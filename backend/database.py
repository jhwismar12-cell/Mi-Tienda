import sqlite3
import os
import secrets
import tempfile
from typing import Generator
from contextlib import contextmanager

from backend.auth import hash_password, unusable_password, is_default_password, verify_password
from backend.supabase_sync import (
    get_store_slug,
    is_supabase_enabled,
    pull_db_from_supabase,
    pull_if_newer,
    push_db_to_supabase,
)

# Claves de configuracion que nunca se envian al navegador.
CLAVES_CONFIG_PRIVADAS = {"SECRET_KEY", "GEMINI_API_KEY"}

DB_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(DB_DIR, ".."))
_DEFAULT_DB_PATH = (
    os.path.join(tempfile.gettempdir(), f"tienda_{get_store_slug()}.db")
    if os.environ.get("VERCEL")
    else os.path.join(PROJECT_ROOT, "tienda.db")
)
DB_PATH = os.environ.get("TIENDA_DB_PATH") or _DEFAULT_DB_PATH
_SYNCING_LOCK = False

DDL_SCHEMA = """
PRAGMA foreign_keys = ON;

-- 1. CONFIGURACION DEL SISTEMA
CREATE TABLE IF NOT EXISTS CONFIGURACION_SISTEMA (
    Clave VARCHAR(50) PRIMARY KEY,
    Valor TEXT NOT NULL,
    Descripcion VARCHAR(255),
    FechaModificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROLES Y USUARIOS (RBAC)
CREATE TABLE IF NOT EXISTS ROLES (
    IDRole INTEGER PRIMARY KEY AUTOINCREMENT,
    Nombre VARCHAR(30) NOT NULL UNIQUE,
    Descripcion VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS USUARIOS (
    IDUsuario INTEGER PRIMARY KEY AUTOINCREMENT,
    IDRole INTEGER NOT NULL,
    Username VARCHAR(30) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    NombreCompleto VARCHAR(100) NOT NULL,
    Activo BOOLEAN NOT NULL DEFAULT 1,
    FechaCreacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (IDRole) REFERENCES ROLES(IDRole) ON DELETE RESTRICT
);

-- 3. CATEGORIAS
CREATE TABLE IF NOT EXISTS CATEGORIAS (
    IDCategoria INTEGER PRIMARY KEY AUTOINCREMENT,
    Nombre VARCHAR(50) NOT NULL UNIQUE,
    Descripcion VARCHAR(255),
    Activa BOOLEAN NOT NULL DEFAULT 1
);

-- 4. PROVEEDORES
CREATE TABLE IF NOT EXISTS PROVEEDORES (
    IDProveedor INTEGER PRIMARY KEY AUTOINCREMENT,
    RUC_CI VARCHAR(20) NOT NULL UNIQUE,
    RazonSocial VARCHAR(150) NOT NULL,
    Telefono VARCHAR(30),
    Email VARCHAR(100),
    Direccion VARCHAR(200),
    Observaciones TEXT,
    Activo BOOLEAN NOT NULL DEFAULT 1,
    FechaCreacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. PRODUCTOS (Balance Materializado)
CREATE TABLE IF NOT EXISTS PRODUCTOS (
    IDProducto INTEGER PRIMARY KEY AUTOINCREMENT,
    IDCategoria INTEGER NOT NULL,
    IDProveedor INTEGER,
    CodigoInterno VARCHAR(30) NOT NULL UNIQUE,
    Nombre VARCHAR(120) NOT NULL,
    Descripcion VARCHAR(255),
    Marca VARCHAR(50),
    UnidadMedida VARCHAR(15) NOT NULL DEFAULT 'UNIDAD',
    PrecioCompraActual DECIMAL(12, 4) NOT NULL CHECK (PrecioCompraActual >= 0),
    PrecioVentaActual DECIMAL(12, 4) NOT NULL CHECK (PrecioVentaActual >= 0),
    MargenMinimoPorcentaje DECIMAL(5, 2) NOT NULL DEFAULT 15.00 CHECK (MargenMinimoPorcentaje >= 0),
    StockMinimo DECIMAL(12, 3) NOT NULL DEFAULT 5.000 CHECK (StockMinimo >= 0),
    StockActual DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    PermiteFraccion BOOLEAN NOT NULL DEFAULT 0,
    Activo BOOLEAN NOT NULL DEFAULT 1,
    FechaCreacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FechaModificacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (IDCategoria) REFERENCES CATEGORIAS(IDCategoria) ON DELETE RESTRICT,
    FOREIGN KEY (IDProveedor) REFERENCES PROVEEDORES(IDProveedor) ON DELETE SET NULL
);

-- 6. PRODUCTO_CODIGOS_BARRAS (Mapeo 1:N)
CREATE TABLE IF NOT EXISTS PRODUCTO_CODIGOS_BARRAS (
    IDCodigo INTEGER PRIMARY KEY AUTOINCREMENT,
    IDProducto INTEGER NOT NULL,
    CodigoBarras VARCHAR(50) NOT NULL UNIQUE,
    EsPrincipal BOOLEAN NOT NULL DEFAULT 1,
    TipoCodigo VARCHAR(20) NOT NULL DEFAULT 'EAN13',
    FechaRegistro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (IDProducto) REFERENCES PRODUCTOS(IDProducto) ON DELETE CASCADE
);

-- 7. HISTORIAL DE PRECIOS
CREATE TABLE IF NOT EXISTS HISTORIAL_PRECIOS (
    IDHistorial INTEGER PRIMARY KEY AUTOINCREMENT,
    IDProducto INTEGER NOT NULL,
    TipoPrecio VARCHAR(10) NOT NULL CHECK (TipoPrecio IN ('COMPRA', 'VENTA')),
    PrecioAnterior DECIMAL(12, 4) NOT NULL,
    PrecioNuevo DECIMAL(12, 4) NOT NULL,
    FechaHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    IDUsuario INTEGER NOT NULL,
    Motivo VARCHAR(150),
    FOREIGN KEY (IDProducto) REFERENCES PRODUCTOS(IDProducto) ON DELETE CASCADE,
    FOREIGN KEY (IDUsuario) REFERENCES USUARIOS(IDUsuario) ON DELETE RESTRICT
);

-- 8. SESIONES DE CAJA (Arqueo y Cierre)
CREATE TABLE IF NOT EXISTS SESIONES_CAJA (
    IDSesionCaja INTEGER PRIMARY KEY AUTOINCREMENT,
    IDUsuario INTEGER NOT NULL,
    FechaApertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FechaCierre DATETIME,
    MontoInicial DECIMAL(12, 2) NOT NULL CHECK (MontoInicial >= 0),
    TotalVentasEfectivo DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    TotalVentasTransferencia DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    TotalRetiros DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    TotalEsperado DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    TotalRealEntregado DECIMAL(12, 2),
    Diferencia DECIMAL(12, 2),
    Estado VARCHAR(15) NOT NULL DEFAULT 'ABIERTA' CHECK (Estado IN ('ABIERTA', 'CERRADA')),
    Observaciones TEXT,
    FOREIGN KEY (IDUsuario) REFERENCES USUARIOS(IDUsuario) ON DELETE RESTRICT
);

-- 9. VENTAS (Cabecera y Detalle)
CREATE TABLE IF NOT EXISTS MOVIMIENTOS_CAJA (
    IDMovimientoCaja INTEGER PRIMARY KEY AUTOINCREMENT,
    IDSesionCaja INTEGER NOT NULL,
    IDUsuario INTEGER NOT NULL,
    FechaHora DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
    Tipo TEXT NOT NULL CHECK (Tipo IN ('RETIRO', 'INGRESO')),
    Monto DECIMAL(12, 2) NOT NULL CHECK (Monto > 0),
    Descripcion TEXT NOT NULL,
    FOREIGN KEY (IDSesionCaja) REFERENCES SESIONES_CAJA(IDSesionCaja) ON DELETE RESTRICT,
    FOREIGN KEY (IDUsuario) REFERENCES USUARIOS(IDUsuario) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS VENTAS (
    IDVenta INTEGER PRIMARY KEY AUTOINCREMENT,
    IDSesionCaja INTEGER NOT NULL,
    IDUsuario INTEGER NOT NULL,
    NumeroVenta VARCHAR(30) NOT NULL UNIQUE,
    FechaHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Subtotal DECIMAL(12, 4) NOT NULL CHECK (Subtotal >= 0),
    Descuento DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (Descuento >= 0),
    Impuestos DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (Impuestos >= 0),
    Total DECIMAL(12, 4) NOT NULL CHECK (Total >= 0),
    MetodoPago VARCHAR(20) NOT NULL DEFAULT 'EFECTIVO' CHECK (MetodoPago IN ('EFECTIVO', 'TRANSFERENCIA', 'MIXTO')),
    MontoRecibido DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (MontoRecibido >= 0),
    Cambio DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (Cambio >= 0),
    CajeroNombre VARCHAR(100),
    Estado VARCHAR(15) NOT NULL DEFAULT 'CONFIRMADA' CHECK (Estado IN ('CONFIRMADA', 'ANULADA')),
    MotivoAnulacion TEXT,
    FOREIGN KEY (IDSesionCaja) REFERENCES SESIONES_CAJA(IDSesionCaja) ON DELETE RESTRICT,
    FOREIGN KEY (IDUsuario) REFERENCES USUARIOS(IDUsuario) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS VENTAS_DETALLE (
    IDDetalleVenta INTEGER PRIMARY KEY AUTOINCREMENT,
    IDVenta INTEGER NOT NULL,
    IDProducto INTEGER NOT NULL,
    Cantidad DECIMAL(12, 3) NOT NULL CHECK (Cantidad > 0),
    PrecioUnitario DECIMAL(12, 4) NOT NULL CHECK (PrecioUnitario >= 0),
    CostoUnitarioAlMomento DECIMAL(12, 4) NOT NULL CHECK (CostoUnitarioAlMomento >= 0),
    Descuento DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (Descuento >= 0),
    Subtotal DECIMAL(12, 4) NOT NULL CHECK (Subtotal >= 0),
    FOREIGN KEY (IDVenta) REFERENCES VENTAS(IDVenta) ON DELETE CASCADE,
    FOREIGN KEY (IDProducto) REFERENCES PRODUCTOS(IDProducto) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS COBROS_IDEMPOTENTES (
    Clave TEXT PRIMARY KEY,
    SolicitudHash TEXT NOT NULL,
    IDVenta INTEGER NOT NULL,
    Respuesta TEXT NOT NULL,
    FOREIGN KEY (IDVenta) REFERENCES VENTAS(IDVenta) ON DELETE CASCADE
);

-- 10. COMPRAS (Cabecera y Detalle)
CREATE TABLE IF NOT EXISTS COMPRAS (
    IDCompra INTEGER PRIMARY KEY AUTOINCREMENT,
    IDProveedor INTEGER NOT NULL,
    IDUsuario INTEGER NOT NULL,
    NumeroDocumento VARCHAR(50) NOT NULL,
    FechaHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Subtotal DECIMAL(12, 4) NOT NULL CHECK (Subtotal >= 0),
    Descuento DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (Descuento >= 0),
    Impuestos DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (Impuestos >= 0),
    Total DECIMAL(12, 4) NOT NULL CHECK (Total >= 0),
    Estado VARCHAR(15) NOT NULL DEFAULT 'CONFIRMADA' CHECK (Estado IN ('CONFIRMADA', 'ANULADA')),
    MotivoAnulacion TEXT,
    Observaciones TEXT,
    FOREIGN KEY (IDProveedor) REFERENCES PROVEEDORES(IDProveedor) ON DELETE RESTRICT,
    FOREIGN KEY (IDUsuario) REFERENCES USUARIOS(IDUsuario) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS COMPRAS_DETALLE (
    IDDetalleCompra INTEGER PRIMARY KEY AUTOINCREMENT,
    IDCompra INTEGER NOT NULL,
    IDProducto INTEGER NOT NULL,
    Cantidad DECIMAL(12, 3) NOT NULL CHECK (Cantidad > 0),
    CostoUnitario DECIMAL(12, 4) NOT NULL CHECK (CostoUnitario >= 0),
    Descuento DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (Descuento >= 0),
    Subtotal DECIMAL(12, 4) NOT NULL CHECK (Subtotal >= 0),
    FOREIGN KEY (IDCompra) REFERENCES COMPRAS(IDCompra) ON DELETE CASCADE,
    FOREIGN KEY (IDProducto) REFERENCES PRODUCTOS(IDProducto) ON DELETE RESTRICT
);

-- 11. MOVIMIENTOS_INVENTARIO (Libro Mayor Inmutable / Ledger)
CREATE TABLE IF NOT EXISTS MOVIMIENTOS_INVENTARIO (
    IDMovimiento INTEGER PRIMARY KEY AUTOINCREMENT,
    FechaHora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    IDProducto INTEGER NOT NULL,
    TipoMovimiento VARCHAR(30) NOT NULL CHECK (TipoMovimiento IN (
        'INVENTARIO_INICIAL',
        'ENTRADA_COMPRA',
        'SALIDA_VENTA',
        'AJUSTE_POSITIVO',
        'AJUSTE_NEGATIVO',
        'PERDIDA',
        'DAÑO',
        'VENCIMIENTO',
        'DEVOLUCION_CLIENTE',
        'DEVOLUCION_PROVEEDOR',
        'ANULACION_VENTA',
        'ANULACION_COMPRA'
    )),
    Cantidad DECIMAL(12, 3) NOT NULL,
    StockAnterior DECIMAL(12, 3) NOT NULL,
    StockPosterior DECIMAL(12, 3) NOT NULL,
    ReferenciaID VARCHAR(50),
    IDUsuario INTEGER NOT NULL,
    Observacion TEXT,
    FOREIGN KEY (IDProducto) REFERENCES PRODUCTOS(IDProducto) ON DELETE RESTRICT,
    FOREIGN KEY (IDUsuario) REFERENCES USUARIOS(IDUsuario) ON DELETE RESTRICT
);

-- 12. PEDIDOS (Agenda de Pedidos / Órdenes de Compra Preventistas)
CREATE TABLE IF NOT EXISTS PEDIDOS (
    IDPedido INTEGER PRIMARY KEY AUTOINCREMENT,
    IDProveedor INTEGER,
    ProveedorNombre VARCHAR(150),
    NumeroPedido VARCHAR(40) NOT NULL UNIQUE,
    FechaPedido DATE NOT NULL DEFAULT (CURRENT_DATE),
    FechaEstimadaEntrega DATE,
    TotalEstimado DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    TotalUnidades DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    Estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (Estado IN ('PENDIENTE', 'RECIBIDO', 'CANCELADO')),
    Notas TEXT,
    FacturaRecepcion VARCHAR(50),
    FechaRecepcion DATETIME,
    FechaCreacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (IDProveedor) REFERENCES PROVEEDORES(IDProveedor) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS PEDIDOS_DETALLE (
    IDDetallePedido INTEGER PRIMARY KEY AUTOINCREMENT,
    IDPedido INTEGER NOT NULL,
    IDProducto INTEGER NOT NULL,
    CantidadPedida DECIMAL(12, 3) NOT NULL CHECK (CantidadPedida > 0),
    CostoEstimado DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    SubtotalEstimado DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    FOREIGN KEY (IDPedido) REFERENCES PEDIDOS(IDPedido) ON DELETE CASCADE,
    FOREIGN KEY (IDProducto) REFERENCES PRODUCTOS(IDProducto) ON DELETE RESTRICT
);

-- 13. INDICES DE VELOCIDAD
CREATE INDEX IF NOT EXISTS idx_codigos_barras ON PRODUCTO_CODIGOS_BARRAS(CodigoBarras);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON PEDIDOS(Estado);
CREATE INDEX IF NOT EXISTS idx_productos_cod_interno ON PRODUCTOS(CodigoInterno);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON PRODUCTOS(Nombre);
CREATE INDEX IF NOT EXISTS idx_movimientos_prod_fecha ON MOVIMIENTOS_INVENTARIO(IDProducto, FechaHora);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON VENTAS(FechaHora);

-- 13. INDICES Y CONFIGURACION ADICIONAL
"""

