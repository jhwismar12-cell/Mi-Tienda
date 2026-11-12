# 🛒 Contexto del Proyecto: Mi Tienda Familiar (POS & ERP)

> **Documento de Contexto Técnico para Asistentes de Código (Codex, Cursor, Claude, etc.)**  
> Este documento contiene la arquitectura completa, las reglas de negocio, el esquema de datos y las decisiones de diseño del sistema para que cualquier desarrollador o IA entienda el código sin ambigüedades.

---

## 1. 📌 Resumen del Sistema

**Mi Tienda Familiar** es un sistema integral de **Punto de Venta (POS) y Gestión de Inventarios (ERP ligero)** diseñado para un comercio minorista/abarrotes en Ecuador (moneda: USD `$`).

El sistema está optimizado para:
1. **Atención rápida en mostrador:** Soporte para pistolas lectoras de código de barras USB (sin requerir clic previo), atajos de teclado (`F1`-`F12`), multiplicadores rápidos (`5*código`) y creación inmediata de productos desconocidos ("Alta al Vuelo").
2. **Control de inventario estricto (Kardex Perpetuo):** Cada entrada por compra, salida por venta, merma o ajuste recalcula el saldo atómicamente en base de datos.
3. **Flujo de pedidos inteligente:** Módulo de **Agenda de Pedidos** (borrador al proveedor que **no** altera stock) vinculado al módulo de **Recepción de Mercancía** (donde se valida lo realmente entregado y recién ahí ingresa al stock).
4. **Gestión de turnos flexibles y auditoría de personal:** La tienda es atendida por turnos rotativos sin horario fijo. Hay un selector rápido en la barra superior para cambiar quién está "A cargo ahora", y cada venta, ticket y movimiento de Kardex registra permanentemente el nombre del trabajador responsable.
5. **Arqueo y control de efectivo:** Apertura de turno con fondo inicial configurable, cálculo de efectivo esperado en tiempo real, registro de retiros/gastos y cierre con Reporte Z.

---

## 2. 🏗️ Arquitectura Tecnológica

El proyecto sigue una arquitectura desacoplada **Cliente-Servidor local**:

```
+-------------------------------------------------------------+
|                     FRONTEND (SPA)                          |
|  - React 18 + TypeScript + Vite                             |
|  - TailwindCSS + Lucide Icons                               |
|  - StoreContext (Estado Global unificado + LocalStorage)    |
|  - Escáner USB (Keydown buffer) + Atajos F1-F12             |
+-------------------------------------------------------------+
                              ↕  REST API (HTTP / JSON)
+-------------------------------------------------------------+
|                     BACKEND (FastAPI)                       |
|  - Python 3.11 + FastAPI + Uvicorn                          |
|  - Pydantic v2 (Esquemas de validación y DTOs)              |
|  - Transacciones ACID nativas con sqlite3                   |
|  - Servicios desacoplados (services.py)                     |
+-------------------------------------------------------------+
                              ↕  Conexión SQLite
+-------------------------------------------------------------+
|                  BASE DE DATOS (SQLite)                     |
|  - Archivo: tienda.db (en la raíz del proyecto)             |
|  - Relacional: PRAGMA foreign_keys = ON                     |
|  - Soporte de copia temporal en tests (TIENDA_DB_PATH)      |
+-------------------------------------------------------------+
```

---

## 3. 📂 Estructura del Código

```text
Mi-Tienda/
│
├── backend/                        # API REST en Python
│   ├── database.py                 # Conexión SQLite, esquema DDL, migraciones y seed inicial
│   ├── models.py                   # Modelos Pydantic de entrada/salida (DTOs)
│   ├── services.py                 # Lógica de negocio (transacciones ACID de venta, compras, turnos)
│   └── main.py                     # Endpoints FastAPI y ruteo HTTP
│
├── src/                            # Interfaz de Usuario (React + TypeScript)
│   ├── components/
│   │   ├── pos/                    # Punto de Venta (PosScreen, carrito, métodos de pago, atajos)
│   │   ├── inventory/              # Pantalla de Inventario, filtros, stock mínimo
│   │   ├── orders/                 # Agenda de Pedidos a proveedores (OrderPlannerScreen)
│   │   ├── reception/              # Recepción y cotejo de mercancía (ReceptionScreen)
│   │   ├── reports/                # Arqueo de caja, reporte Z, gráficas y tabla de historial
│   │   ├── settings/               # Ajustes (modo oscuro, gestión de personal/trabajadores)
│   │   ├── kardex/                 # Auditoría de movimientos de inventario (KardexScreen)
│   │   ├── modals/                 # Alta al vuelo, comprobante térmico (ReceiptModal), arqueo
│   │   └── TopHeader.tsx           # Barra superior: estado de caja, modo oscuro, selector de cajero activo
│   ├── context/
│   │   └── StoreContext.tsx        # CEREBRO DEL FRONTEND: sincronización con API, estado global, buffer lector USB
│   ├── services/
│   │   ├── api.ts                  # Cliente fetch para consumir el backend FastAPI
│   │   └── sounds.ts               # Efectos de audio de caja y escáner
│   ├── types.ts                    # Tipado TypeScript (Product, Sale, CashShift, Worker, etc.)
│   ├── App.tsx                     # Ruteo principal por pestañas
│   └── main.tsx                    # Punto de entrada Vite
│
├── tests/
│   └── test_backend.py             # 17 pruebas unitarias completas de la API
│
├── backups/                        # Respaldos comprimidos de tienda.db (.db.gz)
├── iniciar_tienda.bat              # Script Windows para levantar backend y frontend a 1 clic
├── tienda.db                       # Base de datos SQLite real
├── requirements.txt                # Dependencias Python
├── package.json                    # Dependencias Node.js
└── PROJECT_CONTEXT.md              # Este documento
```

