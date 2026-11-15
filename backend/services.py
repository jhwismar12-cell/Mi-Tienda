import sqlite3
import gzip
import shutil
import os
import hashlib
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.database import get_db, DB_PATH, PROJECT_ROOT, get_backup_dir
from backend.auth import hash_password, unusable_password, validate_new_password
from backend.models import (
    ProductoOut, ProductoCreate, ProductoUpdate, ProductoRapidoRequest,
    VentaCobrarRequest, VentaOut, VentaDetalleOut,
    CompraRegistrarRequest, CompraOut, CompraDetalleOut,
    AjusteInventarioRequest, KardexMovimientoOut,
    CajaAbrirRequest, CajaCerrarRequest, CajaMovimientoRequest,
    SesionCajaOut, CashMovementItem, DashboardKPIsOut, HourlySalesItem,
    BackupResponse,
    PedidoCreateRequest, PedidoUpdateRequest, PedidoOut, PedidoDetalleOut,
    TrabajadorOut, TrabajadorCreate
)

# --- Product Services ---
def get_all_products() -> List[ProductoOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT p.*, c.Nombre as CategoriaNombre, pr.RazonSocial as ProveedorNombre 
               FROM PRODUCTOS p 
               LEFT JOIN CATEGORIAS c ON p.IDCategoria = c.IDCategoria
               LEFT JOIN PROVEEDORES pr ON p.IDProveedor = pr.IDProveedor
               WHERE p.Activo = 1
               ORDER BY p.Nombre ASC"""
        )
        rows = cursor.fetchall()
        
        # Fetch barcodes
        cursor.execute("SELECT IDProducto, CodigoBarras FROM PRODUCTO_CODIGOS_BARRAS")
        barcode_rows = cursor.fetchall()
        barcode_map: Dict[int, List[str]] = {}
        for b in barcode_rows:
            barcode_map.setdefault(b["IDProducto"], []).append(b["CodigoBarras"])

        result = []
        for r in rows:
            pid = r["IDProducto"]
            result.append(
                ProductoOut(
                    id_producto=pid,
                    id_categoria=r["IDCategoria"],
                    categoria_nombre=r["CategoriaNombre"],
                    id_proveedor=r["IDProveedor"] if "IDProveedor" in r.keys() else None,
                    proveedor_nombre=r["ProveedorNombre"] if "ProveedorNombre" in r.keys() else None,
                    codigo_interno=r["CodigoInterno"],
                    nombre=r["Nombre"],
                    descripcion=r["Descripcion"],
                    marca=r["Marca"],
                    unidad_medida=r["UnidadMedida"],
                    precio_compra_actual=float(r["PrecioCompraActual"]),
                    precio_venta_actual=float(r["PrecioVentaActual"]),
                    margen_minimo_porcentaje=float(r["MargenMinimoPorcentaje"]),
                    stock_minimo=float(r["StockMinimo"]),
                    stock_actual=float(r["StockActual"]),
                    permite_fraccion=bool(r["PermiteFraccion"]),
                    activo=bool(r["Activo"]),
                    codigos_barras=barcode_map.get(pid, []),
                    fecha_modificacion=str(r["FechaModificacion"])
                )
            )
        return result

def buscar_productos(query: str) -> List[ProductoOut]:
    query_str = query.strip()
    if not query_str:
        return get_all_products()

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT DISTINCT p.*, c.Nombre as CategoriaNombre, pr.RazonSocial as ProveedorNombre 
               FROM PRODUCTOS p
               LEFT JOIN CATEGORIAS c ON p.IDCategoria = c.IDCategoria
               LEFT JOIN PROVEEDORES pr ON p.IDProveedor = pr.IDProveedor
               LEFT JOIN PRODUCTO_CODIGOS_BARRAS b ON p.IDProducto = b.IDProducto
               WHERE p.Activo = 1
                 AND (
                   p.CodigoInterno = ? 
                   OR b.CodigoBarras = ?
                   OR p.Nombre LIKE ? 
                   OR p.CodigoInterno LIKE ?
                   OR b.CodigoBarras LIKE ?
                 )
               ORDER BY (p.CodigoInterno = ? OR b.CodigoBarras = ?) DESC, p.Nombre ASC""",
            (query_str, query_str, f"%{query_str}%", f"%{query_str}%", f"%{query_str}%", query_str, query_str)
        )
        rows = cursor.fetchall()

        if not rows:
            return []

        pids = [r["IDProducto"] for r in rows]
        placeholders = ",".join("?" * len(pids))
        cursor.execute(
            f"SELECT IDProducto, CodigoBarras FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto IN ({placeholders})",
            pids
        )
        barcode_map: Dict[int, List[str]] = {}
        for b in cursor.fetchall():
            barcode_map.setdefault(b["IDProducto"], []).append(b["CodigoBarras"])

        result = []
        for r in rows:
            pid = r["IDProducto"]
            result.append(
                ProductoOut(
                    id_producto=pid,
                    id_categoria=r["IDCategoria"],
                    categoria_nombre=r["CategoriaNombre"],
                    id_proveedor=r["IDProveedor"] if "IDProveedor" in r.keys() else None,
                    proveedor_nombre=r["ProveedorNombre"] if "ProveedorNombre" in r.keys() else None,
                    codigo_interno=r["CodigoInterno"],
                    nombre=r["Nombre"],
                    descripcion=r["Descripcion"],
                    marca=r["Marca"],
                    unidad_medida=r["UnidadMedida"],
                    precio_compra_actual=float(r["PrecioCompraActual"]),
                    precio_venta_actual=float(r["PrecioVentaActual"]),
                    margen_minimo_porcentaje=float(r["MargenMinimoPorcentaje"]),
                    stock_minimo=float(r["StockMinimo"]),
                    stock_actual=float(r["StockActual"]),
                    permite_fraccion=bool(r["PermiteFraccion"]),
                    activo=bool(r["Activo"]),
                    codigos_barras=barcode_map.get(pid, []),
                    fecha_modificacion=str(r["FechaModificacion"])
                )
            )
        return result

