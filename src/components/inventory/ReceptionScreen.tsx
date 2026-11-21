import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Barcode,
  Search,
  Trash2,
  Save,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Building,
  Calendar,
  FileText,
  X,
  PlusCircle,
  Camera,
  Truck,
  CalendarCheck,
  Package,
  Layers,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ReceptionDraftItem, PurchaseOrder } from '../../types';
import { formatCostPrice, parseDecimalInput, roundCostPrice } from '../../utils/currency';
import { api } from '../../services/api';
import { BarcodeCameraModal } from '../modals/BarcodeCameraModal';
import {
  OrderArrivalState,
  buildReceptionItemsFromOrder,
  countOrderArrivalStates,
  cycleOrderArrivalState
} from '../../utils/orderArrival';

export const ReceptionScreen: React.FC = () => {
  const {
    products,
    receivePurchases,
    purchaseOrders,
    selectedOrderForReception,
    setSelectedOrderForReception,
    receiveOrderInStock,
    setActiveScreen,
    showToast
  } = useStore();

  const [provider, setProvider] = useState('Bebidas Arca Continental Ecuador Arcardor C.L.');
  const [providerId, setProviderId] = useState<number | undefined>();
  const savingPurchase = useRef(false);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [providerList, setProviderList] = useState<Array<{ id_proveedor: number; ruc_ci: string; razon_social: string }>>([]);

  const [isNewProviderModalOpen, setIsNewProviderModalOpen] = useState(false);
  const [providerModalTab, setProviderModalTab] = useState<'create' | 'list'>('create');
  const [newProvName, setNewProvName] = useState('');
  const [newProvRuc, setNewProvRuc] = useState('');
  const [newProvPhone, setNewProvPhone] = useState('');
  const [newProvAddress, setNewProvAddress] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Reception Draft Items
  const [items, setItems] = useState<ReceptionDraftItem[]>([]);
  // Per-item arrival status: 1 tap -> arrived (green), 2 taps -> missing (red), 3 taps -> pending
  const [arrivalStates, setArrivalStates] = useState<Record<string, OrderArrivalState>>({});
  const [showOrderScannerTools, setShowOrderScannerTools] = useState(false);

  // Pending purchase orders
  const pendingOrders = useMemo(() => {
    return purchaseOrders.filter(o => o.status === 'PENDIENTE');
  }, [purchaseOrders]);

  // Load providers
  useEffect(() => {
    api.getProveedores().then(res => {
      if (res && res.length > 0) {
        setProviderList(res);
        if (!selectedOrderForReception) {
          const initial = res.find(p => p.razon_social === provider) || res[0];
          setProvider(initial.razon_social);
          setProviderId(initial.id_proveedor);
        } else if (!providerId) {
          const matched = res.find(
            p => p.razon_social.trim().toLowerCase() === selectedOrderForReception.providerName.trim().toLowerCase()
          );
          if (matched) {
            setProviderId(matched.id_proveedor);
            setProvider(matched.razon_social);
          }
        }
      }
    }).catch(() => {});
  }, []);

  // When selectedOrderForReception is provided from StoreContext
  useEffect(() => {
    if (selectedOrderForReception) {
      loadOrderIntoDraft(selectedOrderForReception);
    }
  }, [selectedOrderForReception]);

  const loadOrderIntoDraft = (order: PurchaseOrder) => {
    setSelectedOrderForReception(order);
    setProvider(order.providerName);
    setProviderId(order.providerId);

    setItems(buildReceptionItemsFromOrder(order, products));
    setArrivalStates({});
    setShowOrderScannerTools(false);
    showToast(`📦 Pedido #${order.orderNumber} cargado. 1 toque = ✓ Verde (llegó), 2 toques = ✕ Rojo (no llegó).`);
  };

  const clearLoadedOrder = () => {
    setSelectedOrderForReception(null);
    setItems([]);
    setArrivalStates({});
    setShowOrderScannerTools(false);
  };

  const toggleItemConfirmed = (id: string) => {
    setArrivalStates(prev => ({ ...prev, [id]: cycleOrderArrivalState(prev[id]) }));
  };

  const areAllItemsConfirmed =
    items.length > 0 && items.every(it => arrivalStates[it.id] === 'arrived');

  const toggleAllItemsConfirmed = () => {
    if (areAllItemsConfirmed) {
      setArrivalStates({});
      return;
    }
    const next: Record<string, OrderArrivalState> = {};
    for (const it of items) {
      next[it.id] = 'arrived';
    }
    setArrivalStates(next);
  };

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName.trim()) return;

    try {
      const created = await api.crearProveedor({
        razon_social: newProvName.trim(),
        ruc_ci: newProvRuc.trim() || `RUC-${Date.now()}`,
        telefono: newProvPhone.trim(),
        direccion: newProvAddress.trim()
      });
      setProviderList(prev => [...prev, created]);
      setProvider(created.razon_social);
      setProviderId(created.id_proveedor);
      showToast(`Distribuidor "${created.razon_social}" registrado`);
    } catch (err) {
      showToast(`No se registró el proveedor: ${err instanceof Error ? err.message : 'Error de conexión'}`);
      return;
    }

    setIsNewProviderModalOpen(false);
    setNewProvName('');
    setNewProvRuc('');
    setNewProvPhone('');
    setNewProvAddress('');
  };

  const isChecklistActive = Boolean(selectedOrderForReception);

  // Calculations (when confirming a scheduled order or scanned invoice, count only arrived/green items)
  const confirmedItems = useMemo(
    () => (isChecklistActive ? items.filter(it => arrivalStates[it.id] === 'arrived') : items),
    [isChecklistActive, items, arrivalStates]
  );
  const { missingCount } = useMemo(
    () => countOrderArrivalStates(items.map(it => it.id), arrivalStates),
    [items, arrivalStates]
  );
  const totalUnits = confirmedItems.reduce((sum, it) => sum + (it.quantityReceived || 0), 0);
  const totalAmount = Number(
    confirmedItems.reduce((sum, it) => sum + it.quantityReceived * it.unitCost, 0).toFixed(2)
  );

  useEffect(() => {
    const hasTouch =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (!selectedOrderForReception && !hasTouch) {
      barcodeRef.current?.focus();
    }
  }, [selectedOrderForReception]);

  // Keyboard shortcut for F10 (Guardar Compra)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSavePurchase();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, confirmedItems, provider, providerId, invoiceNumber, invoiceDate, totalUnits, totalAmount, selectedOrderForReception]);

  const processScannedOrEnteredCode = (rawCode: string): string => {
    const query = rawCode.trim();
    const upperQuery = query.toUpperCase();
    const product = products.find(
      p => p.code.toUpperCase() === upperQuery || (p.barcode && p.barcode.toUpperCase() === upperQuery)
    );
    const existingInDraft = items.find(
      it => it.code.toUpperCase() === (product?.code || query).toUpperCase()
    );

    if (existingInDraft) {
      setItems(prev =>
        prev.map(it =>
          it.id === existingInDraft.id
            ? { ...it, quantityReceived: it.quantityReceived + 1 }
            : it
        )
      );
      if (selectedOrderForReception) {
        setArrivalStates(prev => ({ ...prev, [existingInDraft.id]: 'arrived' }));
      }
      showToast(`Cantidad incrementada para ${existingInDraft.name}`);
      return `${existingInDraft.name} (×${existingInDraft.quantityReceived + 1})`;
    }

    if (product) {
      const newItem: ReceptionDraftItem = {
        id: `rec-${Date.now()}`,
        code: product.code,
        name: product.name,
        quantityReceived: 1,
        unitCost: product.costPrice,
        previousCost: product.costPrice,
        salePrice: product.salePrice,
        suggestedSalePrice: product.salePrice
      };
      setItems(prev => [...prev, newItem]);
      if (selectedOrderForReception) {
        setArrivalStates(prev => ({ ...prev, [newItem.id]: 'arrived' }));
      }
      showToast(`Producto ${product.name} agregado a la recepción`);
      return `${product.name} (+1)`;
    }

    const newItem: ReceptionDraftItem = {
      id: `rec-${Date.now()}`,
      code: query,
      name: `Nuevo Producto (${query})`,
      quantityReceived: 1,
      unitCost: 1.00,
      previousCost: 1.00,
      salePrice: 1.30,
      suggestedSalePrice: 1.30,
      isNewProduct: true
    };
    setItems(prev => [...prev, newItem]);
    if (selectedOrderForReception) {
      setArrivalStates(prev => ({ ...prev, [newItem.id]: 'arrived' }));
    }
    showToast(`Nuevo ítem ${query} agregado`);
    return `Nuevo ítem (${query})`;
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processScannedOrEnteredCode(barcodeInput);
    setBarcodeInput('');
  };

  const handleUpdateItem = (id: string, updates: Partial<ReceptionDraftItem>) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          const updated = { ...it, ...updates };
          if (updates.unitCost !== undefined && updates.unitCost > it.previousCost) {
            updated.suggestedSalePrice = Number((updates.unitCost * 1.28).toFixed(2));
          }
          return updated;
        }
        return it;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
    setArrivalStates(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSavePurchase = async () => {
    if (savingPurchase.current) return;
    if (items.length === 0) {
      showToast('⚠️ Debe agregar al menos un producto a la recepción.');
      return;
    }

    const itemsToReceive = isChecklistActive ? confirmedItems : items;
    if (itemsToReceive.length === 0) {
      showToast('⚠️ Marca con ✓ al menos un producto que haya llegado antes de confirmar.');
      return;
    }

    if (!providerId) {
      showToast('Selecciona o registra el proveedor antes de guardar la compra.');
      return;
    }
    const docNum = invoiceNumber.trim() || `FAC-${Date.now().toString().slice(-6)}`;
    savingPurchase.current = true;
    setIsSavingPurchase(true);

    try {
      if (selectedOrderForReception) {
        // Reconcile and receive checked order items into stock
        await receiveOrderInStock(
          selectedOrderForReception.id,
          docNum,
          itemsToReceive,
          provider,
          providerId
        );
      } else {
        // Regular direct reception
        await receivePurchases({
          provider,
          providerId,
          invoiceNumber: docNum,
          date: invoiceDate,
          items: itemsToReceive,
          totalUnits,
          totalAmount
        });
      }

      setActiveScreen('inventory');
    } catch {
      // Keep the draft so failed purchases can be corrected and retried.
    } finally {
      savingPurchase.current = false;
      setIsSavingPurchase(false);
    }
  };

  const getSupplierBadgeStyle = (distributor?: string) => {
    if (!distributor) return 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] border-[var(--ui-border)]';
    if (distributor.includes('Arca')) return 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border-[var(--ui-danger-border)]';
    if (distributor.includes('Azende')) return 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border-[var(--ui-brand-soft-border)]';
    if (distributor.includes('Tesalia') || distributor.includes('CBC')) return 'bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border-[var(--ui-info-border)]';
    if (distributor.includes('Favorita') || distributor.includes('Titán')) return 'bg-[var(--ui-purple-bg)] text-[var(--ui-purple-text)] border-[var(--ui-purple-border)]';
    if (distributor.includes('Alvarez')) return 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border-[var(--ui-warning-border)]';
    if (distributor.includes('DINADEC')) return 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border-[var(--ui-brand-soft-border)]';
    return 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)]';
  };

  return (
    <div className="workspace-screen flex-1 flex flex-col h-full overflow-y-auto lg:overflow-hidden bg-[var(--ui-surface-muted)] p-3 md:p-6 gap-2.5 md:gap-3.5 select-none">
      {/* Pending Orders Packaging Section (if any pending) */}
      {pendingOrders.length > 0 && !selectedOrderForReception && (
        <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl p-3.5 shrink-0 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ui-brand-strong)]">
              <CalendarCheck className="w-4 h-4" />
              <span>Pedidos pendientes de entrega ({pendingOrders.length})</span>
              <span className="text-xs font-normal text-[var(--ui-muted)]">
                (Haz clic en un pedido para desempaquetar y recibir sus productos)
              </span>
            </div>
            <button
              onClick={() => setActiveScreen('orders')}
              className="text-[11px] text-[var(--ui-brand-strong)] hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Ver Agenda de Pedidos</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {pendingOrders.map(order => (
              <button
                key={order.id}
                onClick={() => loadOrderIntoDraft(order)}
                className="surface-card bg-[var(--ui-surface)] hover:bg-[var(--ui-brand-soft)] border border-[var(--ui-border)] hover:border-[var(--ui-brand)] rounded-xl p-2.5 text-left transition-all shrink-0 min-w-[220px] shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono text-xs font-bold text-[var(--ui-text)]">
                    {order.orderNumber}
                  </span>
                  <span className="font-mono text-xs font-bold text-[var(--ui-brand-strong)]">
                    ${order.totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border truncate mb-1 ${getSupplierBadgeStyle(order.providerName)}`}>
                  {order.providerName}
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--ui-muted)]">
                  <span>{order.items.length} productos ({order.totalUnits} un)</span>
                  <span className="text-[var(--ui-brand-strong)] font-bold group-hover:underline flex items-center gap-0.5">
                    Recibir <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Order Loaded Banner */}
      {selectedOrderForReception && (
        <div className="bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] text-[var(--ui-brand-strong)] p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            <Package className="w-5 h-5 text-[var(--ui-brand-strong)] shrink-0" />
            <div>
              <span className="font-bold">Recibiendo Pedido #{selectedOrderForReception.orderNumber}</span>
              <span className="mx-1.5">•</span>
              <span>Distribuidor: <strong>{selectedOrderForReception.providerName}</strong></span>
              <span className="mx-1.5">•</span>
              <span className="text-[11px] text-[var(--ui-brand-strong)]">
                Marca con ✓ los productos que sí llegaron (sin necesidad de escanear) para pasarlos al inventario.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOrderScannerTools(prev => !prev)}
              className="text-xs font-semibold text-[var(--ui-brand-strong)] hover:bg-[var(--ui-surface)]/70 border border-[var(--ui-brand-soft-border)] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>{showOrderScannerTools ? 'Ocultar escáner' : 'Escanear / añadir extra'}</span>
            </button>
            <button
              type="button"
              onClick={clearLoadedOrder}
              className="text-xs font-bold text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Descartar y volver a recepción libre"
            >
              <X className="w-3.5 h-3.5" />
              <span>Descartar Paquete</span>
            </button>
          </div>
        </div>
      )}

      {/* Context Header & Metadata */}
      <div className="surface-card flex flex-col lg:flex-row items-start lg:items-center justify-between shrink-0 bg-[var(--ui-surface)] p-3 md:p-4 border border-[var(--ui-border)] rounded-xl gap-3 md:gap-4 shadow-xs">
        <div>
          <p className="workspace-eyebrow ml-8 mb-0.5 md:mb-1">Compras e inventario</p>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={() => setActiveScreen('inventory')}
              className="text-[var(--ui-muted)] hover:text-[var(--ui-brand-strong)] transition-colors p-1 rounded hover:bg-[var(--ui-surface-hover)]"
              title="Volver a Inventario"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="workspace-heading font-bold text-base md:text-xl text-[var(--ui-text)]">
              Recepción de Mercancía
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[var(--ui-muted)] ml-8">
            Registro de ingreso físico de compras e inventario al Kardex.
          </p>
        </div>

        {/* Metadata Inputs (Provider, Invoice, Date) */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2.5 sm:gap-3 w-full lg:w-auto">
          {/* Provider */}
          <div className="col-span-2 sm:col-span-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[var(--ui-muted)] font-semibold">
                Proveedor / Distribuidor
              </label>
              <button
                type="button"
                onClick={() => setIsNewProviderModalOpen(true)}
                className="text-[10px] text-[var(--ui-brand-strong)] hover:text-[var(--ui-brand-strong)] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                title="Registrar nuevo distribuidor"
              >
                <PlusCircle className="w-3 h-3" />
                <span>+ Nuevo</span>
              </button>
            </div>
            <select
              value={providerId || ''}
              onChange={(e) => {
                const selected = providerList.find(p => p.id_proveedor === Number(e.target.value));
                setProviderId(selected?.id_proveedor);
                setProvider(selected?.razon_social || '');
              }}
              className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none font-medium w-full sm:min-w-[200px]"
            >
              <option value="">Selecciona un proveedor</option>
              {providerList.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.razon_social}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice / Guide */}
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-[var(--ui-muted)] font-semibold">
              N° Factura Física *
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: 001-002-12345"
              className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none uppercase w-full sm:w-36 font-bold"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-[var(--ui-muted)] font-semibold">
              Fecha de Recepción
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none w-full sm:w-36"
            />
          </div>
        </div>
      </div>

      {/* Barcode Search Scanning Area & AI Trigger (hidden when verifying an already-scheduled order pack unless toggled) */}
      {(!selectedOrderForReception || showOrderScannerTools) && (
        <div className="shrink-0 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1 group">
          <div className="relative bg-[var(--ui-surface)] border border-[var(--ui-border)] focus-within:border-[var(--ui-brand)] focus-within:ring-2 focus-within:ring-[var(--ui-brand)]/20 rounded-xl flex items-center px-4 py-2.5 transition-all shadow-xs">
            <Barcode className="w-5 h-5 text-[var(--ui-muted)] mr-3 shrink-0" />
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanear código de barras o escribir producto a ingresar..."
              className="w-full min-w-0 bg-transparent text-sm text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-subtle)]"
            />
            <button
              type="button"
              onClick={() => {
                setLastScannedFeedback(null);
                setIsBarcodeCameraOpen(true);
              }}
              aria-label="Escanear código de barras con cámara"
              title="Escanear código con cámara (Celular / Tablet)"
              className="ml-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Cámara</span>
            </button>
            <button
              type="submit"
              className="secondary-action ml-1.5 bg-[var(--ui-surface-hover)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
            >
              Agregar
            </button>
          </div>
        </form>
        </div>
      )}

      {/* Main Items Data Table / Order Arrival Checklist */}
      <div className="table-shell shrink-0 lg:shrink lg:flex-1 lg:min-h-0 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl lg:overflow-hidden shadow-xs flex flex-col">
        {isChecklistActive && items.length > 0 && (
          <div className="px-4 py-2.5 bg-[var(--ui-surface-muted)] border-b border-[var(--ui-border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-[var(--ui-brand-strong)] shrink-0" />
              <span className="font-bold text-[var(--ui-text)]">
                Lista de Verificación
              </span>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]">
                ✓ {confirmedItems.length} verde
              </span>
              {missingCount > 0 && (
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border border-[var(--ui-danger-border)]">
                  ✕ {missingCount} rojo
                </span>
              )}
              <span className="text-[11px] text-[var(--ui-muted)]">
                (1 toque = Verde · 2 toques = Rojo)
              </span>
            </div>

            <button
              type="button"
              onClick={toggleAllItemsConfirmed}
              className="px-3 py-1 rounded-lg text-xs font-bold border border-[var(--ui-brand-soft-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] transition-colors cursor-pointer"
            >
              {areAllItemsConfirmed ? 'Limpiar marcas' : `Marcar todos ✓ (${items.length})`}
            </button>
          </div>
        )}

        <div className="overflow-x-auto lg:flex-1 lg:overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[var(--ui-surface-hover)] z-10">
              <tr>
                {isChecklistActive && (
                  <th className="table-heading px-2 sm:px-3 py-2.5 font-sans text-xs font-semibold text-[var(--ui-brand-strong)] text-center w-[68px] whitespace-nowrap">
                    Llegó
                  </th>
                )}
                <th className="table-heading hidden md:table-cell px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] w-[120px]">
                  Código
                </th>
                <th className="table-heading px-2 sm:px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)]">
                  Producto / Descripción
                </th>
                <th className="table-heading px-2 sm:px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-center w-[78px] sm:w-[120px]">
                  Cant.
                </th>
                <th className="table-heading hidden md:table-cell px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-right w-[110px]">
                  Costo Unit. ($)
                </th>
                <th className="table-heading hidden md:table-cell px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-right w-[120px]">
                  PVP Sugerido ($)
                </th>
                <th className="table-heading hidden md:table-cell px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-right w-[110px]">
                  Subtotal ($)
                </th>
                <th className="table-heading px-1.5 sm:px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-center w-[40px] sm:w-[50px]">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={isChecklistActive ? 8 : 7} className="py-16 text-center text-[var(--ui-subtle)]">
                    <div className="max-w-sm mx-auto space-y-2">
                      <FileText className="w-10 h-10 mx-auto text-[var(--ui-subtle)]" />
                      <p className="font-semibold text-sm text-[var(--ui-secondary)]">
                        No hay productos en esta recepción
                      </p>
                      <p className="text-xs">
                        Selecciona un pedido pendiente de arriba o escanea el código de barras de los productos recibidos.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const arrivalState: OrderArrivalState = isChecklistActive
                    ? arrivalStates[item.id] || 'pending'
                    : 'arrived';
                  const isArrived = arrivalState === 'arrived';
                  const isMissing = arrivalState === 'missing';
                  const subtotal = Number(((item.quantityReceived || 0) * (item.unitCost || 0)).toFixed(2));
                  const isCostHigher = item.unitCost > item.previousCost;

                  return (
                    <tr
                      key={item.id}
                      className={`text-xs transition-colors ${
                        isChecklistActive && isArrived
                          ? 'bg-[var(--ui-brand-soft)] hover:bg-[var(--ui-brand)]/15'
                          : isChecklistActive && isMissing
                          ? 'bg-[var(--ui-danger-bg)]/80 hover:bg-[var(--ui-danger-bg)]'
                          : 'hover:bg-[var(--ui-surface-muted)]'
                      }`}
                    >
                      {isChecklistActive && (
                        <td className="px-2.5 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleItemConfirmed(item.id)}
                            aria-label={`Confirmar recepción de ${item.name}`}
                            data-arrival-state={arrivalState}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                              isArrived
                                ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)]'
                                : isMissing
                                ? 'bg-[var(--ui-danger-solid)] text-white border-[var(--ui-danger-solid)]'
                                : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:border-[var(--ui-brand)]'
                            }`}
                          >
                            {isArrived ? '✓ Llegó' : isMissing ? '✕ Faltó' : 'Marcar'}
                          </button>
                        </td>
                      )}

                      <td className="hidden md:table-cell px-4 py-2.5 font-mono font-bold text-[var(--ui-secondary)]">
                        {item.code}
                      </td>

                      <td className="px-2 sm:px-4 py-2.5 font-medium text-[var(--ui-text)]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold leading-tight ${isMissing ? 'line-through text-[var(--ui-danger-text)]' : ''}`}>
                            {item.name}
                          </span>
                          {item.isNewProduct && (
                            <span className="bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border border-[var(--ui-info-border)] px-1.5 py-0.2 rounded text-[10px] font-bold">
                              NUEVO
                            </span>
                          )}
                        </div>
                        <div className="md:hidden text-[10px] font-mono text-[var(--ui-muted)] mt-0.5">
                          {item.code} • ${formatCostPrice(item.unitCost)} • Subt: ${subtotal.toFixed(2)}
                        </div>
                      </td>

                      <td className="px-2 sm:px-4 py-2.5 text-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantityReceived}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(',', '.'));
                            if (Number.isFinite(val) && val > 0) {
                              handleUpdateItem(item.id, { quantityReceived: Number(val.toFixed(3)) });
                            }
                          }}
                          className="w-16 sm:w-20 px-1.5 sm:px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded font-mono font-black text-center text-sm outline-none text-[var(--ui-text)]"
                        />
                      </td>

                      <td className="hidden md:table-cell px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            aria-label={`Costo unitario de ${item.name}`}
                            value={item.unitCost}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                unitCost: roundCostPrice(parseDecimalInput(e.target.value))
                              })
                            }
                            className={`w-20 px-2 py-1 bg-[var(--ui-surface-muted)] border rounded font-mono font-semibold text-right outline-none ${
                              isCostHigher
                                ? 'border-[var(--ui-warning-border)] bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)]'
                                : 'border-[var(--ui-border)] text-[var(--ui-text)]'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="hidden md:table-cell px-4 py-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.suggestedSalePrice || item.salePrice}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              suggestedSalePrice: Math.max(0, parseFloat(e.target.value) || 0)
                            })
                          }
                          className="w-20 px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded font-mono font-bold text-right outline-none text-[var(--ui-brand-strong)]"
                        />
                      </td>

                      <td className="hidden md:table-cell px-4 py-2.5 font-mono font-bold text-right text-[var(--ui-text)]">
                        ${subtotal.toFixed(2)}
                      </td>

                      <td className="px-1.5 sm:px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] rounded transition-colors cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Save Button */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs tabular-nums">
            <div>
              <span className="text-[var(--ui-muted)] font-sans mr-2">Total Ítems:</span>
              <strong className="text-[var(--ui-text)] text-sm">
                {isChecklistActive ? `${confirmedItems.length} / ${items.length}` : items.length}
              </strong>
            </div>
            <div>
              <span className="text-[var(--ui-muted)] font-sans mr-2">Total Unidades:</span>
              <strong className="text-[var(--ui-text)] text-sm">{totalUnits} un</strong>
            </div>
            <div>
              <span className="text-[var(--ui-muted)] font-sans mr-2">Costo Total Compra:</span>
              <strong className="text-[var(--ui-brand-strong)] text-base font-black">${totalAmount.toFixed(2)}</strong>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm('¿Deseas vaciar la lista de recepción?')) {
                  clearLoadedOrder();
                }
              }}
              className="secondary-action px-4 py-2 border border-[var(--ui-border)] text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancelar / Limpiar
            </button>

            <button
              onClick={handleSavePurchase}
              disabled={confirmedItems.length === 0 || isSavingPurchase || !providerId}
              className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white font-semibold text-xs md:text-sm px-6 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Confirmar e Ingresar a Stock [F10]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Registrar Proveedor */}
      {isNewProviderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="surface-card bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--ui-border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--ui-text)]">Registrar Distribuidor / Proveedor</h3>
              <button
                onClick={() => setIsNewProviderModalOpen(false)}
                className="text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProvider} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Razón Social / Nombre Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Central S.A."
                  value={newProvName}
                  onChange={(e) => setNewProvName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  RUC / Cédula
                </label>
                <input
                  type="text"
                  placeholder="Ej: 1790012345001"
                  value={newProvRuc}
                  onChange={(e) => setNewProvRuc(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono text-xs outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setIsNewProviderModalOpen(false)}
                  className="secondary-action px-3 py-1.5 text-xs font-semibold text-[var(--ui-muted)] hover:bg-[var(--ui-surface-hover)] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action px-4 py-1.5 text-xs font-semibold text-white bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] rounded-lg shadow-sm"
                >
                  Guardar Distribuidor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BarcodeCameraModal
        isOpen={isBarcodeCameraOpen}
        onClose={() => {
          setIsBarcodeCameraOpen(false);
          setLastScannedFeedback(null);
        }}
        onDetected={(scanned) => {
          const feedback = processScannedOrEnteredCode(scanned);
          setLastScannedFeedback(feedback);
        }}
        title="Recepcionar por Cámara"
        subtitle="Escanea los códigos de los productos recibidos para sumarlos al ingreso"
        allowContinuous={true}
        defaultContinuous={true}
        lastFeedback={lastScannedFeedback}
      />
    </div>
  );
};
