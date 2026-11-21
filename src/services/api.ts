// API Client Service for Frontend integration with FastAPI Backend

export interface BackendProduct {
  id_producto: number;
  id_categoria: number;
  categoria_nombre?: string;
  id_proveedor?: number;
  proveedor_nombre?: string;
  codigo_interno: string;
  nombre: string;
  descripcion?: string;
  marca?: string;
  unidad_medida: string;
  precio_compra_actual: number;
  precio_venta_actual: number;
  margen_minimo_porcentaje: number;
  stock_minimo: number;
  stock_actual: number;
  permite_fraccion: boolean;
  activo: boolean;
  codigos_barras: string[];
  fecha_modificacion?: string;
}

export interface BackendSaleItem {
  id_detalle_venta: number;
  id_producto: number;
  producto_nombre: string;
  producto_codigo: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  descuento: number;
  subtotal: number;
}

export interface BackendSale {
  id_venta: number;
  id_sesion_caja: number;
  id_usuario: number;
  cajero_nombre?: string;
  numero_venta: string;
  fecha_hora: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  metodo_pago: string;
  monto_recibido: number;
  cambio: number;
  monto_efectivo?: number;
  monto_transferencia?: number;
  estado: string;
  motivo_anulacion?: string | null;
  items: BackendSaleItem[];
}

export interface BackendKardexMovement {
  id_movimiento: number;
  fecha_hora: string;
  id_producto: number;
  producto_nombre?: string;
  producto_codigo?: string;
  tipo_movimiento: string;
  cantidad: number;
  stock_anterior: number;
  stock_posterior: number;
  referencia_id?: string;
  id_usuario: number;
  usuario_nombre?: string;
  observacion?: string;
}

export interface BackendCashMovement {
  id: string;
  hora: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  monto: number;
  ticket_ref?: string;
}

export interface BackendCashSession {
  id_sesion_caja: number;
  id_usuario: number;
  cajero_nombre: string;
  fecha_apertura: string;
  fecha_cierre?: string;
  monto_inicial: number;
  total_ventas_efectivo: number;
  total_ventas_transferencia: number;
  total_retiros: number;
  total_esperado: number;
  total_real_entregado?: number;
  diferencia?: number;
  estado: string;
  observaciones?: string;
  movimientos: BackendCashMovement[];
}

export interface BackendDashboard {
  fecha_inicio: string;
  fecha_fin: string;
  ventas_hoy_total: number;
  tickets_hoy_total: number;
  tickets_efectivo: number;
  tickets_transferencia: number;
  tickets_mixto: number;
  tickets_anulados: number;
  ventas_efectivo_total: number;
  ventas_transferencia_total: number;
  ganancia_bruta_hoy: number;
  margen_promedio_hoy: number;
  valor_inventario_costo: number;
  valor_inventario_venta: number;
  productos_stock_bajo: number;
  productos_agotados: number;
  costos_incrementados_recientes: number;
  caja_activa?: BackendCashSession;
  ventas_por_hora: Array<{ hora: string; monto: number; tickets: number }>;
  top_productos: Array<{
    id_producto: number;
    codigo: string;
    nombre: string;
    unidades: number;
    ingresos: number;
    ganancia: number;
  }>;
}

const rawApiUrl = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

const AUTH_TOKEN_KEY = 'tienda_auth_token';
const AUTH_USER_KEY = 'tienda_auth_user';

let unauthorizedHandler: (() => void) | null = null;

export function setOnUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getAuthToken(): string {
  try {
    return (typeof localStorage !== 'undefined' && (localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem('auth_token'))) || '';
  } catch {
    return '';
  }
}

export function setAuthSession(token: string, user: any) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
  } catch { /* noop */ }
}

export function getStoredAuthUser(): any | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch { /* noop */ }
  return null;
}