---

## 4. 🗄️ Esquema de Base de Datos (`tienda.db`)

La base de datos utiliza claves foráneas (`PRAGMA foreign_keys = ON`) y transacciones estrictas:

### Tablas Principales:
1. **`PRODUCTOS`**:
   - `IDProducto` (PK autoincremental).
   - `CodigoInterno`: Código de factura o referencia del proveedor (ej: `BEB-COC-3000`).
   - `Nombre`, `Descripcion`, `Marca`, `UnidadMedida` (`UNIDAD`, `KG`, `LITRO`).
   - `PrecioCompraActual` (costo) y `PrecioVentaActual` (PVP).
   - `StockActual` (decimal para permitir fracciones) y `StockMinimo`.
2. **`PRODUCTO_CODIGOS_BARRAS`**:
   - Mapea códigos de barras físicos (EAN-13, UPC, etc.) a `IDProducto`. Un producto puede tener uno o múltiples códigos asociados.
3. **`VENTAS` y `VENTAS_DETALLE`**:
   - `VENTAS`: `IDVenta`, `NumeroVenta` (`TK-4095`), `FechaHora`, `Subtotal`, `Descuento`, `Impuestos`, `Total`, `MetodoPago` (`EFECTIVO`/`TRANSFERENCIA`), `MontoRecibido`, `Cambio`, **`CajeroNombre`**, `IDUsuario`.
   - `VENTAS_DETALLE`: `IDProducto`, `Cantidad`, `PrecioUnitario`, `CostoUnitarioAlMomento` (para calcular margen bruto real de cada venta).
4. **`MOVIMIENTOS_INVENTARIO` (Kardex Perpetuo)**:
   - Registra cada cambio en inventario con: `IDProducto`, `TipoMovimiento` (`ENTRADA_COMPRA`, `SALIDA_VENTA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`), `Cantidad`, `StockAnterior`, `StockPosterior`, `ReferenciaID` (número de ticket o factura), `IDUsuario`, `Observacion`.
5. **`SESIONES_CAJA`**:
   - Sesión de caja abierta: `IDUsuario`, `MontoInicial`, `TotalVentasEfectivo`, `TotalVentasTransferencia`, `TotalRetiros`, `TotalEsperado`, `TotalRealEntregado`, `Diferencia`, `Estado` (`ABIERTA`/`CERRADA`).
6. **`PEDIDOS` y `PEDIDOS_DETALLE`**:
   - Agenda de pedidos a proveedores: `NumeroPedido`, `IDProveedor`, `FechaPedido`, `FechaEstimadaEntrega`, `Estado` (`PENDIENTE`, `RECIBIDO_PARCIAL`, `RECIBIDO_TOTAL`, `CANCELADO`).
7. **`COMPRAS` y `COMPRAS_DETALLE`**:
   - Facturas recibidas de proveedores que incrementan stock.
8. **`USUARIOS` y `ROLES`**:
   - Personal de la tienda: `IDUsuario`, `NombreCompleto`, `Rol` (`ADMINISTRADOR`, `CAJERO`).

---

## 5. 💡 Reglas de Negocio y Flujos Críticos

### A. Venta en POS y Lector de Códigos de Barra
* **Entrada sin foco:** El evento global `keydown` en `StoreContext.tsx` captura la ráfaga de teclas enviada por el escáner USB e invoca `addToCartByBarcodeOrCode`.
* **Multiplicador:** Si el cajero ingresa `5*786100123` o `12*BEB-COC-3000`, el sistema automáticamente interpreta cantidad = `5` o `12` y busca el código respectivo.
* **Alta al Vuelo:** Si un código escaneado no existe en la base de datos, no interrumpe el cobro con un error bloqueante: abre el modal emergente para ingresar nombre, costo y precio de venta en 5 segundos, guardándolo en la base de datos e insertándolo de inmediato al carrito.
* **Transacción Atómica de Cobro:** `/api/ventas/cobrar` descuenta stock, inserta venta cabecera y detalle, crea el movimiento de Kardex y actualiza los acumuladores de la sesión de caja en una única transacción SQLite (`with get_db()`).

