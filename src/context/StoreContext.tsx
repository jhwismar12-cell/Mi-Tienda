import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  Product,
  CartItem,
  PaymentMethod,
  Sale,
  KardexMovement,
  CashShift,
  CashMovement,
  ScreenType,
  ReceptionInvoice,
  ReceptionDraftItem,
  PurchaseOrder,
  PurchaseOrderItem,
  OrderStatus,
  Worker,
  AuthUser
} from '../types';
import { INITIAL_PRODUCTS, INITIAL_KARDEX, INITIAL_SHIFT, INITIAL_SALES } from '../data/initialData';
import { sounds } from '../utils/audio';
import {
  api,
  ApiError,
  BackendProduct,
  BackendSale,
  BackendKardexMovement,
  BackendCashSession,
  BackendPedido,
  getStoredAuthUser,
  setAuthSession,
  clearAuthSession,
  setOnUnauthorized
} from '../services/api';

export interface StoreContextType {
  // Navigation
  activeScreen: ScreenType;
  setActiveScreen: (screen: ScreenType) => void;

  // Auth / Session
  currentUser: AuthUser | null;
  loginUser: (username: string, password: string) => Promise<AuthUser>;
  logoutUser: () => void;
  changeMyPassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // Workers / Personal de Tienda
  workers: Worker[];
  activeWorkerName: string;
  refreshWorkers: () => Promise<void>;
  createWorker: (name: string, role?: string, username?: string, password?: string) => Promise<void>;
  assignWorkerPassword: (id: number, password: string) => Promise<void>;
  deleteWorker: (id: number) => Promise<void>;
  setActiveWorker: (name: string) => void;