def crear_producto_rapido(data: ProductoRapidoRequest, id_usuario: int = 1) -> ProductoOut:
    with get_db() as conn:
        cursor = conn.cursor()
        codigo_interno = data.codigo_barras
        cursor.execute("SELECT IDProducto FROM PRODUCTOS WHERE CodigoInterno = ?", (codigo_interno,))
        existing = cursor.fetchone()
        if existing:
            codigo_interno = f"AUT-{int(datetime.now().timestamp())}"

        stock_init = float(data.stock_inicial or 0.0)
        cursor.execute(
            """INSERT INTO PRODUCTOS (
                IDCategoria, CodigoInterno, Nombre, PrecioCompraActual, PrecioVentaActual,
                MargenMinimoPorcentaje, StockMinimo, StockActual, PermiteFraccion, Activo
            ) VALUES (?, ?, ?, ?, ?, 15.0, 5.0, ?, 0, 1)""",
            (data.id_categoria, codigo_interno, data.nombre, data.costo, data.venta, stock_init)
        )
        pid = cursor.lastrowid

        # Insert barcode
        cursor.execute(
            "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal, TipoCodigo) VALUES (?, ?, 1, 'EAN13')",
            (pid, data.codigo_barras)
        )

        # Record Initial Kardex
        if stock_init > 0:
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, 'INVENTARIO_INICIAL', ?, 0, ?, 'ALTA-VUELO', ?, 'Alta al vuelo desde caja')""",
                (pid, stock_init, stock_init, id_usuario)
            )

        cursor.execute("SELECT Nombre FROM CATEGORIAS WHERE IDCategoria = ?", (data.id_categoria,))
        cat_row = cursor.fetchone()
        cat_name = cat_row["Nombre"] if cat_row else "Abarrotes"

        return ProductoOut(
            id_producto=pid,
            id_categoria=data.id_categoria,
            categoria_nombre=cat_name,
            codigo_interno=codigo_interno,
            nombre=data.nombre,
            precio_compra_actual=data.costo,
            precio_venta_actual=data.venta,
            stock_minimo=5.0,
            stock_actual=stock_init,
            codigos_barras=[data.codigo_barras]
        )

def crear_producto(data: ProductoCreate, id_usuario: int = 1) -> ProductoOut:
    with get_db() as conn:
        cursor = conn.cursor()
        codigo_interno = data.codigo_interno or (data.codigos_barras[0] if data.codigos_barras else f"INT-{int(datetime.now().timestamp())}")
        stock_init = float(data.stock_inicial)

        cursor.execute(
            """INSERT INTO PRODUCTOS (
                IDCategoria, IDProveedor, CodigoInterno, Nombre, Descripcion, Marca, UnidadMedida,
                PrecioCompraActual, PrecioVentaActual, MargenMinimoPorcentaje, StockMinimo, StockActual, PermiteFraccion, Activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (
                data.id_categoria, data.id_proveedor, codigo_interno, data.nombre, data.descripcion, data.marca,
                data.unidad_medida, data.precio_compra_actual, data.precio_venta_actual,
                data.margen_minimo_porcentaje, data.stock_minimo, stock_init, int(data.permite_fraccion)
            )
        )
        pid = cursor.lastrowid

        for idx, bc in enumerate(data.codigos_barras):
            if bc.strip():
                cursor.execute(
                    "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal) VALUES (?, ?, ?)",
                    (pid, bc.strip(), 1 if idx == 0 else 0)
                )

        if stock_init > 0:
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, 'INVENTARIO_INICIAL', ?, 0, ?, 'INV-NEW', ?, 'Registro inicial de producto')""",
                (pid, stock_init, stock_init, id_usuario)
            )

        cursor.execute("SELECT Nombre FROM CATEGORIAS WHERE IDCategoria = ?", (data.id_categoria,))
        cat_name = cursor.fetchone()["Nombre"]

        prov_name = None
        if data.id_proveedor is not None:
            cursor.execute("SELECT RazonSocial FROM PROVEEDORES WHERE IDProveedor = ?", (data.id_proveedor,))
            prov_row = cursor.fetchone()
            prov_name = prov_row["RazonSocial"] if prov_row else None

        return ProductoOut(
            id_producto=pid,
            id_categoria=data.id_categoria,
            categoria_nombre=cat_name,
            id_proveedor=data.id_proveedor,
            proveedor_nombre=prov_name,
            codigo_interno=codigo_interno,
            nombre=data.nombre,
            descripcion=data.descripcion,
            marca=data.marca,
            unidad_medida=data.unidad_medida,
            precio_compra_actual=data.precio_compra_actual,
            precio_venta_actual=data.precio_venta_actual,
            margen_minimo_porcentaje=data.margen_minimo_porcentaje,
            stock_minimo=data.stock_minimo,
            stock_actual=stock_init,
            permite_fraccion=data.permite_fraccion,
            codigos_barras=data.codigos_barras
        )


def _eliminar_producto_en_conn(cursor: sqlite3.Cursor, id_producto: int) -> bool:
    """Elimina un producto de raíz si no tiene historial comercial; en caso contrario lo desactiva,
    libera sus códigos de barras y lo desvincula del distribuidor. Retorna True si fue borrado físico."""
    has_sales = cursor.execute(
        "SELECT 1 FROM VENTAS_DETALLE WHERE IDProducto = ? LIMIT 1",
        (id_producto,),
    ).fetchone()
    has_purchases = cursor.execute(
        "SELECT 1 FROM COMPRAS_DETALLE WHERE IDProducto = ? LIMIT 1",
        (id_producto,),
    ).fetchone()
    has_orders = cursor.execute(
        "SELECT 1 FROM PEDIDOS_DETALLE WHERE IDProducto = ? LIMIT 1",
        (id_producto,),
    ).fetchone()

    if not has_sales and not has_purchases and not has_orders:
        cursor.execute("DELETE FROM MOVIMIENTOS_INVENTARIO WHERE IDProducto = ?", (id_producto,))
        cursor.execute("DELETE FROM HISTORIAL_PRECIOS WHERE IDProducto = ?", (id_producto,))
        cursor.execute("DELETE FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto = ?", (id_producto,))
        cursor.execute("DELETE FROM PRODUCTOS WHERE IDProducto = ?", (id_producto,))
        return True

    cursor.execute("DELETE FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto = ?", (id_producto,))
    cursor.execute(
        "UPDATE PRODUCTOS SET Activo = 0, IDProveedor = NULL, FechaModificacion = CURRENT_TIMESTAMP WHERE IDProducto = ?",
        (id_producto,),
    )
    return False


def eliminar_producto(id_producto: int) -> dict:
    """Elimina un producto de raíz si no tiene historial comercial; si tiene ventas/compras/pedidos,
    lo desactiva, libera sus códigos de barras y lo desvincula del distribuidor."""
    with get_db() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT IDProducto FROM PRODUCTOS WHERE IDProducto = ?",
            (id_producto,),
        ).fetchone()
        if not row:
            return {"success": True, "deleted_permanently": False, "message": "Producto no encontrado"}

        deleted_permanently = _eliminar_producto_en_conn(cursor, id_producto)
        if deleted_permanently:
            return {
                "success": True,
                "deleted_permanently": True,
                "message": "Producto eliminado de raíz del inventario",
            }
        return {
            "success": True,
            "deleted_permanently": False,
            "message": "Producto retirado del catálogo (se mantiene en historial de ventas/compras)",
        }


def eliminar_proveedor(id_proveedor: int) -> dict:
    """Elimina un distribuidor junto con todos sus productos asociados."""
    with get_db() as conn:
        cursor = conn.cursor()
        prov = cursor.execute(
            "SELECT IDProveedor, RazonSocial FROM PROVEEDORES WHERE IDProveedor = ?",
            (id_proveedor,),
        ).fetchone()
        if not prov:
            return {
                "success": True,
                "deleted_products_permanently": 0,
                "archived_products": 0,
                "total_products_removed": 0,
                "provider_deleted_permanently": False,
                "message": "Distribuidor no encontrado",
            }

        product_rows = cursor.execute(
            "SELECT IDProducto FROM PRODUCTOS WHERE IDProveedor = ? AND Activo = 1",
            (id_proveedor,),
        ).fetchall()

        deleted_permanently = 0
        archived_products = 0
        for p_row in product_rows:
            if _eliminar_producto_en_conn(cursor, p_row["IDProducto"]):
                deleted_permanently += 1
            else:
                archived_products += 1

        # Clear remaining links if any historical inactive product still references this supplier
        cursor.execute("UPDATE PRODUCTOS SET IDProveedor = NULL WHERE IDProveedor = ?", (id_proveedor,))
        cursor.execute("UPDATE PEDIDOS SET IDProveedor = NULL WHERE IDProveedor = ?", (id_proveedor,))

        has_compras = cursor.execute(
            "SELECT 1 FROM COMPRAS WHERE IDProveedor = ? LIMIT 1",
            (id_proveedor,),
        ).fetchone()

        provider_deleted_permanently = False
        if not has_compras:
            cursor.execute("DELETE FROM PROVEEDORES WHERE IDProveedor = ?", (id_proveedor,))
            provider_deleted_permanently = True
        else:
            cursor.execute("UPDATE PROVEEDORES SET Activo = 0 WHERE IDProveedor = ?", (id_proveedor,))

        total_removed = deleted_permanently + archived_products
        return {
            "success": True,
            "deleted_products_permanently": deleted_permanently,
            "archived_products": archived_products,
            "total_products_removed": total_removed,
            "provider_deleted_permanently": provider_deleted_permanently,
            "message": f"Distribuidor eliminado junto con {total_removed} producto(s)",
        }

# --- Cash Register Services ---
def require_active_session(conn: sqlite3.Connection, session_id: Optional[int] = None) -> sqlite3.Row:
    query = "SELECT * FROM SESIONES_CAJA WHERE Estado = 'ABIERTA'"
    params = ()
    if session_id is not None:
        query += " AND IDSesionCaja = ?"
        params = (session_id,)
    row = conn.execute(query + " ORDER BY IDSesionCaja DESC LIMIT 1", params).fetchone()
    if not row:
        raise ValueError("Abre una sesión de caja antes de realizar esta operación.")
    return row

def obtener_caja_activa() -> Optional[SesionCajaOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT s.*, u.NombreCompleto as CajeroNombre 
               FROM SESIONES_CAJA s 
               JOIN USUARIOS u ON s.IDUsuario = u.IDUsuario 
               WHERE s.Estado = 'ABIERTA' 
               ORDER BY s.IDSesionCaja DESC LIMIT 1"""
        )
        row = cursor.fetchone()
        if not row:
            return None

        sid = row["IDSesionCaja"]
        # Fetch sales and cash movements for this session
        cursor.execute(
            """SELECT FechaHora, NumeroVenta, Total, MetodoPago 
               FROM VENTAS 
               WHERE IDSesionCaja = ? AND Estado = 'CONFIRMADA' 
               ORDER BY FechaHora DESC""",
            (sid,)
        )
        sales_rows = cursor.fetchall()
        
        movements: List[CashMovementItem] = []
        for sr in sales_rows:
            dt = str(sr["FechaHora"])
            time_part = dt.split(" ")[1] if " " in dt else dt
            movements.append(
                CashMovementItem(
                    id=f"v-{sr['NumeroVenta']}",
                    hora=time_part[:5],
                    fecha=dt.split(" ")[0],
                    tipo="VENTA",
                    descripcion=f"Venta - Ticket #{sr['NumeroVenta']} ({sr['MetodoPago']})",
                    monto=float(sr["Total"]),
                    ticket_ref=sr["NumeroVenta"]
                )
            )

        for movement in cursor.execute(
            "SELECT * FROM MOVIMIENTOS_CAJA WHERE IDSesionCaja = ? ORDER BY IDMovimientoCaja DESC", (sid,)
        ).fetchall():
            dt = str(movement["FechaHora"])
            movements.append(CashMovementItem(
                id=f"c-{movement['IDMovimientoCaja']}",
                hora=dt.split(" ")[1][:5], fecha=dt.split(" ")[0],
                tipo=movement["Tipo"], descripcion=movement["Descripcion"], monto=float(movement["Monto"])
            ))
        movements.sort(key=lambda m: (m.fecha, m.hora), reverse=True)

        return SesionCajaOut(
            id_sesion_caja=sid,
            id_usuario=row["IDUsuario"],
            cajero_nombre=row["CajeroNombre"],
            fecha_apertura=str(row["FechaApertura"]),
            fecha_cierre=str(row["FechaCierre"]) if row["FechaCierre"] else None,
            monto_inicial=float(row["MontoInicial"]),
            total_ventas_efectivo=float(row["TotalVentasEfectivo"]),
            total_ventas_transferencia=float(row["TotalVentasTransferencia"]),
            total_retiros=float(row["TotalRetiros"]),
            total_esperado=float(row["TotalEsperado"]),
            total_real_entregado=float(row["TotalRealEntregado"]) if row["TotalRealEntregado"] is not None else None,
            diferencia=float(row["Diferencia"]) if row["Diferencia"] is not None else None,
            estado=row["Estado"],
            observaciones=row["Observaciones"],
            movimientos=movements
        )