def _should_sync_cloud() -> bool:
    global _SYNCING_LOCK
    if _SYNCING_LOCK or not is_supabase_enabled():
        return False
    # No sincronizar bases temporales de tests unitarios
    return os.path.abspath(DB_PATH) == os.path.abspath(_DEFAULT_DB_PATH)

def get_backup_dir() -> str:
    if os.environ.get("VERCEL"):
        return os.path.join(tempfile.gettempdir(), f"tienda_backups_{get_store_slug()}")
    return os.path.join(PROJECT_ROOT, "backups")

def ensure_fresh_cloud_db() -> None:
    if not _should_sync_cloud():
        return
    if not os.path.exists(DB_PATH):
        init_db()
    else:
        pull_if_newer(DB_PATH)

def get_db_connection():
    db_dir = os.path.dirname(os.path.abspath(DB_PATH))
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    if not os.path.exists(DB_PATH) and _should_sync_cloud():
        init_db()
    conn = get_db_connection()
    changes_before = conn.total_changes
    had_writes = False
    try:
        yield conn
        had_writes = conn.total_changes > changes_before
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    if had_writes and _should_sync_cloud():
        push_db_to_supabase(DB_PATH)

def init_db():
    global _SYNCING_LOCK
    pulled = False
    if _should_sync_cloud() and not os.path.exists(DB_PATH):
        pulled = pull_db_from_supabase(DB_PATH)

    _SYNCING_LOCK = True
    conn = get_db_connection()
    try:
        conn.executescript(DDL_SCHEMA)
        conn.commit()
        # Safe migrations
        try:
            cursor = conn.cursor()
            cursor.execute("ALTER TABLE VENTAS ADD COLUMN CajeroNombre VARCHAR(100)")
            conn.commit()
        except sqlite3.OperationalError:
            pass
        seed_initial_data(conn)
        conn.commit()
        bootstrap_security(conn)
    finally:
        conn.close()
        _SYNCING_LOCK = False

    if _should_sync_cloud() and not pulled:
        push_db_to_supabase(DB_PATH)


