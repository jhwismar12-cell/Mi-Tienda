import sqlite3
import gzip
import shutil
import os
import hashlib
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.database import get_db, DB_PATH, PROJECT_ROOT, get_backup_dir, ensure_deudores_schema
from backend.auth import hash_password, unusable_password, validate_new_password
from backend.models import (
    ProductoOut, ProductoCreate, ProductoUpdate, ProductoRapidoRequest,
    VentaCobrarRequest, VentaOut, VentaDetalleOut,
    CompraRegistrarRequest, CompraOut, CompraDetalleOut,
    AjusteInventarioRequest, KardexMovimientoOut,
    CajaAbrirRequest, CajaCerrarRequest, CajaMovimientoRequest,
    SesionCajaOut, CashMovementItem, DashboardKPIsOut, HourlySalesItem, TopProductSalesItem,
    BackupResponse,
    PedidoCreateRequest, PedidoUpdateRequest, PedidoOut, PedidoDetalleOut,
    TrabajadorOut, TrabajadorCreate,
    DeudaProductoInput, DeudaCreateRequest, DeudaUpdateRequest,
    DeudaAgregarRequest, DeudaAbonoRequest,
    DeudaProductoOut, DeudaAbonoOut, DeudaOut
)


def now_local_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today_local_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")

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

def validar_y_liberar_codigos_barras(
    cursor: sqlite3.Cursor,
    codigos_barras: List[str],
    exclude_product_id: Optional[int] = None,
) -> List[str]:
    """Valida que los códigos de barras no pertenezcan a otro producto activo.
    Si el código quedó atado a un producto inactivo/huérfano, lo libera automáticamente."""
    cleaned: List[str] = []
    seen = set()
    for raw_bc in codigos_barras:
        bc = (raw_bc or "").strip()
        if not bc or bc in seen:
            continue
        seen.add(bc)

        if exclude_product_id is not None:
            row = cursor.execute(
                """SELECT b.IDCodigo, b.IDProducto, p.Nombre, p.CodigoInterno, p.Activo
                   FROM PRODUCTO_CODIGOS_BARRAS b
                   LEFT JOIN PRODUCTOS p ON p.IDProducto = b.IDProducto
                   WHERE b.CodigoBarras = ? AND b.IDProducto != ?
                   LIMIT 1""",
                (bc, exclude_product_id),
            ).fetchone()
        else:
            row = cursor.execute(
                """SELECT b.IDCodigo, b.IDProducto, p.Nombre, p.CodigoInterno, p.Activo
                   FROM PRODUCTO_CODIGOS_BARRAS b
                   LEFT JOIN PRODUCTOS p ON p.IDProducto = b.IDProducto
                   WHERE b.CodigoBarras = ?
                   LIMIT 1""",
                (bc,),
            ).fetchone()

        if row:
            if row["Nombre"] is None or int(row["Activo"] or 0) == 0:
                cursor.execute(
                    "DELETE FROM PRODUCTO_CODIGOS_BARRAS WHERE IDCodigo = ?",
                    (row["IDCodigo"],),
                )
            else:
                raise ValueError(
                    f'El código de barras "{bc}" ya está registrado en el producto '
                    f'"{row["Nombre"]}" (Cód: {row["CodigoInterno"]}). '
                    f'Búscalo en el inventario para editarlo en lugar de duplicarlo.'
                )
        cleaned.append(bc)
    return cleaned