def abrir_caja(data: CajaAbrirRequest) -> SesionCajaOut:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        if cursor.execute("SELECT 1 FROM SESIONES_CAJA WHERE Estado = 'ABIERTA'").fetchone():
            raise ValueError("Ya hay una sesión de caja abierta. Ciérrala antes de abrir otra.")
        cursor.execute(
            """INSERT INTO SESIONES_CAJA (
                IDUsuario, MontoInicial, TotalVentasEfectivo, TotalVentasTransferencia, TotalRetiros, TotalEsperado, Estado, Observaciones
            ) VALUES (?, ?, 0.0, 0.0, 0.0, ?, 'ABIERTA', ?)""",
            (data.id_usuario or 1, data.monto_inicial, data.monto_inicial, data.observaciones or "Apertura de turno")
        )
    return obtener_caja_activa()

def cerrar_caja(data: CajaCerrarRequest) -> SesionCajaOut:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM SESIONES_CAJA WHERE Estado = 'ABIERTA' ORDER BY IDSesionCaja DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            raise ValueError("No hay ninguna sesion de caja abierta para cerrar.")

        sid = row["IDSesionCaja"]
        esperado = float(row["TotalEsperado"])
        real = float(data.total_real_entregado)
        diferencia = round(real - esperado, 2)

        cursor.execute(
            """UPDATE SESIONES_CAJA 
               SET Estado = 'CERRADA', FechaCierre = CURRENT_TIMESTAMP, TotalRealEntregado = ?, Diferencia = ?, Observaciones = ?
               WHERE IDSesionCaja = ?""",
            (real, diferencia, data.observaciones, sid)
        )
        
        cursor.execute(
            """SELECT s.*, u.NombreCompleto as CajeroNombre 
               FROM SESIONES_CAJA s 
               JOIN USUARIOS u ON s.IDUsuario = u.IDUsuario 
               WHERE s.IDSesionCaja = ?""",
            (sid,)
        )
        closed_row = cursor.fetchone()

        return SesionCajaOut(
            id_sesion_caja=sid,
            id_usuario=closed_row["IDUsuario"],
            cajero_nombre=closed_row["CajeroNombre"],
            fecha_apertura=str(closed_row["FechaApertura"]),
            fecha_cierre=str(closed_row["FechaCierre"]),
            monto_inicial=float(closed_row["MontoInicial"]),
            total_ventas_efectivo=float(closed_row["TotalVentasEfectivo"]),
            total_ventas_transferencia=float(closed_row["TotalVentasTransferencia"]),
            total_retiros=float(closed_row["TotalRetiros"]),
            total_esperado=esperado,
            total_real_entregado=real,
            diferencia=diferencia,
            estado="CERRADA",
            observaciones=closed_row["Observaciones"],
            movimientos=[]
        )

def registrar_movimiento_caja(data: CajaMovimientoRequest) -> SesionCajaOut:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        sid = require_active_session(conn)["IDSesionCaja"]

        monto = float(data.monto)
        cursor.execute(
            "INSERT INTO MOVIMIENTOS_CAJA (IDSesionCaja, IDUsuario, Tipo, Monto, Descripcion) VALUES (?, ?, ?, ?, ?)",
            (sid, data.id_usuario or 1, data.tipo, monto, data.descripcion)
        )
        if data.tipo == "RETIRO":
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalRetiros = TotalRetiros + ?, TotalEsperado = TotalEsperado - ? 
                   WHERE IDSesionCaja = ?""",
                (monto, monto, sid)
            )
        else:
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalEsperado = TotalEsperado + ? 
                   WHERE IDSesionCaja = ?""",
                (monto, sid)
            )
    return obtener_caja_activa()

def actualizar_fondo_inicial(monto_inicial: float, id_usuario: int = 1) -> SesionCajaOut:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        active = require_active_session(conn)
        monto = float(monto_inicial)
        if monto < 0:
            raise ValueError("El fondo inicial no puede ser negativo.")
        nuevo_esperado = round(float(active["TotalEsperado"]) + monto - float(active["MontoInicial"]), 2)
        cursor.execute(
            "UPDATE SESIONES_CAJA SET MontoInicial = ?, TotalEsperado = ? WHERE IDSesionCaja = ?",
            (monto, nuevo_esperado, active["IDSesionCaja"])
        )
    return obtener_caja_activa()