def es_produccion() -> bool:
    return (os.environ.get("ENTORNO") or "").strip().lower() in ("produccion", "production", "prod")


def get_secret_key() -> str:
    """Clave para firmar sesiones: SECRET_KEY del entorno o una generada y guardada en la base."""
    env_key = (os.environ.get("SECRET_KEY") or "").strip()
    if env_key:
        return env_key
    with get_db() as conn:
        row = conn.execute("SELECT Valor FROM CONFIGURACION_SISTEMA WHERE Clave = 'SECRET_KEY'").fetchone()
        if row and row["Valor"]:
            return row["Valor"]
        key = secrets.token_hex(32)
        conn.execute(
            """INSERT INTO CONFIGURACION_SISTEMA (Clave, Valor, Descripcion) VALUES ('SECRET_KEY', ?, 'Firma de sesiones')
               ON CONFLICT(Clave) DO NOTHING""",
            (key,)
        )
        row = conn.execute("SELECT Valor FROM CONFIGURACION_SISTEMA WHERE Clave = 'SECRET_KEY'").fetchone()
        return row["Valor"]


def bootstrap_security(conn: sqlite3.Connection) -> None:
    """Asegura que ninguna cuenta quede con una clave conocida.

    - ADMIN_PASSWORD reemplaza la clave del admin mientras siga siendo una clave por defecto.
    - Trabajadores (no admin) con claves por defecto quedan sin acceso hasta que el admin les asigne una.
    - En produccion (ENTORNO=produccion) el servidor no arranca si el admin conserva una clave por defecto.
    """
    cursor = conn.cursor()
    env_pwd = os.environ.get("ADMIN_PASSWORD")
    rows = cursor.execute(
        "SELECT u.IDUsuario, u.PasswordHash, r.Nombre AS RoleName FROM USUARIOS u JOIN ROLES r ON u.IDRole = r.IDRole"
    ).fetchall()
    for row in rows:
        if row["PasswordHash"].startswith("!") or not is_default_password(row["PasswordHash"]):
            continue
        if row["RoleName"] == "ADMINISTRADOR":
            if env_pwd and row["IDUsuario"] == 1:
                cursor.execute("UPDATE USUARIOS SET PasswordHash = ? WHERE IDUsuario = ?", (hash_password(env_pwd), row["IDUsuario"]))
        else:
            cursor.execute("UPDATE USUARIOS SET PasswordHash = ? WHERE IDUsuario = ?", (unusable_password(), row["IDUsuario"]))
    conn.commit()

    if es_produccion():
        admin = cursor.execute("SELECT PasswordHash FROM USUARIOS WHERE IDUsuario = 1").fetchone()
        if admin and is_default_password(admin["PasswordHash"]):
            raise RuntimeError(
                "Seguridad: el administrador usa una clave por defecto. "
                "Configura la variable ADMIN_PASSWORD (minimo 8 caracteres) y vuelve a desplegar."
            )
        if env_pwd and len(env_pwd) < 8:
            raise RuntimeError("Seguridad: ADMIN_PASSWORD debe tener al menos 8 caracteres.")

