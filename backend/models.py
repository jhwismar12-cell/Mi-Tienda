from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime

# --- Auth Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class UserInfo(BaseModel):
    id_usuario: int
    username: str
    nombre_completo: str
    id_role: int
    role_name: str
    debe_cambiar_clave: bool = False

class LoginResponse(BaseModel):
    token: str
    usuario: UserInfo

class CambiarClaveRequest(BaseModel):
    clave_actual: str
    clave_nueva: str

class AsignarClaveTrabajadorRequest(BaseModel):
    password: str

# --- Workers / Trabajadores Models ---
class TrabajadorOut(BaseModel):
    id_usuario: int
    username: str
    nombre_completo: str
    id_role: int
    role_name: str
    activo: bool
    fecha_creacion: Optional[str] = None
    puede_iniciar_sesion: bool = False

class TrabajadorCreate(BaseModel):
    nombre_completo: str
    rol: Optional[str] = "CAJERO"
    username: Optional[str] = None
    password: Optional[str] = None

# --- Category & Supplier Models ---
class CategoriaOut(BaseModel):
    id_categoria: int
    nombre: str
    descripcion: Optional[str] = None
    activa: bool = True

class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class ProveedorOut(BaseModel):
    id_proveedor: int
    ruc_ci: str
    razon_social: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    observaciones: Optional[str] = None
    activo: bool = True

class ProveedorCreate(BaseModel):
    ruc_ci: Optional[str] = ""
    razon_social: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    observaciones: Optional[str] = None

class ProveedorUpdate(BaseModel):
    ruc_ci: Optional[str] = None
    razon_social: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion: Optional[str] = None
    observaciones: Optional[str] = None

# --- Product Models ---
class CodigoBarrasItem(BaseModel):
    id_codigo: Optional[int] = None
    codigo_barras: str
    es_principal: bool = True
    tipo_codigo: str = "EAN13"

class ProductoOut(BaseModel):
    id_producto: int
    id_categoria: int
    categoria_nombre: Optional[str] = None
    id_proveedor: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    codigo_interno: str
    nombre: str
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    unidad_medida: str = "UNIDAD"
    precio_compra_actual: float
    precio_venta_actual: float
    margen_minimo_porcentaje: float = 15.0
    stock_minimo: float = 5.0
    stock_actual: float = 0.0
    permite_fraccion: bool = False
    activo: bool = True
    codigos_barras: List[str] = []
    fecha_modificacion: Optional[str] = None

class ProductoCreate(BaseModel):
    id_categoria: int
    id_proveedor: Optional[int] = None
    codigo_interno: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    unidad_medida: str = "UNIDAD"
    precio_compra_actual: float
    precio_venta_actual: float
    margen_minimo_porcentaje: float = 15.0
    stock_minimo: float = 5.0
    stock_inicial: float = 0.0
    permite_fraccion: bool = False
    codigos_barras: List[str] = []

class ProductoUpdate(BaseModel):
    id_categoria: Optional[int] = None
    id_proveedor: Optional[int] = None
    codigo_interno: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    marca: Optional[str] = None
    unidad_medida: Optional[str] = None
    precio_compra_actual: Optional[float] = None
    precio_venta_actual: Optional[float] = None
    margen_minimo_porcentaje: Optional[float] = None
    stock_minimo: Optional[float] = None
    stock_actual: Optional[float] = None
    permite_fraccion: Optional[bool] = None
    activo: Optional[bool] = None
    codigos_barras: Optional[List[str]] = None

class ProductoRapidoRequest(BaseModel):
    nombre: str
    codigo_barras: str
    costo: float = Field(..., ge=0)
    venta: float = Field(..., ge=0)
    id_categoria: Optional[int] = 1
    stock_inicial: Optional[float] = 10.0

# --- POS / Sales Models ---
class VentaItemRequest(BaseModel):
    id_producto: int
    cantidad: float = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)
    descuento: float = Field(0.0, ge=0)