  // Products & Inventory
  products: Product[];
  addProduct: (prod: Omit<Product, 'id'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  renameProviderInProducts: (providerId: number, previousName: string, nextName: string) => void;
  adjustStock: (productId: string, delta: number, type: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DAÑO', reason?: string) => Promise<void>;
  refreshProducts: () => Promise<void>;

  // POS Cart
  cart: CartItem[];
  addToCartByBarcodeOrCode: (code: string) => Promise<{ success: boolean; code?: string }>;
  addProductToCart: (product: Product, quantity?: number, options?: { unitPrice?: number; promoLabel?: string }) => void;
  updateCartQuantity: (index: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  selectedCartIndex: number;
  setSelectedCartIndex: (index: number) => void;

  // POS Payment
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  cashReceived: string;
  setCashReceived: (val: string) => void;
  confirmCheckout: () => Promise<Sale | null>;
  isCheckingOut: boolean;

  // Kardex
  kardexMovements: KardexMovement[];
  selectedKardexProductId: string | null;
  setSelectedKardexProductId: (id: string | null) => void;
  getProductKardex: (productId: string) => KardexMovement[];
  refreshKardex: () => Promise<void>;
  deleteKardexMovement: (movementId: string, revertStock?: boolean) => Promise<void>;
  returnProduct: (productId: string, quantity: number, reason: string, refundAmount?: number, affectsCash?: boolean) => Promise<void>;

  // Cash Register / Shift
  cashShift: CashShift;
  setCashierName: (name: string) => void;
  setCountedCash: (amount: number) => void;
  updateInitialCash: (amount: number) => Promise<void>;
  addCashMovement: (type: 'RETIRO' | 'INGRESO', description: string, amount: number) => Promise<void>;
  closeShiftAndGenerateReport: () => void;
  closeShift: (countedCash: number, observations?: string) => Promise<void>;
  openShift: (initialCash: number, cashierName: string) => Promise<void>;
  refreshCashShift: () => Promise<void>;

  // Reception / Compras
  receivePurchases: (invoice: Omit<ReceptionInvoice, 'id'>) => Promise<void>;

  // Purchase Orders / Agenda de Pedidos
  purchaseOrders: PurchaseOrder[];
  selectedOrderForReception: PurchaseOrder | null;
  setSelectedOrderForReception: (order: PurchaseOrder | null) => void;
  refreshPurchaseOrders: () => Promise<void>;
  createPurchaseOrder: (order: {
    providerId?: number;
    providerName: string;
    expectedDeliveryDate?: string;
    items: Array<{ productId: string; code: string; name: string; quantityOrdered: number; estimatedCost: number; category?: string; barcode?: string }>;
    notes?: string;
  }) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => Promise<void>;
  deletePurchaseOrder: (id: string) => Promise<void>;
  receiveOrderInStock: (orderId: string, invoiceNumber: string, receivedItems: ReceptionDraftItem[], providerName: string, providerId: number) => Promise<void>;

  // Sales History
  sales: Sale[];
  lastCompletedSale: Sale | null;
  setLastCompletedSale: (sale: Sale | null) => void;
  refreshSales: () => Promise<void>;

  // Modals & UI Controls
  isOpenShiftModalOpen: boolean;
  setIsOpenShiftModalOpen: (open: boolean) => void;
  isAltaAlVueloOpen: boolean;
  setIsAltaAlVueloOpen: (open: boolean) => void;
  unknownBarcode: string;
  setUnknownBarcode: (code: string) => void;
  handleSaveAltaAlVuelo: (data: {
    name: string;
    category: any;
    costPrice: number;
    salePrice: number;
    initialStock?: number;
    providerId?: number;
    distributor?: string;
  }) => Promise<void>;

  isNewProductModalOpen: boolean;
  setIsNewProductModalOpen: (open: boolean) => void;
  newProductPrefillBarcode: string;
  openNewProductModal: (prefillBarcode?: string) => void;
  inventoryScanEvent: { code: string; seq: number } | null;
  clearInventoryScanEvent: () => void;

  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;

  isReportZModalOpen: boolean;
  setIsReportZModalOpen: (open: boolean) => void;

  isCashMovementModalOpen: boolean;
  setIsCashMovementModalOpen: (open: boolean) => void;

  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;

  // Theme / Dark Mode
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  toggleDarkMode: () => void;

  // Quick action toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

function mapBackendProduct(bp: BackendProduct): Product {
  return {
    id: String(bp.id_producto),
    code: bp.codigo_interno,
    barcode: bp.codigos_barras && bp.codigos_barras.length > 0 ? bp.codigos_barras[0] : '',
    name: bp.nombre,
    category: (bp.categoria_nombre as any) || 'Abarrotes',
    distributor: bp.proveedor_nombre,
    providerId: bp.id_proveedor,
    costPrice: bp.precio_compra_actual,
    salePrice: bp.precio_venta_actual,
    stock: bp.stock_actual,
    minStock: bp.stock_minimo,
    unit: bp.unidad_medida,
    description: bp.descripcion || undefined,
    allowFraction: Boolean(bp.permite_fraccion),
    lastUpdated: bp.fecha_modificacion
  };
}

function mapBackendKardex(bk: BackendKardexMovement): KardexMovement {
  return {
    id: String(bk.id_movimiento),
    productId: String(bk.id_producto),
    date: bk.fecha_hora ? bk.fecha_hora.split(' ')[0] : new Date().toISOString().split('T')[0],
    time: bk.fecha_hora ? bk.fecha_hora.split(' ')[1] || '00:00' : '00:00',
    type: bk.tipo_movimiento === 'ENTRADA_COMPRA' ? 'COMPRA' : bk.tipo_movimiento === 'SALIDA_VENTA' ? 'VENTA' : (bk.tipo_movimiento as any),
    docNumber: bk.referencia_id || '-',
    responsible: bk.usuario_nombre || 'Admin',
    quantityChange: bk.cantidad,
    balance: bk.stock_posterior,
    notes: bk.observacion || undefined
  };
}

function mapBackendSale(bs: BackendSale): Sale {
  return {
    id: String(bs.id_venta),
    ticketNumber: bs.numero_venta,
    date: bs.fecha_hora ? bs.fecha_hora.split(' ')[0] : new Date().toISOString().split('T')[0],
    time: bs.fecha_hora ? bs.fecha_hora.split(' ')[1] || '00:00' : '00:00',
    subtotal: bs.total,
    totalArticles: bs.items ? bs.items.length : 0,
    totalUnits: bs.items ? bs.items.reduce((acc, it) => acc + it.cantidad, 0) : 0,
    paymentMethod: bs.metodo_pago === 'TRANSFERENCIA' ? 'transfer' : 'cash',
    cashReceived: bs.monto_recibido,
    change: bs.cambio,
    cashierName: bs.cajero_nombre || 'Admin',
    items: bs.items ? bs.items.map(it => ({
      productId: String(it.id_producto),
      code: it.producto_codigo,
      name: it.producto_nombre,
      quantity: it.cantidad,
      unitPrice: it.precio_unitario,
      costPrice: it.costo_unitario,
      subtotal: it.subtotal
    })) : []
  };
}

function mapBackendCashSession(bs: BackendCashSession): CashShift {
  return {
    sessionId: bs.id_sesion_caja,
    isOpen: bs.estado === 'ABIERTA',
    openedAt: bs.fecha_apertura,
    cashierName: bs.cajero_nombre,
    initialCash: bs.monto_inicial,
    cashSalesTotal: bs.total_ventas_efectivo,
    transferSalesTotal: bs.total_ventas_transferencia,
    withdrawalsTotal: bs.total_retiros,
    depositsTotal: bs.movimientos.filter(m => m.tipo === 'INGRESO').reduce((total, m) => total + m.monto, 0),
    expectedCash: bs.total_esperado,
    countedCash: bs.total_real_entregado || 0,
    movements: bs.movimientos.map(m => ({
      id: m.id,
      time: m.hora,
      date: m.fecha,
      type: m.tipo as any,
      description: m.descripcion,
      amount: m.monto,
      ticketRef: m.ticket_ref || undefined
    }))
  };
}

function mapBackendPedido(bp: BackendPedido): PurchaseOrder {
  return {
    id: String(bp.id_pedido),
    orderNumber: bp.numero_pedido,
    providerId: bp.id_proveedor || undefined,
    providerName: bp.proveedor_nombre,
    date: bp.fecha_pedido,
    expectedDeliveryDate: bp.fecha_estimada_entrega || undefined,
    status: bp.estado,
    totalUnits: bp.total_unidades,
    totalAmount: bp.total_estimado,
    notes: bp.notas || undefined,
    receivedInvoiceNumber: bp.factura_recepcion || undefined,
    receivedDate: bp.fecha_recepcion || undefined,
    items: bp.items.map(it => ({
      id: String(it.id_detalle_pedido),
      productId: String(it.id_producto),
      code: it.producto_codigo,
      name: it.producto_nombre,
      quantityOrdered: it.cantidad_pedida,
      estimatedCost: it.costo_estimado,
      subtotal: it.subtotal_estimado,
      category: it.categoria,
      barcode: it.codigo_barras
    }))
  };
}

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation
  const [activeScreen, setActiveScreen] = useState<ScreenType>('pos');

  // Products
  const [products, setProducts] = useState<Product[]>(() => {
    const local = localStorage.getItem('tienda_products');
    return local ? JSON.parse(local) : INITIAL_PRODUCTS;
  });

  // Kardex
  const [kardexMovements, setKardexMovements] = useState<KardexMovement[]>(() => {
    const local = localStorage.getItem('tienda_kardex');
    return local ? JSON.parse(local) : INITIAL_KARDEX;
  });
  const [selectedKardexProductId, setSelectedKardexProductId] = useState<string | null>(null);

  // Sales
  const [sales, setSales] = useState<Sale[]>(() => {
    const local = localStorage.getItem('tienda_sales');
    return local ? JSON.parse(local) : INITIAL_SALES;
  });
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Cash Shift
  const [cashShift, setCashShift] = useState<CashShift>(() => {
    const local = localStorage.getItem('tienda_shift');
    return local ? JSON.parse(local) : INITIAL_SHIFT;
  });

  // Purchase Orders (Agenda de Pedidos)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const local = localStorage.getItem('tienda_purchase_orders');
    return local ? JSON.parse(local) : [];
  });
  const [selectedOrderForReception, setSelectedOrderForReception] = useState<PurchaseOrder | null>(null);

  // POS Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('0.00');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkoutInFlight = useRef(false);
  const checkoutAttempt = useRef<{ signature: string; key: string } | null>(null);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isAltaAlVueloOpen, setIsAltaAlVueloOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [isNewProductModalOpenState, setIsNewProductModalOpenState] = useState(false);
  const [newProductPrefillBarcode, setNewProductPrefillBarcode] = useState('');
  const [inventoryScanEvent, setInventoryScanEvent] = useState<{ code: string; seq: number } | null>(null);
  const inventoryScanSeqRef = useRef(0);

  const setIsNewProductModalOpen = useCallback((open: boolean) => {
    if (!open) {
      setNewProductPrefillBarcode('');
    }
    setIsNewProductModalOpenState(open);
  }, []);

  const openNewProductModal = useCallback((prefillBarcode?: string) => {
    setNewProductPrefillBarcode((prefillBarcode || '').trim());
    setIsNewProductModalOpenState(true);
  }, []);

  const clearInventoryScanEvent = useCallback(() => {
    setInventoryScanEvent(null);
  }, []);

  const isNewProductModalOpen = isNewProductModalOpenState;
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isReportZModalOpen, setIsReportZModalOpen] = useState(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Theme State
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tienda_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const setDarkMode = useCallback((val: boolean) => {
    setDarkModeState(val);
    try {
      localStorage.setItem('tienda_theme', val ? 'dark' : 'light');
    } catch { /* noop */ }
    document.documentElement.classList.toggle('dark', val);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(!darkMode);
  }, [darkMode, setDarkMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Auth user state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuthUser());

  // Workers / Personal de Tienda
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const local = localStorage.getItem('tienda_workers');
    return local ? JSON.parse(local) : [
      { id: 1, name: 'Wismar (Administrador)', username: 'admin', role: 'ADMINISTRADOR', active: true, canLogin: true },
      { id: 2, name: 'Cajero Principal', username: 'cajero', role: 'CAJERO', active: true, canLogin: false }
    ];
  });