# --- POS Sales Services (ACID) ---
def cobrar_venta(data: VentaCobrarRequest) -> VentaOut:
    with get_db() as conn:
        # Serialize stock/cash changes and retries before reading any balances.
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        request_hash = hashlib.sha256(json.dumps(
            data.model_dump(exclude={"clave_idempotencia"}), sort_keys=True, ensure_ascii=False
        ).encode("utf-8")).hexdigest()
        if data.clave_idempotencia:
            previous = cursor.execute(
                "SELECT SolicitudHash, Respuesta FROM COBROS_IDEMPOTENTES WHERE Clave = ?", (data.clave_idempotencia,)
            ).fetchone()
            if previous:
                if previous["SolicitudHash"] != request_hash:
                    raise ValueError("Este identificador de cobro ya se usó para otra venta.")
                return VentaOut.model_validate_json(previous["Respuesta"])

        # Ensure active cash session
        active_session = require_active_session(conn, data.id_sesion_caja)
        sid = active_session["IDSesionCaja"]
        # Determine active cashier/worker
        user_id = data.id_usuario or active_session["IDUsuario"]
        cajero_name = data.cajero_nombre

        if cajero_name and cajero_name.strip():
            cursor.execute("SELECT IDUsuario, NombreCompleto FROM USUARIOS WHERE LOWER(NombreCompleto) = LOWER(?) LIMIT 1", (cajero_name.strip(),))
            u_match = cursor.fetchone()
            if u_match:
                user_id = u_match["IDUsuario"]
                cajero_name = u_match["NombreCompleto"]
        else:
            cursor.execute("SELECT NombreCompleto FROM USUARIOS WHERE IDUsuario = ?", (user_id,))
            u_row = cursor.fetchone()
            cajero_name = u_row["NombreCompleto"] if u_row else "Cajero"

        # Calculate totals & validate items
        if not data.items:
            raise ValueError("El carrito de venta no contiene productos.")

        subtotal_total = 0.0
        pids = [it.id_producto for it in data.items]
        placeholders = ",".join("?" * len(pids))
        cursor.execute(f"SELECT IDProducto, CodigoInterno, Nombre, PrecioCompraActual, PrecioVentaActual, StockActual FROM PRODUCTOS WHERE IDProducto IN ({placeholders})", pids)
        product_rows = {r["IDProducto"]: r for r in cursor.fetchall()}
        stock_balances = {pid: float(row["StockActual"]) for pid, row in product_rows.items()}

        detalle_inserts = []
        for it in data.items:
            if it.id_producto not in product_rows:
                raise ValueError(f"Producto con ID {it.id_producto} no encontrado.")
            prod = product_rows[it.id_producto]
            cant = float(it.cantidad)
            p_unit = float(it.precio_unitario)
            c_unit = float(prod["PrecioCompraActual"])
            desc = float(it.descuento or 0.0)
            item_sub = round((cant * p_unit) - desc, 4)
            if item_sub < 0:
                raise ValueError("El descuento del producto supera su importe.")
            stock_before = stock_balances[it.id_producto]
            stock_balances[it.id_producto] = max(0.0, round(stock_before - cant, 3))
            subtotal_total += item_sub

            detalle_inserts.append({
                "id_producto": it.id_producto,
                "producto_nombre": prod["Nombre"],
                "producto_codigo": prod["CodigoInterno"],
                "cantidad": cant,
                "precio_unitario": p_unit,
                "costo_unitario": c_unit,
                "descuento": desc,
                "subtotal": item_sub,
                "stock_actual": stock_before
            })

        subtotal_total = round(subtotal_total, 2)
        total_final = round(subtotal_total - float(data.descuento or 0.0) + float(data.impuestos or 0.0), 2)
        if total_final < 0:
            raise ValueError("El descuento supera el importe de la venta.")
        monto_rec = float(data.monto_recibido) if data.metodo_pago == "EFECTIVO" else float(data.monto_recibido or total_final)
        if data.metodo_pago == "EFECTIVO" and round(monto_rec, 2) < total_final:
            raise ValueError("El efectivo recibido es insuficiente para cubrir el total.")
        cambio = max(0.0, round(monto_rec - total_final, 2)) if data.metodo_pago == "EFECTIVO" else 0.0

        # Generate Ticket Number
        cursor.execute("SELECT COALESCE(MAX(IDVenta), 0) FROM VENTAS")
        total_sales_count = cursor.fetchone()[0]
        numero_venta = f"TK-{4094 + total_sales_count}"

        # 1. Insert Venta Cabecera (FechaHora in local time; SQLite CURRENT_TIMESTAMP is UTC)
        fecha_venta = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            """INSERT INTO VENTAS (
                IDSesionCaja, IDUsuario, NumeroVenta, FechaHora, Subtotal, Descuento, Impuestos, Total,
                MetodoPago, MontoRecibido, Cambio, CajeroNombre, Estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA')""",
            (
                sid, user_id, numero_venta, fecha_venta, subtotal_total, data.descuento or 0.0,
                data.impuestos or 0.0, total_final, data.metodo_pago, monto_rec, cambio, cajero_name
            )
        )
        vid = cursor.lastrowid

        # 2. Insert Venta Detalle & Update Stock & Insert Kardex
        items_out = []
        for d in detalle_inserts:
            cursor.execute(
                """INSERT INTO VENTAS_DETALLE (
                    IDVenta, IDProducto, Cantidad, PrecioUnitario, CostoUnitarioAlMomento, Descuento, Subtotal
                ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (vid, d["id_producto"], d["cantidad"], d["precio_unitario"], d["costo_unitario"], d["descuento"], d["subtotal"])
            )
            det_id = cursor.lastrowid

            # Deduct stock (clamped at 0 so zero-stock sales do not create negative stock debt)
            stock_ant = d["stock_actual"]
            stock_post = max(0.0, round(stock_ant - d["cantidad"], 3))
            cursor.execute(
                "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = CURRENT_TIMESTAMP WHERE IDProducto = ?",
                (stock_post, d["id_producto"])
            )

            # Insert into Ledger
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?)""",
                (d["id_producto"], -d["cantidad"], stock_ant, stock_post, numero_venta, user_id, f"Venta ticket #{numero_venta} (A cargo: {cajero_name})")
            )

            items_out.append(
                VentaDetalleOut(
                    id_detalle_venta=det_id,
                    id_producto=d["id_producto"],
                    producto_nombre=d["producto_nombre"],
                    producto_codigo=d["producto_codigo"],
                    cantidad=d["cantidad"],
                    precio_unitario=d["precio_unitario"],
                    costo_unitario=d["costo_unitario"],
                    descuento=d["descuento"],
                    subtotal=d["subtotal"]
                )
            )

        # 3. Update Cash Register Totals
        if data.metodo_pago == "EFECTIVO":
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalVentasEfectivo = TotalVentasEfectivo + ?, TotalEsperado = TotalEsperado + ? 
                   WHERE IDSesionCaja = ?""",
                (total_final, total_final, sid)
            )
        else:
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalVentasTransferencia = TotalVentasTransferencia + ? 
                   WHERE IDSesionCaja = ?""",
                (total_final, sid)
            )

        result = VentaOut(
            id_venta=vid,
            id_sesion_caja=sid,
            id_usuario=user_id,
            cajero_nombre=cajero_name,
            numero_venta=numero_venta,
            fecha_hora=fecha_venta,
            subtotal=subtotal_total,
            descuento=data.descuento or 0.0,
            impuestos=data.impuestos or 0.0,
            total=total_final,
            metodo_pago=data.metodo_pago,
            monto_recibido=monto_rec,
            cambio=cambio,
            estado="CONFIRMADA",
            items=items_out
        )
        if data.clave_idempotencia:
            cursor.execute(
                "INSERT INTO COBROS_IDEMPOTENTES (Clave, SolicitudHash, IDVenta, Respuesta) VALUES (?, ?, ?, ?)",
                (data.clave_idempotencia, request_hash, vid, result.model_dump_json())
            )
        return result