export function clearAuthSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      if (typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('auth_token');
        localStorage.removeItem(AUTH_USER_KEY);
      } else {
        localStorage.setItem(AUTH_TOKEN_KEY, '');
        localStorage.setItem('auth_token', '');
        localStorage.setItem(AUTH_USER_KEY, '');
      }
    }
  } catch { /* noop */ }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      if (res.status === 401 && endpoint !== '/auth/login') {
        clearAuthSession();
        if (unauthorizedHandler) unauthorizedHandler();
      }
      const errBody = await res.json().catch(() => ({}));
      throw new ApiError(typeof errBody.detail === 'string' ? errBody.detail : `Error HTTP ${res.status}`, res.status);
    }
    return await res.json();
  } catch (error) {
    console.warn(`API request to ${endpoint} failed:`, error);
    throw error;
  }
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; usuario: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  getMe: () => request<any>('/auth/me'),

  cambiarClave: (clave_actual: string, clave_nueva: string) =>
    request<{ token: string; usuario: any }>('/auth/cambiar-clave', {
      method: 'POST',
      body: JSON.stringify({ clave_actual, clave_nueva })
    }),

  getBackupDownloadUrl: (filename: string) => {
    const token = getAuthToken();
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE}/backups/descargar/${encodeURIComponent(filename)}${q}`;
  },

  // Products
  getProductos: () => request<BackendProduct[]>('/productos'),

  buscarProductos: (query: string) =>
    request<{ query: string; total: number; producto: BackendProduct | null; resultados: BackendProduct[] }>(
      `/productos/buscar?query=${encodeURIComponent(query)}`
    ),

  buscarProducto: (query: string) =>
    request<{ query: string; total: number; producto: BackendProduct | null; resultados: BackendProduct[] }>(
      `/productos/buscar?query=${encodeURIComponent(query)}`
    ),

  crearProductoRapido: (data: {
    nombre: string;
    codigo_barras: string;
    costo: number;
    venta: number;
    id_categoria?: number;
    stock_inicial?: number;
  }) =>
    request<BackendProduct>('/productos/rapido', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  crearProducto: (data: any) =>
    request<BackendProduct>('/productos', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  actualizarProducto: (id: number, data: any) =>
    request<BackendProduct>(`/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  eliminarProducto: (id: number) =>
    request<{ success: boolean }>(`/productos/${id}`, {
      method: 'DELETE'
    }),

  // Sales / POS
  cobrarVenta: (data: {
    clave_idempotencia?: string;
    id_sesion_caja?: number;
    cajero_nombre?: string;
    items: Array<{ id_producto: number; cantidad: number; precio_unitario: number; descuento?: number }>;
    metodo_pago: 'EFECTIVO' | 'TRANSFERENCIA' | 'MIXTO';
    monto_recibido: number;
    monto_efectivo?: number;
    monto_transferencia?: number;
    descuento?: number;
  }) =>
    request<BackendSale>('/ventas/cobrar', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  anularVenta: (idVenta: number, motivo: string) =>
    request<BackendSale>(`/ventas/${idVenta}/anular`, {
      method: 'POST',
      body: JSON.stringify({ motivo })
    }),

  getVentas: (limit: number = 50) => request<BackendSale[]>(`/ventas?limit=${limit}`),

  // Purchases / Compras Reception
  registrarCompra: (data: {
    id_proveedor: number;
    numero_documento: string;
    items: Array<{
      id_producto?: number;
      codigo?: string;
      nombre?: string;
      cantidad: number;
      costo_unitario: number;
      precio_venta_sugerido?: number;
    }>;
    observaciones?: string;
  }) =>
    request<any>('/compras/registrar', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getCompras: (limit: number = 50) => request<any[]>(`/compras?limit=${limit}`),

  // Kardex
  getKardexGeneral: (fechaInicio?: string, fechaFin?: string) => {
    let q = '/inventario/kardex';
    const params = [];
    if (fechaInicio) params.push(`fecha_inicio=${encodeURIComponent(fechaInicio)}`);
    if (fechaFin) params.push(`fecha_fin=${encodeURIComponent(fechaFin)}`);
    if (params.length) q += `?${params.join('&')}`;
    return request<BackendKardexMovement[]>(q);
  },

  getKardexProducto: (idProducto: number) =>
    request<BackendKardexMovement[]>(`/inventario/kardex/${idProducto}`),

  ajustarInventario: (data: {
    id_producto: number;
    tipo_ajuste: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DAÑO' | 'PERDIDA' | 'VENCIMIENTO';
    cantidad: number;
    motivo?: string;
  }) =>
    request<BackendKardexMovement>('/inventario/ajuste', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  eliminarMovimientoKardex: (idMovimiento: number, revertirStock: boolean = true) =>
    request<{ success: boolean; id_movimiento: number; nuevo_stock: number; mensaje: string }>(
      `/inventario/movimientos/${idMovimiento}?revertir_stock=${revertirStock}`,
      { method: 'DELETE' }
    ),

  registrarDevolucion: (data: {
    id_producto: number;
    cantidad: number;
    motivo: string;
    referencia_id?: string;
    afecta_caja?: boolean;
    monto_devolucion?: number;
  }) =>
    request<{ success: boolean; id_movimiento: number; id_producto: number; nuevo_stock: number; mensaje: string }>(
      '/inventario/devolucion',
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    ),

  // Cash Register Sessions
  getCajaActiva: () => request<BackendCashSession | null>('/caja/activa'),

  getHistorialCaja: (limit: number = 30) => request<BackendCashSession[]>(`/caja/historial?limit=${limit}`),

  abrirCaja: (montoInicial: number, observaciones?: string) =>
    request<BackendCashSession>('/caja/abrir', {
      method: 'POST',
      body: JSON.stringify({ monto_inicial: montoInicial, observaciones })
    }),

  cerrarCaja: (totalRealEntregado: number, observaciones?: string) =>
    request<BackendCashSession>('/caja/cerrar', {
      method: 'POST',
      body: JSON.stringify({ total_real_entregado: totalRealEntregado, observaciones })
    }),

  registrarMovimientoCaja: (tipo: 'RETIRO' | 'INGRESO', monto: number, descripcion: string) =>
    request<BackendCashSession>('/caja/movimiento', {
      method: 'POST',
      body: JSON.stringify({ tipo, monto, descripcion })
    }),

  actualizarFondoInicial: (montoInicial: number, idUsuario: number = 1) =>
    request<BackendCashSession>('/caja/fondo-inicial', {
      method: 'PUT',
      body: JSON.stringify({ monto_inicial: montoInicial, id_usuario: idUsuario })
    }),

  // Dashboard & KPIs
  getDashboard: (fechaInicio?: string, fechaFin?: string) => {
    const params: string[] = [];
    if (fechaInicio) params.push(`fecha_inicio=${encodeURIComponent(fechaInicio)}`);
    if (fechaFin) params.push(`fecha_fin=${encodeURIComponent(fechaFin)}`);
    return request<BackendDashboard>(`/dashboard${params.length ? `?${params.join('&')}` : ''}`);
  },

  // Backups
  generarBackup: () =>
    request<{ success: boolean; filename: string; filepath: string; size_bytes: number; timestamp: string }>(
      '/backups/generar',
      { method: 'POST' }
    ),

  getCategorias: () => request<Array<{ id_categoria: number; nombre: string }>>('/categorias'),
  getProveedores: () =>
    request<
      Array<{
        id_proveedor: number;
        ruc_ci: string;
        razon_social: string;
        telefono?: string;
        email?: string;
        direccion?: string;
        observaciones?: string;
      }>
    >('/proveedores'),
  crearProveedor: (data: { ruc_ci?: string; razon_social: string; telefono?: string; email?: string; direccion?: string; observaciones?: string }) =>
    request<{ id_proveedor: number; ruc_ci: string; razon_social: string; telefono?: string; email?: string; direccion?: string; observaciones?: string }>('/proveedores', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  actualizarProveedor: (
    id_proveedor: number,
    data: { ruc_ci?: string; razon_social?: string; telefono?: string; email?: string; direccion?: string; observaciones?: string }
  ) =>
    request<{ id_proveedor: number; ruc_ci: string; razon_social: string; telefono?: string; email?: string; direccion?: string; observaciones?: string }>(
      `/proveedores/${id_proveedor}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    ),
  eliminarProveedor: (id_proveedor: number) =>
    request<{
      success: boolean;
      deleted_products_permanently?: number;
      archived_products?: number;
      total_products_removed?: number;
      provider_deleted_permanently?: boolean;
      message?: string;
    }>(`/proveedores/${id_proveedor}`, {
      method: 'DELETE'
    }),
  getConfiguracion: () => request<Record<string, string>>('/configuracion'),
  guardarConfiguracion: (data: Record<string, string>) =>
    request<{ success: boolean }>('/configuracion', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // AI Invoice Processing & Vision
  procesarFacturaIA: async (formData: FormData): Promise<AIProcessedInvoice> => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/ia/procesar-factura`, {
        method: 'POST',
        headers,
        body: formData
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearAuthSession();
          if (unauthorizedHandler) unauthorizedHandler();
        }
        const err = await res.json().catch(() => ({ detail: 'Error analizando factura con IA' }));
        throw new Error(err.detail || `Error HTTP ${res.status}`);
      }
      return res.json() as Promise<AIProcessedInvoice>;
    } catch (error) {
      console.warn(`API request to /ia/procesar-factura failed:`, error);
      throw error;
    }
  },

  getIAConfig: () => request<{ configurado: boolean; api_key_mascara: string }>('/ia/config'),
  saveIAConfig: (apiKey: string) =>
    request<{ success: boolean; message: string }>('/ia/config', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey })
    }),

  // Purchase Orders / Agenda de Pedidos
  getPedidos: (estado?: string) => {
    let q = '/pedidos';
    if (estado) q += `?estado=${encodeURIComponent(estado)}`;
    return request<BackendPedido[]>(q);
  },
  getPedido: (id: number) => request<BackendPedido>(`/pedidos/${id}`),
  crearPedido: (data: {
    id_proveedor?: number;
    proveedor_nombre?: string;
    fecha_pedido?: string;
    fecha_estimada_entrega?: string;
    items: Array<{ id_producto: number; cantidad_pedida: number; costo_estimado?: number }>;
    notas?: string;
  }) =>
    request<BackendPedido>('/pedidos', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  actualizarPedido: (id: number, data: any) =>
    request<BackendPedido>(`/pedidos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  eliminarPedido: (id: number) =>
    request<{ success: boolean; message: string }>(`/pedidos/${id}`, {
      method: 'DELETE'
    }),
  marcarPedidoRecibido: (id: number, facturaRecepcion: string) =>
    request<BackendPedido>(`/pedidos/${id}/recibir`, {
      method: 'POST',
      body: JSON.stringify({ factura_recepcion: facturaRecepcion })
    }),

  // Workers / Trabajadores
  getTrabajadores: () =>
    request<Array<{
      id_usuario: number;
      username: string;
      nombre_completo: string;
      id_role: number;
      role_name: string;
      activo: boolean;
      fecha_creacion?: string;
      puede_iniciar_sesion?: boolean;
    }>>('/trabajadores'),
  crearTrabajador: (data: { nombre_completo: string; rol?: string; username?: string; password?: string }) =>
    request<{
      id_usuario: number;
      username: string;
      nombre_completo: string;
      id_role: number;
      role_name: string;
      activo: boolean;
      fecha_creacion?: string;
      puede_iniciar_sesion?: boolean;
    }>('/trabajadores', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  asignarClaveTrabajador: (idUsuario: number, password: string) =>
    request<{ success: boolean; message: string }>(`/trabajadores/${idUsuario}/clave`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    }),
  eliminarTrabajador: (idUsuario: number) =>
    request<{ success: boolean; message: string }>(`/trabajadores/${idUsuario}`, {
      method: 'DELETE'
    })
};

export interface BackendPedidoItem {
  id_detalle_pedido: number;
  id_producto: number;
  producto_nombre: string;
  producto_codigo: string;
  categoria?: string;
  codigo_barras?: string;
  cantidad_pedida: number;
  costo_estimado: number;
  subtotal_estimado: number;
}

export interface BackendPedido {
  id_pedido: number;
  id_proveedor: number | null;
  proveedor_nombre: string;
  numero_pedido: string;
  fecha_pedido: string;
  fecha_estimada_entrega: string | null;
  total_estimado: number;
  total_unidades: number;
  estado: 'PENDIENTE' | 'RECIBIDO' | 'CANCELADO';
  notas: string | null;
  factura_recepcion: string | null;
  fecha_recepcion: string | null;
  items: BackendPedidoItem[];
}

export interface AIProcessedItem {
  id_producto: number | null;
  codigo: string;
  nombre: string;
  descripcion_factura: string;
  categoria?: string;
  cantidad: number;
  costo_unitario: number;
  costo_anterior?: number;
  precio_venta_actual?: number;
  precio_venta_sugerido?: number;
  stock_actual?: number;
  descuento: number;
  subtotal: number;
  es_nuevo: boolean;
}

export interface AIProcessedInvoice {
  proveedor_nombre: string;
  id_proveedor: number | null;
  proveedor_ruc?: string;
  numero_factura: string;
  fecha_emision: string;
  subtotal: number;
  descuento: number;
  impuestos: number;
  total: number;
  items: AIProcessedItem[];
  total_items: number;
}