  const [activeWorkerName, setActiveWorkerNameState] = useState<string>(() => {
    const storedUser = getStoredAuthUser();
    return localStorage.getItem('tienda_active_worker') || storedUser?.nombre_completo || 'Wismar (Administrador)';
  });

  const setActiveWorker = useCallback((name: string) => {
    setActiveWorkerNameState(name);
    try {
      localStorage.setItem('tienda_active_worker', name);
    } catch { /* noop */ }
    setCashShift(prev => ({ ...prev, cashierName: name }));
    showToast(`👤 Turno activo: ${name} ahora a cargo`);
  }, [showToast]);

  const refreshWorkers = useCallback(async () => {
    try {
      const backendWorkers = await api.getTrabajadores();
      if (backendWorkers && backendWorkers.length > 0) {
        const mapped: Worker[] = backendWorkers.map(w => ({
          id: w.id_usuario,
          name: w.nombre_completo,
          username: w.username,
          role: w.role_name,
          active: w.activo,
          createdAt: w.fecha_creacion,
          canLogin: Boolean(w.puede_iniciar_sesion)
        }));
        setWorkers(mapped);
        try {
          localStorage.setItem('tienda_workers', JSON.stringify(mapped));
        } catch { /* noop */ }
      }
    } catch (e) {
      console.warn('Usando trabajadores locales');
    }
  }, []);