# --- Purchases / Compras Reception Services ---
def registrar_compra(data: CompraRegistrarRequest) -> CompraOut:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        user_id = data.id_usuario or 1

        if not data.items:
            raise ValueError("La recepcion de compra no contiene items.")

        # Calculate totals
        subtotal_total = 0.0
        processed_items = []
        for it in data.items:
            cant = float(it.cantidad)
            costo = float(it.costo_unitario)
            desc = float(it.descuento or 0.0)
            item_sub = round((cant * costo) - desc, 4)
            subtotal_total += item_sub

            # Resolve product
            pid = it.id_producto
            if not pid and it.codigo:
                cursor.execute(
                    """SELECT p.IDProducto FROM PRODUCTOS p 
                       LEFT JOIN PRODUCTO_CODIGOS_BARRAS b ON p.IDProducto = b.IDProducto 
                       WHERE p.CodigoInterno = ? OR b.CodigoBarras = ? LIMIT 1""",
                    (it.codigo, it.codigo)
                )
                p_row = cursor.fetchone()
                if p_row:
                    pid = p_row["IDProducto"]
                else:
                    # Create new product on the fly
                    p_name = it.nombre or f"Producto {it.codigo}"
                    p_sale = float(it.precio_venta_sugerido or (costo * 1.3))
                    cursor.execute(
                        """INSERT INTO PRODUCTOS (
                            IDCategoria, CodigoInterno, Nombre, PrecioCompraActual, PrecioVentaActual,
                            MargenMinimoPorcentaje, StockMinimo, StockActual, PermiteFraccion, Activo
                        ) VALUES (1, ?, ?, ?, ?, 15.0, 5.0, 0.0, 0, 1)""",
                        (it.codigo, p_name, costo, p_sale)
                    )
                    pid = cursor.lastrowid
                    cursor.execute(
                        "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal) VALUES (?, ?, 1)",
                        (pid, it.codigo)
                    )

            if not pid:
                raise ValueError(f"No se pudo identificar el producto para el item {it.nombre or it.codigo}")

            cursor.execute("SELECT IDProducto, CodigoInterno, Nombre, PrecioCompraActual, PrecioVentaActual, StockActual FROM PRODUCTOS WHERE IDProducto = ?", (pid,))
            prod = cursor.fetchone()

            processed_items.append({
                "id_producto": pid,
                "producto_nombre": prod["Nombre"],
                "producto_codigo": prod["CodigoInterno"],
                "cantidad": cant,
                "costo_unitario": costo,
                "precio_venta_sugerido": it.precio_venta_sugerido,
                "descuento": desc,
                "subtotal": item_sub,
                "prev_cost": float(prod["PrecioCompraActual"]),
                "prev_sale": float(prod["PrecioVentaActual"]),
                "stock_actual": float(prod["StockActual"])
            })

        subtotal_total = round(subtotal_total, 2)
        total_final = round(subtotal_total - float(data.descuento or 0.0) + float(data.impuestos or 0.0), 2)

        # 1. Insert Compra Cabecera
        cursor.execute(
            """INSERT INTO COMPRAS (
                IDProveedor, IDUsuario, NumeroDocumento, Subtotal, Descuento, Impuestos, Total, Estado, Observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?)""",
            (data.id_proveedor, user_id, data.numero_documento, subtotal_total, data.descuento or 0.0, data.impuestos or 0.0, total_final, data.observaciones)
        )
        cid = cursor.lastrowid

        # 2. Insert Detalle & Increment Stock & Update Prices
        details_out = []
        for it in processed_items:
            cursor.execute(
                """INSERT INTO COMPRAS_DETALLE (
                    IDCompra, IDProducto, Cantidad, CostoUnitario, Descuento, Subtotal
                ) VALUES (?, ?, ?, ?, ?, ?)""",
                (cid, it["id_producto"], it["cantidad"], it["costo_unitario"], it["descuento"], it["subtotal"])
            )
            det_id = cursor.lastrowid

            current = cursor.execute(
                "SELECT StockActual, PrecioCompraActual, PrecioVentaActual FROM PRODUCTOS WHERE IDProducto = ?",
                (it["id_producto"],)
            ).fetchone()
            stock_ant = float(current["StockActual"])
            it["prev_cost"] = float(current["PrecioCompraActual"])
            it["prev_sale"] = float(current["PrecioVentaActual"])
            stock_post = round(stock_ant + it["cantidad"], 3)

            # Update product stock & cost
            cursor.execute(
                "UPDATE PRODUCTOS SET StockActual = ?, PrecioCompraActual = ?, FechaModificacion = CURRENT_TIMESTAMP WHERE IDProducto = ?",
                (stock_post, it["costo_unitario"], it["id_producto"])
            )

            # Check price history for purchase
            if abs(it["costo_unitario"] - it["prev_cost"]) > 0.001:
                cursor.execute(
                    """INSERT INTO HISTORIAL_PRECIOS (
                        IDProducto, TipoPrecio, PrecioAnterior, PrecioNuevo, IDUsuario, Motivo
                    ) VALUES (?, 'COMPRA', ?, ?, ?, ?)""",
                    (it["id_producto"], it["prev_cost"], it["costo_unitario"], user_id, f"Compra Factura #{data.numero_documento}")
                )

            # If suggested sale price given and changed
            if it["precio_venta_sugerido"] and it["precio_venta_sugerido"] > 0:
                p_sug = float(it["precio_venta_sugerido"])
                if abs(p_sug - it["prev_sale"]) > 0.001:
                    cursor.execute(
                        "UPDATE PRODUCTOS SET PrecioVentaActual = ? WHERE IDProducto = ?",
                        (p_sug, it["id_producto"])
                    )
                    cursor.execute(
                        """INSERT INTO HISTORIAL_PRECIOS (
                            IDProducto, TipoPrecio, PrecioAnterior, PrecioNuevo, IDUsuario, Motivo
                        ) VALUES (?, 'VENTA', ?, ?, ?, ?)""",
                        (it["id_producto"], it["prev_sale"], p_sug, user_id, f"Actualizacion por Compra #{data.numero_documento}")
                    )

            # Insert into Kardex Ledger
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, 'ENTRADA_COMPRA', ?, ?, ?, ?, ?, ?)""",
                (it["id_producto"], it["cantidad"], stock_ant, stock_post, data.numero_documento, user_id, f"Ingreso compra Factura #{data.numero_documento}")
            )

            details_out.append(
                CompraDetalleOut(
                    id_detalle_compra=det_id,
                    id_producto=it["id_producto"],
                    producto_nombre=it["producto_nombre"],
                    producto_codigo=it["producto_codigo"],
                    cantidad=it["cantidad"],
                    costo_unitario=it["costo_unitario"],
                    descuento=it["descuento"],
                    subtotal=it["subtotal"]
                )
            )

        cursor.execute("SELECT RazonSocial FROM PROVEEDORES WHERE IDProveedor = ?", (data.id_proveedor,))
        prov_name = cursor.fetchone()["RazonSocial"]

        return CompraOut(
            id_compra=cid,
            id_proveedor=data.id_proveedor,
            proveedor_nombre=prov_name,
            id_usuario=user_id,
            numero_documento=data.numero_documento,
            fecha_hora=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            subtotal=subtotal_total,
            descuento=data.descuento or 0.0,
            impuestos=data.impuestos or 0.0,
            total=total_final,
            estado="CONFIRMADA",
            items=details_out
        )

# --- Inventory Adjustments & Kardex ---
def ajustar_inventario(data: AjusteInventarioRequest) -> KardexMovimientoOut:
    with get_db() as conn:
        cursor = conn.cursor()
        user_id = data.id_usuario or 1

        cursor.execute("SELECT IDProducto, CodigoInterno, Nombre, StockActual FROM PRODUCTOS WHERE IDProducto = ?", (data.id_producto,))
        prod = cursor.fetchone()
        if not prod:
            raise ValueError(f"Producto con ID {data.id_producto} no encontrado.")

        stock_ant = float(prod["StockActual"])
        cant = float(data.cantidad)
        
        if data.tipo_ajuste == "AJUSTE_POSITIVO":
            delta = cant
            stock_post = round(stock_ant + delta, 3)
        else:
            delta = -cant
            stock_post = max(0.0, round(stock_ant - cant, 3))

        cursor.execute(
            "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = CURRENT_TIMESTAMP WHERE IDProducto = ?",
            (stock_post, data.id_producto)
        )

        doc_ref = f"AJ-{int(datetime.now().timestamp())}"
        cursor.execute(
            """INSERT INTO MOVIMIENTOS_INVENTARIO (
                IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (data.id_producto, data.tipo_ajuste, delta, stock_ant, stock_post, doc_ref, user_id, data.motivo or "Ajuste manual de inventario")
        )
        mid = cursor.lastrowid

        cursor.execute("SELECT NombreCompleto FROM USUARIOS WHERE IDUsuario = ?", (user_id,))
        u_name = cursor.fetchone()["NombreCompleto"]

        return KardexMovimientoOut(
            id_movimiento=mid,
            fecha_hora=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            id_producto=data.id_producto,
            producto_nombre=prod["Nombre"],
            producto_codigo=prod["CodigoInterno"],
            tipo_movimiento=data.tipo_ajuste,
            cantidad=delta,
            stock_anterior=stock_ant,
            stock_posterior=stock_post,
            referencia_id=doc_ref,
            id_usuario=user_id,
            usuario_nombre=u_name,
            observacion=data.motivo
        )

def obtener_kardex(id_producto: Optional[int] = None, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None) -> List[KardexMovimientoOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        query = """SELECT m.*, p.Nombre as ProductoNombre, p.CodigoInterno as ProductoCodigo, u.NombreCompleto as UsuarioNombre 
                   FROM MOVIMIENTOS_INVENTARIO m 
                   JOIN PRODUCTOS p ON m.IDProducto = p.IDProducto 
                   JOIN USUARIOS u ON m.IDUsuario = u.IDUsuario 
                   WHERE 1=1"""
        params = []
        if id_producto:
            query += " AND m.IDProducto = ?"
            params.append(id_producto)
        if fecha_inicio:
            query += " AND m.FechaHora >= ?"
            params.append(f"{fecha_inicio} 00:00:00")
        if fecha_fin:
            query += " AND m.FechaHora <= ?"
            params.append(f"{fecha_fin} 23:59:59")

        query += " ORDER BY m.IDMovimiento DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        return [
            KardexMovimientoOut(
                id_movimiento=r["IDMovimiento"],
                fecha_hora=str(r["FechaHora"]),
                id_producto=r["IDProducto"],
                producto_nombre=r["ProductoNombre"],
                producto_codigo=r["ProductoCodigo"],
                tipo_movimiento=r["TipoMovimiento"],
                cantidad=float(r["Cantidad"]),
                stock_anterior=float(r["StockAnterior"]),
                stock_posterior=float(r["StockPosterior"]),
                referencia_id=r["ReferenciaID"],
                id_usuario=r["IDUsuario"],
                usuario_nombre=r["UsuarioNombre"],
                observacion=r["Observacion"]
            )
            for r in rows
        ]

