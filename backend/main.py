import os
import base64
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, status, UploadFile, File, Form, Body, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.database import (
    init_db, get_db, get_secret_key, CLAVES_CONFIG_PRIVADAS, PROJECT_ROOT,
    ensure_fresh_cloud_db, get_backup_dir
)
from backend.auth import (
    hash_password, verify_password, needs_rehash, is_default_password, validate_new_password,
    create_token, decode_token, password_fingerprint, check_lock, register_failure, clear_failures
)
from backend.models import (
    LoginRequest, LoginResponse, UserInfo, CambiarClaveRequest, AsignarClaveTrabajadorRequest,
    ProductoOut, ProductoCreate, ProductoUpdate, ProductoRapidoRequest,
    CategoriaOut, ProveedorOut, ProveedorCreate, ProveedorUpdate,
    VentaCobrarRequest, VentaOut,
    CompraRegistrarRequest, CompraOut,
    AjusteInventarioRequest, DevolucionProductoRequest, KardexMovimientoOut,
    CajaAbrirRequest, CajaCerrarRequest, CajaMovimientoRequest,
    SesionCajaOut, DashboardKPIsOut, BackupResponse,
    PedidoCreateRequest, PedidoUpdateRequest, PedidoOut,
    TrabajadorOut, TrabajadorCreate
)
from backend import services
from backend.ai_vision import process_invoice_with_gemini, get_api_key, set_api_key

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    init_db()
    yield

app = FastAPI(
    title="Sistema de Gestion para Tienda POS API",
    description="Backend REST con SQLite ACID para Punto de Venta, Control de Inventario con Kardex y Compras",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS (configure ALLOWED_ORIGINS comma-separated per store deployment, defaults to *)
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*").strip()
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials="*" not in _allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_PUBLIC_API_PATHS = {"/api/health", "/api/auth/login"}

def _resolve_user_from_token(token: str) -> Optional[UserInfo]:
    payload = decode_token(get_secret_key(), token)
    if not payload:
        return None
    uid = payload.get("uid")
    pv = payload.get("pv")
    if not uid or not pv:
        return None
    with get_db() as conn:
        row = conn.execute(
            """SELECT u.*, r.Nombre as RoleName
               FROM USUARIOS u
               JOIN ROLES r ON u.IDRole = r.IDRole
               WHERE u.IDUsuario = ? AND u.Activo = 1""",
            (uid,)
        ).fetchone()
        if not row:
            return None
        if password_fingerprint(row["PasswordHash"]) != pv:
            return None
        return UserInfo(
            id_usuario=row["IDUsuario"],
            username=row["Username"],
            nombre_completo=row["NombreCompleto"],
            id_role=row["IDRole"],
            role_name=row["RoleName"],
            debe_cambiar_clave=is_default_password(row["PasswordHash"])
        )

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and path.startswith("/api/"):
        if path != "/api/health":
            ensure_fresh_cloud_db()
        if path not in _PUBLIC_API_PATHS:
            auth_header = request.headers.get("Authorization", "")
            token = ""
            if auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()
            elif "token" in request.query_params:
                token = request.query_params["token"].strip()

            user = _resolve_user_from_token(token) if token else None
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "No autenticado o sesion expirada. Inicia sesion nuevamente."}
                )
            request.state.user = user
    return await call_next(request)

def get_current_user(request: Request) -> UserInfo:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado.")
    return user

def require_admin(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    if user.role_name.upper() != "ADMINISTRADOR":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Se requiere rol de ADMINISTRADOR.")
    return user

@app.get("/api/health", tags=["Health"])
def health_check():
    with get_db() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}