def crear_producto_rapido(data: ProductoRapidoRequest, id_usuario: int = 1) -> ProductoOut:
    with get_db() as conn:
        cursor = conn.cursor()
        valid_barcodes = validar_y_liberar_codigos_barras(cursor, [data.codigo_barras])
        codigo_barras = valid_barcodes[0] if valid_barcodes else data.codigo_barras.strip()
        codigo_interno = codigo_barras
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
            (pid, codigo_barras)
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
        valid_barcodes = validar_y_liberar_codigos_barras(cursor, data.codigos_barras or [])
        codigo_interno = (data.codigo_interno or "").strip() or (valid_barcodes[0] if valid_barcodes else f"INT-{int(datetime.now().timestamp())}")
        existing_sku = cursor.execute(
            "SELECT IDProducto, Nombre, Activo FROM PRODUCTOS WHERE CodigoInterno = ? LIMIT 1",
            (codigo_interno,),
        ).fetchone()
        if existing_sku:
            if int(existing_sku["Activo"] or 0) == 1:
                raise ValueError(
                    f'El código interno "{codigo_interno}" ya está registrado en el producto "{existing_sku["Nombre"]}".'
                )
            codigo_interno = f"{codigo_interno}-{int(datetime.now().timestamp())}"
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

        for idx, bc in enumerate(valid_barcodes):
            cursor.execute(
                "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal) VALUES (?, ?, ?)",
                (pid, bc, 1 if idx == 0 else 0)
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
                IDUsuario, FechaApertura, MontoInicial, TotalVentasEfectivo, TotalVentasTransferencia, TotalRetiros, TotalEsperado, Estado, Observaciones
            ) VALUES (?, ?, ?, 0.0, 0.0, 0.0, ?, 'ABIERTA', ?)""",
            (data.id_usuario or 1, now_local_str(), data.monto_inicial, data.monto_inicial, data.observaciones or "Apertura de turno")
        )
    return obtener_caja_activa()

def obtener_historial_caja(limit: int = 30) -> List[SesionCajaOut]:
    with get_db() as conn:
        cursor = conn.cursor()
        rows = cursor.execute(
            """SELECT s.*, COALESCE(u.NombreCompleto, 'Cajero') as CajeroNombre
               FROM SESIONES_CAJA s
               LEFT JOIN USUARIOS u ON s.IDUsuario = u.IDUsuario
               ORDER BY s.IDSesionCaja DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [
            SesionCajaOut(
                id_sesion_caja=r["IDSesionCaja"],
                id_usuario=r["IDUsuario"],
                cajero_nombre=r["CajeroNombre"],
                fecha_apertura=str(r["FechaApertura"]),
                fecha_cierre=str(r["FechaCierre"]) if r["FechaCierre"] else None,
                monto_inicial=float(r["MontoInicial"]),
                total_ventas_efectivo=float(r["TotalVentasEfectivo"]),
                total_ventas_transferencia=float(r["TotalVentasTransferencia"]),
                total_retiros=float(r["TotalRetiros"]),
                total_esperado=float(r["TotalEsperado"]),
                total_real_entregado=float(r["TotalRealEntregado"]) if r["TotalRealEntregado"] is not None else None,
                diferencia=float(r["Diferencia"]) if r["Diferencia"] is not None else None,
                estado=r["Estado"],
                observaciones=r["Observaciones"],
                movimientos=[],
            )
            for r in rows
        ]

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
               SET Estado = 'CERRADA', FechaCierre = ?, TotalRealEntregado = ?, Diferencia = ?, Observaciones = ?
               WHERE IDSesionCaja = ?""",
            (now_local_str(), real, diferencia, data.observaciones, sid)
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

def eliminar_movimiento_caja(id_movimiento_caja: int) -> SesionCajaOut:
    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        active = require_active_session(conn)
        sid = active["IDSesionCaja"]

        mov = cursor.execute(
            "SELECT * FROM MOVIMIENTOS_CAJA WHERE IDMovimientoCaja = ? AND IDSesionCaja = ?",
            (id_movimiento_caja, sid),
        ).fetchone()
        if not mov:
            raise ValueError("Movimiento de caja no encontrado en el turno activo.")

        monto = float(mov["Monto"])
        cursor.execute("DELETE FROM MOVIMIENTOS_CAJA WHERE IDMovimientoCaja = ?", (id_movimiento_caja,))
        if mov["Tipo"] == "RETIRO":
            cursor.execute(
                """UPDATE SESIONES_CAJA
                   SET TotalRetiros = MAX(0, TotalRetiros - ?),
                       TotalEsperado = TotalEsperado + ?
                   WHERE IDSesionCaja = ?""",
                (monto, monto, sid),
            )
        else:
            cursor.execute(
                """UPDATE SESIONES_CAJA
                   SET TotalEsperado = TotalEsperado - ?
                   WHERE IDSesionCaja = ?""",
                (monto, sid),
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
        descuento_global = round(float(data.descuento or 0.0), 2)
        impuestos_total = round(float(data.impuestos or 0.0), 2)
        total_final = round(subtotal_total - descuento_global + impuestos_total, 2)
        if total_final < 0:
            raise ValueError("El descuento supera el importe de la venta.")

        if data.metodo_pago == "EFECTIVO":
            monto_rec = round(float(data.monto_recibido), 2)
            if monto_rec < total_final:
                raise ValueError("El efectivo recibido es insuficiente para cubrir el total.")
            cambio = max(0.0, round(monto_rec - total_final, 2))
            monto_ef_neto = total_final
            monto_tr_neto = 0.0
        elif data.metodo_pago == "TRANSFERENCIA":
            monto_rec = total_final
            cambio = 0.0
            monto_ef_neto = 0.0
            monto_tr_neto = total_final
        else:
            # Pago MIXTO (Efectivo + Transferencia)
            raw_ef = float(data.monto_efectivo) if data.monto_efectivo is not None else float(data.monto_recibido or 0.0)
            raw_tr = float(data.monto_transferencia) if data.monto_transferencia is not None else max(0.0, round(total_final - raw_ef, 2))
            raw_ef = round(raw_ef, 2)
            raw_tr = round(raw_tr, 2)
            if raw_ef < 0 or raw_tr < 0:
                raise ValueError("Los montos de pago mixto no pueden ser negativos.")
            if round(raw_ef + raw_tr, 2) < total_final:
                raise ValueError("La suma de efectivo y transferencia no cubre el total de la venta.")
            cambio = max(0.0, round((raw_ef + raw_tr) - total_final, 2))
            monto_tr_neto = min(raw_tr, total_final)
            monto_ef_neto = round(total_final - monto_tr_neto, 2)
            monto_rec = raw_ef

        # Generate Ticket Number
        cursor.execute("SELECT COALESCE(MAX(IDVenta), 0) FROM VENTAS")
        total_sales_count = cursor.fetchone()[0]
        numero_venta = f"TK-{4094 + total_sales_count}"

        # 1. Insert Venta Cabecera (FechaHora in local time; SQLite CURRENT_TIMESTAMP is UTC)
        fecha_venta = now_local_str()
        cursor.execute(
            """INSERT INTO VENTAS (
                IDSesionCaja, IDUsuario, NumeroVenta, FechaHora, Subtotal, Descuento, Impuestos, Total,
                MetodoPago, MontoRecibido, Cambio, MontoEfectivo, MontoTransferencia, CajeroNombre, Estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA')""",
            (
                sid, user_id, numero_venta, fecha_venta, subtotal_total, descuento_global,
                impuestos_total, total_final, data.metodo_pago, monto_rec, cambio,
                monto_ef_neto, monto_tr_neto, cajero_name
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
                "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = ? WHERE IDProducto = ?",
                (stock_post, fecha_venta, d["id_producto"])
            )

            # Insert into Ledger
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    FechaHora, IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, ?, 'SALIDA_VENTA', ?, ?, ?, ?, ?, ?)""",
                (fecha_venta, d["id_producto"], -d["cantidad"], stock_ant, stock_post, numero_venta, user_id, f"Venta ticket #{numero_venta} (A cargo: {cajero_name})")
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
        if monto_ef_neto > 0 and monto_tr_neto > 0:
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalVentasEfectivo = TotalVentasEfectivo + ?,
                       TotalVentasTransferencia = TotalVentasTransferencia + ?,
                       TotalEsperado = TotalEsperado + ? 
                   WHERE IDSesionCaja = ?""",
                (monto_ef_neto, monto_tr_neto, monto_ef_neto, sid)
            )
        elif monto_ef_neto > 0:
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalVentasEfectivo = TotalVentasEfectivo + ?, TotalEsperado = TotalEsperado + ? 
                   WHERE IDSesionCaja = ?""",
                (monto_ef_neto, monto_ef_neto, sid)
            )
        elif monto_tr_neto > 0:
            cursor.execute(
                """UPDATE SESIONES_CAJA 
                   SET TotalVentasTransferencia = TotalVentasTransferencia + ? 
                   WHERE IDSesionCaja = ?""",
                (monto_tr_neto, sid)
            )

        result = VentaOut(
            id_venta=vid,
            id_sesion_caja=sid,
            id_usuario=user_id,
            cajero_nombre=cajero_name,
            numero_venta=numero_venta,
            fecha_hora=fecha_venta,
            subtotal=subtotal_total,
            descuento=descuento_global,
            impuestos=impuestos_total,
            total=total_final,
            metodo_pago=data.metodo_pago,
            monto_recibido=monto_rec,
            cambio=cambio,
            monto_efectivo=monto_ef_neto,
            monto_transferencia=monto_tr_neto,
            estado="CONFIRMADA",
            items=items_out
        )
        if data.clave_idempotencia:
            cursor.execute(
                "INSERT INTO COBROS_IDEMPOTENTES (Clave, SolicitudHash, IDVenta, Respuesta) VALUES (?, ?, ?, ?)",
                (data.clave_idempotencia, request_hash, vid, result.model_dump_json())
            )
        return result


def anular_venta(id_venta: int, motivo: str, id_usuario: int = 1) -> VentaOut:
    motivo_clean = (motivo or "").strip()
    if len(motivo_clean) < 3:
        raise ValueError("Debes indicar un motivo para anular la venta.")

    with get_db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        sale = cursor.execute(
            """SELECT v.*, COALESCE(v.CajeroNombre, u.NombreCompleto, 'Cajero') as CajeroNombreResuelto
               FROM VENTAS v
               LEFT JOIN USUARIOS u ON v.IDUsuario = u.IDUsuario
               WHERE v.IDVenta = ?""",
            (id_venta,),
        ).fetchone()
        if not sale:
            raise ValueError("Venta no encontrada.")
        if sale["Estado"] == "ANULADA":
            raise ValueError("Esta venta ya se encuentra anulada.")

        fecha_anulacion = now_local_str()
        cursor.execute(
            "UPDATE VENTAS SET Estado = 'ANULADA', MotivoAnulacion = ? WHERE IDVenta = ?",
            (motivo_clean, id_venta),
        )

        # Restore stock and log Kardex ANULACION_VENTA
        det_rows = cursor.execute(
            """SELECT d.*, p.Nombre as ProductoNombre, p.CodigoInterno as ProductoCodigo, p.StockActual
               FROM VENTAS_DETALLE d
               JOIN PRODUCTOS p ON d.IDProducto = p.IDProducto
               WHERE d.IDVenta = ?""",
            (id_venta,),
        ).fetchall()

        items_out: List[VentaDetalleOut] = []
        for dr in det_rows:
            cant = float(dr["Cantidad"])
            stock_ant = float(dr["StockActual"])
            stock_post = round(stock_ant + cant, 3)
            cursor.execute(
                "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = ? WHERE IDProducto = ?",
                (stock_post, fecha_anulacion, dr["IDProducto"]),
            )
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    FechaHora, IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, ?, 'ANULACION_VENTA', ?, ?, ?, ?, ?, ?)""",
                (
                    fecha_anulacion,
                    dr["IDProducto"],
                    cant,
                    stock_ant,
                    stock_post,
                    sale["NumeroVenta"],
                    id_usuario,
                    f"Anulación ticket #{sale['NumeroVenta']}: {motivo_clean}",
                ),
            )
            items_out.append(
                VentaDetalleOut(
                    id_detalle_venta=dr["IDDetalleVenta"],
                    id_producto=dr["IDProducto"],
                    producto_nombre=dr["ProductoNombre"],
                    producto_codigo=dr["ProductoCodigo"],
                    cantidad=cant,
                    precio_unitario=float(dr["PrecioUnitario"]),
                    costo_unitario=float(dr["CostoUnitarioAlMomento"]),
                    descuento=float(dr["Descuento"]),
                    subtotal=float(dr["Subtotal"]),
                )
            )

        # Reverse active cash register session totals if still open
        sess = cursor.execute(
            "SELECT IDSesionCaja, Estado FROM SESIONES_CAJA WHERE IDSesionCaja = ?",
            (sale["IDSesionCaja"],),
        ).fetchone()
        total_sale = float(sale["Total"])
        ef_part = float(sale["MontoEfectivo"]) if "MontoEfectivo" in sale.keys() and sale["MontoEfectivo"] is not None else 0.0
        tr_part = float(sale["MontoTransferencia"]) if "MontoTransferencia" in sale.keys() and sale["MontoTransferencia"] is not None else 0.0
        if ef_part == 0.0 and tr_part == 0.0 and total_sale > 0:
            if sale["MetodoPago"] == "EFECTIVO":
                ef_part = total_sale
            else:
                tr_part = total_sale

        if sess and sess["Estado"] == "ABIERTA":
            cursor.execute(
                """UPDATE SESIONES_CAJA
                   SET TotalVentasEfectivo = MAX(0, TotalVentasEfectivo - ?),
                       TotalVentasTransferencia = MAX(0, TotalVentasTransferencia - ?),
                       TotalEsperado = TotalEsperado - ?
                   WHERE IDSesionCaja = ?""",
                (ef_part, tr_part, ef_part, sess["IDSesionCaja"]),
            )

        return VentaOut(
            id_venta=id_venta,
            id_sesion_caja=sale["IDSesionCaja"],
            id_usuario=sale["IDUsuario"],
            cajero_nombre=sale["CajeroNombreResuelto"],
            numero_venta=sale["NumeroVenta"],
            fecha_hora=str(sale["FechaHora"]),
            subtotal=float(sale["Subtotal"]),
            descuento=float(sale["Descuento"]),
            impuestos=float(sale["Impuestos"]),
            total=total_sale,
            metodo_pago=sale["MetodoPago"],
            monto_recibido=float(sale["MontoRecibido"]),
            cambio=float(sale["Cambio"]),
            monto_efectivo=ef_part,
            monto_transferencia=tr_part,
            estado="ANULADA",
            motivo_anulacion=motivo_clean,
            items=items_out,
        )

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

            # Resolve product (only active products)
            pid = it.id_producto
            if not pid and it.codigo:
                cursor.execute(
                    """SELECT p.IDProducto FROM PRODUCTOS p 
                       LEFT JOIN PRODUCTO_CODIGOS_BARRAS b ON p.IDProducto = b.IDProducto 
                       WHERE (p.CodigoInterno = ? OR b.CodigoBarras = ?) AND p.Activo = 1 LIMIT 1""",
                    (it.codigo, it.codigo)
                )
                p_row = cursor.fetchone()
                if p_row:
                    pid = p_row["IDProducto"]
                else:
                    # Create new product on the fly linked to supplier
                    p_name = it.nombre or f"Producto {it.codigo}"
                    p_sale = float(it.precio_venta_sugerido or (costo * 1.3))
                    valid_bcs = validar_y_liberar_codigos_barras(cursor, [it.codigo])
                    codigo_int = it.codigo.strip()
                    if cursor.execute("SELECT 1 FROM PRODUCTOS WHERE CodigoInterno = ?", (codigo_int,)).fetchone():
                        codigo_int = f"AUT-{int(datetime.now().timestamp())}-{len(processed_items)}"
                    cursor.execute(
                        """INSERT INTO PRODUCTOS (
                            IDCategoria, IDProveedor, CodigoInterno, Nombre, PrecioCompraActual, PrecioVentaActual,
                            MargenMinimoPorcentaje, StockMinimo, StockActual, PermiteFraccion, Activo
                        ) VALUES (1, ?, ?, ?, ?, ?, 15.0, 5.0, 0.0, 0, 1)""",
                        (data.id_proveedor, codigo_int, p_name, costo, p_sale)
                    )
                    pid = cursor.lastrowid
                    if valid_bcs:
                        cursor.execute(
                            "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal) VALUES (?, ?, 1)",
                            (pid, valid_bcs[0])
                        )

            if not pid:
                raise ValueError(f"No se pudo identificar el producto para el item {it.nombre or it.codigo}")

            cursor.execute("SELECT IDProducto, CodigoInterno, Nombre, PrecioCompraActual, PrecioVentaActual, StockActual FROM PRODUCTOS WHERE IDProducto = ?", (pid,))
            prod = cursor.fetchone()
            if not prod:
                raise ValueError(f"Producto con ID {pid} no encontrado.")

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

        # 1. Insert Compra Cabecera (local timestamp)
        fecha_compra = now_local_str()
        cursor.execute(
            """INSERT INTO COMPRAS (
                IDProveedor, IDUsuario, NumeroDocumento, FechaHora, Subtotal, Descuento, Impuestos, Total, Estado, Observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?)""",
            (data.id_proveedor, user_id, data.numero_documento, fecha_compra, subtotal_total, data.descuento or 0.0, data.impuestos or 0.0, total_final, data.observaciones)
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
                "UPDATE PRODUCTOS SET StockActual = ?, PrecioCompraActual = ?, FechaModificacion = ? WHERE IDProducto = ?",
                (stock_post, it["costo_unitario"], fecha_compra, it["id_producto"])
            )

            # Check price history for purchase
            if abs(it["costo_unitario"] - it["prev_cost"]) > 0.001:
                cursor.execute(
                    """INSERT INTO HISTORIAL_PRECIOS (
                        FechaHora, IDProducto, TipoPrecio, PrecioAnterior, PrecioNuevo, IDUsuario, Motivo
                    ) VALUES (?, ?, 'COMPRA', ?, ?, ?, ?)""",
                    (fecha_compra, it["id_producto"], it["prev_cost"], it["costo_unitario"], user_id, f"Compra Factura #{data.numero_documento}")
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
                            FechaHora, IDProducto, TipoPrecio, PrecioAnterior, PrecioNuevo, IDUsuario, Motivo
                        ) VALUES (?, ?, 'VENTA', ?, ?, ?, ?)""",
                        (fecha_compra, it["id_producto"], it["prev_sale"], p_sug, user_id, f"Actualizacion por Compra #{data.numero_documento}")
                    )

            # Insert into Kardex Ledger
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    FechaHora, IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, ?, 'ENTRADA_COMPRA', ?, ?, ?, ?, ?, ?)""",
                (fecha_compra, it["id_producto"], it["cantidad"], stock_ant, stock_post, data.numero_documento, user_id, f"Ingreso compra Factura #{data.numero_documento}")
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

        fecha_ajuste = now_local_str()
        cursor.execute(
            "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = ? WHERE IDProducto = ?",
            (stock_post, fecha_ajuste, data.id_producto)
        )

        doc_ref = f"AJ-{int(datetime.now().timestamp())}"
        cursor.execute(
            """INSERT INTO MOVIMIENTOS_INVENTARIO (
                FechaHora, IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (fecha_ajuste, data.id_producto, data.tipo_ajuste, delta, stock_ant, stock_post, doc_ref, user_id, data.motivo or "Ajuste manual de inventario")
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
        query = """SELECT m.*,
                          p.Nombre as ProductoNombre,
                          p.CodigoInterno as ProductoCodigo,
                          p.PrecioCompraActual as ProductoPrecioCompra,
                          p.PrecioVentaActual as ProductoPrecioVenta,
                          (
                              SELECT vd.PrecioUnitario
                              FROM VENTAS v
                              JOIN VENTAS_DETALLE vd ON vd.IDVenta = v.IDVenta
                              WHERE v.NumeroVenta = m.ReferenciaID
                                AND vd.IDProducto = m.IDProducto
                              ORDER BY vd.IDDetalleVenta DESC
                              LIMIT 1
                          ) as VentaPrecioUnitario,
                          u.NombreCompleto as UsuarioNombre
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

        results = []
        for r in rows:
            is_sale = r["TipoMovimiento"] in ("VENTA", "SALIDA_VENTA")
            sale_pvp = r["VentaPrecioUnitario"] if (is_sale and r["VentaPrecioUnitario"] is not None) else r["ProductoPrecioVenta"]
            results.append(
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
                    costo_unitario=round(float(r["ProductoPrecioCompra"] or 0.0), 4),
                    precio_venta_unitario=round(float(sale_pvp or 0.0), 4),
                    referencia_id=r["ReferenciaID"],
                    id_usuario=r["IDUsuario"],
                    usuario_nombre=r["UsuarioNombre"],
                    observacion=r["Observacion"]
                )
            )
        return results