# --- Dashboard KPIs ---
def obtener_dashboard_kpis() -> DashboardKPIsOut:
    with get_db() as conn:
        cursor = conn.cursor()
        today_date = datetime.now().strftime("%Y-%m-%d")

        # Today's sales
        cursor.execute(
            """SELECT COUNT(*) as TicketsTotal, COALESCE(SUM(Total), 0) as VentasTotal 
               FROM VENTAS 
               WHERE FechaHora LIKE ? AND Estado = 'CONFIRMADA'""",
            (f"{today_date}%",)
        )
        sales_agg = cursor.fetchone()
        tickets_total = sales_agg["TicketsTotal"]
        ventas_total = float(sales_agg["VentasTotal"])

        # Gross profit today
        cursor.execute(
            """SELECT COALESCE(SUM((d.PrecioUnitario - d.CostoUnitarioAlMomento) * d.Cantidad), 0) as Ganancia 
               FROM VENTAS_DETALLE d 
               JOIN VENTAS v ON d.IDVenta = v.IDVenta 
               WHERE v.FechaHora LIKE ? AND v.Estado = 'CONFIRMADA'""",
            (f"{today_date}%",)
        )
        ganancia_total = float(cursor.fetchone()["Ganancia"])
        margen_prom = round((ganancia_total / ventas_total * 100), 1) if ventas_total > 0 else 30.0

        # Inventory valuations & alerts
        cursor.execute("SELECT PrecioCompraActual, PrecioVentaActual, StockActual, StockMinimo FROM PRODUCTOS WHERE Activo = 1")
        prods = cursor.fetchall()
        val_costo = sum(float(p["PrecioCompraActual"]) * float(p["StockActual"]) for p in prods)
        val_venta = sum(float(p["PrecioVentaActual"]) * float(p["StockActual"]) for p in prods)
        stock_bajo = sum(1 for p in prods if 0 < float(p["StockActual"]) <= float(p["StockMinimo"]))
        agotados = sum(1 for p in prods if float(p["StockActual"]) <= 0)

        # Recent cost increase count
        cursor.execute(
            """SELECT COUNT(*) FROM HISTORIAL_PRECIOS 
               WHERE TipoPrecio = 'COMPRA' AND PrecioNuevo > PrecioAnterior AND FechaHora LIKE ?""",
            (f"{today_date}%",)
        )
        costos_incr = cursor.fetchone()[0]

        # Hourly sales
        cursor.execute(
            """SELECT strftime('%H:00', FechaHora) as Hora, SUM(Total) as Monto, COUNT(*) as Tickets 
               FROM VENTAS 
               WHERE FechaHora LIKE ? AND Estado = 'CONFIRMADA' 
               GROUP BY Hora ORDER BY Hora ASC""",
            (f"{today_date}%",)
        )
        hourly_rows = cursor.fetchall()
        ventas_hora = [
            HourlySalesItem(hora=hr["Hora"], monto=float(hr["Monto"]), tickets=hr["Tickets"])
            for hr in hourly_rows
        ]
        if not ventas_hora:
            ventas_hora = [
                HourlySalesItem(hora="08:00", monto=0, tickets=0),
                HourlySalesItem(hora="10:00", monto=0, tickets=0),
                HourlySalesItem(hora="12:00", monto=0, tickets=0),
                HourlySalesItem(hora="14:00", monto=0, tickets=0),
                HourlySalesItem(hora="16:00", monto=0, tickets=0),
                HourlySalesItem(hora="18:00", monto=0, tickets=0)
            ]

        caja_act = obtener_caja_activa()

        return DashboardKPIsOut(
            ventas_hoy_total=round(ventas_total, 2),
            tickets_hoy_total=tickets_total,
            ganancia_bruta_hoy=round(ganancia_total, 2),
            margen_promedio_hoy=margen_prom,
            valor_inventario_costo=round(val_costo, 2),
            valor_inventario_venta=round(val_venta, 2),
            productos_stock_bajo=stock_bajo,
            productos_agotados=agotados,
            costos_incrementados_recientes=costos_incr,
            caja_activa=caja_act,
            ventas_por_hora=ventas_hora
        )

# --- Backup Generator ---
def generar_backup_database() -> BackupResponse:
    backup_dir = get_backup_dir()
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_tienda_{timestamp}.db.gz"
    filepath = os.path.join(backup_dir, filename)

    # Perform safe SQLite backup
    temp_db = os.path.join(backup_dir, f"temp_{timestamp}.db")
    with get_db() as src_conn:
        dest_conn = sqlite3.connect(temp_db)
        src_conn.backup(dest_conn)
        dest_conn.close()

    # Compress with gzip
    with open(temp_db, "rb") as f_in:
        with gzip.open(filepath, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    if os.path.exists(temp_db):
        os.remove(temp_db)

    size_bytes = os.path.getsize(filepath)
    return BackupResponse(
        success=True,
        filename=filename,
        filepath=filepath,
        size_bytes=size_bytes,
        timestamp=timestamp
    )

def eliminar_movimiento_inventario(id_movimiento: int, revertir_stock: bool = True) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM MOVIMIENTOS_INVENTARIO WHERE IDMovimiento = ?", (id_movimiento,))
        mov = cursor.fetchone()
        if not mov:
            raise ValueError(f"Movimiento #{id_movimiento} no encontrado.")

        pid = mov["IDProducto"]
        cant = float(mov["Cantidad"])
        tipo = mov["TipoMovimiento"]

        cursor.execute("SELECT IDProducto, CodigoInterno, Nombre, StockActual FROM PRODUCTOS WHERE IDProducto = ?", (pid,))
        prod = cursor.fetchone()
        nuevo_stock = float(prod["StockActual"]) if prod else 0.0

        if revertir_stock and prod:
            # If movement added stock (+cant), revert by subtracting cant
            # If movement subtracted stock (-cant), revert by adding abs(cant)
            revert_delta = -cant
            nuevo_stock = max(0.0, round(float(prod["StockActual"]) + revert_delta, 3))
            cursor.execute(
                "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = CURRENT_TIMESTAMP WHERE IDProducto = ?",
                (nuevo_stock, pid)
            )

        cursor.execute("DELETE FROM MOVIMIENTOS_INVENTARIO WHERE IDMovimiento = ?", (id_movimiento,))

        return {
            "success": True,
            "id_movimiento": id_movimiento,
            "id_producto": pid,
            "producto_nombre": prod["Nombre"] if prod else "",
            "nuevo_stock": nuevo_stock,
            "mensaje": f"Movimiento #{id_movimiento} ({tipo}) eliminado y stock revertido a {nuevo_stock} un."
        }

def registrar_devolucion_producto(
    id_producto: int,
    cantidad: float,
    motivo: str,
    referencia_id: Optional[str] = None,
    afecta_caja: bool = False,
    monto_devolucion: float = 0.0,
    id_usuario: int = 1
) -> Dict[str, Any]:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        refund_session = require_active_session(conn) if afecta_caja and monto_devolucion > 0 else None
        if monto_devolucion < 0:
            raise ValueError("El reembolso no puede ser negativo.")
        cursor.execute("SELECT IDProducto, CodigoInterno, Nombre, StockActual, PrecioVentaActual FROM PRODUCTOS WHERE IDProducto = ?", (id_producto,))
        prod = cursor.fetchone()
        if not prod:
            raise ValueError(f"Producto con ID {id_producto} no encontrado.")

        cant = float(cantidad)
        if cant <= 0:
            raise ValueError("La cantidad devuelta debe ser mayor a 0.")

        stock_ant = float(prod["StockActual"])
        stock_post = round(stock_ant + cant, 3)

        cursor.execute(
            "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = CURRENT_TIMESTAMP WHERE IDProducto = ?",
            (stock_post, id_producto)
        )

        doc_ref = referencia_id or f"DEV-{int(datetime.now().timestamp())}"
        cursor.execute(
            """INSERT INTO MOVIMIENTOS_INVENTARIO (
                IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
            ) VALUES (?, 'DEVOLUCION_CLIENTE', ?, ?, ?, ?, ?, ?)""",
            (id_producto, cant, stock_ant, stock_post, doc_ref, id_usuario, f"Devolución de cliente: {motivo or 'Producto retornado a tienda'}")
        )
        mid = cursor.lastrowid

        # If refund money from cash drawer
        if afecta_caja and monto_devolucion > 0:
            sid = refund_session["IDSesionCaja"]
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_CAJA (
                    IDSesionCaja, IDUsuario, Tipo, Monto, Descripcion
                ) VALUES (?, ?, 'RETIRO', ?, ?)""",
                (sid, id_usuario, monto_devolucion, f"Devolución producto {prod['Nombre']} ({motivo})")
            )
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalRetiros = TotalRetiros + ?, TotalEsperado = TotalEsperado - ? 
                   WHERE IDSesionCaja = ?""",
                (monto_devolucion, monto_devolucion, sid)
            )

        return {
            "success": True,
            "id_movimiento": mid,
            "id_producto": id_producto,
            "producto_nombre": prod["Nombre"],
            "cantidad_devuelta": cant,
            "stock_anterior": stock_ant,
            "nuevo_stock": stock_post,
            "mensaje": f"Devolución registrada: +{cant} un ingresadas al stock de {prod['Nombre']}."
        }