  const createWorker = useCallback(async (name: string, role: string = 'CAJERO', username?: string, password?: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      const payload: { nombre_completo: string; rol: string; username?: string; password?: string } = {
        nombre_completo: cleanName,
        rol: role
      };
      if (username && username.trim()) payload.username = username.trim();
      if (password && password.trim()) payload.password = password;

      const created = await api.crearTrabajador(payload);
      const newW: Worker = {
        id: created.id_usuario,
        name: created.nombre_completo,
        username: created.username,
        role: created.role_name,
        active: created.activo,
        createdAt: created.fecha_creacion,
        canLogin: Boolean(created.puede_iniciar_sesion)
      };
      setWorkers(prev => [...prev, newW]);
      showToast(newW.canLogin ? `Usuario "${newW.username}" creado con acceso al sistema` : `Trabajador "${newW.name}" registrado`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        showToast(`⚠️ ${err.message}`);
        throw err;
      }
      const newW: Worker = {
        id: Date.now(),
        name: cleanName,
        username: (username && username.trim()) || cleanName.toLowerCase().replace(/\s+/g, '_'),
        role,
        active: true,
        canLogin: Boolean(password && password.trim())
      };
      setWorkers(prev => [...prev, newW]);
      showToast(`Trabajador "${newW.name}" registrado`);
    }
  }, [showToast]);

  const assignWorkerPassword = useCallback(async (id: number, password: string) => {
    await api.asignarClaveTrabajador(id, password);
    setWorkers(prev => prev.map(w => w.id === id ? { ...w, canLogin: true } : w));
    showToast('🔑 Contraseña asignada correctamente');
  }, [showToast]);

  const deleteWorker = useCallback(async (id: number) => {
    try {
      await api.eliminarTrabajador(id);
    } catch (e) {
      // Local fallback
    }
    const removed = workers.find(w => w.id === id);
    setWorkers(prev => prev.filter(w => w.id !== id));
    if (removed && removed.name.trim().toLowerCase() === activeWorkerName.trim().toLowerCase()) {
      const admin = workers.find(w => w.id === 1);
      setActiveWorker(admin ? admin.name : 'Wismar (Administrador)');
    }
    showToast('Trabajador eliminado');
  }, [showToast, workers, activeWorkerName, setActiveWorker]);

  // Sync with Backend
  const refreshProducts = useCallback(async () => {
    try {
      const backendProds = await api.getProductos();
      if (backendProds && backendProds.length > 0) {
        setProducts(backendProds.map(mapBackendProduct));
      }
    } catch (e) {
      console.warn('Usando productos locales');
    }
  }, []);

  const refreshKardex = useCallback(async () => {
    try {
      const backendKardex = await api.getKardexGeneral();
      if (backendKardex) {
        setKardexMovements(backendKardex.map(mapBackendKardex));
      }
    } catch (e) {
      console.warn('Usando kardex local');
    }
  }, []);

  const refreshCashShift = useCallback(async () => {
    try {
      const backendShift = await api.getCajaActiva();
      if (backendShift) {
        const mapped = mapBackendCashSession(backendShift);
        setCashShift(mapped);
        if (!mapped.isOpen) {
          setIsOpenShiftModalOpen(true);
        }
      } else {
        setCashShift(prev => ({ ...prev, isOpen: false }));
        setIsOpenShiftModalOpen(true);
      }
    } catch (e) {
      console.warn('Usando caja local');
    }
  }, []);

  const refreshPurchaseOrders = useCallback(async () => {
    try {
      const backendOrders = await api.getPedidos();
      if (backendOrders) {
        setPurchaseOrders(backendOrders.map(mapBackendPedido));
      }
    } catch (e) {
      console.warn('Usando pedidos locales');
    }
  }, []);

  const refreshSales = useCallback(async () => {
    try {
      const backendSales = await api.getVentas();
      if (backendSales) {
        setSales(backendSales.map(mapBackendSale));
      }
    } catch (e) {
      console.warn('Usando ventas locales');
    }
  }, []);

  // Init fetch
  useEffect(() => {
    setOnUnauthorized(() => {
      setCurrentUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  useEffect(() => {
    refreshProducts();
    refreshKardex();
    refreshCashShift();
    refreshPurchaseOrders();
    refreshWorkers();
    refreshSales();
  }, [refreshProducts, refreshKardex, refreshCashShift, refreshPurchaseOrders, refreshWorkers, refreshSales]);

  const loginUser = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const res = await api.login(username.trim(), password);
    setAuthSession(res.token, res.usuario);
    setCurrentUser(res.usuario);
    if (res.usuario?.nombre_completo) {
      setActiveWorkerNameState(res.usuario.nombre_completo);
      try {
        localStorage.setItem('tienda_active_worker', res.usuario.nombre_completo);
      } catch { /* noop */ }
    }
    await Promise.all([
      refreshProducts(),
      refreshKardex(),
      refreshCashShift(),
      refreshPurchaseOrders(),
      refreshWorkers(),
      refreshSales()
    ]);
    return res.usuario;
  }, [refreshProducts, refreshKardex, refreshCashShift, refreshPurchaseOrders, refreshWorkers, refreshSales]);

  const logoutUser = useCallback(() => {
    clearAuthSession();
    setCurrentUser(null);
    showToast('🔒 Sesión cerrada');
  }, [showToast]);

  const changeMyPassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await api.cambiarClave(currentPassword, newPassword);
    setAuthSession(res.token, res.usuario);
    setCurrentUser(res.usuario);
    showToast('✅ Contraseña actualizada correctamente');
  }, [showToast]);

  // LocalStorage backups
  useEffect(() => {
    localStorage.setItem('tienda_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('tienda_kardex', JSON.stringify(kardexMovements));
  }, [kardexMovements]);

  useEffect(() => {
    localStorage.setItem('tienda_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('tienda_shift', JSON.stringify(cashShift));
  }, [cashShift]);

  useEffect(() => {
    localStorage.setItem('tienda_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  // Cart operations
  const addProductToCart = useCallback(
    (product: Product, quantity = 1, options?: { unitPrice?: number; promoLabel?: string }) => {
      const qty = Number(quantity.toFixed(3));
      if (!Number.isFinite(qty) || qty <= 0) return;
      const effectivePrice = options?.unitPrice !== undefined ? options.unitPrice : product.salePrice;
      const promoLabel = options?.promoLabel;

      setCart(prev => {
        const existingIdx = prev.findIndex(
          item =>
            item.product.id === product.id &&
            Math.abs(item.unitPrice - effectivePrice) < 1e-5 &&
            (item.promoLabel || '') === (promoLabel || '')
        );
        if (existingIdx >= 0) {
          const newQty = Number((prev[existingIdx].quantity + qty).toFixed(3));
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: newQty,
            subtotal: Number((newQty * updated[existingIdx].unitPrice).toFixed(2))
          };
          sounds.playScannerBeep();
          setSelectedCartIndex(existingIdx);
          return updated;
        }

        sounds.playScannerBeep();
        const newItem: CartItem = {
          product,
          quantity: qty,
          unitPrice: effectivePrice,
          subtotal: Number((qty * effectivePrice).toFixed(2)),
          promoLabel
        };
        const nextCart = [...prev, newItem];
        setSelectedCartIndex(nextCart.length - 1);
        return nextCart;
      });
    },
    [showToast]
  );

  const addToCartByBarcodeOrCode = useCallback(
    async (query: string): Promise<{ success: boolean; code?: string }> => {
      const raw = query.trim();
      if (!raw) return { success: false };

      let quantity = 1;
      let targetCode = raw.toUpperCase();

      // Multiplier syntax: e.g. "5*786100123", "5X786100123", "0.5*GRN-ARR-MAR"
      const multiplierMatch = raw.match(/^(\d+(?:[.,]\d+)?)\s*[\*xX]\s*(.+)$/);
      if (multiplierMatch) {
        const parsedMult = parseFloat(multiplierMatch[1].replace(',', '.'));
        quantity = parsedMult > 0 ? Number(parsedMult.toFixed(3)) : 1;
        targetCode = multiplierMatch[2].trim().toUpperCase();
      }

      // 1. Try local memory
      let matched = products.find(
        p => (p.barcode && p.barcode.toUpperCase() === targetCode) || p.code.toUpperCase() === targetCode
      );

      // 2. Try Backend if not found locally
      if (!matched) {
        try {
          const res = await api.buscarProducto(targetCode);
          if (res && res.producto) {
            matched = mapBackendProduct(res.producto);
          }
        } catch (e) {
          // ignore
        }
      }

      if (matched) {
        addProductToCart(matched, quantity);
        return { success: true };
      }

      // Not found -> trigger Alta al Vuelo
      sounds.playErrorBeep();
      setUnknownBarcode(targetCode);
      setIsAltaAlVueloOpen(true);
      return { success: false, code: targetCode };
    },
    [products, addProductToCart]
  );

  const scannerStateRef = useRef({
    activeScreen,
    isModalOpen: false
  });
  scannerStateRef.current = {
    activeScreen,
    isModalOpen:
      isOpenShiftModalOpen ||
      isAltaAlVueloOpen ||
      isNewProductModalOpenState ||
      isReceiptModalOpen ||
      isReportZModalOpen ||
      isCashMovementModalOpen ||
      isGlobalSearchOpen
  };

  // Global Keybindings & USB Barcode Scanner support
  useEffect(() => {
    let scannerBuffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // F-Keys
      if (e.key === 'F12') {
        e.preventDefault();
        closeShiftAndGenerateReport();
        return;
      }

      if (isInput) return;

      // Barcode hardware scanner input
      const currentTime = Date.now();
      const isFast = currentTime - lastKeyTime < 50;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (scannerBuffer.length >= 3) {
          const scanned = scannerBuffer;
          scannerBuffer = '';
          const { activeScreen: currentScreen, isModalOpen } = scannerStateRef.current;
          if (isModalOpen) return;
          if (currentScreen === 'inventory') {
            setInventoryScanEvent({ code: scanned, seq: ++inventoryScanSeqRef.current });
          } else {
            addToCartByBarcodeOrCode(scanned);
          }
        }
        return;
      }

      if (e.key.length === 1) {
        if (isFast || scannerBuffer.length > 0) {
          scannerBuffer += e.key;
        } else {
          scannerBuffer = e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [addToCartByBarcodeOrCode]);

  const updateCartQuantity = useCallback((index: number, quantity: number) => {
    const nextQty = Number(quantity.toFixed(3));
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      removeFromCart(index);
      return;
    }

    setCart(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: nextQty,
        subtotal: Number((nextQty * updated[index].unitPrice).toFixed(2))
      };
      return updated;
    });
  }, []);

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    setSelectedCartIndex(prev => Math.max(0, prev - 1));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartIndex(0);
    setCashReceived('0.00');
  };

  // Alta al Vuelo
  const handleSaveAltaAlVuelo = async (data: {
    name: string;
    category: any;
    costPrice: number;
    salePrice: number;
    initialStock?: number;
    providerId?: number;
    distributor?: string;
  }) => {
    const code = unknownBarcode || `AUT-${Date.now()}`;
    const newProd = await addProduct({
      code,
      barcode: unknownBarcode,
      name: data.name,
      category: data.category,
      providerId: data.providerId,
      distributor: data.distributor,
      costPrice: data.costPrice,
      salePrice: data.salePrice,
      stock: data.initialStock || 0,
      minStock: 5
    });

    setIsAltaAlVueloOpen(false);
    setUnknownBarcode('');
    addProductToCart(newProd, 1);
    showToast(`Producto "${newProd.name}" registrado`);
  };

  // Checkout / Venta
  const confirmCheckout = async (): Promise<Sale | null> => {
    if (checkoutInFlight.current || cart.length === 0) return null;
    if (!cashShift.isOpen) {
      showToast('Abre la caja antes de cobrar.');
      setIsOpenShiftModalOpen(true);
      return null;
    }

    const subtotal = Number(cart.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2));
    const totalUnits = Number(cart.reduce((acc, item) => acc + item.quantity, 0).toFixed(3));
    const cashNum = paymentMethod === 'cash' ? Number(cashReceived) : subtotal;
    if (!Number.isFinite(cashNum) || cashNum < 0 || (paymentMethod === 'cash' && Math.round(cashNum * 100) < Math.round(subtotal * 100))) {
      showToast('El efectivo recibido es insuficiente para cubrir el total.');
      return null;
    }
    const saleItems = cart.map(it => ({
      productId: it.product.id,
      code: it.product.code,
      name: it.product.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      costPrice: it.product.costPrice,
      subtotal: it.subtotal
    }));

    const currentCashier = activeWorkerName || cashShift.cashierName || 'Wismar (Administrador)';
    const payload = {
        id_sesion_caja: cashShift.sessionId,
        items: cart.map(it => ({
          id_producto: parseInt(it.product.id),
          cantidad: it.quantity,
          precio_unitario: it.unitPrice
        })),
        metodo_pago: paymentMethod === 'cash' ? 'EFECTIVO' as const : 'TRANSFERENCIA' as const,
        monto_recibido: cashNum,
        cajero_nombre: currentCashier
    };
    const signature = JSON.stringify(payload);
    if (checkoutAttempt.current && checkoutAttempt.current.signature !== signature) {
      showToast('El cobro anterior está pendiente de confirmar. Reintenta con el mismo carrito, pago y cajero.');
      return null;
    }
    checkoutAttempt.current ??= {
      signature,
      key: crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')
    };
    checkoutInFlight.current = true;
    setIsCheckingOut(true);
    try {
      const res = await api.cobrarVenta({ ...payload, clave_idempotencia: checkoutAttempt.current.key });

      const completedSale: Sale = {
        id: String(res.id_venta),
        ticketNumber: res.numero_venta,
        date: res.fecha_hora.split(' ')[0],
        time: res.fecha_hora.split(' ')[1] || '00:00',
        items: saleItems,
        subtotal: res.subtotal,
        totalArticles: cart.length,
        totalUnits,
        paymentMethod,
        cashReceived: res.monto_recibido,
        change: res.cambio,
        cashierName: res.cajero_nombre || currentCashier
      };

      setSales(prev => [completedSale, ...prev.filter(sale => sale.id !== completedSale.id)]);
      setLastCompletedSale(completedSale);
      checkoutAttempt.current = null;
      clearCart();
      sounds.playPaymentSuccess();
      refreshProducts();
      refreshKardex();
      refreshCashShift();
      setIsReceiptModalOpen(true);
      return completedSale;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        checkoutAttempt.current = null;
        showToast(`No se completó el cobro: ${error.message}`);
      } else {
        showToast('No se pudo confirmar el cobro. Conservamos el carrito; reintenta para recuperar el mismo ticket.');
      }
      return null;
    } finally {
      checkoutInFlight.current = false;
      setIsCheckingOut(false);
    }
  };

  // Product CRUD
  const addProduct = async (prodData: Omit<Product, 'id'>): Promise<Product> => {
    try {
      const categories = await api.getCategorias();
      const selectedCategory = categories.find(category =>
        category.nombre.trim().toLocaleLowerCase('es') === prodData.category.trim().toLocaleLowerCase('es')
      );
      if (!selectedCategory) {
        throw new Error(`La categoría "${prodData.category}" no está disponible. Actualiza la tienda y vuelve a intentar.`);
      }
      const unit = prodData.unit || 'UNIDAD';
      const allowFraction =
        prodData.allowFraction ?? (unit === 'LIBRA' || unit === 'KG' || unit === 'GALON');
      const created = await api.crearProducto({
        id_categoria: selectedCategory.id_categoria,
        id_proveedor: prodData.providerId,
        codigo_interno: prodData.code,
        nombre: prodData.name,
        descripcion: prodData.description,
        unidad_medida: unit,
        permite_fraccion: allowFraction,
        precio_compra_actual: prodData.costPrice,
        precio_venta_actual: prodData.salePrice,
        stock_minimo: prodData.minStock || 5,
        stock_inicial: prodData.stock || 0,
        codigos_barras: prodData.barcode ? [prodData.barcode] : []
      });
      const mapped = mapBackendProduct(created);
      if (!mapped.distributor && prodData.distributor) {
        mapped.distributor = prodData.distributor;
      }
      if (mapped.providerId === undefined && prodData.providerId !== undefined) {
        mapped.providerId = prodData.providerId;
      }
      setProducts(prev => [mapped, ...prev]);
      refreshKardex();
      showToast(`Producto "${mapped.name}" creado`);
      return mapped;
    } catch (error) {
      showToast(`No se creó el producto: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    let mappedFromBackend: Product | null = null;
    try {
      const numId = parseInt(id);
      if (!isNaN(numId)) {
        const hasProviderUpdate = 'providerId' in updates;
        const updatedBackend = await api.actualizarProducto(numId, {
          nombre: updates.name,
          codigo_interno: updates.code,
          descripcion: updates.description,
          unidad_medida: updates.unit,
          permite_fraccion: updates.allowFraction,
          id_proveedor: hasProviderUpdate ? (updates.providerId ?? null) : undefined,
          precio_compra_actual: updates.costPrice,
          precio_venta_actual: updates.salePrice,
          stock_minimo: updates.minStock,
          codigos_barras: updates.barcode !== undefined ? (updates.barcode ? [updates.barcode] : []) : undefined
        });
        if (updatedBackend && typeof updatedBackend.id_producto === 'number') {
          mappedFromBackend = mapBackendProduct(updatedBackend);
        }
      }
    } catch (e) {
      console.warn('Actualización local:', e);
    }
    setProducts(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        if (mappedFromBackend) {
          return {
            ...mappedFromBackend,
            distributor:
              mappedFromBackend.distributor ??
              ('distributor' in updates ? updates.distributor : undefined),
            providerId:
              mappedFromBackend.providerId ??
              ('providerId' in updates ? updates.providerId : undefined)
          };
        }
        return { ...p, ...updates, lastUpdated: new Date().toISOString() };
      })
    );
    showToast('Producto actualizado');
  };

  const deleteProduct = async (id: string) => {
    let message = 'Producto eliminado';
    let deletedPermanently = true;
    try {
      const numId = parseInt(id);
      if (!isNaN(numId)) {
        const res = await api.eliminarProducto(numId);
        if (res && typeof res === 'object' && 'deleted_permanently' in res) {
          deletedPermanently = Boolean((res as { deleted_permanently?: boolean }).deleted_permanently);
        }
        if (res && typeof res === 'object' && 'message' in res && typeof (res as { message?: string }).message === 'string') {
          message = (res as { message?: string }).message as string;
        }
      }
    } catch (e) {
      if (e instanceof ApiError) {
        showToast(`⚠️ No se pudo eliminar el producto: ${e.message}`);
        throw e;
      }
      console.warn('Eliminación local:', e);
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    setCart(prev => prev.filter(item => item.product.id !== id));
    if (selectedKardexProductId === id) {
      setSelectedKardexProductId(null);
    }
    if (deletedPermanently) {
      setKardexMovements(prev => prev.filter(m => m.productId !== id));
    }
    showToast(message);
  };

  const renameProviderInProducts = useCallback((providerId: number, previousName: string, nextName: string) => {
    const cleanPrev = previousName.trim().toLowerCase();
    const cleanNext = nextName.trim();
    if (!cleanNext) return;
    setProducts(prev =>
      prev.map(p => {
        const matchesId = p.providerId === providerId;
        const matchesName =
          p.providerId === undefined &&
          cleanPrev !== '' &&
          (p.distributor || '').trim().toLowerCase() === cleanPrev;
        if (matchesId || matchesName) {
          return { ...p, providerId, distributor: cleanNext };
        }
        return p;
      })
    );
  }, []);

  const adjustStock = async (
    productId: string,
    delta: number,
    type: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DAÑO',
    reason?: string
  ) => {
    try {
      const numId = parseInt(productId);
      if (!isNaN(numId)) {
        await api.ajustarInventario({
          id_producto: numId,
          tipo_ajuste: type,
          cantidad: Math.abs(delta),
          motivo: reason
        });
        refreshProducts();
        refreshKardex();
        showToast('Ajuste de inventario aplicado');
        return;
      }
    } catch (e) {
      // Local fallback
    }

    const now = new Date();
    setProducts(prev =>
      prev.map(p => {
        if (p.id !== productId) return p;
        const newStock = Math.max(0, p.stock + delta);
        const mov: KardexMovement = {
          id: `mov-${Date.now()}`,
          productId: p.id,
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0],
          type,
          docNumber: `AJU-${Date.now()}`,
          responsible: cashShift.cashierName,
          quantityChange: delta,
          balance: newStock,
          notes: reason
        };
        setKardexMovements(kprev => [mov, ...kprev]);
        return { ...p, stock: newStock };
      })
    );
    showToast('Ajuste de inventario aplicado');
  };

  const deleteKardexMovement = async (movementId: string, revertStock: boolean = true) => {
    try {
      const numId = parseInt(movementId);
      if (!isNaN(numId)) {
        const res = await api.eliminarMovimientoKardex(numId, revertStock);
        refreshProducts();
        refreshKardex();
        showToast(res.mensaje || 'Movimiento eliminado del Kardex');
        return;
      }
    } catch (e) {
      console.warn('Eliminación local de movimiento:', e);
    }

    // Local fallback
    const target = kardexMovements.find(m => m.id === movementId);
    if (target && revertStock) {
      const revDelta = -target.quantityChange;
      setProducts(prev =>
        prev.map(p =>
          p.id === target.productId ? { ...p, stock: Math.max(0, p.stock + revDelta) } : p
        )
      );
    }
    setKardexMovements(prev => prev.filter(m => m.id !== movementId));
    showToast('Movimiento eliminado del Kardex');
  };

  const returnProduct = async (
    productId: string,
    quantity: number,
    reason: string,
    refundAmount: number = 0,
    affectsCash: boolean = false
  ) => {
    try {
      const res = await api.registrarDevolucion({
        id_producto: Number(productId), cantidad: quantity, motivo: reason,
        afecta_caja: affectsCash, monto_devolucion: refundAmount
      });
      await Promise.all([refreshProducts(), refreshKardex(), ...(affectsCash ? [refreshCashShift()] : [])]);
      showToast(res.mensaje || 'Devolución de producto registrada');
    } catch (error) {
      showToast(`No se registró la devolución: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  const getProductKardex = (productId: string) => {
    return kardexMovements.filter(m => m.productId === productId);
  };

  // Shift operations
  const setCashierName = (name: string) => {
    setCashShift(prev => ({ ...prev, cashierName: name }));
  };

  const setCountedCash = (amount: number) => {
    setCashShift(prev => ({ ...prev, countedCash: amount }));
  };

  const updateInitialCash = async (newInitialCash: number) => {
    try {
      const backendShift = await api.actualizarFondoInicial(newInitialCash);
      setCashShift(mapBackendCashSession(backendShift));
      showToast(`Fondo inicial actualizado a $${newInitialCash.toFixed(2)}`);
    } catch (error) {
      showToast(`No se actualizó el fondo: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  const addCashMovement = async (type: 'RETIRO' | 'INGRESO', description: string, amount: number) => {
    try {
      const backendShift = await api.registrarMovimientoCaja(type, amount, description);
      setCashShift(mapBackendCashSession(backendShift));
      showToast(`Movimiento de caja (${type}) registrado`);
    } catch (error) {
      showToast(`No se registró el movimiento de caja: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  const closeShiftAndGenerateReport = () => {
    setIsReportZModalOpen(true);
  };

  const closeShift = async (countedCash: number, observations?: string) => {
    try {
      const closedShift = await api.cerrarCaja(countedCash, observations);
      setCashShift(mapBackendCashSession(closedShift));
      showToast('Caja cerrada con éxito');
    } catch (error) {
      showToast(`No se cerró la caja: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  const openShift = async (initialCash: number, cashierName: string) => {
    try {
      const openedShift = await api.abrirCaja(initialCash, `Apertura por ${cashierName}`);
      setCashShift(mapBackendCashSession(openedShift));
      setIsOpenShiftModalOpen(false);
      showToast(`Caja abierta con $${initialCash.toFixed(2)} por ${cashierName}`);
    } catch (error) {
      showToast(`No se abrió la caja: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  // Reception / Compras
  const receivePurchases = async (invoice: Omit<ReceptionInvoice, 'id'>) => {
    try {
      if (!Number.isInteger(invoice.providerId) || invoice.providerId <= 0) {
        throw new Error('Selecciona un proveedor registrado.');
      }
      await api.registrarCompra({
        id_proveedor: invoice.providerId,
        numero_documento: invoice.invoiceNumber,
        items: invoice.items.map(it => ({
          codigo: it.code, nombre: it.name, cantidad: it.quantityReceived,
          costo_unitario: it.unitCost, precio_venta_sugerido: it.suggestedSalePrice || it.salePrice
        })),
        observaciones: `Recepción de mercadería ${invoice.provider}`
      });
      await Promise.all([refreshProducts(), refreshKardex()]);
      showToast(`Factura ${invoice.invoiceNumber} registrada exitosamente (+${invoice.totalUnits} un)`);
    } catch (error) {
      showToast(`No se registró la compra: ${error instanceof Error ? error.message : 'Error de conexión'}`);
      throw error;
    }
  };

  // Purchase Orders / Agenda de Pedidos
  const createPurchaseOrder = async (orderData: {
    providerId?: number;
    providerName: string;
    expectedDeliveryDate?: string;
    items: Array<{ productId: string; code: string; name: string; quantityOrdered: number; estimatedCost: number; category?: string; barcode?: string }>;
    notes?: string;
  }): Promise<PurchaseOrder> => {
    try {
      const created = await api.crearPedido({
        id_proveedor: orderData.providerId,
        proveedor_nombre: orderData.providerName,
        fecha_estimada_entrega: orderData.expectedDeliveryDate,
        notas: orderData.notes,
        items: orderData.items.map(it => ({
          id_producto: parseInt(it.productId) || 1,
          cantidad_pedida: it.quantityOrdered,
          costo_estimado: it.estimatedCost
        }))
      });
      const mapped = mapBackendPedido(created);
      setPurchaseOrders(prev => [mapped, ...prev]);
      showToast(`Pedido #${mapped.orderNumber} creado exitosamente`);
      return mapped;
    } catch (e) {
      // Local fallback
      const totalUnits = orderData.items.reduce((acc, it) => acc + it.quantityOrdered, 0);
      const totalAmount = orderData.items.reduce((acc, it) => acc + it.quantityOrdered * it.estimatedCost, 0);
      const todayStr = new Date().toISOString().split('T')[0];
      const orderNum = `PED-${Date.now().toString().slice(-6)}`;

      const newOrder: PurchaseOrder = {
        id: `ped-${Date.now()}`,
        orderNumber: orderNum,
        providerId: orderData.providerId,
        providerName: orderData.providerName,
        date: todayStr,
        expectedDeliveryDate: orderData.expectedDeliveryDate,
        status: 'PENDIENTE',
        totalUnits,
        totalAmount,
        notes: orderData.notes,
        items: orderData.items.map((it, idx) => ({
          id: `det-${Date.now()}-${idx}`,
          productId: it.productId,
          code: it.code,
          name: it.name,
          quantityOrdered: it.quantityOrdered,
          estimatedCost: it.estimatedCost,
          subtotal: it.quantityOrdered * it.estimatedCost,
          category: it.category,
          barcode: it.barcode
        }))
      };

      setPurchaseOrders(prev => [newOrder, ...prev]);
      showToast(`Pedido #${orderNum} creado exitosamente (Modo Local)`);
      return newOrder;
    }
  };

  const updatePurchaseOrder = async (id: string, updates: Partial<PurchaseOrder>) => {
    try {
      const numId = parseInt(id);
      if (!isNaN(numId)) {
        await api.actualizarPedido(numId, {
          estado: updates.status,
          fecha_estimada_entrega: updates.expectedDeliveryDate,
          notas: updates.notes,
          items: updates.items ? updates.items.map(it => ({
            id_producto: parseInt(it.productId) || 1,
            cantidad_pedida: it.quantityOrdered,
            costo_estimado: it.estimatedCost
          })) : undefined
        });
        refreshPurchaseOrders();
        showToast('Pedido actualizado');
        return;
      }
    } catch (e) {
      console.warn('Actualización local de pedido:', e);
    }

    setPurchaseOrders(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
    showToast('Pedido actualizado');
  };

  const deletePurchaseOrder = async (id: string) => {
    try {
      const numId = parseInt(id);
      if (!isNaN(numId)) {
        await api.eliminarPedido(numId);
      }
    } catch (e) {
      console.warn('Eliminación local de pedido:', e);
    }
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
    showToast('Pedido eliminado');
  };

  const receiveOrderInStock = async (
    orderId: string,
    invoiceNumber: string,
    receivedItems: ReceptionDraftItem[],
    providerName: string,
    providerId: number
  ) => {
    // 1. Process purchase reception (which updates stock and Kardex)
    const totalUnits = receivedItems.reduce((acc, it) => acc + it.quantityReceived, 0);
    const totalAmount = receivedItems.reduce((acc, it) => acc + it.quantityReceived * it.unitCost, 0);

    await receivePurchases({
      provider: providerName,
      providerId,
      invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      items: receivedItems,
      totalUnits,
      totalAmount
    });

    // 2. Mark order as RECIBIDO
    try {
      const numId = parseInt(orderId);
      if (!isNaN(numId)) {
        await api.marcarPedidoRecibido(numId, invoiceNumber);
        refreshPurchaseOrders();
      }
    } catch (e) {
      // Local fallback
      setPurchaseOrders(prev =>
        prev.map(o =>
          o.id === orderId
            ? {
                ...o,
                status: 'RECIBIDO',
                receivedInvoiceNumber: invoiceNumber,
                receivedDate: new Date().toISOString()
              }
            : o
        )
      );
    }

    setSelectedOrderForReception(null);
    showToast(`✅ Pedido recibido y cargado al stock con factura ${invoiceNumber}`);
  };

  return (
    <StoreContext.Provider
      value={{
        activeScreen,
        setActiveScreen,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        renameProviderInProducts,
        adjustStock,
        refreshProducts,
        cart,
        addToCartByBarcodeOrCode,
        addProductToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        selectedCartIndex,
        setSelectedCartIndex,
        paymentMethod,
        setPaymentMethod,
        cashReceived,
        setCashReceived,
        confirmCheckout,
        isCheckingOut,
        kardexMovements,
        selectedKardexProductId,
        setSelectedKardexProductId,
        getProductKardex,
        refreshKardex,
        deleteKardexMovement,
        returnProduct,
        cashShift,
        setCashierName,
        setCountedCash,
        updateInitialCash,
        addCashMovement,
        closeShiftAndGenerateReport,
        closeShift,
        openShift,
        refreshCashShift,
        receivePurchases,
        purchaseOrders,
        selectedOrderForReception,
        setSelectedOrderForReception,
        refreshPurchaseOrders,
        createPurchaseOrder,
        updatePurchaseOrder,
        deletePurchaseOrder,
        receiveOrderInStock,
        sales,
        lastCompletedSale,
        setLastCompletedSale,
        isOpenShiftModalOpen,
        setIsOpenShiftModalOpen,
        isAltaAlVueloOpen,
        setIsAltaAlVueloOpen,
        unknownBarcode,
        setUnknownBarcode,
        handleSaveAltaAlVuelo,
        isNewProductModalOpen,
        setIsNewProductModalOpen,
        newProductPrefillBarcode,
        openNewProductModal,
        inventoryScanEvent,
        clearInventoryScanEvent,
        isReceiptModalOpen,
        setIsReceiptModalOpen,
        isReportZModalOpen,
        setIsReportZModalOpen,
        isCashMovementModalOpen,
        setIsCashMovementModalOpen,
        isGlobalSearchOpen,
        setIsGlobalSearchOpen,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        currentUser,
        loginUser,
        logoutUser,
        changeMyPassword,
        workers,
        activeWorkerName,
        refreshWorkers,
        createWorker,
        assignWorkerPassword,
        deleteWorker,
        setActiveWorker,
        refreshSales,
        toastMessage,
        showToast
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