# --- Dashboard KPIs ---
def obtener_dashboard_kpis(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
) -> DashboardKPIsOut:
    with get_db() as conn:
        cursor = conn.cursor()
        f_ini = (fecha_inicio or today_local_str()).strip()[:10]
        f_fin = (fecha_fin or f_ini).strip()[:10]
        if f_fin < f_ini:
            f_ini, f_fin = f_fin, f_ini
        start_ts = f"{f_ini} 00:00:00"
        end_ts = f"{f_fin} 23:59:59"

        # Confirmed sales in range
        cursor.execute(
            """SELECT
                   COUNT(*) as TicketsTotal,
                   COALESCE(SUM(Total), 0) as VentasTotal,
                   COALESCE(SUM(Descuento), 0) as DescuentosTotal,
                   SUM(CASE WHEN MetodoPago = 'EFECTIVO' THEN 1 ELSE 0 END) as TicketsEf,
                   SUM(CASE WHEN MetodoPago = 'TRANSFERENCIA' THEN 1 ELSE 0 END) as TicketsTr,
                   SUM(CASE WHEN MetodoPago = 'MIXTO' THEN 1 ELSE 0 END) as TicketsMix,
                   COALESCE(SUM(CASE WHEN MontoEfectivo > 0 OR MontoTransferencia > 0 THEN MontoEfectivo WHEN MetodoPago = 'EFECTIVO' THEN Total ELSE 0 END), 0) as VentasEf,
                   COALESCE(SUM(CASE WHEN MontoEfectivo > 0 OR MontoTransferencia > 0 THEN MontoTransferencia WHEN MetodoPago != 'EFECTIVO' THEN Total ELSE 0 END), 0) as VentasTr
               FROM VENTAS
               WHERE FechaHora >= ? AND FechaHora <= ? AND Estado = 'CONFIRMADA'""",
            (start_ts, end_ts)
        )
        sales_agg = cursor.fetchone()
        tickets_total = int(sales_agg["TicketsTotal"] or 0)
        ventas_total = round(float(sales_agg["VentasTotal"] or 0.0), 2)
        descuentos_total = round(float(sales_agg["DescuentosTotal"] or 0.0), 2)
        tickets_ef = int(sales_agg["TicketsEf"] or 0)
        tickets_tr = int(sales_agg["TicketsTr"] or 0)
        tickets_mix = int(sales_agg["TicketsMix"] or 0)
        ventas_ef = round(float(sales_agg["VentasEf"] or 0.0), 2)
        ventas_tr = round(float(sales_agg["VentasTr"] or 0.0), 2)

        # Voided tickets in range
        tickets_anulados = int(
            cursor.execute(
                "SELECT COUNT(*) FROM VENTAS WHERE FechaHora >= ? AND FechaHora <= ? AND Estado = 'ANULADA'",
                (start_ts, end_ts),
            ).fetchone()[0]
        )

        # Gross profit in range
        cursor.execute(
            """SELECT COALESCE(SUM((d.PrecioUnitario - d.CostoUnitarioAlMomento) * d.Cantidad - d.Descuento), 0) as Ganancia
               FROM VENTAS_DETALLE d
               JOIN VENTAS v ON d.IDVenta = v.IDVenta
               WHERE v.FechaHora >= ? AND v.FechaHora <= ? AND v.Estado = 'CONFIRMADA'""",
            (start_ts, end_ts)
        )
        ganancia_total = round(float(cursor.fetchone()["Ganancia"] or 0.0) - descuentos_total, 2)
        margen_prom = round((ganancia_total / ventas_total * 100), 1) if ventas_total > 0 else 0.0

        # Inventory valuations & alerts
        cursor.execute("SELECT PrecioCompraActual, PrecioVentaActual, StockActual, StockMinimo FROM PRODUCTOS WHERE Activo = 1")
        prods = cursor.fetchall()
        val_costo = sum(float(p["PrecioCompraActual"]) * float(p["StockActual"]) for p in prods)
        val_venta = sum(float(p["PrecioVentaActual"]) * float(p["StockActual"]) for p in prods)
        stock_bajo = sum(1 for p in prods if 0 < float(p["StockActual"]) <= float(p["StockMinimo"]))
        agotados = sum(1 for p in prods if float(p["StockActual"]) <= 0)

        # Recent cost increase count in range
        cursor.execute(
            """SELECT COUNT(*) FROM HISTORIAL_PRECIOS
               WHERE TipoPrecio = 'COMPRA' AND PrecioNuevo > PrecioAnterior
                 AND FechaHora >= ? AND FechaHora <= ?""",
            (start_ts, end_ts)
        )
        costos_incr = int(cursor.fetchone()[0])

        # Hourly sales in range
        cursor.execute(
            """SELECT strftime('%H:00', FechaHora) as Hora, SUM(Total) as Monto, COUNT(*) as Tickets
               FROM VENTAS
               WHERE FechaHora >= ? AND FechaHora <= ? AND Estado = 'CONFIRMADA'
               GROUP BY Hora ORDER BY Hora ASC""",
            (start_ts, end_ts)
        )
        hourly_rows = cursor.fetchall()
        ventas_hora = [
            HourlySalesItem(hora=hr["Hora"], monto=round(float(hr["Monto"]), 2), tickets=int(hr["Tickets"]))
            for hr in hourly_rows if hr["Hora"]
        ]

        # Top 10 best-selling products in range
        cursor.execute(
            """SELECT d.IDProducto, p.CodigoInterno, p.Nombre,
                      SUM(d.Cantidad) as Unidades,
                      SUM(d.Subtotal) as Ingresos,
                      SUM((d.PrecioUnitario - d.CostoUnitarioAlMomento) * d.Cantidad - d.Descuento) as Ganancia
               FROM VENTAS_DETALLE d
               JOIN VENTAS v ON d.IDVenta = v.IDVenta
               JOIN PRODUCTOS p ON d.IDProducto = p.IDProducto
               WHERE v.FechaHora >= ? AND v.FechaHora <= ? AND v.Estado = 'CONFIRMADA'
               GROUP BY d.IDProducto, p.CodigoInterno, p.Nombre
               ORDER BY Ingresos DESC, Unidades DESC
               LIMIT 10""",
            (start_ts, end_ts)
        )
        top_productos = [
            TopProductSalesItem(
                id_producto=r["IDProducto"],
                codigo=r["CodigoInterno"],
                nombre=r["Nombre"],
                unidades=round(float(r["Unidades"]), 3),
                ingresos=round(float(r["Ingresos"]), 2),
                ganancia=round(float(r["Ganancia"]), 2),
            )
            for r in cursor.fetchall()
        ]

        caja_act = obtener_caja_activa()

        return DashboardKPIsOut(
            fecha_inicio=f_ini,
            fecha_fin=f_fin,
            ventas_hoy_total=ventas_total,
            tickets_hoy_total=tickets_total,
            tickets_efectivo=tickets_ef,
            tickets_transferencia=tickets_tr,
            tickets_mixto=tickets_mix,
            tickets_anulados=tickets_anulados,
            ventas_efectivo_total=ventas_ef,
            ventas_transferencia_total=ventas_tr,
            ganancia_bruta_hoy=ganancia_total,
            margen_promedio_hoy=margen_prom,
            valor_inventario_costo=round(val_costo, 2),
            valor_inventario_venta=round(val_venta, 2),
            productos_stock_bajo=stock_bajo,
            productos_agotados=agotados,
            costos_incrementados_recientes=costos_incr,
            caja_activa=caja_act,
            ventas_por_hora=ventas_hora,
            top_productos=top_productos,
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
        conn.execute("BEGIN IMMEDIATE")
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

        # Generate collision-safe unique order number based on local date + MAX suffix
        today_str = datetime.now().strftime("%Y%m%d")
        prefix = f"PED-{today_str}-"
        max_seq = cursor.execute(
            "SELECT COALESCE(MAX(CAST(SUBSTR(NumeroPedido, ?) AS INTEGER)), 0) FROM PEDIDOS WHERE NumeroPedido LIKE ?",
            (len(prefix) + 1, f"{prefix}%"),
        ).fetchone()[0]
        num_pedido = f"{prefix}{(int(max_seq or 0) + 1):03d}"

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


# --- Debtors / Deudores (Fiados) Services ---
def _map_deuda_row(cursor: sqlite3.Cursor, row: sqlite3.Row) -> DeudaOut:
    did = int(row["IDDeuda"])
    item_rows = cursor.execute(
        "SELECT * FROM DEUDAS_PRODUCTOS WHERE IDDeuda = ? ORDER BY IDDeudaProducto ASC",
        (did,),
    ).fetchall()
    abono_rows = cursor.execute(
        "SELECT * FROM DEUDAS_ABONOS WHERE IDDeuda = ? ORDER BY FechaHora DESC, IDAbono DESC",
        (did,),
    ).fetchall()

    return DeudaOut(
        id_deuda=did,
        nombre_persona=row["NombrePersona"],
        telefono=row["Telefono"],
        tipo_deuda=row["TipoDeuda"],
        total_deuda=round(float(row["TotalDeuda"]), 2),
        total_abonado=round(float(row["TotalAbonado"]), 2),
        saldo_pendiente=round(float(row["SaldoPendiente"]), 2),
        estado=row["Estado"],
        notas=row["Notas"],
        fecha_creacion=str(row["FechaCreacion"]),
        fecha_actualizacion=str(row["FechaActualizacion"]),
        fecha_pago=str(row["FechaPago"]) if row["FechaPago"] else None,
        items=[
            DeudaProductoOut(
                id_deuda_producto=int(i["IDDeudaProducto"]),
                id_producto=int(i["IDProducto"]) if i["IDProducto"] is not None else None,
                nombre_producto=i["NombreProducto"],
                cantidad=float(i["Cantidad"]),
                precio_unitario=float(i["PrecioUnitario"]),
                subtotal=round(float(i["Subtotal"]), 2),
                fecha_registro=str(i["FechaRegistro"]),
            )
            for i in item_rows
        ],
        abonos=[
            DeudaAbonoOut(
                id_abono=int(a["IDAbono"]),
                monto=round(float(a["Monto"]), 2),
                metodo_pago=a["MetodoPago"],
                nota=a["Nota"],
                registrar_en_caja=bool(a["RegistrarEnCaja"]),
                id_movimiento_caja=int(a["IDMovimientoCaja"]) if a["IDMovimientoCaja"] is not None else None,
                fecha_hora=str(a["FechaHora"]),
            )
            for a in abono_rows
        ],
    )


def _descontar_stock_items_deuda(
    cursor: sqlite3.Cursor,
    items: List[DeudaProductoInput],
    nombre_persona: str,
    id_deuda: int,
    id_usuario: int,
    ahora: str,
) -> None:
    for it in items:
        if it.id_producto is None:
            continue
        prod = cursor.execute(
            "SELECT IDProducto, StockActual FROM PRODUCTOS WHERE IDProducto = ?",
            (it.id_producto,),
        ).fetchone()
        if not prod:
            continue
        stock_ant = float(prod["StockActual"])
        cant = float(it.cantidad)
        stock_post = max(0.0, round(stock_ant - cant, 3))
        cursor.execute(
            "UPDATE PRODUCTOS SET StockActual = ?, FechaModificacion = ? WHERE IDProducto = ?",
            (stock_post, ahora, it.id_producto),
        )
        cursor.execute(
            """INSERT INTO MOVIMIENTOS_INVENTARIO (
                FechaHora, IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior,
                ReferenciaID, IDUsuario, Observacion
            ) VALUES (?, ?, 'AJUSTE_NEGATIVO', ?, ?, ?, ?, ?, ?)""",
            (
                ahora,
                it.id_producto,
                -cant,
                stock_ant,
                stock_post,
                f"FIADO-{id_deuda}",
                id_usuario,
                f"Fiado a {nombre_persona}",
            ),
        )


def listar_deudores() -> List[DeudaOut]:
    with get_db() as conn:
        ensure_deudores_schema(conn)
        cursor = conn.cursor()
        rows = cursor.execute(
            """SELECT * FROM DEUDAS
               ORDER BY CASE WHEN Estado = 'PENDIENTE' THEN 0 ELSE 1 END,
                        FechaActualizacion DESC,
                        IDDeuda DESC"""
        ).fetchall()
        return [_map_deuda_row(cursor, r) for r in rows]


def crear_deuda(data: DeudaCreateRequest) -> DeudaOut:
    nombre = data.nombre_persona.strip()
    if not nombre:
        raise ValueError("El nombre de la persona es obligatorio.")
    telefono = (data.telefono or "").strip() or None
    notas = (data.notas or "").strip() or None
    uid = int(data.id_usuario or 1)
    ahora = now_local_str()

    prepared_items: List[dict] = []
    if data.tipo_deuda == "PRODUCTOS":
        if not data.items:
            raise ValueError("Agrega al menos un producto para registrar una deuda con productos.")
        total = 0.0
        for it in data.items:
            p_name = it.nombre_producto.strip()
            if not p_name:
                raise ValueError("Todos los productos deben tener nombre.")
            cant = float(it.cantidad)
            precio = float(it.precio_unitario)
            sub = round(cant * precio, 2)
            total = round(total + sub, 2)
            prepared_items.append(
                {
                    "id_producto": it.id_producto,
                    "nombre_producto": p_name,
                    "cantidad": cant,
                    "precio_unitario": precio,
                    "subtotal": sub,
                }
            )
        if total <= 0:
            raise ValueError("El total a pagar debe ser mayor a $0.00.")
    else:
        if data.monto is None or float(data.monto) <= 0:
            raise ValueError("La cantidad de dinero adeudada debe ser mayor a $0.00.")
        total = round(float(data.monto), 2)

    with get_db() as conn:
        ensure_deudores_schema(conn)
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO DEUDAS (
                NombrePersona, Telefono, TipoDeuda, TotalDeuda, TotalAbonado, SaldoPendiente,
                Estado, Notas, IDUsuario, FechaCreacion, FechaActualizacion
            ) VALUES (?, ?, ?, ?, 0.00, ?, 'PENDIENTE', ?, ?, ?, ?)""",
            (nombre, telefono, data.tipo_deuda, total, total, notas, uid, ahora, ahora),
        )
        did = cursor.lastrowid
        for it in prepared_items:
            cursor.execute(
                """INSERT INTO DEUDAS_PRODUCTOS (
                    IDDeuda, IDProducto, NombreProducto, Cantidad, PrecioUnitario, Subtotal, FechaRegistro
                ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    did,
                    it["id_producto"],
                    it["nombre_producto"],
                    it["cantidad"],
                    it["precio_unitario"],
                    it["subtotal"],
                    ahora,
                ),
            )
        if data.tipo_deuda == "PRODUCTOS" and data.descontar_stock and data.items:
            _descontar_stock_items_deuda(cursor, data.items, nombre, did, uid, ahora)

        row = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (did,)).fetchone()
        return _map_deuda_row(cursor, row)