# --- Purchase Orders / Agenda de Pedidos Services ---
def get_all_pedidos(estado: Optional[str] = None) -> List[PedidoOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM PEDIDOS"
        params = []
        if estado:
            query += " WHERE Estado = ?"
            params.append(estado.upper())
        query += " ORDER BY IDPedido DESC"
        cursor.execute(query, params)
        p_rows = cursor.fetchall()

        result = []
        for p in p_rows:
            pid = p["IDPedido"]
            cursor.execute(
                """SELECT d.*, pr.Nombre as ProductoNombre, pr.CodigoInterno as ProductoCodigo, c.Nombre as CategoriaNombre,
                          (SELECT CodigoBarras FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto = d.IDProducto LIMIT 1) as CodigoBarras
                   FROM PEDIDOS_DETALLE d
                   JOIN PRODUCTOS pr ON d.IDProducto = pr.IDProducto
                   LEFT JOIN CATEGORIAS c ON pr.IDCategoria = c.IDCategoria
                   WHERE d.IDPedido = ?""",
                (pid,)
            )
            d_rows = cursor.fetchall()
            items = [
                PedidoDetalleOut(
                    id_detalle_pedido=d["IDDetallePedido"],
                    id_producto=d["IDProducto"],
                    producto_nombre=d["ProductoNombre"],
                    producto_codigo=d["ProductoCodigo"],
                    categoria=d["CategoriaNombre"],
                    codigo_barras=d["CodigoBarras"],
                    cantidad_pedida=float(d["CantidadPedida"]),
                    costo_estimado=float(d["CostoEstimado"]),
                    subtotal_estimado=float(d["SubtotalEstimado"])
                )
                for d in d_rows
            ]

            result.append(
                PedidoOut(
                    id_pedido=pid,
                    id_proveedor=p["IDProveedor"],
                    proveedor_nombre=p["ProveedorNombre"] or "General",
                    numero_pedido=p["NumeroPedido"],
                    fecha_pedido=str(p["FechaPedido"]),
                    fecha_estimada_entrega=str(p["FechaEstimadaEntrega"]) if p["FechaEstimadaEntrega"] else None,
                    total_estimado=float(p["TotalEstimado"]),
                    total_unidades=float(p["TotalUnidades"]),
                    estado=p["Estado"],
                    notas=p["Notas"],
                    factura_recepcion=p["FacturaRecepcion"],
                    fecha_recepcion=str(p["FechaRecepcion"]) if p["FechaRecepcion"] else None,
                    items=items
                )
            )
        return result

def get_pedido_by_id(id_pedido: int) -> Optional[PedidoOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM PEDIDOS WHERE IDPedido = ?", (id_pedido,))
        p = cursor.fetchone()
        if not p:
            return None

        cursor.execute(
            """SELECT d.*, pr.Nombre as ProductoNombre, pr.CodigoInterno as ProductoCodigo, c.Nombre as CategoriaNombre,
                      (SELECT CodigoBarras FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto = d.IDProducto LIMIT 1) as CodigoBarras
               FROM PEDIDOS_DETALLE d
               JOIN PRODUCTOS pr ON d.IDProducto = pr.IDProducto
               LEFT JOIN CATEGORIAS c ON pr.IDCategoria = c.IDCategoria
               WHERE d.IDPedido = ?""",
            (id_pedido,)
        )
        d_rows = cursor.fetchall()
        items = [
            PedidoDetalleOut(
                id_detalle_pedido=d["IDDetallePedido"],
                id_producto=d["IDProducto"],
                producto_nombre=d["ProductoNombre"],
                producto_codigo=d["ProductoCodigo"],
                categoria=d["CategoriaNombre"],
                codigo_barras=d["CodigoBarras"],
                cantidad_pedida=float(d["CantidadPedida"]),
                costo_estimado=float(d["CostoEstimado"]),
                subtotal_estimado=float(d["SubtotalEstimado"])
            )
            for d in d_rows
        ]

        return PedidoOut(
            id_pedido=p["IDPedido"],
            id_proveedor=p["IDProveedor"],
            proveedor_nombre=p["ProveedorNombre"] or "General",
            numero_pedido=p["NumeroPedido"],
            fecha_pedido=str(p["FechaPedido"]),
            fecha_estimada_entrega=str(p["FechaEstimadaEntrega"]) if p["FechaEstimadaEntrega"] else None,
            total_estimado=float(p["TotalEstimado"]),
            total_unidades=float(p["TotalUnidades"]),
            estado=p["Estado"],
            notas=p["Notas"],
            factura_recepcion=p["FacturaRecepcion"],
            fecha_recepcion=str(p["FechaRecepcion"]) if p["FechaRecepcion"] else None,
            items=items
        )

def crear_pedido(data: PedidoCreateRequest) -> PedidoOut:
    with get_db() as conn:
        cursor = conn.cursor()

        if not data.items:
            raise ValueError("El pedido debe contener al menos un producto.")

        # Resolve provider name
        prov_id = data.id_proveedor
        prov_nombre = data.proveedor_nombre
        if prov_id and not prov_nombre:
            cursor.execute("SELECT RazonSocial FROM PROVEEDORES WHERE IDProveedor = ?", (prov_id,))
            r = cursor.fetchone()
            if r:
                prov_nombre = r["RazonSocial"]

        if not prov_nombre:
            prov_nombre = "General"

        # Generate unique order number
        today_str = datetime.now().strftime("%Y%m%d")
        cursor.execute("SELECT COUNT(*) as c FROM PEDIDOS WHERE DATE(FechaCreacion) = CURRENT_DATE")
        cnt = cursor.fetchone()["c"] + 1
        num_pedido = f"PED-{today_str}-{cnt:03d}"

        # Calculate totals
        total_estimado = 0.0
        total_unidades = 0.0
        details_to_insert = []

        for it in data.items:
            cursor.execute("SELECT IDProducto, Nombre, CodigoInterno, PrecioCompraActual FROM PRODUCTOS WHERE IDProducto = ?", (it.id_producto,))
            prod = cursor.fetchone()
            if not prod:
                raise ValueError(f"Producto ID {it.id_producto} no encontrado.")

            cant = float(it.cantidad_pedida)
            costo = float(it.costo_estimado) if it.costo_estimado > 0 else float(prod["PrecioCompraActual"])
            sub = round(cant * costo, 4)

            total_estimado += sub
            total_unidades += cant
            details_to_insert.append({
                "id_producto": it.id_producto,
                "nombre": prod["Nombre"],
                "codigo": prod["CodigoInterno"],
                "cantidad": cant,
                "costo": costo,
                "subtotal": sub
            })

        fecha_ped = data.fecha_pedido or datetime.now().strftime("%Y-%m-%d")

        cursor.execute(
            """INSERT INTO PEDIDOS (
                IDProveedor, ProveedorNombre, NumeroPedido, FechaPedido, FechaEstimadaEntrega,
                TotalEstimado, TotalUnidades, Estado, Notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)""",
            (prov_id, prov_nombre, num_pedido, fecha_ped, data.fecha_estimada_entrega, total_estimado, total_unidades, data.notas)
        )
        id_pedido = cursor.lastrowid

        items_out = []
        for d in details_to_insert:
            cursor.execute(
                """INSERT INTO PEDIDOS_DETALLE (
                    IDPedido, IDProducto, CantidadPedida, CostoEstimado, SubtotalEstimado
                ) VALUES (?, ?, ?, ?, ?)""",
                (id_pedido, d["id_producto"], d["cantidad"], d["costo"], d["subtotal"])
            )
            det_id = cursor.lastrowid
            items_out.append(
                PedidoDetalleOut(
                    id_detalle_pedido=det_id,
                    id_producto=d["id_producto"],
                    producto_nombre=d["nombre"],
                    producto_codigo=d["codigo"],
                    cantidad_pedida=d["cantidad"],
                    costo_estimado=d["costo"],
                    subtotal_estimado=d["subtotal"]
                )
            )

        return PedidoOut(
            id_pedido=id_pedido,
            id_proveedor=prov_id,
            proveedor_nombre=prov_nombre,
            numero_pedido=num_pedido,
            fecha_pedido=fecha_ped,
            fecha_estimada_entrega=data.fecha_estimada_entrega,
            total_estimado=total_estimado,
            total_unidades=total_unidades,
            estado="PENDIENTE",
            notas=data.notas,
            items=items_out
        )

def actualizar_pedido(id_pedido: int, data: PedidoUpdateRequest) -> PedidoOut:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM PEDIDOS WHERE IDPedido = ?", (id_pedido,))
        p = cursor.fetchone()
        if not p:
            raise ValueError(f"Pedido #{id_pedido} no encontrado.")

        if data.estado:
            cursor.execute("UPDATE PEDIDOS SET Estado = ? WHERE IDPedido = ?", (data.estado, id_pedido))
        if data.fecha_estimada_entrega is not None:
            cursor.execute("UPDATE PEDIDOS SET FechaEstimadaEntrega = ? WHERE IDPedido = ?", (data.fecha_estimada_entrega, id_pedido))
        if data.notas is not None:
            cursor.execute("UPDATE PEDIDOS SET Notas = ? WHERE IDPedido = ?", (data.notas, id_pedido))

        if data.items is not None:
            cursor.execute("DELETE FROM PEDIDOS_DETALLE WHERE IDPedido = ?", (id_pedido,))
            total_estimado = 0.0
            total_unidades = 0.0
            for it in data.items:
                cursor.execute("SELECT IDProducto, Nombre, CodigoInterno, PrecioCompraActual FROM PRODUCTOS WHERE IDProducto = ?", (it.id_producto,))
                prod = cursor.fetchone()
                if not prod:
                    continue
                cant = float(it.cantidad_pedida)
                costo = float(it.costo_estimado) if it.costo_estimado > 0 else float(prod["PrecioCompraActual"])
                sub = round(cant * costo, 4)
                total_estimado += sub
                total_unidades += cant
                cursor.execute(
                    """INSERT INTO PEDIDOS_DETALLE (
                        IDPedido, IDProducto, CantidadPedida, CostoEstimado, SubtotalEstimado
                    ) VALUES (?, ?, ?, ?, ?)""",
                    (id_pedido, it.id_producto, cant, costo, sub)
                )
            cursor.execute(
                "UPDATE PEDIDOS SET TotalEstimado = ?, TotalUnidades = ? WHERE IDPedido = ?",
                (total_estimado, total_unidades, id_pedido)
            )

    return get_pedido_by_id(id_pedido)

def eliminar_pedido(id_pedido: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM PEDIDOS WHERE IDPedido = ?", (id_pedido,))
        return cursor.rowcount > 0

def marcar_pedido_recibido(id_pedido: int, factura_recepcion: str) -> PedidoOut:
    with get_db() as conn:
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            """UPDATE PEDIDOS 
               SET Estado = 'RECIBIDO', FacturaRecepcion = ?, FechaRecepcion = ? 
               WHERE IDPedido = ?""",
            (factura_recepcion, now_str, id_pedido)
        )
    return get_pedido_by_id(id_pedido)

# --- Workers / Trabajadores Services ---
def listar_trabajadores() -> List[TrabajadorOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT u.IDUsuario, u.Username, u.PasswordHash, u.NombreCompleto, u.IDRole, r.Nombre as RoleName, u.Activo, u.FechaCreacion
               FROM USUARIOS u
               JOIN ROLES r ON u.IDRole = r.IDRole
               WHERE u.Activo = 1
               ORDER BY u.IDRole ASC, u.IDUsuario ASC"""
        )
        rows = cursor.fetchall()
        return [
            TrabajadorOut(
                id_usuario=r["IDUsuario"],
                username=r["Username"],
                nombre_completo=r["NombreCompleto"],
                id_role=r["IDRole"],
                role_name=r["RoleName"],
                activo=bool(r["Activo"]),
                fecha_creacion=str(r["FechaCreacion"]),
                puede_iniciar_sesion=not str(r["PasswordHash"]).startswith("!")
            )
            for r in rows
        ]

def crear_trabajador(data: TrabajadorCreate) -> TrabajadorOut:
    with get_db() as conn:
        cursor = conn.cursor()
        nombre = data.nombre_completo.strip()
        if not nombre:
            raise ValueError("El nombre del trabajador no puede estar vacio.")

        import re
        base_user = re.sub(r'[^a-zA-Z0-9]', '', nombre.lower().split()[0])
        clean_user = data.username.strip().lower() if data.username and data.username.strip() else f"{base_user}_{int(datetime.now().timestamp()) % 10000}"

        role_name = (data.rol or "CAJERO").upper()
        cursor.execute("SELECT IDRole FROM ROLES WHERE Nombre = ?", (role_name,))
        role_row = cursor.fetchone()
        role_id = role_row["IDRole"] if role_row else 2

        cursor.execute("SELECT 1 FROM USUARIOS WHERE LOWER(Username) = ?", (clean_user,))
        if cursor.fetchone():
            raise ValueError(f"El usuario '{clean_user}' ya existe. Elige otro nombre de usuario.")

        # Sin clave: el trabajador solo sirve como nombre "a cargo" y no puede iniciar sesion.
        if data.password:
            validate_new_password(data.password)
            pwd_hash = hash_password(data.password)
        else:
            pwd_hash = unusable_password()
        cursor.execute(
            """INSERT INTO USUARIOS (IDRole, Username, PasswordHash, NombreCompleto, Activo)
               VALUES (?, ?, ?, ?, 1)""",
            (role_id, clean_user, pwd_hash, nombre)
        )
        uid = cursor.lastrowid

        cursor.execute(
            """SELECT u.IDUsuario, u.Username, u.PasswordHash, u.NombreCompleto, u.IDRole, r.Nombre as RoleName, u.Activo, u.FechaCreacion
               FROM USUARIOS u
               JOIN ROLES r ON u.IDRole = r.IDRole
               WHERE u.IDUsuario = ?""",
            (uid,)
        )
        row = cursor.fetchone()
        return TrabajadorOut(
            id_usuario=row["IDUsuario"],
            username=row["Username"],
            nombre_completo=row["NombreCompleto"],
            id_role=row["IDRole"],
            role_name=row["RoleName"],
            activo=bool(row["Activo"]),
            fecha_creacion=str(row["FechaCreacion"]),
            puede_iniciar_sesion=not row["PasswordHash"].startswith("!")
        )

def asignar_clave_trabajador(id_usuario: int, password: str) -> None:
    validate_new_password(password)
    with get_db() as conn:
        cur = conn.execute("UPDATE USUARIOS SET PasswordHash = ? WHERE IDUsuario = ? AND Activo = 1", (hash_password(password), id_usuario))
        if cur.rowcount == 0:
            raise LookupError("Trabajador no encontrado.")

def eliminar_trabajador(id_usuario: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        if id_usuario == 1:
            raise ValueError("No se puede eliminar el usuario administrador principal.")
        # Desactivar y anular la clave: pierde el acceso de inmediato.
        cursor.execute("UPDATE USUARIOS SET Activo = 0, PasswordHash = ? WHERE IDUsuario = ?", (unusable_password(), id_usuario))
        return cursor.rowcount > 0