class VentaCobrarRequest(BaseModel):
    clave_idempotencia: Optional[str] = Field(None, min_length=1, max_length=100)
    id_sesion_caja: Optional[int] = None
    id_usuario: Optional[int] = 1
    cajero_nombre: Optional[str] = None
    items: List[VentaItemRequest]
    metodo_pago: Literal["EFECTIVO", "TRANSFERENCIA", "MIXTO"] = "EFECTIVO"
    monto_recibido: float = Field(0.0, ge=0)
    monto_efectivo: Optional[float] = Field(None, ge=0)
    monto_transferencia: Optional[float] = Field(None, ge=0)
    descuento: float = Field(0.0, ge=0)
    impuestos: float = Field(0.0, ge=0)

class VentaAnularRequest(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=300)

class VentaDetalleOut(BaseModel):
    id_detalle_venta: int
    id_producto: int
    producto_nombre: str
    producto_codigo: str
    cantidad: float
    precio_unitario: float
    costo_unitario: float
    descuento: float
    subtotal: float

class VentaOut(BaseModel):
    id_venta: int
    id_sesion_caja: int
    id_usuario: int
    cajero_nombre: Optional[str] = None
    numero_venta: str
    fecha_hora: str
    subtotal: float
    descuento: float
    impuestos: float
    total: float
    metodo_pago: str
    monto_recibido: float
    cambio: float
    monto_efectivo: float = 0.0
    monto_transferencia: float = 0.0
    estado: str
    motivo_anulacion: Optional[str] = None
    items: List[VentaDetalleOut] = []

# --- Purchases / Compras Models ---
class CompraItemRequest(BaseModel):
    id_producto: Optional[int] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    cantidad: float = Field(..., gt=0)
    costo_unitario: float = Field(..., ge=0)
    precio_venta_sugerido: Optional[float] = None
    descuento: float = Field(0.0, ge=0)

class CompraRegistrarRequest(BaseModel):
    id_proveedor: int
    numero_documento: str
    id_usuario: Optional[int] = 1
    items: List[CompraItemRequest]
    descuento: float = Field(0.0, ge=0)
    impuestos: float = Field(0.0, ge=0)
    observaciones: Optional[str] = None

class CompraDetalleOut(BaseModel):
    id_detalle_compra: int
    id_producto: int
    producto_nombre: str
    producto_codigo: str
    cantidad: float
    costo_unitario: float
    descuento: float
    subtotal: float

class CompraOut(BaseModel):
    id_compra: int
    id_proveedor: int
    proveedor_nombre: Optional[str] = None
    id_usuario: int
    numero_documento: str
    fecha_hora: str
    subtotal: float
    descuento: float
    impuestos: float
    total: float
    estado: str
    items: List[CompraDetalleOut] = []

