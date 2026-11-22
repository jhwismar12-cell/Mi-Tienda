import gc
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

# IMPORTANT: point the backend at a disposable copy of the database BEFORE importing it.
# The tearDown below deletes sales/stock data; it must never run against the real tienda.db.
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_TEST_DB_DIR = tempfile.mkdtemp(prefix="tienda_test_")
_TEST_DB_PATH = os.path.join(_TEST_DB_DIR, "tienda_test.db")
_REAL_DB = os.path.join(_PROJECT_ROOT, "tienda.db")
os.environ["TIENDA_DB_PATH"] = _TEST_DB_PATH

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, get_db, DB_PATH
from backend.auth import reset_all_failures
from backend import database, services

assert os.path.abspath(DB_PATH) != os.path.abspath(_REAL_DB), "Tests must not use the real tienda.db"

class TestTiendaBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _cleanup_test_dir(self):
        gc.collect()
        self.test_dir.cleanup()

    def setUp(self):
        # Each test owns a fresh database; no business database is copied or opened.
        reset_all_failures()
        self.test_dir = tempfile.TemporaryDirectory(prefix="tienda_case_")
        self.addCleanup(self._cleanup_test_dir)
        path = os.path.join(self.test_dir.name, "test.db")
        for module in (database, services):
            db_patch = patch.object(module, "DB_PATH", path)
            db_patch.start()
            self.addCleanup(db_patch.stop)
        init_db()
        with get_db() as conn:
            conn.execute("INSERT INTO PROVEEDORES (IDProveedor, RUC_CI, RazonSocial) VALUES (3, 'TEST-3', 'Proveedor de prueba')")
            for pid, code, name in [(1, "BEB-COC-3000", "Coca-Cola 3L"), (3, "BEB-COC-1350", "Coca-Cola 1.35L"), (4, "BEB-GUI-500", "Guitig 500ml")]:
                conn.execute("UPDATE PRODUCTOS SET CodigoInterno = ?, Nombre = ?, IDProveedor = 1 WHERE IDProducto = ?", (code, name, pid))
        login_res = self.client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        self.assertEqual(login_res.status_code, 200)
        self.client.headers["Authorization"] = f"Bearer {login_res.json()['token']}"
        self.client.post("/api/caja/abrir", json={"monto_inicial": 20.0})

    def test_01_auth_login(self):
        response = self.client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["usuario"]["username"], "admin")

    def test_02_buscar_producto_por_codigo_barras(self):
        response = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNotNone(data["producto"])
        self.assertEqual(data["producto"]["codigo_interno"], "BEB-COC-3000")
        self.assertIn("COCA-COLA", data["producto"]["nombre"].upper())

    def test_03_alta_al_vuelo(self):
        import time
        barcode = f"770{int(time.time()*1000)}"[-13:]
        payload = {
            "nombre": "Galletas Test 36g",
            "codigo_barras": barcode,
            "costo": 0.35,
            "venta": 0.50,
            "id_categoria": 5,
            "stock_inicial": 20
        }
        response = self.client.post("/api/productos/rapido", json=payload)
        self.assertEqual(response.status_code, 200)
        prod = response.json()
        self.assertEqual(prod["nombre"], "Galletas Test 36g")
        self.assertEqual(prod["stock_actual"], 20)

        # Check searching it immediately
        search_res = self.client.get(f"/api/productos/buscar?query={barcode}")
        self.assertEqual(search_res.status_code, 200)
        self.assertIsNotNone(search_res.json()["producto"])

        # Cleanup created product immediately
        with get_db() as conn:
            c = conn.cursor()
            c.execute("DELETE FROM MOVIMIENTOS_INVENTARIO WHERE IDProducto = ?", (prod["id_producto"],))
            c.execute("DELETE FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto = ?", (prod["id_producto"],))
            c.execute("DELETE FROM PRODUCTOS WHERE IDProducto = ?", (prod["id_producto"],))

    def test_04_cobrar_venta_transaccional_acid(self):
        # 1. Purchase 5 units first to ensure positive stock
        search_res = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        prod = search_res.json()["producto"]
        pid = prod["id_producto"]

        self.client.post("/api/compras/registrar", json={
            "id_proveedor": 1,
            "numero_documento": "FAC-TEST-04",
            "items": [{"id_producto": pid, "cantidad": 5, "costo_unitario": 2.07}]
        })

        search_res = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        prod = search_res.json()["producto"]
        initial_stock = prod["stock_actual"]

        # 2. Checkout 1 unit
        payload = {
            "items": [
                {"id_producto": pid, "cantidad": 1, "precio_unitario": prod["precio_venta_actual"]}
            ],
            "metodo_pago": "EFECTIVO",
            "monto_recibido": 10.0
        }
        response = self.client.post("/api/ventas/cobrar", json=payload)
        self.assertEqual(response.status_code, 200)
        venta = response.json()
        self.assertTrue("numero_venta" in venta or "NumeroVenta" in venta)
        
        # 3. Verify stock deducted
        search_res2 = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        prod2 = search_res2.json()["producto"]
        self.assertEqual(prod2["stock_actual"], initial_stock - 1)

        # 4. Verify Kardex has SALIDA_VENTA
        kardex_res = self.client.get(f"/api/inventario/kardex/{pid}")
        self.assertEqual(kardex_res.status_code, 200)
        movements = kardex_res.json()
        self.assertTrue(any(m["tipo_movimiento"] == "SALIDA_VENTA" for m in movements))

    def test_05_recepcion_compras(self):
        # Purchase 5 units of Coca-Cola 1.35L (code BEB-COC-1350)
        search_res = self.client.get("/api/productos/buscar?query=BEB-COC-1350")
        prod = search_res.json()["producto"]
        initial_stock = prod["stock_actual"]
        pid = prod["id_producto"]

        payload = {
            "id_proveedor": 1,
            "numero_documento": "FAC-TEST-999",
            "items": [
                {
                    "id_producto": pid,
                    "cantidad": 5,
                    "costo_unitario": 1.05,
                    "precio_venta_sugerido": 1.50
                }
            ]
        }
        response = self.client.post("/api/compras/registrar", json=payload)
        self.assertEqual(response.status_code, 200)

        # Verify stock incremented and price updated
        search_res2 = self.client.get("/api/productos/buscar?query=BEB-COC-1350")
        prod2 = search_res2.json()["producto"]
        self.assertEqual(prod2["stock_actual"], initial_stock + 5)
        self.assertEqual(prod2["precio_compra_actual"], 1.05)
        self.assertEqual(prod2["precio_venta_actual"], 1.50)

    def test_06_ajuste_inventario_daño(self):
        # First ensure product BEB-GUI-500 has stock 3
        search_res = self.client.get("/api/productos/buscar?query=BEB-GUI-500")
        prod = search_res.json()["producto"]
        pid = prod["id_producto"]

        self.client.post("/api/compras/registrar", json={
            "id_proveedor": 3,
            "numero_documento": "FAC-TEST-06",
            "items": [{"id_producto": pid, "cantidad": 3, "costo_unitario": 0.53}]
        })

        search_res = self.client.get("/api/productos/buscar?query=BEB-GUI-500")
        prod = search_res.json()["producto"]
        initial_stock = prod["stock_actual"]

        payload = {
            "id_producto": pid,
            "tipo_ajuste": "DAÑO",
            "cantidad": 1,
            "motivo": "Botella abollada en bodega"
        }
        response = self.client.post("/api/inventario/ajuste", json=payload)
        self.assertEqual(response.status_code, 200)

        search_res2 = self.client.get("/api/productos/buscar?query=BEB-GUI-500")
        prod2 = search_res2.json()["producto"]
        self.assertEqual(prod2["stock_actual"], initial_stock - 1)

    def test_07_caja_activa_y_arqueo(self):
        response = self.client.get("/api/caja/activa")
        self.assertEqual(response.status_code, 200)
        caja = response.json()
        self.assertIn(caja["estado"], ["ABIERTA", "CERRADA"])

    def test_08_dashboard_kpis(self):
        response = self.client.get("/api/dashboard")
        self.assertEqual(response.status_code, 200)
        dash = response.json()
        self.assertIn("ventas_hoy_total", dash)
        self.assertIn("valor_inventario_costo", dash)
        self.assertIn("valor_inventario_venta", dash)

    def test_09_categorias_y_proveedores(self):
        response = self.client.get("/api/categorias")
        self.assertEqual(response.status_code, 200)
        cats = response.json()
        self.assertGreater(len(cats), 0)

        prov_res = self.client.get("/api/proveedores")
        self.assertEqual(prov_res.status_code, 200)
        provs = prov_res.json()
        self.assertGreater(len(provs), 0)

    def test_10_ai_vision_matching_pipeline(self):
        from backend.ai_vision import match_products_and_supplier
        fake_invoice = {
            "proveedor_nombre": "Bebidas Arca Continental Ecuador Arcardor C.L.",
            "numero_factura": "029-001-001299430",
            "items": [
                {
                    "codigo": "BEB-COC-3000",
                    "nombre": "COCA-COLA E 3000 PET (6)",
                    "cantidad": 5.0,
                    "costo_unitario": 2.07,
                    "descuento": 0.0,
                    "subtotal": 10.33
                },
                {
                    "codigo": "BEB-GUI-500",
                    "nombre": "GUITIG 500 ML PET X 24",
                    "cantidad": 12.0,
                    "costo_unitario": 0.53,
                    "descuento": 0.0,
                    "subtotal": 6.36
                },
                {
                    "codigo": "NEW-PROD-999",
                    "nombre": "Jugo Exótico Nuevo 500ml",
                    "cantidad": 5.0,
                    "costo_unitario": 1.00,
                    "descuento": 0.0,
                    "subtotal": 5.00
                }
            ]
        }
        matched = match_products_and_supplier(fake_invoice)
        self.assertIsNotNone(matched["id_proveedor"])
        self.assertEqual(len(matched["items"]), 3)
        self.assertFalse(matched["items"][0]["es_nuevo"]) # Coca-Cola matched
        self.assertTrue(matched["items"][2]["es_nuevo"])  # New product detected as new

    def test_11_devolucion_producto(self):
        # 1. Product BEB-COC-3000
        search_res = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        prod = search_res.json()["producto"]
        pid = prod["id_producto"]
        st_before = prod["stock_actual"]

        # 2. Register return (+3 units)
        res = self.client.post("/api/inventario/devolucion", json={
            "id_producto": pid,
            "cantidad": 3.0,
            "motivo": "Cliente devolvió 3 botellas selladas",
            "afecta_caja": False
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["nuevo_stock"], st_before + 3.0)

        # 3. Check Kardex
        kardex_res = self.client.get(f"/api/inventario/kardex/{pid}")
        movements = kardex_res.json()
        self.assertTrue(any(m["tipo_movimiento"] == "DEVOLUCION_CLIENTE" for m in movements))

    def test_12_eliminar_movimiento_kardex(self):
        # 1. Product BEB-COC-3000
        search_res = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        prod = search_res.json()["producto"]
        pid = prod["id_producto"]
        st_before = prod["stock_actual"]

        # 2. Create a test positive adjustment (+5 units)
        adj_res = self.client.post("/api/inventario/ajuste", json={
            "id_producto": pid,
            "tipo_ajuste": "AJUSTE_POSITIVO",
            "cantidad": 5.0,
            "motivo": "Ajuste temporal para test"
        })
        self.assertEqual(adj_res.status_code, 200)
        mid = adj_res.json()["id_movimiento"]

        # Verify stock went up by 5
        search_after = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        self.assertEqual(search_after.json()["producto"]["stock_actual"], st_before + 5.0)

        # 3. Delete this movement with stock reversion
        del_res = self.client.delete(f"/api/inventario/movimientos/{mid}?revertir_stock=true")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["success"])

        # 4. Verify stock reverted back to st_before
        search_reverted = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        self.assertEqual(search_reverted.json()["producto"]["stock_actual"], st_before)

    def test_13_proveedores_productos_y_cierre_caja(self):
        # 1. Verify get products returns proveedor_nombre
        res = self.client.get("/api/productos")
        self.assertEqual(res.status_code, 200)
        prods = res.json()
        self.assertGreater(len(prods), 0)
        # Check that products have proveedor_nombre populated
        coca = next((p for p in prods if p["codigo_interno"] == "BEB-COC-3000"), None)
        self.assertIsNotNone(coca)
        self.assertIsNotNone(coca["proveedor_nombre"])
        self.assertIn("Arca Continental", coca["proveedor_nombre"])

        # 2. Test cash register open & close
        self.client.post("/api/caja/cerrar", json={"total_real_entregado": 20.0})
        open_res = self.client.post("/api/caja/abrir", json={"monto_inicial": 25.0, "id_usuario": 1})
        self.assertEqual(open_res.status_code, 200)
        self.assertEqual(open_res.json()["estado"], "ABIERTA")

        # 3. Test closing cash register
        close_res = self.client.post("/api/caja/cerrar", json={"total_real_entregado": 25.0, "observaciones": "Cierre de prueba"})
        self.assertEqual(close_res.status_code, 200)
        self.assertEqual(close_res.json()["estado"], "CERRADA")

    def test_14_agenda_pedidos_flow(self):
        # 1. Find product BEB-COC-3000
        search_res = self.client.get("/api/productos/buscar?query=BEB-COC-3000")
        prod = search_res.json()["producto"]
        pid = prod["id_producto"]
        stock_initial = prod["stock_actual"]

        # 2. Create purchase order for 10 units (Agenda de Pedidos)
        order_payload = {
            "id_proveedor": 1,
            "proveedor_nombre": "Bebidas Arca Continental",
            "fecha_estimada_entrega": "2026-08-28",
            "notas": "Pedido semanal preventista",
            "items": [
                {
                    "id_producto": pid,
                    "cantidad_pedida": 10.0,
                    "costo_estimado": 2.07
                }
            ]
        }
        create_res = self.client.post("/api/pedidos", json=order_payload)
        self.assertEqual(create_res.status_code, 200)
        order = create_res.json()
        oid = order["id_pedido"]
        self.assertEqual(order["estado"], "PENDIENTE")
        self.assertEqual(order["total_unidades"], 10.0)

        # 3. VERIFY CRITICAL CONDITION: Stock has NOT changed
        check_prod = self.client.get("/api/productos/buscar?query=BEB-COC-3000").json()["producto"]
        self.assertEqual(check_prod["stock_actual"], stock_initial)

        # 4. List pending orders
        list_res = self.client.get("/api/pedidos?estado=PENDIENTE")
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(p["id_pedido"] == oid for p in list_res.json()))

        # 5. Receive order with reconciliation (repartidor brought 8 units instead of 10)
        rec_res = self.client.post("/api/compras/registrar", json={
            "id_proveedor": 1,
            "numero_documento": "FAC-ORD-2026",
            "items": [
                {
                    "id_producto": pid,
                    "cantidad": 8.0,
                    "costo_unitario": 2.07
                }
            ]
        })
        self.assertEqual(rec_res.status_code, 200)

        # 6. Mark order as RECIBIDO
        close_ord = self.client.post(f"/api/pedidos/{oid}/recibir", json={"factura_recepcion": "FAC-ORD-2026"})
        self.assertEqual(close_ord.status_code, 200)
        self.assertEqual(close_ord.json()["estado"], "RECIBIDO")

        # 7. Verify stock increased by received quantity (+8)
        final_prod = self.client.get("/api/productos/buscar?query=BEB-COC-3000").json()["producto"]
        self.assertEqual(final_prod["stock_actual"], stock_initial + 8.0)

    def test_15_editar_fondo_inicial_caja(self):
        # 1. Open or ensure cash session
        self.client.post("/api/caja/abrir", json={"monto_inicial": 20.0, "id_usuario": 1})

        # 2. Update initial cash to 50.0
        res = self.client.put("/api/caja/fondo-inicial", json={"monto_inicial": 50.0, "id_usuario": 1})
        self.assertEqual(res.status_code, 200)
        caja = res.json()
        self.assertEqual(caja["monto_inicial"], 50.0)
        self.assertEqual(caja["total_esperado"], 50.0)

        # 3. Verify in dashboard endpoint
        dash = self.client.get("/api/dashboard").json()
        self.assertEqual(dash["caja_activa"]["monto_inicial"], 50.0)

    def test_16_gestion_trabajadores_flow(self):
        # 1. List workers
        res = self.client.get("/api/trabajadores")
        self.assertEqual(res.status_code, 200)
        workers = res.json()
        self.assertGreaterEqual(len(workers), 2)
        admin = next((w for w in workers if w["id_usuario"] == 1), None)
        self.assertIsNotNone(admin)
        self.assertEqual(admin["role_name"], "ADMINISTRADOR")

        # 2. Create a new worker
        post_res = self.client.post("/api/trabajadores", json={
            "nombre_completo": "María Gómez (Turno Tarde)",
            "rol": "CAJERO"
        })
        self.assertEqual(post_res.status_code, 200)
        new_w = post_res.json()
        self.assertEqual(new_w["nombre_completo"], "María Gómez (Turno Tarde)")
        self.assertEqual(new_w["role_name"], "CAJERO")
        wid = new_w["id_usuario"]

        # 3. Verify in list
        workers_after = self.client.get("/api/trabajadores").json()
        self.assertTrue(any(w["id_usuario"] == wid for w in workers_after))

        # 4. Try deleting admin (should fail)
        del_admin = self.client.delete("/api/trabajadores/1")
        self.assertEqual(del_admin.status_code, 400)

        # 5. Delete created worker
        del_res = self.client.delete(f"/api/trabajadores/{wid}")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["success"])

    def test_17_venta_registra_cajero_a_cargo_en_historial(self):
        # 1. Register a sale with a specific cashier name
        sale_payload = {
            "cajero_nombre": "Carlos Ruiz (Turno Noche)",
            "items": [
                {
                    "id_producto": 1,
                    "cantidad": 1.0,
                    "precio_unitario": 3.00,
                    "descuento": 0.0
                }
            ],
            "metodo_pago": "EFECTIVO",
            "monto_recibido": 5.00
        }
        res = self.client.post("/api/ventas/cobrar", json=sale_payload)
        self.assertEqual(res.status_code, 200)
        sale_data = res.json()
        self.assertEqual(sale_data["cajero_nombre"], "Carlos Ruiz (Turno Noche)")
        ticket_num = sale_data["numero_venta"]

        # 2. Check that the sales list endpoint reflects the cashier in charge
        sales_list = self.client.get("/api/ventas?limit=10").json()
        target_sale = next((s for s in sales_list if s["numero_venta"] == ticket_num), None)
        self.assertIsNotNone(target_sale)
        self.assertEqual(target_sale["cajero_nombre"], "Carlos Ruiz (Turno Noche)")

    def sale_payload(self, **updates):
        payload = {"items": [{"id_producto": 1, "cantidad": 1, "precio_unitario": 3}], "metodo_pago": "EFECTIVO", "monto_recibido": 3}
        payload.update(updates)
        return payload

    def test_18_insufficient_cash_rolls_back_everything(self):
        with get_db() as conn:
            before = conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0]
        for cash in (0, 1):
            res = self.client.post("/api/ventas/cobrar", json=self.sale_payload(monto_recibido=cash))
            self.assertEqual(res.status_code, 400)
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM VENTAS").fetchone()[0], 0)
            self.assertEqual(conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0], before)
        self.assertEqual(self.client.get("/api/caja/activa").json()["total_ventas_efectivo"], 0)

    def test_19_close_and_restart_do_not_reopen_cash(self):
        self.client.post("/api/caja/cerrar", json={"total_real_entregado": 20})
        init_db()  # Simulate another backend startup after close.
        self.assertIsNone(self.client.get("/api/caja/activa").json())
        self.assertIsNone(self.client.get("/api/dashboard").json()["caja_activa"])
        self.assertEqual(self.client.post("/api/ventas/cobrar", json=self.sale_payload()).status_code, 400)
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM SESIONES_CAJA").fetchone()[0], 1)
        reopened = self.client.post("/api/caja/abrir", json={"monto_inicial": 7}).json()
        self.assertEqual(reopened["monto_inicial"], 7)

    def test_20_concurrent_duplicate_checkout_is_applied_once(self):
        payload = self.sale_payload(clave_idempotencia="same-checkout")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.client.post("/api/ventas/cobrar", json=payload), range(2)))
        self.assertEqual([r.status_code for r in results], [200, 200])
        self.assertEqual(results[0].json(), results[1].json())
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM VENTAS").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0], 1)
        self.assertEqual(self.client.get("/api/caja/activa").json()["total_ventas_efectivo"], 3)
        self.client.post("/api/caja/cerrar", json={"total_real_entregado": 23})
        self.assertEqual(self.client.post("/api/ventas/cobrar", json=payload).json(), results[0].json())

    def test_21_idempotency_key_cannot_be_reused_for_different_sale(self):
        first = self.client.post("/api/ventas/cobrar", json=self.sale_payload(clave_idempotencia="key"))
        self.assertEqual(first.status_code, 200)
        changed = self.sale_payload(clave_idempotencia="key", monto_recibido=5)
        self.assertEqual(self.client.post("/api/ventas/cobrar", json=changed).status_code, 400)

    def test_22_refund_updates_stock_cash_and_movement_atomically(self):
        res = self.client.post("/api/inventario/devolucion", json={"id_producto": 1, "cantidad": 1, "afecta_caja": True, "monto_devolucion": 3})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["nuevo_stock"], 3)
        cash = self.client.get("/api/caja/activa").json()
        self.assertEqual(cash["total_retiros"], 3)
        self.assertEqual(cash["total_esperado"], 17)
        self.assertTrue(any(m["tipo"] == "RETIRO" and m["monto"] == 3 for m in cash["movimientos"]))

    def test_23_refund_without_cash_session_has_no_partial_effect(self):
        self.client.post("/api/caja/cerrar", json={"total_real_entregado": 20})
        res = self.client.post("/api/inventario/devolucion", json={"id_producto": 1, "cantidad": 1, "afecta_caja": True, "monto_devolucion": 3})
        self.assertEqual(res.status_code, 400)
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0], 2)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM MOVIMIENTOS_INVENTARIO WHERE TipoMovimiento = 'DEVOLUCION_CLIENTE'").fetchone()[0], 0)
        self.assertIsNone(self.client.get("/api/caja/activa").json())

    def test_24_repeated_purchase_lines_accumulate_and_preserve_supplier(self):
        res = self.client.post("/api/compras/registrar", json={
            "id_proveedor": 3, "numero_documento": "REPEATED", "items": [
                {"id_producto": 1, "cantidad": 2, "costo_unitario": 2},
                {"codigo": "BEB-COC-3000", "cantidad": 3, "costo_unitario": 2.5}
            ]})
        self.assertEqual(res.status_code, 200, res.text)
        self.assertEqual(res.json()["id_proveedor"], 3)
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0], 7)
            balances = conn.execute("SELECT StockAnterior, StockPosterior FROM MOVIMIENTOS_INVENTARIO WHERE ReferenciaID = 'REPEATED' ORDER BY IDMovimiento").fetchall()
            self.assertEqual([tuple(r) for r in balances], [(2, 4), (4, 7)])
        self.assertEqual(self.client.get("/api/compras").json()[0]["proveedor_nombre"], "Proveedor de prueba")

    def test_25_repeated_sale_lines_and_zero_stock_allowed(self):
        payload = self.sale_payload(items=[{"id_producto": 1, "cantidad": 1, "precio_unitario": 3}] * 2, monto_recibido=6)
        self.assertEqual(self.client.post("/api/ventas/cobrar", json=payload).status_code, 200)
        # Selling when stock is already 0 is allowed and clamps StockActual to 0
        self.assertEqual(self.client.post("/api/ventas/cobrar", json=self.sale_payload()).status_code, 200)
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0], 0)
            balances = conn.execute("SELECT StockAnterior, StockPosterior FROM MOVIMIENTOS_INVENTARIO WHERE TipoMovimiento = 'SALIDA_VENTA' ORDER BY IDMovimiento").fetchall()
            self.assertEqual([tuple(r) for r in balances], [(2, 1), (1, 0), (0, 0)])

    def test_26_editing_opening_float_preserves_deposits(self):
        self.client.post("/api/caja/movimiento", json={"tipo": "INGRESO", "monto": 5, "descripcion": "Cambio"})
        cash = self.client.put("/api/caja/fondo-inicial", json={"monto_inicial": 30}).json()
        self.assertEqual(cash["total_esperado"], 35)
        self.assertTrue(any(m["tipo"] == "INGRESO" and m["monto"] == 5 for m in cash["movimientos"]))

    def test_27_closed_session_rejects_movements_and_float_changes(self):
        self.client.post("/api/caja/cerrar", json={"total_real_entregado": 20})
        self.assertEqual(self.client.post("/api/caja/movimiento", json={"tipo": "INGRESO", "monto": 5, "descripcion": "Cambio"}).status_code, 400)
        self.assertEqual(self.client.put("/api/caja/fondo-inicial", json={"monto_inicial": 30}).status_code, 400)
        self.assertIsNone(self.client.get("/api/caja/activa").json())

    def test_28_opening_another_session_does_not_close_existing_one(self):
        self.assertEqual(self.client.post("/api/caja/abrir", json={"monto_inicial": 7}).status_code, 400)
        self.assertEqual(self.client.get("/api/caja/activa").json()["monto_inicial"], 20)

    def test_29_schema_upgrade_preserves_existing_data_and_closed_session(self):
        self.client.post("/api/caja/cerrar", json={"total_real_entregado": 20})
        with get_db() as conn:
            conn.execute("DROP TABLE COBROS_IDEMPOTENTES")
            conn.execute("DROP TABLE MOVIMIENTOS_CAJA")
        init_db()
        init_db()
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM PRODUCTOS").fetchone()[0], 13)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM SESIONES_CAJA").fetchone()[0], 1)
            self.assertEqual(conn.execute("SELECT Estado FROM SESIONES_CAJA").fetchone()[0], "CERRADA")
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM MOVIMIENTOS_CAJA").fetchone()[0], 0)

    def test_30_refund_rolls_back_if_cash_movement_cannot_be_written(self):
        with get_db() as conn:
            conn.execute("CREATE TRIGGER fail_refund BEFORE INSERT ON MOVIMIENTOS_CAJA BEGIN SELECT RAISE(ABORT, 'cash write failed'); END")
        res = self.client.post("/api/inventario/devolucion", json={"id_producto": 1, "cantidad": 1, "afecta_caja": True, "monto_devolucion": 3})
        self.assertEqual(res.status_code, 400)
        with get_db() as conn:
            self.assertEqual(conn.execute("SELECT StockActual FROM PRODUCTOS WHERE IDProducto = 1").fetchone()[0], 2)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM MOVIMIENTOS_INVENTARIO WHERE TipoMovimiento = 'DEVOLUCION_CLIENTE'").fetchone()[0], 0)
        self.assertEqual(self.client.get("/api/caja/activa").json()["total_esperado"], 20)

    def test_31_seguridad_y_usuarios_nuevas_tiendas(self):
        # 1. Endpoint sin token debe ser rechazado con 401
        unauth_client = TestClient(app)
        self.assertEqual(unauth_client.get("/api/productos").status_code, 401)
        self.assertEqual(unauth_client.get("/api/health").status_code, 200)

        # 2. Claves privadas ocultas en /api/configuracion
        cfg = self.client.get("/api/configuracion").json()
        self.assertNotIn("SECRET_KEY", cfg)
        self.assertNotIn("GEMINI_API_KEY", cfg)

        # 3. Crear trabajador SIN contraseña (solo a cargo) vs CON contraseña (puede iniciar sesión)
        w_nologin = self.client.post("/api/trabajadores", json={
            "nombre_completo": "Pedro Turno Dia",
            "rol": "CAJERO",
            "username": "pedro_dia"
        }).json()
        self.assertFalse(w_nologin["puede_iniciar_sesion"])
        self.assertEqual(
            unauth_client.post("/api/auth/login", json={"username": "pedro_dia", "password": "CualquierClave123"}).status_code,
            401
        )

        w_login = self.client.post("/api/trabajadores", json={
            "nombre_completo": "Ana Cajera",
            "rol": "CAJERO",
            "username": "ana_caja",
            "password": "ClaveSeguraAna2026"
        }).json()
        self.assertTrue(w_login["puede_iniciar_sesion"])
        ana_login = unauth_client.post("/api/auth/login", json={"username": "ana_caja", "password": "ClaveSeguraAna2026"})
        self.assertEqual(ana_login.status_code, 200)
        ana_token = ana_login.json()["token"]
        self.assertFalse(ana_login.json()["usuario"]["debe_cambiar_clave"])

        # 4. Cajera puede consultar productos pero NO eliminar trabajadores (403)
        ana_headers = {"Authorization": f"Bearer {ana_token}"}
        self.assertEqual(unauth_client.get("/api/productos", headers=ana_headers).status_code, 200)
        self.assertEqual(unauth_client.delete(f"/api/trabajadores/{w_nologin['id_usuario']}", headers=ana_headers).status_code, 403)

        # 5. Asignar contraseña a Pedro y verificar que ahora sí inicia sesión
        assign_res = self.client.put(
            f"/api/trabajadores/{w_nologin['id_usuario']}/clave",
            json={"password": "PedroClaveNueva99"}
        )
        self.assertEqual(assign_res.status_code, 200)
        self.assertEqual(
            unauth_client.post("/api/auth/login", json={"username": "pedro_dia", "password": "PedroClaveNueva99"}).status_code,
            200
        )

        # 6. Eliminar a Ana revoca su token inmediatamente
        self.assertEqual(self.client.delete(f"/api/trabajadores/{w_login['id_usuario']}").status_code, 200)
        self.assertEqual(unauth_client.get("/api/productos", headers=ana_headers).status_code, 401)

        # 7. Cambiar contraseña de admin invalida el token anterior y limpia debe_cambiar_clave
        old_admin_token = self.client.headers["Authorization"]
        chg_res = self.client.post("/api/auth/cambiar-clave", json={
            "clave_actual": "admin123",
            "clave_nueva": "MiTiendaSegura2026!"
        })
        self.assertEqual(chg_res.status_code, 200)
        new_admin_token = chg_res.json()["token"]
        self.assertFalse(chg_res.json()["usuario"]["debe_cambiar_clave"])
        self.assertEqual(unauth_client.get("/api/auth/me", headers={"Authorization": old_admin_token}).status_code, 401)
        self.client.headers["Authorization"] = f"Bearer {new_admin_token}"
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)

        # 8. Bloqueo por fuerza bruta tras 5 intentos fallidos
        for _ in range(5):
            self.assertEqual(
                unauth_client.post("/api/auth/login", json={"username": "usuario_ataque", "password": "mal"}).status_code,
                401
            )
        self.assertEqual(
            unauth_client.post("/api/auth/login", json={"username": "usuario_ataque", "password": "mal"}).status_code,
            429
        )

    def test_32_vercel_entrypoint_y_supabase_sync(self):
        # 1. Verifica que api/index.py expone la app FastAPI para Vercel
        import api.index as vercel_entry
        self.assertIs(vercel_entry.app, app)

        # 2. Verifica empaquetado de snapshot y actualizacion de version en Supabase Sync (sin red real)
        from backend import supabase_sync
        called_rpcs = []

        def fake_rpc(fn_name, payload, timeout=8.0):
            called_rpcs.append((fn_name, payload))
            if fn_name == "guardar_estado_tienda":
                return {"ok": True, "version": 7}
            if fn_name == "obtener_version_tienda":
                return {"found": True, "version": 7}
            return {}

        with patch.dict(os.environ, {
            "SUPABASE_URL": "https://ejemplo.supabase.co",
            "SUPABASE_KEY": "sb_publishable_demo",
            "SUPABASE_SYNC_SECRET": "secreto_test",
            "TIENDA_SLUG": "Tienda Norte 01"
        }):
            self.assertEqual(supabase_sync.get_store_slug(), "tienda-norte-01")
            with patch.object(supabase_sync, "_rpc_call", side_effect=fake_rpc):
                ok = supabase_sync.push_db_to_supabase(services.DB_PATH)
                self.assertTrue(ok)
                self.assertEqual(called_rpcs[0][0], "guardar_estado_tienda")
                self.assertEqual(called_rpcs[0][1]["p_slug"], "tienda-norte-01")
                self.assertGreaterEqual(len(called_rpcs[0][1]["p_usuarios"]), 2)
                # Version local queda en 7, asi que pull_if_newer no descarga redundante
                self.assertFalse(supabase_sync.pull_if_newer(services.DB_PATH))

    def test_33_granel_combos_stock_estricto_y_actualizacion(self):
        # 1. Crear producto a granel sin codigo de barras (Arroz 0.50/lb, stock 10.0)
        arroz_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "codigo_interno": "GRN-ARR-TEST",
            "nombre": "Arroz Maraqueño Test",
            "unidad_medida": "LIBRA",
            "permite_fraccion": True,
            "precio_compra_actual": 0.35,
            "precio_venta_actual": 0.50,
            "stock_minimo": 5.0,
            "stock_inicial": 10.0,
            "codigos_barras": []
        })
        self.assertEqual(arroz_res.status_code, 200)
        arroz = arroz_res.json()
        self.assertEqual(arroz["unidad_medida"], "LIBRA")
        self.assertTrue(arroz["permite_fraccion"])
        self.assertEqual(arroz["codigos_barras"], [])

        # 2. Crear producto con combo y stock 0 estricto (Huevo 0.15 c/u o Promo: 6 x $1.00)
        huevo_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "codigo_interno": "GRN-HUV-TEST",
            "nombre": "Huevo Test",
            "descripcion": "Promo: 6 x $1.00",
            "unidad_medida": "UNIDAD",
            "permite_fraccion": False,
            "precio_compra_actual": 0.11,
            "precio_venta_actual": 0.15,
            "stock_minimo": 12.0,
            "stock_inicial": 0.0,
            "codigos_barras": []
        })
        self.assertEqual(huevo_res.status_code, 200)
        huevo = huevo_res.json()

        # 3. Usar caja activa (o abrir si esta cerrada) y validar venta permitida con stock 0 (clamp a 0)
        caja_activa = self.client.get("/api/caja/activa")
        if caja_activa.status_code == 200 and caja_activa.json() and caja_activa.json().get("estado") == "ABIERTA":
            id_caja = caja_activa.json()["id_sesion_caja"]
        else:
            caja_res = self.client.post("/api/caja/abrir", json={"monto_inicial": 20.0, "cajero_nombre": "Admin"})
            self.assertEqual(caja_res.status_code, 200)
            id_caja = caja_res.json()["id_sesion_caja"]

        zero_stock_sale = self.client.post("/api/ventas/cobrar", json={
            "id_sesion_caja": id_caja,
            "items": [{"id_producto": huevo["id_producto"], "cantidad": 1, "precio_unitario": 0.15}],
            "metodo_pago": "EFECTIVO",
            "monto_recibido": 1.0
        })
        self.assertEqual(zero_stock_sale.status_code, 200)
        prods_mid = {p["id_producto"]: p for p in self.client.get("/api/productos").json()}
        self.assertAlmostEqual(prods_mid[huevo["id_producto"]]["stock_actual"], 0.0, places=3)

        # 4. Ajustar stock decimal (+2.5 lb arroz) y +7 huevos, luego cobrar fraccion + combo + suelto
        adj_arroz = self.client.post("/api/inventario/ajuste", json={
            "id_producto": arroz["id_producto"],
            "tipo_ajuste": "AJUSTE_POSITIVO",
            "cantidad": 2.5,
            "motivo": "Prueba fraccion"
        })
        self.assertEqual(adj_arroz.status_code, 200)
        self.assertAlmostEqual(adj_arroz.json()["stock_posterior"], 12.5, places=3)

        adj_huevo = self.client.post("/api/inventario/ajuste", json={
            "id_producto": huevo["id_producto"],
            "tipo_ajuste": "AJUSTE_POSITIVO",
            "cantidad": 7,
            "motivo": "Ingreso inicial"
        })
        self.assertEqual(adj_huevo.status_code, 200)

        sale_res = self.client.post("/api/ventas/cobrar", json={
            "id_sesion_caja": id_caja,
            "items": [
                {"id_producto": arroz["id_producto"], "cantidad": 0.5, "precio_unitario": 0.50},
                {"id_producto": huevo["id_producto"], "cantidad": 1, "precio_unitario": 0.15},
                {"id_producto": huevo["id_producto"], "cantidad": 6, "precio_unitario": round(1.0 / 6.0, 6)},
            ],
            "metodo_pago": "EFECTIVO",
            "monto_recibido": 2.0
        })
        self.assertEqual(sale_res.status_code, 200)
        self.assertAlmostEqual(sale_res.json()["total"], 1.40, places=2)

        # Verificar stock actualizado tras descuento fraccionario y combo
        prods = {p["id_producto"]: p for p in self.client.get("/api/productos").json()}
        self.assertAlmostEqual(prods[arroz["id_producto"]]["stock_actual"], 12.0, places=3)
        self.assertAlmostEqual(prods[huevo["id_producto"]]["stock_actual"], 0.0, places=3)

        # 5. Actualizar unidad_medida, permite_fraccion y descripcion via PUT
        upd_res = self.client.put(f"/api/productos/{huevo['id_producto']}", json={
            "descripcion": "Promo: 6 x $1.00 | Cartón $4.20",
            "unidad_medida": "UNIDAD",
            "permite_fraccion": False
        })
        self.assertEqual(upd_res.status_code, 200)
        self.assertEqual(upd_res.json()["descripcion"], "Promo: 6 x $1.00 | Cartón $4.20")

    def test_21_crear_proveedor_y_producto_con_distribuidor(self):
        # Reject blank name cleanly
        bad_res = self.client.post("/api/proveedores", json={"ruc_ci": "", "razon_social": "   "})
        self.assertEqual(bad_res.status_code, 400)

        # Create provider with optional empty ruc_ci
        prov_res = self.client.post("/api/proveedores", json={
            "ruc_ci": "",
            "razon_social": "Distribuidora Escolar Prueba",
            "telefono": "0991234567"
        })
        self.assertEqual(prov_res.status_code, 200)
        prov = prov_res.json()
        self.assertEqual(prov["razon_social"], "Distribuidora Escolar Prueba")
        self.assertTrue(prov["ruc_ci"].startswith("RUC-"))

        # Create product linked to new provider and confirm proveedor_nombre comes back
        prod_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": prov["id_proveedor"],
            "codigo_interno": "DIST-TEST-01",
            "nombre": "Borrador Blanco",
            "precio_compra_actual": 0.15,
            "precio_venta_actual": 0.30,
            "stock_inicial": 20,
            "codigos_barras": []
        })
        self.assertEqual(prod_res.status_code, 200)
        created = prod_res.json()
        self.assertEqual(created["id_proveedor"], prov["id_proveedor"])
        self.assertEqual(created["proveedor_nombre"], "Distribuidora Escolar Prueba")

        # Update name & switch to another provider, then explicitly clear provider with null
        prov2_res = self.client.post("/api/proveedores", json={
            "ruc_ci": "",
            "razon_social": "Distribuidora Secundaria"
        })
        self.assertEqual(prov2_res.status_code, 200)
        prov2_id = prov2_res.json()["id_proveedor"]

        upd1 = self.client.put(f"/api/productos/{created['id_producto']}", json={
            "nombre": "Borrador Escolar Grande",
            "id_proveedor": prov2_id
        })
        self.assertEqual(upd1.status_code, 200)
        self.assertEqual(upd1.json()["nombre"], "Borrador Escolar Grande")
        self.assertEqual(upd1.json()["id_proveedor"], prov2_id)
        self.assertEqual(upd1.json()["proveedor_nombre"], "Distribuidora Secundaria")

        # Partial update without id_proveedor preserves existing provider
        upd2 = self.client.put(f"/api/productos/{created['id_producto']}", json={
            "precio_venta_actual": 0.35
        })
        self.assertEqual(upd2.status_code, 200)
        self.assertEqual(upd2.json()["id_proveedor"], prov2_id)

        # Explicit null id_proveedor clears distributor
        upd3 = self.client.put(f"/api/productos/{created['id_producto']}", json={
            "id_proveedor": None
        })
        self.assertEqual(upd3.status_code, 200)
        self.assertIsNone(upd3.json()["id_proveedor"])
        self.assertIsNone(upd3.json()["proveedor_nombre"])

    def test_21_editar_proveedor_y_eliminar_producto_de_raiz(self):
        # 1. Create distributor & linked product with barcode
        prov_res = self.client.post("/api/proveedores", json={
            "razon_social": "Distribuidora Original S.A.",
            "telefono": "099111222"
        })
        self.assertEqual(prov_res.status_code, 200)
        pid = prov_res.json()["id_proveedor"]

        prod_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": pid,
            "codigo_interno": "RAIZ-001",
            "nombre": "Producto Prueba Raiz",
            "precio_compra_actual": 1.0,
            "precio_venta_actual": 1.5,
            "stock_inicial": 5,
            "codigos_barras": ["7869990001112"]
        })
        self.assertEqual(prod_res.status_code, 200)
        prod_id = prod_res.json()["id_producto"]

        # 2. Rename distributor -> rejects empty/duplicate and updates products on success
        bad_empty = self.client.put(f"/api/proveedores/{pid}", json={"razon_social": "   "})
        self.assertEqual(bad_empty.status_code, 400)

        ren_res = self.client.put(f"/api/proveedores/{pid}", json={
            "razon_social": "Distribuidora Renombrada",
            "telefono": "099888777"
        })
        self.assertEqual(ren_res.status_code, 200)
        self.assertEqual(ren_res.json()["razon_social"], "Distribuidora Renombrada")
        self.assertEqual(ren_res.json()["telefono"], "099888777")

        all_prods = {p["id_producto"]: p for p in self.client.get("/api/productos").json()}
        self.assertEqual(all_prods[prod_id]["proveedor_nombre"], "Distribuidora Renombrada")

        # 3. Root deletion when no sales/purchases exist -> completely removed from DB
        del_res = self.client.delete(f"/api/productos/{prod_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["deleted_permanently"])

        all_after = {p["id_producto"]: p for p in self.client.get("/api/productos").json()}
        self.assertNotIn(prod_id, all_after)
        search_after = self.client.get("/api/productos/buscar?query=7869990001112").json()
        self.assertIsNone(search_after["producto"])

        # 4. If product HAS sales history -> deactivates & excludes from active listings/search
        self.client.post("/api/compras/registrar", json={
            "id_proveedor": 1,
            "numero_documento": "FAC-HIST-1",
            "items": [{"id_producto": 1, "cantidad": 2, "costo_unitario": 2.0}]
        })
        del_coca = self.client.post("/api/ventas/cobrar", json={
            "metodo_pago": "EFECTIVO",
            "monto_recibido": 10.0,
            "items": [{"id_producto": 1, "cantidad": 1, "precio_unitario": 3.0}]
        })
        self.assertEqual(del_coca.status_code, 200)

        del_sold = self.client.delete("/api/productos/1")
        self.assertEqual(del_sold.status_code, 200)
        self.assertFalse(del_sold.json()["deleted_permanently"])
        active_ids = {p["id_producto"] for p in self.client.get("/api/productos").json()}
        self.assertNotIn(1, active_ids)
        search_sold = self.client.get("/api/productos/buscar?query=BEB-COC-3000").json()
        self.assertIsNone(search_sold["producto"])

    def test_22_eliminar_distribuidor_y_sus_productos(self):
        # 1. Distributor without transaction history: deletes both distributor and all products permanently
        prov1_res = self.client.post("/api/proveedores", json={"razon_social": "Distribuidora Temporal"})
        self.assertEqual(prov1_res.status_code, 200)
        pid1 = prov1_res.json()["id_proveedor"]

        p1_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": pid1,
            "codigo_interno": "TMP-01",
            "nombre": "Producto Temp 1",
            "precio_compra_actual": 1.0,
            "precio_venta_actual": 2.0,
            "stock_inicial": 4,
            "stock_minimo": 1,
            "codigos_barras": ["7868880001111"],
        })
        self.assertEqual(p1_res.status_code, 200)
        p1 = p1_res.json()["id_producto"]

        p2_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": pid1,
            "codigo_interno": "TMP-02",
            "nombre": "Producto Temp 2",
            "precio_compra_actual": 1.5,
            "precio_venta_actual": 3.0,
            "stock_inicial": 2,
            "stock_minimo": 1,
            "codigos_barras": ["7868880002222"],
        })
        self.assertEqual(p2_res.status_code, 200)
        p2 = p2_res.json()["id_producto"]

        del1 = self.client.delete(f"/api/proveedores/{pid1}")
        self.assertEqual(del1.status_code, 200)
        body1 = del1.json()
        self.assertTrue(body1["success"])
        self.assertEqual(body1["deleted_products_permanently"], 2)
        self.assertEqual(body1["archived_products"], 0)
        self.assertEqual(body1["total_products_removed"], 2)
        self.assertTrue(body1["provider_deleted_permanently"])

        prov_ids_after = {pr["id_proveedor"] for pr in self.client.get("/api/proveedores").json()}
        self.assertNotIn(pid1, prov_ids_after)
        prod_ids_after = {pr["id_producto"] for pr in self.client.get("/api/productos").json()}
        self.assertNotIn(p1, prod_ids_after)
        self.assertNotIn(p2, prod_ids_after)
        self.assertIn(1, prod_ids_after)
        self.assertIsNone(self.client.get("/api/productos/buscar?query=7868880001111").json()["producto"])

        # 2. Distributor WITH purchase history: keeps receipts intact while removing all products & hiding provider
        prov2_res = self.client.post("/api/proveedores", json={"razon_social": "Distribuidora Historial"})
        self.assertEqual(prov2_res.status_code, 200)
        pid2 = prov2_res.json()["id_proveedor"]

        p_hist_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": pid2,
            "codigo_interno": "HIS-01",
            "nombre": "Producto Con Compra",
            "precio_compra_actual": 2.0,
            "precio_venta_actual": 4.0,
            "stock_inicial": 0,
            "stock_minimo": 1,
            "codigos_barras": ["7868880003333"],
        })
        self.assertEqual(p_hist_res.status_code, 200)
        p_hist = p_hist_res.json()["id_producto"]

        p_fresh_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": pid2,
            "codigo_interno": "HIS-02",
            "nombre": "Producto Sin Compra",
            "precio_compra_actual": 2.5,
            "precio_venta_actual": 5.0,
            "stock_inicial": 1,
            "stock_minimo": 1,
            "codigos_barras": ["7868880004444"],
        })
        self.assertEqual(p_fresh_res.status_code, 200)
        p_fresh = p_fresh_res.json()["id_producto"]

        buy_res = self.client.post("/api/compras/registrar", json={
            "id_proveedor": pid2,
            "numero_documento": "FAC-DELPROV-1",
            "items": [{"id_producto": p_hist, "cantidad": 3, "costo_unitario": 2.0}]
        })
        self.assertEqual(buy_res.status_code, 200)

        del2 = self.client.delete(f"/api/proveedores/{pid2}")
        self.assertEqual(del2.status_code, 200)
        body2 = del2.json()
        self.assertTrue(body2["success"])
        self.assertEqual(body2["deleted_products_permanently"], 1)
        self.assertEqual(body2["archived_products"], 1)
        self.assertEqual(body2["total_products_removed"], 2)
        self.assertFalse(body2["provider_deleted_permanently"])

        prov_ids_final = {pr["id_proveedor"] for pr in self.client.get("/api/proveedores").json()}
        self.assertNotIn(pid2, prov_ids_final)
        prod_ids_final = {pr["id_producto"] for pr in self.client.get("/api/productos").json()}
        self.assertNotIn(p_hist, prod_ids_final)
        self.assertNotIn(p_fresh, prod_ids_final)

    def test_23_costos_cuatro_decimales_en_productos_y_compras(self):
        # 1. Create product with 4-decimal cost ($1.3043) -> stored and returned intact
        prod_res = self.client.post("/api/productos", json={
            "id_categoria": 1,
            "id_proveedor": 1,
            "codigo_interno": "DEC4-001",
            "nombre": "Producto Cuatro Decimales",
            "precio_compra_actual": 1.3043,
            "precio_venta_actual": 2.00,
            "stock_inicial": 0,
            "stock_minimo": 2,
            "codigos_barras": ["7941660072551"]
        })
        self.assertEqual(prod_res.status_code, 200)
        pid = prod_res.json()["id_producto"]
        self.assertAlmostEqual(prod_res.json()["precio_compra_actual"], 1.3043, places=4)

        # 2. Update cost via PUT to another 4-decimal cost ($0.4348)
        upd_res = self.client.put(f"/api/productos/{pid}", json={"precio_compra_actual": 0.4348})
        self.assertEqual(upd_res.status_code, 200)
        self.assertAlmostEqual(upd_res.json()["precio_compra_actual"], 0.4348, places=4)

        # 3. Purchase 20 units at $1.3043 -> subtotal preserves 26.086 and total reflects $26.09 weight
        buy_res = self.client.post("/api/compras/registrar", json={
            "id_proveedor": 1,
            "numero_documento": "FAC-DEC4-20",
            "items": [{
                "id_producto": pid,
                "codigo": "DEC4-001",
                "nombre": "Producto Cuatro Decimales",
                "cantidad": 20,
                "costo_unitario": 1.3043,
                "precio_venta_sugerido": 2.00
            }]
        })
        self.assertEqual(buy_res.status_code, 200)
        compra = buy_res.json()
        self.assertAlmostEqual(compra["total"], 26.09, places=2)
        self.assertAlmostEqual(compra["items"][0]["costo_unitario"], 1.3043, places=4)
        self.assertAlmostEqual(compra["items"][0]["subtotal"], 26.086, places=3)

        all_after = {p["id_producto"]: p for p in self.client.get("/api/productos").json()}
        self.assertAlmostEqual(all_after[pid]["precio_compra_actual"], 1.3043, places=4)

    def test_31_kardex_pvp_y_eliminar_retiro_caja(self):
        # Ensure active cash session
        if not self.client.get("/api/caja/activa").json():
            open_res = self.client.post("/api/caja/abrir", json={"monto_inicial": 30.0, "id_usuario": 1})
            self.assertEqual(open_res.status_code, 200)
        shift_before = self.client.get("/api/caja/activa").json()
        expected_before = float(shift_before["total_esperado"])
        retiros_before = float(shift_before["total_retiros"])

        # 1. Register a cash withdrawal for purchases ($12.50)
        ret_res = self.client.post("/api/caja/movimiento", json={
            "tipo": "RETIRO",
            "monto": 12.50,
            "descripcion": "Compra de mercadería"
        })
        self.assertEqual(ret_res.status_code, 200)
        shift_after_ret = ret_res.json()
        self.assertAlmostEqual(shift_after_ret["total_retiros"], retiros_before + 12.50, places=2)
        self.assertAlmostEqual(shift_after_ret["total_esperado"], expected_before - 12.50, places=2)

        # Find the created withdrawal movement ID (c-<id>)
        mov = next((m for m in shift_after_ret["movimientos"] if m["tipo"] == "RETIRO" and m["descripcion"] == "Compra de mercadería"), None)
        self.assertIsNotNone(mov)
        mov_id = int(mov["id"].replace("c-", ""))

        # 2. Delete the withdrawal and verify caja balances back cleanly
        del_res = self.client.delete(f"/api/caja/movimiento/{mov_id}")
        self.assertEqual(del_res.status_code, 200)
        shift_restored = del_res.json()
        self.assertAlmostEqual(shift_restored["total_retiros"], retiros_before, places=2)
        self.assertAlmostEqual(shift_restored["total_esperado"], expected_before, places=2)

        # 3. Verify Kardex returns precio_venta_unitario on sale & non-sale movements
        prod = self.client.get("/api/productos/buscar?query=BEB-COC-3000").json()["producto"]
        pid = prod["id_producto"]
        sale_res = self.client.post("/api/ventas/cobrar", json={
            "metodo_pago": "EFECTIVO",
            "monto_recibido": 10.0,
            "items": [{"id_producto": pid, "cantidad": 2.0, "precio_unitario": 2.75}]
        })
        self.assertEqual(sale_res.status_code, 200)

        kardex = self.client.get(f"/api/inventario/kardex/{pid}").json()
        self.assertGreater(len(kardex), 0)
        latest = kardex[0]
        self.assertIn("precio_venta_unitario", latest)
        self.assertAlmostEqual(float(latest["precio_venta_unitario"]), 2.75, places=2)

if __name__ == "__main__":
    unittest.main()

