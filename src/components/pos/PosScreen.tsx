import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  Building2,
  CheckCircle2,
  Printer,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  Lock,
  Unlock,
  AlertTriangle,
  PackageX,
  Truck,
  Scale,
  ArrowDown,
  Camera
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { BulkSaleModal, formatUnitShort } from './BulkSaleModal';
import {
  SupplierSearchModal,
  buildSupplierGroups,
  ALL_SUPPLIERS_KEY
} from './SupplierSearchModal';
import { BarcodeCameraModal } from '../modals/BarcodeCameraModal';
import { canAutoFocusInput } from '../../utils/responsive';

export const PosScreen: React.FC = () => {
  const {
    products,
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
    setIsGlobalSearchOpen,
    closeShiftAndGenerateReport,
    cashShift,
    setIsOpenShiftModalOpen,
    setActiveScreen,
    showToast
  } = useStore();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [initialSupplierFilter, setInitialSupplierFilter] = useState<string | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const [searchHighlightIdx, setSearchHighlightIdx] = useState(-1);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const paymentSectionRef = useRef<HTMLDivElement>(null);

  const supplierGroups = useMemo(() => buildSupplierGroups(products), [products]);

  const parsedSearchInput = useMemo(() => {
    const raw = barcodeInput.trim();
    const multMatch = raw.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/);
    if (multMatch) {
      const qty = parseFloat(multMatch[1].replace(',', '.'));
      return {
        qty: Number.isFinite(qty) && qty > 0 ? Number(qty.toFixed(3)) : 1,
        query: multMatch[2].trim().toLowerCase()
      };
    }
    return { qty: 1, query: raw.toLowerCase() };
  }, [barcodeInput]);

  const instantSuggestions = useMemo(() => {
    const q = parsedSearchInput.query;
    if (q.length < 2) return [];
    const exactMatch = products.some(
      p => (p.barcode && p.barcode.toLowerCase() === q) || p.code.toLowerCase() === q
    );
    if (exactMatch) return [];
    return products
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.distributor && p.distributor.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, parsedSearchInput.query]);

  const openSupplierModal = (supplierKey?: string | null) => {
    setInitialSupplierFilter(supplierKey || ALL_SUPPLIERS_KEY);
    setIsSupplierModalOpen(true);
  };

  // Calculations
  const totalArticles = cart.length;
  const totalUnits = Number(cart.reduce((sum, item) => sum + item.quantity, 0).toFixed(3));
  const subtotal = Number(cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const totalCatalogStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  
  const cashReceivedNumber = parseFloat(cashReceived) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, Number((cashReceivedNumber - subtotal).toFixed(2))) : 0;

  // Auto-focus barcode input only on desktop pointers (avoid popping virtual keyboard on tablet/phone)
  useEffect(() => {
    if (canAutoFocusInput()) {
      barcodeInputRef.current?.focus();
    }
  }, []);

  // Keyboard shortcut handler (F1-F5, F12)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a modal or text input (except barcode)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';

      if (e.key === 'F1') {
        e.preventDefault();
        if (products[0]) addProductToCart(products[0], 1);
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (products[1]) addProductToCart(products[1], 1);
      } else if (e.key === 'F3') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (products[3]) addProductToCart(products[3], 1);
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (cart.length > 0) {
          confirmCheckout();
        } else {
          showToast('El carrito está vacío');
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        setIsBulkModalOpen(prev => !prev);
      } else if (e.key === 'F7') {
        e.preventDefault();
        setInitialSupplierFilter(ALL_SUPPLIERS_KEY);
        setIsSupplierModalOpen(prev => !prev);
      } else if (e.key === 'F12') {
        e.preventDefault();
        closeShiftAndGenerateReport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, confirmCheckout, addProductToCart, closeShiftAndGenerateReport, showToast]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    addToCartByBarcodeOrCode(barcodeInput.trim());
    setBarcodeInput('');
  };

  const handleCameraDetected = (scannedCode: string) => {
    const trimmed = scannedCode.trim();
    if (!trimmed) return;
    const upper = trimmed.toUpperCase();
    const matched = products.find(
      (p) => (p.barcode && p.barcode.toUpperCase() === upper) || p.code.toUpperCase() === upper
    );
    if (!matched) {
      setLastScannedFeedback(null);
      setIsCameraScannerOpen(false);
      addToCartByBarcodeOrCode(trimmed);
      return;
    }
    addToCartByBarcodeOrCode(trimmed);
    setLastScannedFeedback(`${matched.name} — $${matched.salePrice.toFixed(2)}`);
  };

  const handleQuickPay = (amount: number | 'exact') => {
    if (amount === 'exact') {
      setCashReceived(subtotal.toFixed(2));
    } else {
      setCashReceived(amount.toFixed(2));
    }
  };

  return (
    <div className="pos-workspace flex-1 flex flex-col lg:flex-row overflow-hidden bg-[var(--ui-surface-muted)] select-none h-full">
      {/* Left Section: Cart (approx 65%) */}
      <div className="pos-cart-section flex-1 lg:flex-[6.5] flex flex-col p-4 md:p-6 border-r border-[var(--ui-border)] overflow-hidden min-w-0">
        <div className="pos-heading">
          <p className="workspace-eyebrow mb-1">Operación de caja</p>
          <h1 className="workspace-heading">Punto de venta</h1>
        </div>

        {/* Banner 1: Cash Shift Closed Notice */}
        {!cashShift.isOpen && (
          <div className="mb-3.5 p-3.5 bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] rounded-xl flex items-center justify-between gap-3 text-xs md:text-sm shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 text-[var(--ui-danger-text)] font-semibold">
              <Lock className="w-5 h-5 shrink-0 text-[var(--ui-danger-text)]" />
              <div>
                <span className="font-bold">Caja Cerrada:</span> Procede a la apertura de caja para registrar las ventas y fondo del día.
              </div>
            </div>
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="px-3.5 py-1.5 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold rounded-lg text-xs shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Unlock className="w-3.5 h-3.5 text-[var(--ui-mint)]" />
              <span>Proceder a Apertura</span>
            </button>
          </div>
        )}

        {/* Banner 2: Zero Stock Catalog Notice */}
        {totalCatalogStock === 0 && (
          <div className="mb-3.5 p-3.5 bg-[var(--ui-warning-bg)] border border-[var(--ui-warning-border)] rounded-xl flex items-center justify-between gap-3 text-xs md:text-sm shadow-xs">
            <div className="flex items-center gap-2.5 text-[var(--ui-warning-text)]">
              <PackageX className="w-5 h-5 shrink-0 text-[var(--ui-warning-text)]" />
              <div>
                <span className="font-bold">Catálogo con 0 unidades:</span> Todos los productos están agotados temporalmente. Realiza una recepción para ingresar stock al Kardex.
              </div>
            </div>
            <button
              onClick={() => setActiveScreen('reception')}
              className="px-3.5 py-1.5 bg-[var(--ui-warning-solid)] hover:bg-[var(--ui-warning-solid)] text-white font-bold rounded-lg text-xs shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Truck className="w-3.5 h-3.5 text-[var(--ui-warning-text)]" />
              <span>Ir a Recepción</span>
            </button>
          </div>
        )}

        {/* Barcode / Product / Supplier Search Input + Quick Triggers */}
        <div className="mb-2.5 flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleBarcodeSubmit} className="relative group flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--ui-muted)]">
              <Barcode className="w-5 h-5" />
            </div>
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => {
                setBarcodeInput(e.target.value);
                setSearchHighlightIdx(-1);
              }}
              onKeyDown={(e) => {
                if (instantSuggestions.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSearchHighlightIdx(prev => (prev + 1) % instantSuggestions.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSearchHighlightIdx(prev => (prev <= 0 ? -1 : prev - 1));
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setBarcodeInput('');
                  setSearchHighlightIdx(-1);
                } else if (e.key === 'Enter' && searchHighlightIdx >= 0 && instantSuggestions[searchHighlightIdx]) {
                  e.preventDefault();
                  const chosen = instantSuggestions[searchHighlightIdx];
                  addProductToCart(chosen, parsedSearchInput.qty);
                  showToast(`"${chosen.name}" agregado al carrito`);
                  setBarcodeInput('');
                  setSearchHighlightIdx(-1);
                }
              }}
              placeholder="Buscar por nombre, proveedor o código (ej. dipor, 0.5*código)..."
              aria-label="Buscar por nombre, proveedor, código de barras y cantidad"
              className="pos-scanner w-full pl-11 pr-36 lg:pr-44 py-3.5 bg-[var(--ui-surface)] border-2 border-[var(--ui-border)] focus:border-[var(--ui-brand)] focus:ring-2 focus:ring-[var(--ui-brand)]/20 rounded-lg font-mono text-sm text-[var(--ui-text)] shadow-sm transition-all outline-none placeholder:font-sans placeholder:text-[var(--ui-subtle)]"
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLastScannedFeedback(null);
                  setIsCameraScannerOpen(true);
                }}
                aria-label="Escanear código de barras con cámara"
                title="Escanear código de barras con cámara (Celular / Tablet)"
                className="px-2.5 py-1.5 min-h-[34px] bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Cámara</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGlobalSearchOpen(true)}
                className="p-1.5 hover:bg-[var(--ui-surface-hover)] rounded text-[var(--ui-muted)] transition-colors cursor-pointer"
                title="Buscar en catálogo (⌘K)"
              >
                <Search className="w-4 h-4" />
              </button>
              <span className="hidden lg:inline font-mono text-xs bg-[var(--ui-chrome-raised)] text-white px-2 py-1 rounded font-bold">
                [F3]
              </span>
            </div>

            {instantSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-[var(--ui-surface)] border border-[var(--ui-border-strong)] rounded-xl shadow-xl overflow-hidden divide-y divide-[var(--ui-border)] max-h-72 overflow-y-auto">
                {instantSuggestions.map((prod, sIdx) => {
                  const isHighlighted = searchHighlightIdx === sIdx;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        addProductToCart(prod, parsedSearchInput.qty);
                        showToast(`"${prod.name}" agregado al carrito`);
                        setBarcodeInput('');
                        setSearchHighlightIdx(-1);
                        barcodeInputRef.current?.focus();
                      }}
                      className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-[var(--ui-surface-hover)]' : 'hover:bg-[var(--ui-surface-muted)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs sm:text-sm text-[var(--ui-text)] truncate">
                          {prod.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--ui-muted)] flex-wrap">
                          <span className="font-mono">{prod.code}</span>
                          {prod.distributor && (
                            <>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] font-semibold">
                                {prod.distributor}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span>Stock: {prod.stock}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-[var(--ui-brand-strong)]">
                          ${prod.salePrice.toFixed(2)}
                        </span>
                        {parsedSearchInput.qty !== 1 && (
                          <div className="text-[10px] font-mono text-[var(--ui-muted)]">
                            × {parsedSearchInput.qty}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </form>

          <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openSupplierModal(ALL_SUPPLIERS_KEY)}
              className="px-3 sm:px-3.5 py-3 min-h-[44px] bg-[var(--ui-chrome)] hover:bg-[var(--ui-chrome-raised)] text-white rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              title="Buscar y vender productos agrupados por proveedor (F7)"
            >
              <Truck className="w-4 h-4 text-[var(--ui-mint)] shrink-0" />
              <span className="truncate">Por Proveedor</span>
              <span className="hidden lg:inline font-mono text-[10px] bg-white/15 px-1.5 py-0.5 rounded font-bold">
                [F7]
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-3 sm:px-3.5 py-3 min-h-[44px] bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              title="Vender por peso, valor en dólares o productos sin código (F6)"
            >
              <Scale className="w-4 h-4 text-[var(--ui-mint)] shrink-0" />
              <span className="truncate">Granel / Sin Cód.</span>
              <span className="hidden lg:inline font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-bold">
                [F6]
              </span>
            </button>
          </div>
        </div>

        {/* Quick Supplier Filter Strip */}
        {supplierGroups.length > 1 && (
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ui-muted)] flex items-center gap-1 shrink-0 mr-1">
              <Truck className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
              <span>Proveedores:</span>
            </span>
            {supplierGroups.map((group) => (
              <button
                key={group.key}
                type="button"
                onClick={() => openSupplierModal(group.key)}
                className="px-2.5 py-1 rounded-full bg-[var(--ui-surface)] hover:bg-[var(--ui-brand)] hover:text-white hover:border-[var(--ui-brand)] border border-[var(--ui-border)] text-[11px] font-semibold text-[var(--ui-secondary)] transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span className="truncate max-w-[160px]">
                  {group.key === ALL_SUPPLIERS_KEY ? 'Todos' : group.label}
                </span>
                <span className="font-mono text-[10px] opacity-75">({group.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Access Bar (F1 - F4) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[0, 1, 2, 3].map((idx) => {
            const prod = products[idx];
            const hotkey = `[F${idx + 1}]`;
            if (!prod) return null;

            const isOutOfStock = prod.stock <= 0;

            return (
              <button
                key={prod.id}
                onClick={() => addProductToCart(prod, 1)}
                className={`pos-shortcut bg-[var(--ui-surface)] border py-2.5 px-3 rounded-lg relative hover:border-[var(--ui-border-strong)] active:scale-[0.98] transition-all shadow-sm flex flex-col items-center justify-center text-center group overflow-hidden cursor-pointer ${
                  isOutOfStock ? 'border-dashed border-[var(--ui-danger-border)] bg-[var(--ui-danger-bg)]/30' : 'border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)]'
                }`}
              >
                <span className="hidden lg:inline font-mono text-[10px] absolute top-1.5 right-1.5 bg-[var(--ui-chrome-raised)] text-white px-1.5 py-0.5 rounded font-bold">
                  {hotkey}
                </span>
                {isOutOfStock && (
                  <span className="font-sans text-[9px] bg-[var(--ui-danger-solid)] text-white px-1.5 py-0.2 rounded-full font-bold mb-1 sm:mb-0 sm:absolute sm:top-1.5 sm:left-1.5">
                    Agotado (0)
                  </span>
                )}
                <span className="pos-shortcut-name font-medium text-xs text-[var(--ui-text)] group-hover:text-[var(--ui-brand-strong)] transition-colors line-clamp-2 w-full">
                  {prod.name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-[var(--ui-muted)] font-semibold">
                    ${prod.salePrice.toFixed(2)}
                  </span>
                  <span className={`text-[10px] font-mono px-1 rounded ${isOutOfStock ? 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] font-bold' : 'text-[var(--ui-muted)]'}`}>
                    {prod.stock} un
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile/Tablet Quick Jump to Checkout Bar */}
        {cart.length > 0 && (
          <div className="lg:hidden mb-3 px-3.5 py-2.5 rounded-xl bg-[var(--ui-chrome)] text-white flex items-center justify-between gap-2 shadow-sm">
            <div className="text-xs">
              <span className="opacity-80">{totalArticles} {totalArticles === 1 ? 'ítem' : 'ítems'} · Total </span>
              <strong className="font-mono text-sm text-[var(--ui-mint)]">${subtotal.toFixed(2)}</strong>
            </div>
            <button
              type="button"
              onClick={() => paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="px-3 py-1.5 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Ir a Cobrar</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Cart Table Container */}
        <div className="pos-cart flex-1 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg overflow-hidden flex flex-col shadow-sm">
          {/* Mobile Cart Header */}
          <div className="sm:hidden bg-[var(--ui-surface-hover)] border-b border-[var(--ui-border)] px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider shrink-0">
            <span>Carrito ({totalArticles})</span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[var(--ui-danger-text)] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                aria-label="Vaciar carrito móvil"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {/* Tablet/Desktop Table Header */}
          <div className="pos-cart-header hidden sm:grid bg-[var(--ui-surface-hover)] border-b border-[var(--ui-border)] px-4 py-2.5 grid-cols-12 text-xs font-mono font-bold text-[var(--ui-muted)] uppercase tracking-wider shrink-0">
            <div className="col-span-1">#</div>
            <div className="col-span-2">Código</div>
            <div className="col-span-4">Descripción</div>
            <div className="col-span-2 text-center">Cant.</div>
            <div className="col-span-1 text-right">P. Unit</div>
            <div className="col-span-1 text-right">Subtotal</div>
            <div className="col-span-1 text-center">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[var(--ui-danger-text)] hover:text-[var(--ui-danger-text)] text-[10px] uppercase font-bold"
                  title="Vaciar carrito"
                  aria-label="Vaciar carrito"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table Scrollable Body */}
          <div className="pos-cart-body flex-1 overflow-y-auto divide-y divide-[var(--ui-border)]">
            {cart.length === 0 ? (
              <div className="h-full min-h-[170px] flex flex-col items-center justify-center p-6 sm:p-8 text-center text-[var(--ui-subtle)]">
                <div className="pos-empty-icon">
                  <ShoppingBag className="w-8 h-8 text-[var(--ui-subtle)]" />
                </div>
                <p className="font-semibold text-sm text-[var(--ui-muted)]">Carrito vacío</p>
                <p className="text-xs text-[var(--ui-subtle)] max-w-xs mt-1">
                  Busca por producto o proveedor arriba para comenzar a vender.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isSelected = selectedCartIndex === idx;
                const isFraction = Boolean(item.product.allowFraction);
                const qtyStep = isFraction ? 0.5 : 1;
                const unitShort = formatUnitShort(item.product.unit);

                return (
                  <React.Fragment key={`${item.product.id}-${item.unitPrice}-${item.promoLabel || 'base'}`}>
                    {/* Phone Card Layout (< 640px) */}
                    <div
                      onClick={() => setSelectedCartIndex(idx)}
                      className={`sm:hidden p-3 space-y-2.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[var(--ui-brand)]/10' : 'bg-[var(--ui-surface)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-[var(--ui-text)] leading-snug">
                            {item.product.name}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-[11px] text-[var(--ui-muted)]">
                            <span className="font-mono">{item.product.barcode || item.product.code}</span>
                            <span>·</span>
                            <span className="font-mono uppercase">{unitShort}</span>
                            {item.promoLabel && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {item.promoLabel}
                              </span>
                            )}
                            {item.product.distributor && (
                              <span className="truncate max-w-[140px]">· {item.product.distributor}</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(idx);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] shrink-0 cursor-pointer"
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(idx, Number((item.quantity - qtyStep).toFixed(3)))}
                            className="w-9 h-9 rounded-lg bg-[var(--ui-surface-hover)] text-[var(--ui-text)] border border-[var(--ui-border)] flex items-center justify-center active:scale-95 font-bold cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            step={isFraction ? '0.01' : '1'}
                            min={isFraction ? '0.01' : '1'}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value.replace(',', '.'));
                              if (Number.isFinite(val) && val > 0) {
                                updateCartQuantity(idx, val);
                              }
                            }}
                            className="w-14 h-9 text-center font-mono font-bold bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg text-sm outline-none focus:border-[var(--ui-brand)]"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(idx, Number((item.quantity + qtyStep).toFixed(3)))}
                            className="w-9 h-9 rounded-lg bg-[var(--ui-surface-hover)] text-[var(--ui-text)] border border-[var(--ui-border)] flex items-center justify-center active:scale-95 font-bold cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] font-mono text-[var(--ui-muted)]">
                            ${item.unitPrice.toFixed(2)} c/u
                          </div>
                          <div className="font-mono font-black text-base text-[var(--ui-text)]">
                            ${item.subtotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tablet & Desktop Table Row (>= 640px) */}
                    <div
                      onClick={() => setSelectedCartIndex(idx)}
                      className={`pos-cart-row hidden sm:grid grid-cols-12 items-center px-4 py-2.5 transition-colors cursor-pointer text-sm ${
                        isSelected
                          ? 'bg-[var(--ui-brand)]/10 ring-1 ring-inset ring-[var(--ui-brand)] shadow-sm'
                          : idx % 2 === 0
                          ? 'bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-muted)]'
                          : 'bg-[var(--ui-surface-muted)] hover:bg-[var(--ui-surface-hover)]'
                      }`}
                    >
                      {/* # Index */}
                      <div className="col-span-1 font-mono text-xs text-[var(--ui-muted)]">
                        {idx + 1}
                      </div>

                      {/* Code */}
                      <div className="col-span-2 font-mono text-xs text-[var(--ui-text)] truncate">
                        {item.product.barcode || item.product.code}
                      </div>

                      {/* Description */}
                      <div className="col-span-4 font-medium text-[var(--ui-text)] truncate pr-2">
                        <span>{item.product.name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-[var(--ui-muted)] uppercase">
                            {unitShort}
                          </span>
                          {item.promoLabel && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              {item.promoLabel}
                            </span>
                          )}
                          {item.product.distributor && (
                            <span className="text-[10px] text-[var(--ui-muted)] font-normal truncate">
                              · {item.product.distributor}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="col-span-2 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => updateCartQuantity(idx, Number((item.quantity - qtyStep).toFixed(3)))}
                          className="w-7 h-7 rounded bg-[var(--ui-surface-hover)] text-[var(--ui-text)] flex items-center justify-center active:scale-90 transition-all font-bold cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          step={isFraction ? '0.01' : '1'}
                          min={isFraction ? '0.01' : '1'}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(',', '.'));
                            if (Number.isFinite(val) && val > 0) {
                              updateCartQuantity(idx, val);
                            }
                          }}
                          className="w-12 text-center font-mono font-bold bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded py-0.5 text-xs outline-none focus:border-[var(--ui-brand)]"
                        />
                        <button
                          onClick={() => updateCartQuantity(idx, Number((item.quantity + qtyStep).toFixed(3)))}
                          className="w-7 h-7 rounded bg-[var(--ui-surface-hover)] text-[var(--ui-text)] flex items-center justify-center active:scale-90 transition-all font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-1 text-right font-mono text-xs text-[var(--ui-muted)]">
                        ${item.unitPrice.toFixed(2)}
                      </div>

                      {/* Subtotal */}
                      <div className="col-span-1 text-right font-mono font-bold text-xs text-[var(--ui-text)]">
                        ${item.subtotal.toFixed(2)}
                      </div>

                      {/* Delete Item */}
                      <div className="col-span-1 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(idx);
                          }}
                          className="p-1.5 text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] rounded hover:bg-[var(--ui-danger-bg)] transition-colors cursor-pointer"
                          title="Eliminar línea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Table Footer Summary */}
          <div className="pos-cart-footer bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] p-3 flex justify-between items-center text-xs font-mono text-[var(--ui-muted)] shrink-0">
            <div>
              Artículos: <strong className="text-[var(--ui-text)]">{totalArticles}</strong> | Unidades: <strong className="text-[var(--ui-text)]">{totalUnits}</strong>
            </div>
            <div className="pos-shortcuts-hint hidden lg:flex flex-wrap gap-3 text-xs">
              <span>[F1-F4] Rápido</span>
              <span>[F3] Buscar</span>
              <span>[F6] Granel</span>
              <span>[F7] Proveedor</span>
              <span>[F5] Cobrar</span>
              <span>[F12] Corte Z</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section: Total & Payment (approx 35%) */}
      <div
        id="pos-payment-panel"
        ref={paymentSectionRef}
        className="pos-payment flex-1 lg:flex-[3.5] bg-[var(--ui-surface)] p-4 md:p-6 flex flex-col justify-between lg:overflow-y-auto min-w-0"
      >
        <div>
          {/* Big Total Display Banner */}
          <div className="pos-total bg-[var(--ui-chrome)] rounded-xl p-5 md:p-6 text-white mb-5 shadow-md flex flex-col items-end justify-center border border-[var(--ui-border-strong)]">
            <span className="pos-total-caption text-xs uppercase tracking-widest text-[var(--ui-mint)] font-bold font-mono">
              TOTAL A COBRAR
            </span>
            <div className="pos-total-amount font-mono text-4xl md:text-5xl font-black text-white mt-2 tracking-tight flex items-baseline gap-1.5">
              <span className="text-2xl text-[var(--ui-mint)]">$</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <span className="text-[11px] text-[var(--ui-chrome-muted)] mt-2">
              {totalUnits} unidades en {totalArticles} ítems
            </span>
          </div>

          {/* Payment Method Selector */}
          <div className="mb-5">
            <label className="pos-payment-label block text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider mb-2 font-mono">
              Forma de Pago
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`pos-pay-method py-3 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs md:text-sm transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)] shadow-sm'
                    : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)]'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`pos-pay-method py-3 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs md:text-sm transition-all ${
                  paymentMethod === 'transfer'
                    ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)] shadow-sm'
                    : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)]'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Transferencia</span>
              </button>
            </div>
          </div>

          {/* Cash Received Input & Fast Keys */}
          {paymentMethod === 'cash' ? (
            <div className="mb-5">
              <label className="pos-payment-label block text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider mb-2 font-mono">
                Efectivo Recibido ($)
              </label>
              <div className="relative mb-2.5">
                <span className="absolute left-3.5 top-3 font-mono text-base font-bold text-[var(--ui-muted)]">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={subtotal > 0 ? subtotal.toFixed(2) : '0.00'}
                  className="pos-cash-input w-full pl-9 pr-4 py-3 bg-[var(--ui-surface-muted)] border-2 border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl font-mono text-xl font-bold text-[var(--ui-text)] outline-none transition-all"
                />
              </div>

              {/* Fast Cash Buttons ($5, $10, $20, $50, Exacto) */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickPay(5)}
                  className="py-2.5 min-h-[42px] bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] rounded-lg font-mono text-xs md:text-sm font-bold text-[var(--ui-text)] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  $5
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPay(10)}
                  className="py-2.5 min-h-[42px] bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] rounded-lg font-mono text-xs md:text-sm font-bold text-[var(--ui-text)] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  $10
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPay(20)}
                  className="py-2.5 min-h-[42px] bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] rounded-lg font-mono text-xs md:text-sm font-bold text-[var(--ui-text)] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  $20
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPay(50)}
                  className="py-2.5 min-h-[42px] bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] rounded-lg font-mono text-xs md:text-sm font-bold text-[var(--ui-text)] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  $50
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPay('exact')}
                  className="col-span-2 py-2.5 min-h-[42px] bg-[var(--ui-surface-hover)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] rounded-lg font-sans text-xs md:text-sm font-bold text-[var(--ui-text)] shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Exacto
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-[var(--ui-info-bg)] border border-[var(--ui-info-border)] rounded-lg text-xs text-[var(--ui-info-text)] flex-1">
              <p className="font-bold text-sm mb-1">Pago por Transferencia / DeUna / Banco</p>
              <p>
                Verifique el comprobante de transferencia bancaria por <strong>${subtotal.toFixed(2)}</strong> antes de confirmar la venta.
              </p>
            </div>
          )}

          {/* Change / Vuelto Box */}
          {paymentMethod === 'cash' && (
            <div className="pos-change bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] p-3.5 rounded-lg mb-4 flex justify-between items-center shadow-xs">
              <span className="font-bold text-sm md:text-base text-[var(--ui-brand-strong)]">
                Cambio / Vuelto
              </span>
              <span className="metric-value font-mono text-xl md:text-2xl font-black text-[var(--ui-brand-strong)]">
                $ {change.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Checkout Button */}
        <button
          type="button"
          onClick={() => {
            if (cart.length === 0) {
              showToast('Agregue productos al carrito antes de cobrar');
              return;
            }
            confirmCheckout();
          }}
          disabled={cart.length === 0 || isCheckingOut || !cashShift.isOpen || (paymentMethod === 'cash' && cashReceivedNumber < subtotal)}
          className={`pos-checkout w-full py-4 px-4 rounded-xl font-bold text-base md:text-lg shadow-md transition-all active:scale-[0.98] flex flex-col items-center justify-center relative overflow-hidden ${
            cart.length > 0 && !isCheckingOut && cashShift.isOpen && (paymentMethod !== 'cash' || cashReceivedNumber >= subtotal)
              ? 'bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white cursor-pointer'
              : 'bg-[var(--ui-border-strong)] text-white/70 cursor-not-allowed'
          }`}
        >
          <span className="hidden lg:inline font-mono text-xs absolute top-2 right-2 bg-black/40 text-white px-2 py-0.5 rounded font-bold">
            [F5]
          </span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{isCheckingOut ? 'PROCESANDO COBRO…' : 'CONFIRMAR COBRO'}</span>
          </div>
          <span className="text-xs font-normal opacity-85 mt-0.5 tracking-wider">
            E IMPRIMIR TICKET
          </span>
        </button>

      </div>

      <BulkSaleModal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          if (canAutoFocusInput()) barcodeInputRef.current?.focus();
        }}
      />

      <SupplierSearchModal
        isOpen={isSupplierModalOpen}
        initialSupplier={initialSupplierFilter}
        onClose={() => {
          setIsSupplierModalOpen(false);
          if (canAutoFocusInput()) barcodeInputRef.current?.focus();
        }}
      />

      <BarcodeCameraModal
        isOpen={isCameraScannerOpen}
        onClose={() => {
          setIsCameraScannerOpen(false);
          setLastScannedFeedback(null);
          if (canAutoFocusInput()) barcodeInputRef.current?.focus();
        }}
        onDetected={handleCameraDetected}
        title="Escanear para Vender (POS)"
        subtitle="Apunta la cámara trasera al código de barras para agregarlo al carrito"
        allowContinuous={true}
        defaultContinuous={true}
        lastFeedback={lastScannedFeedback}
      />
    </div>
  );
};