# --- Kardex & Inventory Models ---
class AjusteInventarioRequest(BaseModel):
    id_producto: int
    tipo_ajuste: Literal["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "DAÑO", "PERDIDA", "VENCIMIENTO"]
    cantidad: float = Field(..., gt=0)
    motivo: Optional[str] = None
    id_usuario: Optional[int] = 1

class DevolucionProductoRequest(BaseModel):
    id_producto: int
    cantidad: float = Field(..., gt=0)
    motivo: str = "Devolución de cliente"
    referencia_id: Optional[str] = None
    afecta_caja: bool = False
    monto_devolucion: Optional[float] = Field(0.0, ge=0)
    id_usuario: Optional[int] = 1

class KardexMovimientoOut(BaseModel):
    id_movimiento: int
    fecha_hora: str
    id_producto: int
    producto_nombre: Optional[str] = None
    producto_codigo: Optional[str] = None
    tipo_movimiento: str
    cantidad: float
    stock_anterior: float
    stock_posterior: float
    referencia_id: Optional[str] = None
    id_usuario: int
    usuario_nombre: Optional[str] = None
    observacion: Optional[str] = None

# --- Cash Register Session Models ---
class CajaAbrirRequest(BaseModel):
    monto_inicial: float = Field(..., ge=0)
    id_usuario: Optional[int] = 1
    observaciones: Optional[str] = None

class CajaCerrarRequest(BaseModel):
    total_real_entregado: float = Field(..., ge=0)
    observaciones: Optional[str] = None

class CajaMovimientoRequest(BaseModel):
    tipo: Literal["RETIRO", "INGRESO"]
    monto: float = Field(..., gt=0)
    descripcion: str
    id_usuario: Optional[int] = 1

class CashMovementItem(BaseModel):
    id: str
    hora: str
    fecha: str
    tipo: str
    descripcion: str
    monto: float
    ticket_ref: Optional[str] = None

class SesionCajaOut(BaseModel):
    id_sesion_caja: int
    id_usuario: int
    cajero_nombre: str
    fecha_apertura: str
    fecha_cierre: Optional[str] = None
    monto_inicial: float
    total_ventas_efectivo: float
    total_ventas_transferencia: float
    total_retiros: float
    total_esperado: float
    total_real_entregado: Optional[float] = None
    diferencia: Optional[float] = None
    estado: str
    observaciones: Optional[str] = None
    movimientos: List[CashMovementItem] = []

# --- Dashboard KPIs Models ---
class HourlySalesItem(BaseModel):
    hora: str
    monto: float
    tickets: int

class TopProductSalesItem(BaseModel):
    id_producto: int
    codigo: str
    nombre: str
    unidades: float
    ingresos: float
    ganancia: float

class DashboardKPIsOut(BaseModel):
    fecha_inicio: str
    fecha_fin: str
    ventas_hoy_total: float
    tickets_hoy_total: int
    tickets_efectivo: int = 0
    tickets_transferencia: int = 0
    tickets_mixto: int = 0
    tickets_anulados: int = 0
    ventas_efectivo_total: float = 0.0
    ventas_transferencia_total: float = 0.0
    ganancia_bruta_hoy: float
    margen_promedio_hoy: float
    valor_inventario_costo: float
    valor_inventario_venta: float
    productos_stock_bajo: int
    productos_agotados: int
    costos_incrementados_recientes: int
    caja_activa: Optional[SesionCajaOut] = None
    ventas_por_hora: List[HourlySalesItem] = []
    top_productos: List[TopProductSalesItem] = []

# --- Backup Models ---
class BackupResponse(BaseModel):
    success: bool
    filename: str
    filepath: str
    size_bytes: int
    timestamp: str

# --- Purchase Orders / Agenda de Pedidos Models ---
class PedidoItemRequest(BaseModel):
    id_producto: int
    cantidad_pedida: float = Field(..., gt=0)
    costo_estimado: float = Field(0.0, ge=0)

class PedidoCreateRequest(BaseModel):
    id_proveedor: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    fecha_pedido: Optional[str] = None
    fecha_estimada_entrega: Optional[str] = None
    items: List[PedidoItemRequest]
    notas: Optional[str] = None

class PedidoUpdateRequest(BaseModel):
    fecha_estimada_entrega: Optional[str] = None
    items: Optional[List[PedidoItemRequest]] = None
    notas: Optional[str] = None
    estado: Optional[Literal["PENDIENTE", "RECIBIDO", "CANCELADO"]] = None

class PedidoDetalleOut(BaseModel):
    id_detalle_pedido: int
    id_producto: int
    producto_nombre: str
    producto_codigo: str
    categoria: Optional[str] = None
    codigo_barras: Optional[str] = None
    cantidad_pedida: float
    costo_estimado: float
    subtotal_estimado: float

class PedidoOut(BaseModel):
    id_pedido: int
    id_proveedor: Optional[int] = None
    proveedor_nombre: str
    numero_pedido: str
    fecha_pedido: str
    fecha_estimada_entrega: Optional[str] = None
    total_estimado: float
    total_unidades: float
    estado: str
    notas: Optional[str] = None
    factura_recepcion: Optional[str] = None
    fecha_recepcion: Optional[str] = None
    items: List[PedidoDetalleOut] = []
