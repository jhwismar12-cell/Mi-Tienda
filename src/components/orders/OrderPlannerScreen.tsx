import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Plus,
  Truck,
  Building2,
  Calendar,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Search,
  X,
  FileText,
  DollarSign,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ShoppingBag,
  Send,
  Printer
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import { Product, PurchaseOrder, PurchaseOrderItem } from '../../types';
import { formatCostPrice, parseDecimalInput, roundCostPrice } from '../../utils/currency';
import {
  OrderArrivalState,
  buildReceptionItemsFromOrder,
  countOrderArrivalStates,
  cycleOrderArrivalState
} from '../../utils/orderArrival';

export const OrderPlannerScreen: React.FC = () => {
  const {
    products,
    purchaseOrders,
    createPurchaseOrder,
    deletePurchaseOrder,
    receiveOrderInStock,
    setSelectedOrderForReception,
    setActiveScreen,
    showToast
  } = useStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'received' | 'all'>('pending');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedOrders, setCollapsedOrders] = useState<Record<string, boolean>>({});
  const [arrivalByOrder, setArrivalByOrder] = useState<Record<string, Record<string, OrderArrivalState>>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);

  // Modal: Crear Nuevo Pedido
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProviderName, setSelectedProviderName] = useState<string>('Bebidas Arca Continental Ecuador Arcardor C.L.');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // tomorrow by default
    return d.toISOString().split('T')[0];
  });
  const [orderNotes, setOrderNotes] = useState('');
  const [orderDraftItems, setOrderDraftItems] = useState<Array<{
    productId: string;
    code: string;
    name: string;
    quantityOrdered: number;
    estimatedCost: number;
    category?: string;
    barcode?: string;
  }>>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Unique suppliers list from catalog
  const suppliersList = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.distributor) set.add(p.distributor);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter(order => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'pending' && order.status === 'PENDIENTE') ||
        (activeTab === 'received' && order.status === 'RECIBIDO');

      const matchesSupplier =
        selectedSupplierFilter === 'all' || order.providerName === selectedSupplierFilter;

      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.notes && order.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        order.items.some(it => it.name.toLowerCase().includes(searchQuery.toLowerCase()) || it.code.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesTab && matchesSupplier && matchesSearch;
    });
  }, [purchaseOrders, activeTab, selectedSupplierFilter, searchQuery]);

  // Counts
  const pendingCount = useMemo(() => purchaseOrders.filter(o => o.status === 'PENDIENTE').length, [purchaseOrders]);
  const receivedCount = useMemo(() => purchaseOrders.filter(o => o.status === 'RECIBIDO').length, [purchaseOrders]);

  // Available products for selected provider when creating order
  const availableProductsForOrder = useMemo(() => {
    return products.filter(p => {
      const matchSupplier = !selectedProviderName || p.distributor === selectedProviderName || p.distributor?.includes(selectedProviderName.split(' ')[0]);
      const matchQuery =
        !productSearchQuery ||
        p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(productSearchQuery));
      return matchSupplier && matchQuery;
    });
  }, [products, selectedProviderName, productSearchQuery]);

  // Add product to order draft
  const handleAddProductToDraft = (prod: Product) => {
    setOrderDraftItems(prev => {
      const exists = prev.find(item => item.productId === prod.id);
      if (exists) {
        return prev.map(item =>
          item.productId === prod.id
            ? { ...item, quantityOrdered: item.quantityOrdered + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          code: prod.code,
          name: prod.name,
          quantityOrdered: 1,
          estimatedCost: prod.costPrice,
          category: prod.category,
          barcode: prod.barcode
        }
      ];
    });
  };

  const handleUpdateDraftQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setOrderDraftItems(prev => prev.filter(item => item.productId !== productId));
      return;
    }
    setOrderDraftItems(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, quantityOrdered: qty } : item
      )
    );
  };

  const handleUpdateDraftCost = (productId: string, cost: number) => {
    setOrderDraftItems(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, estimatedCost: cost } : item
      )
    );
  };

  const handleRemoveDraftItem = (productId: string) => {
    setOrderDraftItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Draft Totals
  const draftTotalUnits = useMemo(() => {
    return orderDraftItems.reduce((acc, it) => acc + it.quantityOrdered, 0);
  }, [orderDraftItems]);

  const draftTotalAmount = useMemo(() => {
    return orderDraftItems.reduce((acc, it) => acc + it.quantityOrdered * it.estimatedCost, 0);
  }, [orderDraftItems]);

  // Open Create Order Modal
  const handleOpenCreateModal = (supplierName?: string) => {
    const prov = supplierName || (suppliersList[0] || 'General');
    setSelectedProviderName(prov);
    setOrderDraftItems([]);
    setProductSearchQuery('');
    setOrderNotes('');
    setIsCreateModalOpen(true);
  };

  // Save Order
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderDraftItems.length === 0) {
      showToast('⚠️ Agrega al menos un producto al pedido.');
      return;
    }

    const providerObj = products.find(p => p.distributor === selectedProviderName);

    await createPurchaseOrder({
      providerId: providerObj?.providerId,
      providerName: selectedProviderName,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: orderNotes.trim() || undefined,
      items: orderDraftItems
    });

    setIsCreateModalOpen(false);
    setOrderDraftItems([]);
  };

  // Dispatch / Send order to Reception Screen
  const handleSendToReception = (order: PurchaseOrder) => {
    setSelectedOrderForReception(order);
    setActiveScreen('reception');
    showToast(`📦 Pedido #${order.orderNumber} empaquetado y cargado en Recepción de Mercancía.`);
  };

  const getOrderItemKey = (item: PurchaseOrderItem, idx: number) =>
    item.id || item.productId || String(idx);

  const toggleOrderExpanded = (orderId: string) => {
    setCollapsedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const handleCycleOrderItem = (orderId: string, itemKey: string) => {
    setArrivalByOrder(prev => {
      const orderMap = prev[orderId] || {};
      return {
        ...prev,
        [orderId]: {
          ...orderMap,
          [itemKey]: cycleOrderArrivalState(orderMap[itemKey])
        }
      };
    });
  };

  const handleMarkAllArrived = (order: PurchaseOrder) => {
    const orderMap = arrivalByOrder[order.id] || {};
    const keys = order.items.map((it, idx) => getOrderItemKey(it, idx));
    const allGreen = keys.length > 0 && keys.every(k => orderMap[k] === 'arrived');
    if (allGreen) {
      setArrivalByOrder(prev => ({ ...prev, [order.id]: {} }));
      return;
    }
    const next: Record<string, OrderArrivalState> = {};
    for (const k of keys) next[k] = 'arrived';
    setArrivalByOrder(prev => ({ ...prev, [order.id]: next }));
  };

  const handleDirectSendToInventory = async (order: PurchaseOrder) => {
    if (submittingOrderId) return;
    const orderMap = arrivalByOrder[order.id] || {};
    const receivedItems = buildReceptionItemsFromOrder(order, products, orderMap);
    if (receivedItems.length === 0) {
      showToast('⚠️ Marca al menos un producto en verde (1 toque) antes de enviar a inventario.');
      return;
    }

    let resolvedProviderId =
      order.providerId ||
      products.find(
        p =>
          typeof p.providerId === 'number' &&
          p.distributor?.trim().toLowerCase() === order.providerName.trim().toLowerCase()
      )?.providerId;

    if (!resolvedProviderId) {
      try {
        const providers = await api.getProveedores();
        const match = providers.find(
          p => p.razon_social.trim().toLowerCase() === order.providerName.trim().toLowerCase()
        );
        if (match) resolvedProviderId = match.id_proveedor;
      } catch {
        // Fallback handled below
      }
    }

    if (!resolvedProviderId) {
      handleSendToReception(order);
      showToast('Selecciona o confirma el proveedor en Recepción para completar el ingreso.');
      return;
    }

    const docNum = `FAC-${Date.now().toString().slice(-6)}`;
    setSubmittingOrderId(order.id);
    try {
      await receiveOrderInStock(order.id, docNum, receivedItems, order.providerName, resolvedProviderId);
      setArrivalByOrder(prev => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    } catch {
      // Errors are surfaced via StoreContext toast
    } finally {
      setSubmittingOrderId(null);
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
    <div className="workspace-screen flex-1 flex flex-col h-full overflow-hidden bg-[var(--ui-surface)] select-none relative">
      {/* Header Bar */}
      <div className="px-4 lg:px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] shrink-0 z-20 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <p className="workspace-eyebrow mb-1">Planificación de compras</p>
            <h1 className="workspace-heading font-bold text-xl md:text-2xl text-[var(--ui-text)] tracking-tight flex flex-wrap items-center gap-2">
              <CalendarCheck className="w-6 h-6 text-[var(--ui-brand-strong)]" />
              <span>Agenda de Pedidos a Proveedores</span>
              <span className="status-pill text-xs bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] px-2.5 py-0.5 rounded-full font-semibold">
                {pendingCount} activos
              </span>
            </h1>
            <p className="text-sm text-[var(--ui-muted)] mt-1">
              Planifica y genera pedidos a preventistas sin afectar el inventario hasta su recepción física.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => handleOpenCreateModal()}
              className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs md:text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Pedido</span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-[var(--ui-surface-hover)] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-[var(--ui-surface)] text-[var(--ui-brand-strong)] font-bold shadow-xs'
                  : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
              <span>Pendientes ({pendingCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('received')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'received'
                  ? 'bg-[var(--ui-surface)] text-[var(--ui-text)] font-bold shadow-xs'
                  : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
              <span>Recibidos ({receivedCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[var(--ui-surface)] text-[var(--ui-text)] font-bold shadow-xs'
                  : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
              }`}
            >
              <span>Todos ({purchaseOrders.length})</span>
            </button>
          </div>

          {/* Search and Supplier Quick Filter */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--ui-muted)]" />
              <input
                type="text"
                placeholder="Buscar pedido, producto o proveedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)] focus:bg-[var(--ui-surface)] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-[var(--ui-subtle)] hover:text-[var(--ui-text)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedSupplierFilter}
              onChange={(e) => setSelectedSupplierFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs font-medium text-[var(--ui-secondary)] outline-none focus:border-[var(--ui-brand)]"
            >
              <option value="all">Todos los Distribuidores</option>
              {suppliersList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Orders List */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-[var(--ui-surface-muted)]">
        {filteredOrders.length === 0 ? (
          <div className="surface-card text-center py-16 bg-[var(--ui-surface)] rounded-2xl border border-dashed border-[var(--ui-border)] p-8 max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] flex items-center justify-center mx-auto">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-[var(--ui-text)]">
              {activeTab === 'pending' ? 'No tienes pedidos pendientes programados' : 'No se encontraron pedidos'}
            </h3>
            <p className="text-xs text-[var(--ui-muted)] max-w-sm mx-auto">
              Crea una lista de compras con los productos que necesitas pedirle a tu preventista. Al llegar el camión, podrás recibirlo con 1 clic.
            </p>
            <button
              onClick={() => handleOpenCreateModal()}
              className="primary-action mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Primer Pedido</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredOrders.map(order => {
              const isPending = order.status === 'PENDIENTE';
              const isReceived = order.status === 'RECIBIDO';
              const orderMap = arrivalByOrder[order.id] || {};
              const itemKeys = order.items.map((it, idx) => getOrderItemKey(it, idx));
              const { arrivedCount, missingCount } = countOrderArrivalStates(itemKeys, orderMap);
              const isExpanded = !collapsedOrders[order.id];

              return (
                <div
                  key={order.id}
                  className={`surface-card bg-[var(--ui-surface)] rounded-2xl border transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
                    isPending
                      ? 'border-[var(--ui-border)] hover:border-[var(--ui-brand)] hover:shadow-md'
                      : 'border-[var(--ui-border)] opacity-90'
                  }`}
                >
                  {/* Order Card Header */}
                  <div className="p-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => toggleOrderExpanded(order.id)}
                              aria-label={`Desplegar paquete ${order.orderNumber}`}
                              className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[var(--ui-brand-strong)] bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] px-2 py-0.5 rounded hover:opacity-90 transition-opacity cursor-pointer"
                              title="Clic para abrir o contraer la lista de productos del paquete"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>{order.orderNumber}</span>
                              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="font-mono text-xs font-bold text-[var(--ui-text)] bg-[var(--ui-surface-hover)] px-2 py-0.5 rounded">
                              {order.orderNumber}
                            </span>
                          )}
                          <span className={`status-pill px-2 py-0.5 rounded text-xs font-semibold border ${getSupplierBadgeStyle(order.providerName)}`}>
                            {order.providerName}
                          </span>
                          <span
                            className={`status-pill px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isPending
                                ? 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border border-[var(--ui-warning-border)]'
                                : isReceived
                                ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]'
                                : 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border border-[var(--ui-danger-border)]'
                            }`}
                          >
                            {isPending ? 'Pendiente de entrega' : isReceived ? 'Recibido en stock' : 'Cancelado'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ui-muted)] font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[var(--ui-subtle)]" />
                            <span>Pedido: <strong>{order.date}</strong></span>
                          </span>
                          {order.expectedDeliveryDate && (
                            <span className="flex items-center gap-1 text-[var(--ui-brand-strong)] font-semibold">
                              <Truck className="w-3.5 h-3.5" />
                              <span>Llegada estimada: {order.expectedDeliveryDate}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-1">
                        {isPending && (
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Deseas cancelar el pedido #${order.orderNumber}?`)) {
                                deletePurchaseOrder(order.id);
                              }
                            }}
                            className="p-1.5 text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] rounded-lg transition-colors cursor-pointer"
                            title="Cancelar pedido"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {order.notes && (
                      <div className="mt-2 text-xs bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] p-2 rounded-lg border border-[var(--ui-border)] italic">
                        "{order.notes}"
                      </div>
                    )}
                  </div>

                  {/* Order Items Table / List */}
                  {isExpanded && (
                    <div className="p-4 flex-1">
                      <div className="workspace-eyebrow text-xs font-semibold text-[var(--ui-muted)] mb-1.5 flex items-center justify-between gap-2 flex-wrap">
                        <span>Productos Solicitados ({order.items.length} ítems)</span>
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleMarkAllArrived(order)}
                            className="text-[11px] font-bold text-[var(--ui-brand-strong)] hover:underline cursor-pointer normal-case tracking-normal"
                          >
                            {arrivedCount === order.items.length && order.items.length > 0
                              ? 'Limpiar marcas'
                              : 'Marcar todos ✓'}
                          </button>
                        ) : (
                          <span>Cant. Pedida</span>
                        )}
                      </div>

                      {isPending && (
                        <p className="text-[11px] text-[var(--ui-muted)] mb-2">
                          Toca cada producto: <strong className="text-[var(--ui-brand-strong)]">1 toque = ✓ Verde (llegó)</strong> · <strong className="text-[var(--ui-danger-text)]">2 toques = ✕ Rojo (no llegó)</strong>
                        </p>
                      )}

                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {order.items.map((item, idx) => {
                          const itemKey = getOrderItemKey(item, idx);
                          const arrivalState: OrderArrivalState = orderMap[itemKey] || 'pending';

                          if (!isPending) {
                            return (
                              <div key={itemKey} className="pt-1.5 border-t first:border-t-0 border-[var(--ui-border)] flex items-center justify-between text-xs">
                                <div className="overflow-hidden pr-2">
                                  <div className="font-semibold text-[var(--ui-text)] truncate">{item.name}</div>
                                  <div className="font-mono text-[10px] text-[var(--ui-muted)]">
                                    Cód: {item.code} • Costo Ref: ${formatCostPrice(item.estimatedCost)}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-mono font-black text-xs text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-2 py-0.5 rounded">
                                    {item.quantityOrdered} un
                                  </span>
                                  <div className="font-mono text-[10px] text-[var(--ui-muted)] mt-0.5">
                                    ${item.subtotal.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          const isArrived = arrivalState === 'arrived';
                          const isMissing = arrivalState === 'missing';

                          return (
                            <button
                              key={itemKey}
                              type="button"
                              onClick={() => handleCycleOrderItem(order.id, itemKey)}
                              aria-label={`Marcar llegada de ${item.name} en ${order.orderNumber}`}
                              data-arrival-state={arrivalState}
                              className={`w-full text-left p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all cursor-pointer ${
                                isArrived
                                  ? 'bg-[var(--ui-brand-soft)] border-[var(--ui-brand)] shadow-2xs'
                                  : isMissing
                                  ? 'bg-[var(--ui-danger-bg)] border-[var(--ui-danger-border)]'
                                  : 'bg-[var(--ui-surface)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-muted)]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                                    isArrived
                                      ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)]'
                                      : isMissing
                                      ? 'bg-[var(--ui-danger-solid)] text-white border-[var(--ui-danger-solid)]'
                                      : 'bg-[var(--ui-surface-muted)] text-[var(--ui-subtle)] border-[var(--ui-border)]'
                                  }`}
                                >
                                  {isArrived ? '✓' : isMissing ? '✕' : '•'}
                                </span>
                                <div className="overflow-hidden min-w-0">
                                  <div
                                    className={`font-semibold truncate ${
                                      isMissing
                                        ? 'line-through text-[var(--ui-danger-text)]'
                                        : isArrived
                                        ? 'text-[var(--ui-brand-strong)]'
                                        : 'text-[var(--ui-text)]'
                                    }`}
                                  >
                                    {item.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-[var(--ui-muted)]">
                                    Cód: {item.code} • Costo Ref: ${formatCostPrice(item.estimatedCost)}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                                <span
                                  className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                                    isMissing
                                      ? 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border border-[var(--ui-danger-border)]'
                                      : 'text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10'
                                  }`}
                                >
                                  {item.quantityOrdered} un
                                </span>
                                <span
                                  className={`text-[10px] font-bold ${
                                    isArrived
                                      ? 'text-[var(--ui-brand-strong)]'
                                      : isMissing
                                      ? 'text-[var(--ui-danger-text)]'
                                      : 'text-[var(--ui-subtle)]'
                                  }`}
                                >
                                  {isArrived
                                    ? 'Llegó'
                                    : isMissing
                                    ? 'No llegó'
                                    : `$${Number(item.subtotal ?? item.quantityOrdered * item.estimatedCost).toFixed(2)}`}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Card Footer: Summary & Dispatch Button */}
                  <div className="p-4 bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
                      <div>
                        <div className="text-[10px] text-[var(--ui-muted)] font-sans">Total Unidades</div>
                        <div className="font-black text-sm text-[var(--ui-text)]">{order.totalUnits} un</div>
                      </div>
                      <div className="h-6 w-px bg-[var(--ui-border)]" />
                      <div>
                        <div className="text-[10px] text-[var(--ui-muted)] font-sans">Presupuesto Est.</div>
                        <div className="font-black text-sm text-[var(--ui-brand-strong)]">${order.totalAmount.toFixed(2)}</div>
                      </div>
                      {isPending && (arrivedCount > 0 || missingCount > 0) && (
                        <>
                          <div className="h-6 w-px bg-[var(--ui-border)]" />
                          <div className="font-sans text-[11px] font-bold flex items-center gap-1.5">
                            {arrivedCount > 0 && (
                              <span className="text-[var(--ui-brand-strong)]">✓ {arrivedCount}</span>
                            )}
                            {missingCount > 0 && (
                              <span className="text-[var(--ui-danger-text)]">✕ {missingCount}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {isPending ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {arrivedCount > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSendToReception(order)}
                              disabled={submittingOrderId === order.id}
                              className="secondary-action px-3 py-2 border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] text-xs font-semibold rounded-xl cursor-pointer"
                              title="Editar factura o cantidades antes de confirmar"
                            >
                              En Recepción
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDirectSendToInventory(order)}
                              disabled={submittingOrderId === order.id}
                              className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4 text-white/95" />
                              <span>{submittingOrderId === order.id ? 'Enviando...' : 'Enviar a Inventario'}</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendToReception(order)}
                            className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer group"
                          >
                            <Truck className="w-4 h-4 text-white/90" />
                            <span>Recibir en Mercancía</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-[10px] text-[var(--ui-brand-strong)] font-bold">
                          Ingresado con Factura: <strong>{order.receivedInvoiceNumber || 'FAC-CONFIRMADA'}</strong>
                        </div>
                        <div className="text-[10px] text-[var(--ui-muted)] font-mono">
                          Fecha: {order.receivedDate ? order.receivedDate.split('T')[0] : order.date}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Crear Nuevo Pedido */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="surface-card bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-3xl w-full h-[90vh] max-h-[750px] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--ui-brand)] text-white flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4 text-white/90" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--ui-text)]">Nuevo Pedido a Distribuidor</h3>
                  <p className="text-xs text-[var(--ui-muted)]">Genera tu orden de compra programada</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Left Column: Provider & Catalog Picker */}
              <div className="w-full md:w-1/2 p-4 border-r border-[var(--ui-border)] flex flex-col overflow-hidden bg-[var(--ui-surface)] space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--ui-text)] mb-1">
                    🏢 Selecciona el Distribuidor / Proveedor *
                  </label>
                  <select
                    value={selectedProviderName}
                    onChange={(e) => {
                      setSelectedProviderName(e.target.value);
                      setOrderDraftItems([]);
                    }}
                    className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  >
                    {suppliersList.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                {/* Search Products */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                    Seleccionar Productos del Catálogo
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--ui-muted)]" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o código..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
                    />
                  </div>
                </div>

                {/* Available Products List */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[var(--ui-border)]">
                  {availableProductsForOrder.length === 0 ? (
                    <div className="py-8 text-center text-[var(--ui-subtle)] text-xs">
                      No hay productos registrados para este proveedor.
                    </div>
                  ) : (
                    availableProductsForOrder.map(prod => {
                      const alreadyInDraft = orderDraftItems.find(it => it.productId === prod.id);
                      return (
                        <div
                          key={prod.id}
                          className="pt-1.5 flex items-center justify-between gap-2 text-xs hover:bg-[var(--ui-surface-muted)] p-1.5 rounded-lg transition-colors"
                        >
                          <div className="overflow-hidden">
                            <div className="font-semibold text-[var(--ui-text)] truncate">{prod.name}</div>
                            <div className="font-mono text-[10px] text-[var(--ui-muted)] flex items-center gap-2">
                              <span>Cód: {prod.code}</span>
                              <span>•</span>
                              <span>Costo: ${formatCostPrice(prod.costPrice)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddProductToDraft(prod)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                              alreadyInDraft
                                ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                                : 'bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] hover:bg-[var(--ui-brand)]/20'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{alreadyInDraft ? `${alreadyInDraft.quantityOrdered} un` : 'Agregar'}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Order Items & Configuration */}
              <div className="w-full md:w-1/2 p-4 flex flex-col justify-between overflow-hidden bg-[var(--ui-surface-muted)] space-y-3">
                {/* Delivery Date & Notes */}
                <div className="space-y-2 shrink-0">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--ui-secondary)] mb-1">
                        📅 Fecha Estimada de Entrega
                      </label>
                      <input
                        type="date"
                        value={expectedDeliveryDate}
                        onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--ui-secondary)] mb-1">
                        📝 Notas para el Preventista
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Pedir 2 combos"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Draft Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  <div className="flex justify-between items-center text-xs font-bold text-[var(--ui-text)]">
                    <span>Lista del Pedido ({orderDraftItems.length} productos)</span>
                    <span className="font-mono text-[var(--ui-brand-strong)]">{draftTotalUnits} unidades</span>
                  </div>

                  {orderDraftItems.length === 0 ? (
                    <div className="py-12 text-center text-[var(--ui-subtle)] text-xs bg-[var(--ui-surface)] rounded-xl border border-dashed border-[var(--ui-border)] p-4">
                      Selecciona productos del catálogo a la izquierda para armar tu pedido.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orderDraftItems.map(item => (
                        <div
                          key={item.productId}
                          className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-2.5 shadow-2xs text-xs space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div className="overflow-hidden pr-2">
                              <div className="font-semibold text-[var(--ui-text)] truncate">{item.name}</div>
                              <div className="font-mono text-[10px] text-[var(--ui-muted)]">Cód: {item.code}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftItem(item.productId)}
                              className="text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 border-t border-[var(--ui-border)] pt-1.5">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-[var(--ui-muted)] font-medium">Cantidad:</label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantityOrdered}
                                onChange={(e) => handleUpdateDraftQty(item.productId, parseInt(e.target.value) || 1)}
                                className="w-16 px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded font-mono font-bold text-xs text-center"
                              />
                              <span className="text-[10px] text-[var(--ui-muted)]">un</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-[var(--ui-muted)] font-medium">Costo $:</label>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={item.estimatedCost}
                                onChange={(e) =>
                                  handleUpdateDraftCost(
                                    item.productId,
                                    roundCostPrice(parseDecimalInput(e.target.value))
                                  )
                                }
                                className="w-16 px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded font-mono font-bold text-xs text-right"
                              />
                            </div>

                            <div className="font-mono font-bold text-xs text-[var(--ui-brand-strong)]">
                              ${(item.quantityOrdered * item.estimatedCost).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Modal Footer: Budget & Save */}
                <div className="pt-3 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 rounded-xl flex items-center justify-between shrink-0">
                  <div>
                    <div className="text-[10px] text-[var(--ui-muted)] font-medium">Presupuesto Estimado</div>
                    <div className="font-mono font-black text-lg text-[var(--ui-brand-strong)]">
                      ${draftTotalAmount.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="secondary-action px-3 py-2 text-xs font-semibold text-[var(--ui-muted)] hover:bg-[var(--ui-surface-hover)] rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveOrder}
                      disabled={orderDraftItems.length === 0}
                      className="primary-action px-4 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Guardar Pedido</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