def agregar_a_deuda(id_deuda: int, data: DeudaAgregarRequest) -> DeudaOut:
    uid = int(data.id_usuario or 1)
    ahora = now_local_str()
    has_extra_money = data.monto_extra is not None and float(data.monto_extra) > 0
    has_items = len(data.items) > 0
    if not has_extra_money and not has_items:
        raise ValueError("Indica un monto adicional o al menos un producto para sumar a la deuda.")

    with get_db() as conn:
        ensure_deudores_schema(conn)
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,)).fetchone()
        if not row:
            raise LookupError("Deudor no encontrado.")

        added_total = round(float(data.monto_extra), 2) if has_extra_money else 0.0
        for it in data.items:
            p_name = it.nombre_producto.strip()
            if not p_name:
                raise ValueError("Todos los productos deben tener nombre.")
            cant = float(it.cantidad)
            precio = float(it.precio_unitario)
            sub = round(cant * precio, 2)
            added_total = round(added_total + sub, 2)
            cursor.execute(
                """INSERT INTO DEUDAS_PRODUCTOS (
                    IDDeuda, IDProducto, NombreProducto, Cantidad, PrecioUnitario, Subtotal, FechaRegistro
                ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (id_deuda, it.id_producto, p_name, cant, precio, sub, ahora),
            )

        if added_total <= 0:
            raise ValueError("El monto a sumar debe ser mayor a $0.00.")

        if has_items and data.descontar_stock:
            _descontar_stock_items_deuda(cursor, data.items, row["NombrePersona"], id_deuda, uid, ahora)

        new_total = round(float(row["TotalDeuda"]) + added_total, 2)
        abonado = round(float(row["TotalAbonado"]), 2)
        new_saldo = max(0.0, round(new_total - abonado, 2))
        new_estado = "PAGADO" if new_saldo <= 0.005 else "PENDIENTE"
        new_tipo = "PRODUCTOS" if (row["TipoDeuda"] == "PRODUCTOS" or has_items) else "MONTO"

        next_notas = row["Notas"]
        if data.nota and data.nota.strip():
            clean_note = data.nota.strip()
            next_notas = f"{next_notas} | {clean_note}" if next_notas else clean_note

        cursor.execute(
            """UPDATE DEUDAS
               SET TipoDeuda = ?, TotalDeuda = ?, SaldoPendiente = ?, Estado = ?,
                   Notas = ?, FechaActualizacion = ?, FechaPago = CASE WHEN ? = 'PENDIENTE' THEN NULL ELSE FechaPago END
               WHERE IDDeuda = ?""",
            (new_tipo, new_total, new_saldo, new_estado, next_notas, ahora, new_estado, id_deuda),
        )
        updated = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,)).fetchone()
        return _map_deuda_row(cursor, updated)


def registrar_abono_deuda(id_deuda: int, data: DeudaAbonoRequest) -> DeudaOut:
    uid = int(data.id_usuario or 1)
    ahora = now_local_str()
    monto = round(float(data.monto), 2)
    if monto <= 0:
        raise ValueError("El monto del abono debe ser mayor a $0.00.")

    with get_db() as conn:
        ensure_deudores_schema(conn)
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,)).fetchone()
        if not row:
            raise LookupError("Deudor no encontrado.")

        saldo_actual = round(float(row["SaldoPendiente"]), 2)
        if saldo_actual <= 0.005:
            raise ValueError("Esta deuda ya está completamente pagada.")
        if monto > saldo_actual + 0.01:
            raise ValueError(f"El abono (${monto:.2f}) supera el saldo pendiente (${saldo_actual:.2f}).")
        if monto > saldo_actual:
            monto = saldo_actual

        mov_caja_id = None
        recorded_in_cash = 0
        if data.registrar_en_caja:
            active_shift = cursor.execute(
                "SELECT IDSesionCaja FROM SESIONES_CAJA WHERE Estado = 'ABIERTA' ORDER BY IDSesionCaja DESC LIMIT 1"
            ).fetchone()
            if active_shift:
                sid = int(active_shift["IDSesionCaja"])
                nota_txt = f" ({data.nota.strip()})" if data.nota and data.nota.strip() else ""
                desc_caja = f"Pago deuda: {row['NombrePersona']}{nota_txt}"
                cursor.execute(
                    "INSERT INTO MOVIMIENTOS_CAJA (IDSesionCaja, IDUsuario, Tipo, Monto, Descripcion) VALUES (?, ?, 'INGRESO', ?, ?)",
                    (sid, uid, monto, desc_caja),
                )
                mov_caja_id = cursor.lastrowid
                cursor.execute(
                    "UPDATE SESIONES_CAJA SET TotalEsperado = TotalEsperado + ? WHERE IDSesionCaja = ?",
                    (monto, sid),
                )
                recorded_in_cash = 1

        cursor.execute(
            """INSERT INTO DEUDAS_ABONOS (
                IDDeuda, Monto, MetodoPago, Nota, RegistrarEnCaja, IDMovimientoCaja, IDUsuario, FechaHora
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                id_deuda,
                monto,
                data.metodo_pago,
                (data.nota or "").strip() or None,
                recorded_in_cash,
                mov_caja_id,
                uid,
                ahora,
            ),
        )

        new_abonado = round(float(row["TotalAbonado"]) + monto, 2)
        new_saldo = max(0.0, round(float(row["TotalDeuda"]) - new_abonado, 2))
        is_paid = new_saldo <= 0.005
        if is_paid:
            new_saldo = 0.0
        new_estado = "PAGADO" if is_paid else "PENDIENTE"
        fecha_pago = ahora if is_paid else None

        cursor.execute(
            """UPDATE DEUDAS
               SET TotalAbonado = ?, SaldoPendiente = ?, Estado = ?, FechaActualizacion = ?, FechaPago = ?
               WHERE IDDeuda = ?""",
            (new_abonado, new_saldo, new_estado, ahora, fecha_pago, id_deuda),
        )
        updated = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,)).fetchone()
        return _map_deuda_row(cursor, updated)