def seed_initial_data(conn: sqlite3.Connection):
    cursor = conn.cursor()
    
    # 1. Seed Roles
    cursor.execute("SELECT COUNT(*) FROM ROLES")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO ROLES (IDRole, Nombre, Descripcion) VALUES (?, ?, ?)",
            [
                (1, "ADMINISTRADOR", "Control total del sistema"),
                (2, "CAJERO", "Operaciones de venta y cobro"),
                (3, "BODEGUERO", "Recepcion de mercancia e inventario")
            ]
        )

    # 2. Seed Default Users (la clave del admin viene de ADMIN_PASSWORD; ver bootstrap_security)
    cursor.execute("SELECT COUNT(*) FROM USUARIOS")
    if cursor.fetchone()[0] == 0:
        admin_user = (os.environ.get("ADMIN_USERNAME") or "admin").strip().lower()
        admin_nombre = (os.environ.get("ADMIN_NOMBRE") or "Administrador").strip()
        env_pwd = os.environ.get("ADMIN_PASSWORD")
        admin_pwd = hash_password(env_pwd) if env_pwd else hash_password("admin123")
        cursor.execute(
            "INSERT INTO USUARIOS (IDUsuario, IDRole, Username, PasswordHash, NombreCompleto, Activo) VALUES (?, ?, ?, ?, ?, 1)",
            (1, 1, admin_user, admin_pwd, admin_nombre)
        )
        cursor.execute(
            "INSERT INTO USUARIOS (IDUsuario, IDRole, Username, PasswordHash, NombreCompleto, Activo) VALUES (?, ?, ?, ?, ?, 1)",
            (2, 2, "cajero", unusable_password(), "Cajero Principal")
        )

    # 3. Seed Config
    cursor.execute("SELECT COUNT(*) FROM CONFIGURACION_SISTEMA")
    if cursor.fetchone()[0] == 0:
        cursor.executemany(
            "INSERT INTO CONFIGURACION_SISTEMA (Clave, Valor, Descripcion) VALUES (?, ?, ?)",
            [
                ("NOMBRE_TIENDA", os.environ.get("TIENDA_NOMBRE") or "Mi Tienda", "Nombre comercial de la tienda"),
                ("RUC_TIENDA", os.environ.get("TIENDA_RUC") or "", "Identificacion tributaria"),
                ("DIRECCION_TIENDA", os.environ.get("TIENDA_DIRECCION") or "", "Direccion del local"),
                ("TELEFONO_TIENDA", os.environ.get("TIENDA_TELEFONO") or "", "Telefono de contacto"),
                ("PIE_TICKET", "¡Gracias por su compra! Vuelva pronto.", "Texto al pie del ticket"),
                ("FORMATO_IMPRESORA", "80mm", "Ancho de ticket termico"),
                ("MARGEN_DEFAULT", "25.0", "Margen de ganancia sugerido por defecto (%)")
            ]
        )

    # 4. Seed Categories
    cursor.execute("SELECT COUNT(*) FROM CATEGORIAS")
    if cursor.fetchone()[0] == 0:
        categorias = [
            (1, "Abarrotes", "Productos basicos de alacena"),
            (2, "Lácteos", "Leche, quesos, yogures"),
            (3, "Bebidas", "Gaseosas, jugos, aguas"),
            (4, "Limpieza", "Detergentes, jabones, desinfectantes"),
            (5, "Snacks", "Papas, galletas, golosinas"),
            (6, "Panadería", "Panes frescos y empacados"),
            (7, "Embutidos", "Jamon, salchichas, tocinos")
        ]
        cursor.executemany("INSERT INTO CATEGORIAS (IDCategoria, Nombre, Descripcion) VALUES (?, ?, ?)", categorias)

    # 5. Seed Suppliers
    cursor.execute("SELECT COUNT(*) FROM PROVEEDORES")
    if cursor.fetchone()[0] == 0:
        proveedores = [
            (1, "179241149001", "Bebidas Arca Continental Ecuador Arcardor C.L.", "022973801", "pedidos@arcacontal.com", "Panamericana Norte Km 16 y Jose Viteri", "Distribuidor Coca-Cola, Sprite, Fanta, Powerade, Del Valle")
        ]
        cursor.executemany("INSERT INTO PROVEEDORES (IDProveedor, RUC_CI, RazonSocial, Telefono, Email, Direccion, Observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)", proveedores)

    # 6. Seed Initial Products from Invoice
    cursor.execute("SELECT COUNT(*) FROM PRODUCTOS")
    if cursor.fetchone()[0] == 0:
        prods = [
            (1, 3, "0136", "Coca-Cola 3L (3000ml) PET", "Coca-Cola 3L", "Coca-Cola", "UNIDAD", 2.35, 3.00, 20.0, 2, 2, 0),
            (2, 3, "12499", "Coca-Cola Original 2L PET", "Coca-Cola 2L", "Coca-Cola", "UNIDAD", 1.45, 1.85, 20.0, 2, 2, 0),
            (3, 3, "0131", "Coca-Cola 1.35L (1350ml) PET", "Coca-Cola 1.35L", "Coca-Cola", "UNIDAD", 1.18, 1.50, 20.0, 2, 6, 0),
            (4, 3, "0580", "Sprite 1.35L (1350ml) PET", "Sprite 1.35L", "Sprite", "UNIDAD", 1.05, 1.35, 20.0, 2, 2, 0),
            (5, 3, "3172", "Fanta Naranja 1.35L (1350ml) PET", "Fanta Naranja 1.35L", "Fanta", "UNIDAD", 1.05, 1.35, 20.0, 2, 2, 0),
            (6, 3, "2964", "Powerade Frutas Tropicales 1L (1000ml)", "Powerade 1L", "Powerade", "UNIDAD", 0.88, 1.25, 20.0, 2, 3, 0),
            (7, 3, "1674", "Jugo Del Valle Naranja 950ml PET", "Del Valle 950ml", "Del Valle", "UNIDAD", 0.35, 0.60, 20.0, 2, 6, 0),
            (8, 3, "2952", "Powerade Mora Azul 600ml PET", "Powerade Mora Azul 600ml", "Powerade", "UNIDAD", 0.58, 0.85, 20.0, 2, 4, 0),
            (9, 3, "2953", "Powerade Frutas Tropicales 600ml PET", "Powerade Frutas Tropicales 600ml", "Powerade", "UNIDAD", 0.58, 0.85, 20.0, 2, 2, 0),
            (10, 3, "2954", "Powerade Manzana Clear 600ml PET", "Powerade Manzana Clear 600ml", "Powerade", "UNIDAD", 0.58, 0.85, 20.0, 2, 2, 0),
            (11, 3, "11608", "Fanta Naranja 500ml PET", "Fanta Naranja 500ml", "Fanta", "UNIDAD", 0.38, 0.60, 20.0, 2, 4, 0),
            (12, 3, "2931", "Powerade Manzana Clear 350ml PET", "Powerade Manzana Clear 350ml", "Powerade", "UNIDAD", 0.35, 0.50, 20.0, 2, 4, 0),
            (13, 3, "13104", "Powerade Frutas Cítricas 350ml PET", "Powerade Frutas Cítricas 350ml", "Powerade", "UNIDAD", 0.35, 0.50, 20.0, 2, 2, 0)
        ]
        cursor.executemany(
            """INSERT INTO PRODUCTOS (
                IDProducto, IDCategoria, CodigoInterno, Nombre, Descripcion, Marca, UnidadMedida,
                PrecioCompraActual, PrecioVentaActual, MargenMinimoPorcentaje, StockMinimo, StockActual, PermiteFraccion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            prods
        )

        # Barcode mappings
        barcodes = [(p[0], p[2], 1, "EAN13") for p in prods]
        cursor.executemany(
            "INSERT INTO PRODUCTO_CODIGOS_BARRAS (IDProducto, CodigoBarras, EsPrincipal, TipoCodigo) VALUES (?, ?, ?, ?)",
            barcodes
        )

        # Initial Kardex movements
        for p in prods:
            pid, stock, cost = p[0], p[11], p[7]
            cursor.execute(
                """INSERT INTO MOVIMIENTOS_INVENTARIO (
                    IDProducto, TipoMovimiento, Cantidad, StockAnterior, StockPosterior, ReferenciaID, IDUsuario, Observacion
                ) VALUES (?, 'ENTRADA_COMPRA', ?, 0, ?, '029-001-001309343', 1, 'Ingreso factura Arca Continental')""",
                (pid, stock, stock)
            )

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Base de datos inicializada con exito en:", DB_PATH)