### B. Personal Rotativo y Trazabilidad de Ventas
* Los turnos no tienen horarios fijos de entrada/salida.
* En `TopHeader.tsx` se muestra: `[Admin] [🟢 A cargo ahora: Nombre ▾]`.
* Al cambiar el trabajador en ese selector, se actualiza `activeWorkerName` en `StoreContext.tsx` y en `localStorage ('tienda_active_worker')`.
* Al cobrar, el frontend envía `cajero_nombre`. El backend lo persiste en la columna `VENTAS.CajeroNombre` y en la observación del Kardex (`"Venta ticket #TK-4095 (A cargo: Nombre)"`).
* En la pantalla de **Reportes**, la tabla **"Historial de Ventas y Personas a Cargo"** permite auditar y filtrar por trabajador exactamente qué tickets cobró cada quien.

### C. Fechas y Horas (Zona Horaria Local vs UTC)
* **Importante:** SQLite por defecto con `CURRENT_TIMESTAMP` devuelve hora UTC. En Ecuador (UTC-5), una venta realizada a las 19:30 UTC-5 caería con fecha del día siguiente en UTC, descuadrando los reportes del día.
* **Solución aplicada:** Tanto en `backend/services.py` como en `src/context/StoreContext.tsx` las fechas y horas de venta se generan explícitamente en hora local con formato `YYYY-MM-DD HH:MM:SS`. Los KPIs del Dashboard filtran las ventas por la fecha local del cliente.

### D. Agenda de Pedidos vs Recepción de Mercancía
* **Agenda de Pedidos (`/api/pedidos`):** Se planifica lo que se va a pedir al proveedor (ej: Arca Continental). Guarda cantidades y costos estimados. **No afecta stock ni Kardex**.
* **Recepción de Mercancía (`/api/compras`):** Cuando el proveedor entrega la mercadería, se abre el pedido pendiente, se ajusta lo que realmente llegó (o no llegó), se ingresa el número de factura física y se confirma. En ese momento se inserta la compra, se actualizan los costos actuales y se incrementa el stock con registro en Kardex. El pedido pasa a estado `RECIBIDO_TOTAL`.

### E. Aislamiento de Base de Datos en Pruebas
* `backend/database.py` permite sobreescribir la ruta de la base de datos mediante la variable de entorno `TIENDA_DB_PATH`.
* En `tests/test_backend.py`, antes de importar la app, se crea una copia temporal en `tempfile.mkdtemp()` y se establece `os.environ["TIENDA_DB_PATH"]`.
* **Regla estricta:** Las pruebas unitarias **nunca** deben apuntar a la base de datos real `tienda.db` para evitar que el `tearDownClass` vacíe las tablas del negocio.

---

## 6. 🚀 Cómo Ejecutar el Proyecto

### Forma Automática (Recomendada en Windows):
Hacer doble clic en `iniciar_tienda.bat` ubicado en la raíz del proyecto. Este script:
1. Inicia el backend FastAPI en `http://localhost:8000`.
2. Inicia el servidor de desarrollo Vite en `http://localhost:5173`.
3. Abre automáticamente el navegador en la aplicación.

### Forma Manual por Terminal:
```bash
# Terminal 1 - Backend:
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 - Frontend:
npm run dev
```

### Verificación y Tests:
```bash
# Comprobación de tipos TypeScript:
npx tsc --noEmit -p .

# Build de producción:
npm run build

# Pruebas unitarias de backend (con entorno aislado):
python -m unittest tests/test_backend.py
```

---

## 7. 📌 Resumen de Endpoints Principales

| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Autenticación de usuario |
| `GET` | `/api/productos/buscar?query={cod}` | Búsqueda por código interno o de barras |
| `GET` | `/api/productos` | Catálogo de productos con stock y precios |
| `POST` | `/api/productos` | Crear nuevo producto (usado en Alta al Vuelo) |
| `PUT` | `/api/productos/{id}` | Actualizar producto |
| `POST` | `/api/ventas/cobrar` | Cobro ACID de venta (descuenta stock, genera ticket y kardex) |
| `GET` | `/api/ventas?limit=50` | Historial de ventas con nombre de cajero |
| `GET` | `/api/caja/activa` | Obtener estado y totales del turno actual |
| `POST` | `/api/caja/abrir` | Abrir nueva sesión de caja |
| `POST` | `/api/caja/cerrar` | Cierre de caja con balance y reporte Z |
| `PUT` | `/api/caja/fondo-inicial` | Modificar fondo inicial del turno activo |
| `GET` | `/api/pedidos` | Listar pedidos de compra planificados |
| `POST` | `/api/pedidos` | Crear pedido a proveedor |
| `POST` | `/api/pedidos/{id}/recibir` | Convertir pedido en compra e ingresar a stock |
| `GET` | `/api/trabajadores` | Listar trabajadores |
| `POST` | `/api/trabajadores` | Registrar nuevo trabajador |
| `DELETE` | `/api/trabajadores/{id}` | Eliminar trabajador |
| `GET` | `/api/dashboard` | KPIs de ventas, ganancias y estado general |

---
*Documento generado para que Codex y cualquier modelo de lenguaje disponga de todo el mapa mental y técnico del sistema.*
