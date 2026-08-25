import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product,
  CartItem,
  Sale,
  KardexMovement,
  CashShift,
  CashMovement,
  ScreenType,
  PaymentMethod,
  ReceptionInvoice,
  ReceptionDraftItem
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_KARDEX,
  INITIAL_SALES,
  INITIAL_SHIFT
} from '../data/initialData';
import { sounds } from '../utils/audio';

interface StoreContextType {
  // Navigation
  activeScreen: ScreenType;
  setActiveScreen: (screen: ScreenType) => void;

  // Products & Inventory
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, delta: number, type: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DAÑO', reason?: string) => void;

  // POS Cart
  cart: CartItem[];
  addToCartByBarcodeOrCode: (code: string) => { success: boolean; code?: string };
  addProductToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  selectedCartIndex: number;
  setSelectedCartIndex: (idx: number) => void;

  // POS Payment
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  cashReceived: string;
  setCashReceived: (val: string) => void;
  confirmCheckout: () => Sale | null;

  // Kardex
  kardexMovements: KardexMovement[];
  selectedKardexProductId: string | null;
  setSelectedKardexProductId: (id: string | null) => void;
  getProductKardex: (productId: string) => KardexMovement[];

  // Cash Register / Shift
  cashShift: CashShift;
  setCashierName: (name: string) => void;
  setCountedCash: (amount: number) => void;
  addCashMovement: (type: 'RETIRO' | 'INGRESO', description: string, amount: number) => void;
  closeShiftAndGenerateReport: () => void;
  openShift: (initialCash: number, cashierName: string) => void;

  // Reception / Compras
  receivePurchases: (invoice: Omit<ReceptionInvoice, 'id'>) => void;

  // Sales History
  sales: Sale[];
  lastCompletedSale: Sale | null;
  setLastCompletedSale: (sale: Sale | null) => void;

  // Modals & UI Controls
  isAltaAlVueloOpen: boolean;
  setIsAltaAlVueloOpen: (open: boolean) => void;
  unknownBarcode: string;
  setUnknownBarcode: (code: string) => void;
  handleSaveAltaAlVuelo: (data: { name: string; category: any; costPrice: number; salePrice: number; initialStock?: number }) => void;

  isNewProductModalOpen: boolean;
  setIsNewProductModalOpen: (open: boolean) => void;

  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;

  isReportZModalOpen: boolean;
  setIsReportZModalOpen: (open: boolean) => void;

  isCashMovementModalOpen: boolean;
  setIsCashMovementModalOpen: (open: boolean) => void;

  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;

  // Quick action toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'mi_tienda_familiar_v1_';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [activeScreen, setActiveScreen] = useState<ScreenType>('pos');