# --- 1. Auth Endpoints ---
@app.post("/api/auth/login", response_model=LoginResponse, tags=["Auth"])
def login(creds: LoginRequest):
    username = creds.username.strip()
    is_locked, retry_after = check_lock(username.lower())
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos fallidos. Intenta de nuevo en {retry_after} segundos."
        )

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT u.*, r.Nombre as RoleName 
               FROM USUARIOS u 
               JOIN ROLES r ON u.IDRole = r.IDRole 
               WHERE LOWER(u.Username) = LOWER(?) AND u.Activo = 1""",
            (username,)
        )
        row = cursor.fetchone()
        if not row or not verify_password(creds.password, row["PasswordHash"]):
            register_failure(username.lower())
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales invalidas o usuario inactivo."
            )

        clear_failures(username.lower())
        current_hash = row["PasswordHash"]
        if needs_rehash(current_hash):
            current_hash = hash_password(creds.password)
            cursor.execute(
                "UPDATE USUARIOS SET PasswordHash = ? WHERE IDUsuario = ?",
                (current_hash, row["IDUsuario"])
            )

        must_change = is_default_password(current_hash)
        user_info = UserInfo(
            id_usuario=row["IDUsuario"],
            username=row["Username"],
            nombre_completo=row["NombreCompleto"],
            id_role=row["IDRole"],
            role_name=row["RoleName"],
            debe_cambiar_clave=must_change
        )
        token = create_token(get_secret_key(), row["IDUsuario"], current_hash, must_change=must_change)
        return LoginResponse(token=token, usuario=user_info)

@app.get("/api/auth/me", response_model=UserInfo, tags=["Auth"])
def auth_me(current_user: UserInfo = Depends(get_current_user)):
    return current_user

@app.post("/api/auth/cambiar-clave", response_model=LoginResponse, tags=["Auth"])
def cambiar_clave(data: CambiarClaveRequest, current_user: UserInfo = Depends(get_current_user)):
    try:
        validate_new_password(data.clave_nueva)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM USUARIOS WHERE IDUsuario = ? AND Activo = 1",
            (current_user.id_usuario,)
        ).fetchone()
        if not row or not verify_password(data.clave_actual, row["PasswordHash"]):
            raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
        if verify_password(data.clave_nueva, row["PasswordHash"]):
            raise HTTPException(status_code=400, detail="La nueva contraseña debe ser diferente a la actual.")

        new_hash = hash_password(data.clave_nueva)
        conn.execute(
            "UPDATE USUARIOS SET PasswordHash = ? WHERE IDUsuario = ?",
            (new_hash, current_user.id_usuario)
        )

    updated_user = UserInfo(
        id_usuario=current_user.id_usuario,
        username=current_user.username,
        nombre_completo=current_user.nombre_completo,
        id_role=current_user.id_role,
        role_name=current_user.role_name,
        debe_cambiar_clave=False
    )
    new_token = create_token(get_secret_key(), current_user.id_usuario, new_hash, must_change=False)
    return LoginResponse(token=new_token, usuario=updated_user)

# --- 2. Products Endpoints ---
@app.get("/api/productos/buscar", tags=["Productos"])
def buscar_productos_endpoint(query: str = Query(..., description="Codigo de barras o nombre")):
    prods = services.buscar_productos(query)
    # If single exact match on barcode or internal code, include it in response structure
    exact_match = None
    if len(prods) == 1:
        exact_match = prods[0]
    elif len(prods) > 1:
        for p in prods:
            if query.strip() in p.codigos_barras or query.strip() == p.codigo_interno:
                exact_match = p
                break
    return {
        "query": query,
        "total": len(prods),
        "producto": exact_match,
        "resultados": prods
    }

@app.post("/api/productos/rapido", response_model=ProductoOut, tags=["Productos"])
def alta_al_vuelo(data: ProductoRapidoRequest):
    try:
        return services.crear_producto_rapido(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/productos", response_model=List[ProductoOut], tags=["Productos"])
def listar_productos():
    return services.get_all_products()

@app.post("/api/productos", response_model=ProductoOut, tags=["Productos"])
def crear_producto(data: ProductoCreate):
    try:
        return services.crear_producto(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/productos/{id_producto}", response_model=ProductoOut, tags=["Productos"])
def actualizar_producto(id_producto: int, data: ProductoUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM PRODUCTOS WHERE IDProducto = ?", (id_producto,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Producto no encontrado.")

        updates = []
        params = []
        if data.nombre is not None:
            updates.append("Nombre = ?")
            params.append(data.nombre)
        if data.codigo_interno is not None:
            updates.append("CodigoInterno = ?")
            params.append(data.codigo_interno)
        if data.id_categoria is not None:
            updates.append("IDCategoria = ?")
            params.append(data.id_categoria)
        if "id_proveedor" in data.model_fields_set:
            updates.append("IDProveedor = ?")
            params.append(data.id_proveedor)
        if data.descripcion is not None:
            updates.append("Descripcion = ?")
            params.append(data.descripcion)
        if data.unidad_medida is not None:
            updates.append("UnidadMedida = ?")
            params.append(data.unidad_medida)
        if data.permite_fraccion is not None:
            updates.append("PermiteFraccion = ?")
            params.append(int(data.permite_fraccion))
        if data.precio_compra_actual is not None:
            updates.append("PrecioCompraActual = ?")
            params.append(data.precio_compra_actual)
        if data.precio_venta_actual is not None:
            updates.append("PrecioVentaActual = ?")
            params.append(data.precio_venta_actual)
        if data.stock_minimo is not None:
            updates.append("StockMinimo = ?")
            params.append(data.stock_minimo)
        if data.activo is not None:
            updates.append("Activo = ?")
            params.append(int(data.activo))

        updates.append("FechaModificacion = CURRENT_TIMESTAMP")
        params.append(id_producto)

        cursor.execute(f"UPDATE PRODUCTOS SET {', '.join(updates)} WHERE IDProducto = ?", params)

        # Update barcodes if provided
        if data.codigos_barras is not None:
            cursor.execute("DELETE FROM PRODUCTO_CODIGOS_BARRAS WHERE IDProducto = ?", (id_producto,))
            for idx, bc in enumerate(data.codigos_barras):
                if bc.strip():
                    cursor.execute(
                        "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal) VALUES (?, ?, ?)",
                        (id_producto, bc.strip(), 1 if idx == 0 else 0)
                    )

    for p in services.get_all_products():
        if p.id_producto == id_producto:
            return p
    raise HTTPException(status_code=404, detail="Producto no encontrado tras actualizar.")

@app.delete("/api/productos/{id_producto}", tags=["Productos"])
def eliminar_producto(id_producto: int):
    return services.eliminar_producto(id_producto)

# --- 3. POS Sales Endpoints ---
@app.post("/api/ventas/cobrar", response_model=VentaOut, tags=["Ventas"])
def cobrar_venta_endpoint(data: VentaCobrarRequest):
    try:
        return services.cobrar_venta(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/ventas", response_model=List[VentaOut], tags=["Ventas"])
def listar_ventas(limit: int = 50):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT v.*, COALESCE(v.CajeroNombre, u.NombreCompleto, 'Cajero') as CajeroNombre 
               FROM VENTAS v 
               LEFT JOIN USUARIOS u ON v.IDUsuario = u.IDUsuario 
               ORDER BY v.IDVenta DESC LIMIT ?""",
            (limit,)
        )
        sales_rows = cursor.fetchall()
        
        result = []
        for sr in sales_rows:
            vid = sr["IDVenta"]
            cursor.execute(
                """SELECT d.*, p.Nombre as ProductoNombre, p.CodigoInterno as ProductoCodigo 
                   FROM VENTAS_DETALLE d 
                   JOIN PRODUCTOS p ON d.IDProducto = p.IDProducto 
                   WHERE d.IDVenta = ?""",
                (vid,)
            )
            det_rows = cursor.fetchall()
            items = [
                services.VentaDetalleOut(
                    id_detalle_venta=dr["IDDetalleVenta"],
                    id_producto=dr["IDProducto"],
                    producto_nombre=dr["ProductoNombre"],
                    producto_codigo=dr["ProductoCodigo"],
                    cantidad=float(dr["Cantidad"]),
                    precio_unitario=float(dr["PrecioUnitario"]),
                    costo_unitario=float(dr["CostoUnitarioAlMomento"]),
                    descuento=float(dr["Descuento"]),
                    subtotal=float(dr["Subtotal"])
                )
                for dr in det_rows
            ]
            result.append(
                VentaOut(
                    id_venta=vid,
                    id_sesion_caja=sr["IDSesionCaja"],
                    id_usuario=sr["IDUsuario"],
                    cajero_nombre=sr["CajeroNombre"],
                    numero_venta=sr["NumeroVenta"],
                    fecha_hora=str(sr["FechaHora"]),
                    subtotal=float(sr["Subtotal"]),
                    descuento=float(sr["Descuento"]),
                    impuestos=float(sr["Impuestos"]),
                    total=float(sr["Total"]),
                    metodo_pago=sr["MetodoPago"],
                    monto_recibido=float(sr["MontoRecibido"]),
                    cambio=float(sr["Cambio"]),
                    estado=sr["Estado"],
                    items=items
                )
            )
        return result