def actualizar_deuda(id_deuda: int, data: DeudaUpdateRequest) -> DeudaOut:
    ahora = now_local_str()
    with get_db() as conn:
        ensure_deudores_schema(conn)
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        row = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,)).fetchone()
        if not row:
            raise LookupError("Deudor no encontrado.")

        nombre = data.nombre_persona.strip() if data.nombre_persona is not None else row["NombrePersona"]
        if not nombre:
            raise ValueError("El nombre de la persona es obligatorio.")
        telefono = (data.telefono.strip() or None) if data.telefono is not None else row["Telefono"]
        notas = (data.notas.strip() or None) if data.notas is not None else row["Notas"]

        total = round(float(row["TotalDeuda"]), 2)
        tipo = row["TipoDeuda"]

        if data.items is not None:
            if not data.items:
                raise ValueError("La lista de productos no puede quedar vacía.")
            cursor.execute("DELETE FROM DEUDAS_PRODUCTOS WHERE IDDeuda = ?", (id_deuda,))
            total = 0.0
            for it in data.items:
                p_name = it.nombre_producto.strip()
                if not p_name:
                    raise ValueError("Todos los productos deben tener nombre.")
                cant = float(it.cantidad)
                precio = float(it.precio_unitario)
                sub = round(cant * precio, 2)
                total = round(total + sub, 2)
                cursor.execute(
                    """INSERT INTO DEUDAS_PRODUCTOS (
                        IDDeuda, IDProducto, NombreProducto, Cantidad, PrecioUnitario, Subtotal, FechaRegistro
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (id_deuda, it.id_producto, p_name, cant, precio, sub, ahora),
                )
            tipo = "PRODUCTOS"
        elif data.monto is not None:
            if float(data.monto) <= 0:
                raise ValueError("El monto total debe ser mayor a $0.00.")
            total = round(float(data.monto), 2)

        abonado = round(float(row["TotalAbonado"]), 2)
        saldo = max(0.0, round(total - abonado, 2))
        is_paid = saldo <= 0.005
        if is_paid:
            saldo = 0.0
        estado = "PAGADO" if is_paid else "PENDIENTE"
        fecha_pago = (row["FechaPago"] or ahora) if is_paid else None

        cursor.execute(
            """UPDATE DEUDAS
               SET NombrePersona = ?, Telefono = ?, TipoDeuda = ?, TotalDeuda = ?,
                   SaldoPendiente = ?, Estado = ?, Notas = ?, FechaActualizacion = ?, FechaPago = ?
               WHERE IDDeuda = ?""",
            (nombre, telefono, tipo, total, saldo, estado, notas, ahora, fecha_pago, id_deuda),
        )
        updated = cursor.execute("SELECT * FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,)).fetchone()
        return _map_deuda_row(cursor, updated)


def eliminar_deuda(id_deuda: int) -> bool:
    with get_db() as conn:
        ensure_deudores_schema(conn)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM DEUDAS WHERE IDDeuda = ?", (id_deuda,))
        return cursor.rowcount > 0