  // Products
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}products`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_PRODUCTS;
  });

  // Initial cart with items matching the mockup (Row 1: Pan Bimbo 1x $2.50, Row 2: Leche Vita 2x $0.95, Row 3: Pan de Agua 3x $0.15)
  const [cart, setCart] = useState<CartItem[]>(() => {
    const p1 = INITIAL_PRODUCTS.find(p => p.code === '78610001') || INITIAL_PRODUCTS[0];
    const p2 = INITIAL_PRODUCTS.find(p => p.code === '78610223') || INITIAL_PRODUCTS[1];
    const p3 = INITIAL_PRODUCTS.find(p => p.code === '00000004') || INITIAL_PRODUCTS[2];
    return [
      { product: p1, quantity: 1, unitPrice: p1.salePrice, subtotal: p1.salePrice * 1 },
      { product: p2, quantity: 2, unitPrice: p2.salePrice, subtotal: p2.salePrice * 2 },
      { product: p3, quantity: 3, unitPrice: p3.salePrice, subtotal: p3.salePrice * 3 }
    ];
  });

  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(1); // Row 2 selected as in Image 1
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('5.00');

  // Kardex
  const [kardexMovements, setKardexMovements] = useState<KardexMovement[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}kardex`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_KARDEX;
  });
  const [selectedKardexProductId, setSelectedKardexProductId] = useState<string | null>('prod-8');

  // Sales
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}sales`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_SALES;
  });
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Shift & Cash Box
  const [cashShift, setCashShift] = useState<CashShift>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}shift`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.cashierName === 'Carlos M.' || parsed.cashierName === 'Carlos') {
          parsed.cashierName = 'Wismar';
        }
        return parsed;
      } catch (e) { console.error(e); }
    }
    return INITIAL_SHIFT;
  });

  // Modals
  const [isAltaAlVueloOpen, setIsAltaAlVueloOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isReportZModalOpen, setIsReportZModalOpen] = useState(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persist key state
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}products`, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}kardex`, JSON.stringify(kardexMovements));
  }, [kardexMovements]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}sales`, JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}shift`, JSON.stringify(cashShift));
  }, [cashShift]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Cart operations
  const addProductToCart = (product: Product, quantity = 1) => {
    sounds.playScanBeep();
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          subtotal: Number((newQty * updated[existingIdx].unitPrice).toFixed(2))
        };
        setSelectedCartIndex(existingIdx);
        return updated;
      } else {
        const newItem: CartItem = {
          product,
          quantity,
          unitPrice: product.salePrice,
          subtotal: Number((quantity * product.salePrice).toFixed(2))
        };
        const nextCart = [...prev, newItem];
        setSelectedCartIndex(nextCart.length - 1);
        return nextCart;
      }
    });
  };

  const addToCartByBarcodeOrCode = (code: string): { success: boolean; code?: string } => {
    const trimmed = code.trim();
    if (!trimmed) return { success: false };

    const product = products.find(p => p.code === trimmed || p.barcode === trimmed);
    if (product) {
      addProductToCart(product, 1);
      return { success: true };
    } else {
      sounds.playWarning();
      setUnknownBarcode(trimmed);
      setIsAltaAlVueloOpen(true);
      return { success: false, code: trimmed };
    }
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    sounds.playClick();
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          return {
            ...item,
            quantity,
            subtotal: Number((quantity * item.unitPrice).toFixed(2))
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    sounds.playClick();
    setCart(prev => {
      const next = prev.filter(item => item.product.id !== productId);
      if (selectedCartIndex >= next.length) {
        setSelectedCartIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCartIndex(0);
    setCashReceived('0.00');
  };

  // Alta al Vuelo (Quick Registration on unknown scan)
  const handleSaveAltaAlVuelo = (data: {
    name: string;
    category: any;
    costPrice: number;
    salePrice: number;
    initialStock?: number;
  }) => {
    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      code: unknownBarcode || `AUT-${Math.floor(100000 + Math.random() * 900000)}`,
      barcode: unknownBarcode || undefined,
      name: data.name,
      category: data.category || 'Abarrotes',
      costPrice: Number(data.costPrice) || 0,
      salePrice: Number(data.salePrice) || 0,
      stock: Number(data.initialStock) || 10,
      minStock: 5,
      lastUpdated: new Date().toISOString()
    };

    setProducts(prev => [newProduct, ...prev]);

    // Record in Kardex
    const now = new Date();
    const newKardex: KardexMovement = {
      id: `k-${Date.now()}`,
      productId: newProduct.id,
      date: 'Hoy',
      time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      type: 'INICIAL',
      docNumber: 'ALTA-VUELO',
      responsible: cashShift.cashierName,
      quantityChange: newProduct.stock,
      balance: newProduct.stock,
      costUnit: newProduct.costPrice,
      notes: 'Alta al vuelo desde caja'
    };
    setKardexMovements(prev => [newKardex, ...prev]);

    // Automatically add to cart!
    addProductToCart(newProduct, 1);
    setIsAltaAlVueloOpen(false);
    setUnknownBarcode('');
    showToast(`Producto "${newProduct.name}" registrado y añadido al carrito`);
  };

  // Add Product (General)
  const addProduct = (prodData: Omit<Product, 'id'>): Product => {
    const newProduct: Product = {
      ...prodData,
      id: `prod-${Date.now()}`
    };
    setProducts(prev => [newProduct, ...prev]);

    // Initial kardex entry
    if (newProduct.stock > 0) {
      const now = new Date();
      const kMov: KardexMovement = {
        id: `k-${Date.now()}`,
        productId: newProduct.id,
        date: 'Hoy',
        time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        type: 'INICIAL',
        docNumber: 'INV-NEW',
        responsible: cashShift.cashierName,
        quantityChange: newProduct.stock,
        balance: newProduct.stock,
        costUnit: newProduct.costPrice,
        notes: 'Registro inicial de producto'
      };
      setKardexMovements(prev => [kMov, ...prev]);
    }

    showToast(`Producto "${newProduct.name}" creado`);
    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          return { ...p, ...updates, lastUpdated: new Date().toISOString() };
        }
        return p;
      })
    );
    showToast('Producto actualizado');
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast('Producto eliminado');
  };

  // Manual stock adjustment with Kardex recording
  const adjustStock = (
    productId: string,
    delta: number,
    type: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DAÑO',
    reason?: string
  ) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;

    const newStock = Math.max(0, target.stock + delta);
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, stock: newStock } : p))
    );

    const now = new Date();
    const movement: KardexMovement = {
      id: `k-${Date.now()}`,
      productId,
      date: 'Hoy',
      time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      type,
      docNumber: type === 'DAÑO' ? `MER-${Math.floor(100 + Math.random() * 900)}` : `AJ-${Math.floor(100 + Math.random() * 900)}`,
      responsible: cashShift.cashierName,
      quantityChange: delta,
      balance: newStock,
      costUnit: target.costPrice,
      notes: reason || (type === 'DAÑO' ? 'Merma / daño en bodega' : 'Ajuste manual de inventario')
    };

    setKardexMovements(prev => [movement, ...prev]);
    showToast(`Stock ajustado: ${delta > 0 ? '+' : ''}${delta} (${newStock} un)`);
  };

  // Confirm POS Sale
  const confirmCheckout = (): Sale | null => {
    if (cart.length === 0) return null;

    const totalArticles = cart.length;
    const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Number(cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const receivedNum = Number(cashReceived) || subtotal;
    const change = paymentMethod === 'cash' ? Math.max(0, Number((receivedNum - subtotal).toFixed(2))) : 0;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ticketNumber = `TK-${4093 + sales.length}`;

    const saleItems = cart.map(item => ({
      productId: item.product.id,
      code: item.product.code,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.product.costPrice,
      subtotal: item.subtotal
    }));

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      ticketNumber,
      date: dateStr,
      time: timeStr,
      items: saleItems,
      subtotal,
      totalArticles,
      totalUnits,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? receivedNum : undefined,
      change: paymentMethod === 'cash' ? change : undefined,
      cashierName: cashShift.cashierName
    };

    // 1. Deduct Stock & Record Kardex for each item
    const kardexAdditions: KardexMovement[] = [];
    const updatedProducts = products.map(prod => {
      const cartMatch = cart.find(c => c.product.id === prod.id);
      if (cartMatch) {
        const newStock = Math.max(0, prod.stock - cartMatch.quantity);
        kardexAdditions.push({
          id: `k-${Date.now()}-${prod.id}`,
          productId: prod.id,
          date: 'Hoy',
          time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          type: 'VENTA',
          docNumber: ticketNumber,
          responsible: cashShift.cashierName,
          quantityChange: -cartMatch.quantity,
          balance: newStock,
          costUnit: prod.costPrice
        });
        return { ...prod, stock: newStock };
      }
      return prod;
    });

    setProducts(updatedProducts);
    setKardexMovements(prev => [...kardexAdditions, ...prev]);

    // 2. Add to sales history
    setSales(prev => [newSale, ...prev]);
    setLastCompletedSale(newSale);

    // 3. Update Cash Register Shift
    setCashShift(prev => {
      const isCash = paymentMethod === 'cash';
      const newCashSales = isCash ? prev.cashSalesTotal + subtotal : prev.cashSalesTotal;
      const newTransferSales = !isCash ? prev.transferSalesTotal + subtotal : prev.transferSalesTotal;
      const newExpected = prev.initialCash + newCashSales - prev.withdrawalsTotal + prev.depositsTotal;
      const newMovement: CashMovement = {
        id: `mov-${Date.now()}`,
        time: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        date: 'Hoy',
        type: 'VENTA',
        description: `Venta - Ticket #${ticketNumber}`,
        amount: subtotal,
        ticketRef: ticketNumber
      };

      return {
        ...prev,
        cashSalesTotal: Number(newCashSales.toFixed(2)),
        transferSalesTotal: Number(newTransferSales.toFixed(2)),
        expectedCash: Number(newExpected.toFixed(2)),
        countedCash: Number(newExpected.toFixed(2)),
        movements: [newMovement, ...prev.movements]
      };
    });

    // Play sound and open receipt
    sounds.playCashRegister();
    setIsReceiptModalOpen(true);
    clearCart();

    return newSale;
  };

  // Kardex query helper
  const getProductKardex = (productId: string) => {
    return kardexMovements.filter(m => m.productId === productId);
  };

  // Cash shift updates
  const setCashierName = (name: string) => {
    setCashShift(prev => ({
      ...prev,
      cashierName: name
    }));
  };

  const setCountedCash = (amount: number) => {
    setCashShift(prev => ({
      ...prev,
      countedCash: amount
    }));
  };

  const addCashMovement = (type: 'RETIRO' | 'INGRESO', description: string, amount: number) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const signedAmount = type === 'RETIRO' ? -Math.abs(amount) : Math.abs(amount);

    setCashShift(prev => {
      const newWithdrawals = type === 'RETIRO' ? prev.withdrawalsTotal + Math.abs(amount) : prev.withdrawalsTotal;
      const newDeposits = type === 'INGRESO' ? prev.depositsTotal + Math.abs(amount) : prev.depositsTotal;
      const newExpected = prev.initialCash + prev.cashSalesTotal - newWithdrawals + newDeposits;

      const newMov: CashMovement = {
        id: `mov-${Date.now()}`,
        time: timeStr,
        date: 'Hoy',
        type,
        description,
        amount: signedAmount
      };

      return {
        ...prev,
        withdrawalsTotal: Number(newWithdrawals.toFixed(2)),
        depositsTotal: Number(newDeposits.toFixed(2)),
        expectedCash: Number(newExpected.toFixed(2)),
        movements: [newMov, ...prev.movements]
      };
    });

    showToast(`${type === 'RETIRO' ? 'Retiro' : 'Ingreso'} registrado: $${amount.toFixed(2)}`);
  };

  const closeShiftAndGenerateReport = () => {
    sounds.playCashRegister();
    setIsReportZModalOpen(true);
  };

  const openShift = (initialCash: number, cashierName: string) => {
    const now = new Date();
    setCashShift({
      isOpen: true,
      openedAt: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      cashierName: cashierName || 'Wismar',
      initialCash,
      cashSalesTotal: 0,
      transferSalesTotal: 0,
      withdrawalsTotal: 0,
      depositsTotal: 0,
      expectedCash: initialCash,
      countedCash: initialCash,
      movements: []
    });
    showToast('Caja abierta exitosamente');
  };

  // Reception of merchandise (Recepcion de compras)
  const receivePurchases = (invoiceData: Omit<ReceptionInvoice, 'id'>) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Update products cost, price & stock
    const kardexEntries: KardexMovement[] = [];
    
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const itemDraft = invoiceData.items.find(it => it.code === prod.code);
        if (itemDraft) {
          const updatedStock = prod.stock + itemDraft.quantityReceived;
          kardexEntries.push({
            id: `k-${Date.now()}-${prod.id}`,
            productId: prod.id,
            date: 'Hoy',
            time: timeStr,
            type: 'COMPRA',
            docNumber: invoiceData.invoiceNumber || `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
            responsible: cashShift.cashierName,
            quantityChange: itemDraft.quantityReceived,
            balance: updatedStock,
            costUnit: itemDraft.unitCost,
            notes: `Proveedor: ${invoiceData.provider}`
          });

          return {
            ...prod,
            costPrice: itemDraft.unitCost,
            salePrice: itemDraft.suggestedSalePrice || itemDraft.salePrice,
            stock: updatedStock,
            lastUpdated: now.toISOString()
          };
        }
        return prod;
      });
    });

    setKardexMovements(prev => [...kardexEntries, ...prev]);
    sounds.playCashRegister();
    showToast(`Compra procesada: ${invoiceData.totalUnits} unidades ingresadas`);
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
        adjustStock,
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
        kardexMovements,
        selectedKardexProductId,
        setSelectedKardexProductId,
        getProductKardex,
        cashShift,
        setCashierName,
        setCountedCash,
        addCashMovement,
        closeShiftAndGenerateReport,
        openShift,
        receivePurchases,
        sales,
        lastCompletedSale,
        setLastCompletedSale,
        isAltaAlVueloOpen,
        setIsAltaAlVueloOpen,
        unknownBarcode,
        setUnknownBarcode,
        handleSaveAltaAlVuelo,
        isNewProductModalOpen,
        setIsNewProductModalOpen,
        isReceiptModalOpen,
        setIsReceiptModalOpen,
        isReportZModalOpen,
        setIsReportZModalOpen,
        isCashMovementModalOpen,
        setIsCashMovementModalOpen,
        isGlobalSearchOpen,
        setIsGlobalSearchOpen,
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