# --- 4. Purchases Reception Endpoints ---
@app.post("/api/compras/registrar", response_model=CompraOut, tags=["Compras"])
def registrar_compra_endpoint(data: CompraRegistrarRequest):
    try:
        return services.registrar_compra(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/compras", response_model=List[CompraOut], tags=["Compras"])
def listar_compras(limit: int = 50):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT c.*, p.RazonSocial as ProveedorNombre 
               FROM COMPRAS c 
               JOIN PROVEEDORES p ON c.IDProveedor = p.IDProveedor 
               ORDER BY c.IDCompra DESC LIMIT ?""",
            (limit,)
        )
        compra_rows = cursor.fetchall()
        result = []
        for cr in compra_rows:
            cid = cr["IDCompra"]
            cursor.execute(
                """SELECT d.*, p.Nombre as ProductoNombre, p.CodigoInterno as ProductoCodigo 
                   FROM COMPRAS_DETALLE d 
                   JOIN PRODUCTOS p ON d.IDProducto = p.IDProducto 
                   WHERE d.IDCompra = ?""",
                (cid,)
            )
            det_rows = cursor.fetchall()
            items = [
                services.CompraDetalleOut(
                    id_detalle_compra=dr["IDDetalleCompra"],
                    id_producto=dr["IDProducto"],
                    producto_nombre=dr["ProductoNombre"],
                    producto_codigo=dr["ProductoCodigo"],
                    cantidad=float(dr["Cantidad"]),
                    costo_unitario=float(dr["CostoUnitario"]),
                    descuento=float(dr["Descuento"]),
                    subtotal=float(dr["Subtotal"])
                )
                for dr in det_rows
            ]
            result.append(
                CompraOut(
                    id_compra=cid,
                    id_proveedor=cr["IDProveedor"],
                    proveedor_nombre=cr["ProveedorNombre"],
                    id_usuario=cr["IDUsuario"],
                    numero_documento=cr["NumeroDocumento"],
                    fecha_hora=str(cr["FechaHora"]),
                    subtotal=float(cr["Subtotal"]),
                    descuento=float(cr["Descuento"]),
                    impuestos=float(cr["Impuestos"]),
                    total=float(cr["Total"]),
                    estado=cr["Estado"],
                    items=items
                )
            )
        return result

# --- 5. Kardex & Inventory Adjustment Endpoints ---
@app.get("/api/inventario/kardex/{id_producto}", response_model=List[KardexMovimientoOut], tags=["Inventario"])
def kardex_producto(
    id_producto: int,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None
):
    return services.obtener_kardex(id_producto=id_producto, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)

@app.get("/api/inventario/kardex", response_model=List[KardexMovimientoOut], tags=["Inventario"])
def kardex_general(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None
):
    return services.obtener_kardex(id_producto=None, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)

@app.post("/api/inventario/ajuste", response_model=KardexMovimientoOut, tags=["Inventario"])
def ajuste_inventario_endpoint(data: AjusteInventarioRequest):
    try:
        return services.ajustar_inventario(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/inventario/movimientos/{id_movimiento}", tags=["Inventario"])
def eliminar_movimiento_endpoint(id_movimiento: int, revertir_stock: bool = True):
    try:
        return services.eliminar_movimiento_inventario(id_movimiento, revertir_stock=revertir_stock)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/inventario/devolucion", tags=["Inventario"])
def registrar_devolucion_endpoint(data: DevolucionProductoRequest):
    try:
        return services.registrar_devolucion_producto(
            id_producto=data.id_producto,
            cantidad=data.cantidad,
            motivo=data.motivo,
            referencia_id=data.referencia_id,
            afecta_caja=data.afecta_caja,
            monto_devolucion=data.monto_devolucion or 0.0,
            id_usuario=data.id_usuario or 1
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 6. Cash Shift Endpoints ---
@app.get("/api/caja/activa", response_model=Optional[SesionCajaOut], tags=["Caja"])
def caja_activa_endpoint():
    return services.obtener_caja_activa()

@app.post("/api/caja/abrir", response_model=SesionCajaOut, tags=["Caja"])
def abrir_caja_endpoint(data: CajaAbrirRequest):
    try:
        return services.abrir_caja(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/caja/cerrar", response_model=SesionCajaOut, tags=["Caja"])
def cerrar_caja_endpoint(data: CajaCerrarRequest):
    try:
        return services.cerrar_caja(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/caja/movimiento", response_model=SesionCajaOut, tags=["Caja"])
def registrar_movimiento_caja(data: CajaMovimientoRequest):
    try:
        return services.registrar_movimiento_caja(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/caja/fondo-inicial", response_model=SesionCajaOut, tags=["Caja"])
def actualizar_fondo_inicial_endpoint(data: dict = Body(...)):
    monto = float(data.get("monto_inicial", 0.0))
    user_id = int(data.get("id_usuario", 1))
    try:
        return services.actualizar_fondo_inicial(monto, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 7. Dashboard Endpoints ---
@app.get("/api/dashboard", response_model=DashboardKPIsOut, tags=["Dashboard"])
def dashboard_endpoint():
    return services.obtener_dashboard_kpis()

# --- 8. Backups Endpoints ---
@app.post("/api/backups/generar", response_model=BackupResponse, tags=["Backups"])
def generar_backup_endpoint():
    try:
        return services.generar_backup_database()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/backups/descargar/{filename}", tags=["Backups"])
def descargar_backup(filename: str):
    safe_name = os.path.basename(filename)
    file_path = os.path.join(get_backup_dir(), safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo de backup no encontrado.")
    return FileResponse(file_path, media_type="application/gzip", filename=safe_name)

# --- 9. Auxiliary Entities Endpoints ---
@app.get("/api/categorias", response_model=List[CategoriaOut], tags=["Auxiliares"])
def listar_categorias():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM CATEGORIAS WHERE Activa = 1 ORDER BY Nombre ASC")
        return [
            CategoriaOut(
                id_categoria=r["IDCategoria"],
                nombre=r["Nombre"],
                descripcion=r["Descripcion"],
                activa=bool(r["Activa"])
            )
            for r in cursor.fetchall()
        ]

@app.get("/api/proveedores", response_model=List[ProveedorOut], tags=["Auxiliares"])
def listar_proveedores():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM PROVEEDORES WHERE Activo = 1 ORDER BY RazonSocial ASC")
        return [
            ProveedorOut(
                id_proveedor=r["IDProveedor"],
                ruc_ci=r["RUC_CI"],
                razon_social=r["RazonSocial"],
                telefono=r["Telefono"],
                email=r["Email"],
                direccion=r["Direccion"],
                observaciones=r["Observaciones"],
                activo=bool(r["Activo"])
            )
            for r in cursor.fetchall()
        ]

@app.post("/api/proveedores", response_model=ProveedorOut, tags=["Auxiliares"])
def crear_proveedor(data: ProveedorCreate):
    clean_name = (data.razon_social or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="El nombre del distribuidor es obligatorio.")
    with get_db() as conn:
        cursor = conn.cursor()
        ruc = (data.ruc_ci or "").strip() or f"RUC-{int(datetime.now().timestamp() * 1000)}"
        try:
            cursor.execute(
                """INSERT INTO PROVEEDORES (RUC_CI, RazonSocial, Telefono, Email, Direccion, Observaciones, Activo)
                   VALUES (?, ?, ?, ?, ?, ?, 1)""",
                (ruc, clean_name, data.telefono, data.email, data.direccion, data.observaciones)
            )
        except Exception as e:
            if "UNIQUE" in str(e).upper():
                raise HTTPException(status_code=400, detail="Ya existe un distribuidor con ese RUC o cédula.")
            raise HTTPException(status_code=400, detail=str(e))
        pid = cursor.lastrowid
        return ProveedorOut(
            id_proveedor=pid,
            ruc_ci=ruc,
            razon_social=clean_name,
            telefono=data.telefono,
            email=data.email,
            direccion=data.direccion,
            observaciones=data.observaciones,
            activo=True
        )

@app.put("/api/proveedores/{id_proveedor}", response_model=ProveedorOut, tags=["Auxiliares"])
def actualizar_proveedor(id_proveedor: int, data: ProveedorUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        row = cursor.execute(
            "SELECT * FROM PROVEEDORES WHERE IDProveedor = ? AND Activo = 1",
            (id_proveedor,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Distribuidor no encontrado.")

        fields = data.model_fields_set
        new_name = (data.razon_social or "").strip() if "razon_social" in fields else row["RazonSocial"]
        if not new_name:
            raise HTTPException(status_code=400, detail="El nombre del distribuidor es obligatorio.")

        dup_name = cursor.execute(
            "SELECT IDProveedor FROM PROVEEDORES WHERE LOWER(TRIM(RazonSocial)) = LOWER(?) AND IDProveedor != ? AND Activo = 1",
            (new_name, id_proveedor)
        ).fetchone()
        if dup_name:
            raise HTTPException(status_code=400, detail="Ya existe otro distribuidor con ese nombre.")

        new_ruc = (
            ((data.ruc_ci or "").strip() or row["RUC_CI"])
            if "ruc_ci" in fields
            else row["RUC_CI"]
        )
        new_telefono = data.telefono if "telefono" in fields else row["Telefono"]
        new_email = data.email if "email" in fields else row["Email"]
        new_direccion = data.direccion if "direccion" in fields else row["Direccion"]
        new_obs = data.observaciones if "observaciones" in fields else row["Observaciones"]

        try:
            cursor.execute(
                """UPDATE PROVEEDORES
                   SET RUC_CI = ?, RazonSocial = ?, Telefono = ?, Email = ?, Direccion = ?, Observaciones = ?
                   WHERE IDProveedor = ?""",
                (new_ruc, new_name, new_telefono, new_email, new_direccion, new_obs, id_proveedor)
            )
        except Exception as e:
            if "UNIQUE" in str(e).upper():
                raise HTTPException(status_code=400, detail="Ya existe otro distribuidor con ese RUC o cédula.")
            raise HTTPException(status_code=400, detail=str(e))

        return ProveedorOut(
            id_proveedor=id_proveedor,
            ruc_ci=new_ruc,
            razon_social=new_name,
            telefono=new_telefono,
            email=new_email,
            direccion=new_direccion,
            observaciones=new_obs,
            activo=True
        )

@app.delete("/api/proveedores/{id_proveedor}", tags=["Auxiliares"])
def eliminar_proveedor(id_proveedor: int):
    return services.eliminar_proveedor(id_proveedor)

@app.get("/api/configuracion", tags=["Configuracion"])
def obtener_configuracion():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT Clave, Valor FROM CONFIGURACION_SISTEMA")
        return {
            r["Clave"]: r["Valor"]
            for r in cursor.fetchall()
            if r["Clave"] not in CLAVES_CONFIG_PRIVADAS
        }

@app.post("/api/configuracion", tags=["Configuracion"])
def guardar_configuracion(config: dict):
    with get_db() as conn:
        cursor = conn.cursor()
        for k, v in config.items():
            if k in CLAVES_CONFIG_PRIVADAS:
                continue
            cursor.execute(
                """INSERT INTO CONFIGURACION_SISTEMA (Clave, Valor, FechaModificacion) 
                   VALUES (?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT(Clave) DO UPDATE SET Valor = excluded.Valor, FechaModificacion = CURRENT_TIMESTAMP""",
                (k, str(v))
            )
        return {"success": True}

# --- 9. AI Invoice Processing & Vision Endpoints ---
@app.get("/api/ia/config", tags=["IA"])
def get_ia_config():
    key = get_api_key()
    return {
        "configurado": bool(key),
        "api_key_mascara": f"AIza...{key[-4:]}" if key and len(key) > 8 else ("Configurada" if key else "")
    }

@app.post("/api/ia/config", tags=["IA"])
def save_ia_config(data: dict = Body(...)):
    key = data.get("api_key", "").strip()
    if not key:
        raise HTTPException(status_code=400, detail="La API Key no puede estar vacía.")
    set_api_key(key)
    return {"success": True, "message": "API Key de Gemini guardada correctamente."}

@app.post("/api/ia/procesar-factura", tags=["IA"])
async def procesar_factura_ia(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    mime_type: Optional[str] = Form("image/jpeg"),
    api_key: Optional[str] = Form(None)
):
    try:
        raw_bytes = None
        actual_mime = mime_type or "image/jpeg"

        if file:
            raw_bytes = await file.read()
            actual_mime = file.content_type or "image/jpeg"
        elif image_base64:
            b64 = image_base64
            if "," in b64:
                prefix, b64 = b64.split(",", 1)
                if "image/png" in prefix:
                    actual_mime = "image/png"
                elif "image/webp" in prefix:
                    actual_mime = "image/webp"
            raw_bytes = base64.b64decode(b64)
        else:
            raise HTTPException(status_code=400, detail="Debe proporcionar un archivo o una imagen en Base64.")

        result = process_invoice_with_gemini(raw_bytes, mime_type=actual_mime, api_key=api_key)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analizando factura: {str(e)}")

# --- 10. Purchase Orders / Agenda de Pedidos Endpoints ---
@app.get("/api/pedidos", response_model=List[PedidoOut], tags=["Pedidos"])
def listar_pedidos(estado: Optional[str] = None):
    return services.get_all_pedidos(estado)

@app.get("/api/pedidos/{id_pedido}", response_model=PedidoOut, tags=["Pedidos"])
def obtener_pedido(id_pedido: int):
    ped = services.get_pedido_by_id(id_pedido)
    if not ped:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    return ped

@app.post("/api/pedidos", response_model=PedidoOut, tags=["Pedidos"])
def crear_pedido_endpoint(data: PedidoCreateRequest):
    try:
        return services.crear_pedido(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/pedidos/{id_pedido}", response_model=PedidoOut, tags=["Pedidos"])
def actualizar_pedido_endpoint(id_pedido: int, data: PedidoUpdateRequest):
    try:
        return services.actualizar_pedido(id_pedido, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/pedidos/{id_pedido}", tags=["Pedidos"])
def eliminar_pedido_endpoint(id_pedido: int):
    success = services.eliminar_pedido(id_pedido)
    if not success:
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    return {"success": True, "message": f"Pedido #{id_pedido} eliminado."}

@app.post("/api/pedidos/{id_pedido}/recibir", response_model=PedidoOut, tags=["Pedidos"])
def marcar_pedido_recibido_endpoint(id_pedido: int, data: dict = Body(...)):
    factura = data.get("factura_recepcion", "FAC-RECIBIDA")
    try:
        return services.marcar_pedido_recibido(id_pedido, factura)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- 11. Trabajadores / Workers Endpoints ---
@app.get("/api/trabajadores", response_model=List[TrabajadorOut], tags=["Trabajadores"])
def listar_trabajadores_endpoint():
    return services.listar_trabajadores()

@app.post("/api/trabajadores", response_model=TrabajadorOut, tags=["Trabajadores"])
def crear_trabajador_endpoint(data: TrabajadorCreate, _admin: UserInfo = Depends(require_admin)):
    try:
        return services.crear_trabajador(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/trabajadores/{id_usuario}/clave", tags=["Trabajadores"])
def asignar_clave_trabajador_endpoint(
    id_usuario: int,
    data: AsignarClaveTrabajadorRequest,
    _admin: UserInfo = Depends(require_admin)
):
    try:
        services.asignar_clave_trabajador(id_usuario, data.password)
        return {"success": True, "message": "Contraseña actualizada correctamente."}
    except LookupError as le:
        raise HTTPException(status_code=404, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.delete("/api/trabajadores/{id_usuario}", tags=["Trabajadores"])
def eliminar_trabajador_endpoint(id_usuario: int, _admin: UserInfo = Depends(require_admin)):
    try:
        success = services.eliminar_trabajador(id_usuario)
        if not success:
            raise HTTPException(status_code=404, detail="Trabajador no encontrado.")
        return {"success": True, "message": "Trabajador eliminado correctamente."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 12. Serve Frontend Static SPA from dist/ ---
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        # Don't intercept API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Endpoint API no encontrado")
        target_file = os.path.join(DIST_DIR, full_path)
        if os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
