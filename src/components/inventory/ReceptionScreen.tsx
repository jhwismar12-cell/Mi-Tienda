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
  Sparkles,
  UploadCloud,
  Check,
  Loader2,
  RefreshCw,
  Eye,
  Zap,
  Image as ImageIcon,
  Key,
  HelpCircle,
  Truck,
  CalendarCheck,
  Package,
  Layers,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ReceptionDraftItem, PurchaseOrder } from '../../types';
import { parseDecimalInput, roundCostPrice } from '../../utils/currency';
import { api, AIProcessedInvoice } from '../../services/api';
import { BarcodeCameraModal } from '../modals/BarcodeCameraModal';

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

  // AI Invoice Scanner State
  const [isAIScannerModalOpen, setIsAIScannerModalOpen] = useState(false);
  const [aiScanTab, setAiScanTab] = useState<'upload' | 'camera'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState<AIProcessedInvoice | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const [hasServerApiKey, setHasServerApiKey] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Reception Draft Items
  const [items, setItems] = useState<ReceptionDraftItem[]>([]);
  // Per-item arrival checkboxes when confirming a scheduled purchase order pack
  const [confirmedItemIds, setConfirmedItemIds] = useState<Record<string, boolean>>({});
  const [showOrderScannerTools, setShowOrderScannerTools] = useState(false);

  // Pending purchase orders
  const pendingOrders = useMemo(() => {
    return purchaseOrders.filter(o => o.status === 'PENDIENTE');
  }, [purchaseOrders]);

  // Load providers and AI config
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

    api.getIAConfig().then(res => {
      setHasServerApiKey(res.configurado);
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
    
    const draftItems: ReceptionDraftItem[] = order.items.map(it => {
      const p = products.find(prod => prod.id === it.productId || prod.code === it.code);
      return {
        id: `rec-ord-${it.id || it.productId}`,
        code: it.code,
        name: it.name,
        quantityReceived: it.quantityOrdered,
        unitCost: it.estimatedCost,
        previousCost: p ? p.costPrice : it.estimatedCost,
        salePrice: p ? p.salePrice : Number((it.estimatedCost * 1.3).toFixed(2)),
        suggestedSalePrice: p ? p.salePrice : Number((it.estimatedCost * 1.3).toFixed(2))
      };
    });

    setItems(draftItems);
    setConfirmedItemIds({});
    setShowOrderScannerTools(false);
    showToast(`📦 Pedido #${order.orderNumber} cargado. Marca con ✓ cada producto que llegó antes de confirmar.`);
  };

  const clearLoadedOrder = () => {
    setSelectedOrderForReception(null);
    setItems([]);
    setConfirmedItemIds({});
    setShowOrderScannerTools(false);
  };

  const toggleItemConfirmed = (id: string) => {
    setConfirmedItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const areAllItemsConfirmed =
    items.length > 0 && items.every(it => Boolean(confirmedItemIds[it.id]));

  const toggleAllItemsConfirmed = () => {
    if (areAllItemsConfirmed) {
      setConfirmedItemIds({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const it of items) {
      next[it.id] = true;
    }
    setConfirmedItemIds(next);
  };

  // Camera Management
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setAiError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setAiError('No se pudo acceder a la cámara. Permite los permisos en tu navegador o sube la imagen.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setImagePreview(dataUrl);
      setSelectedFile(null);
      stopCamera();
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setAiError('');
    setAiResult(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  // Trigger AI analysis
  const handleProcessInvoice = async () => {
    if (!imagePreview && !selectedFile) {
      setAiError('Por favor selecciona una imagen o toma una fotografía primero.');
      return;
    }

    setIsProcessingAI(true);
    setAiError('');

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      } else if (imagePreview) {
        formData.append('image_base64', imagePreview);
      }
      if (customApiKey.trim()) {
        formData.append('api_key', customApiKey.trim());
      }

      const result = await api.procesarFacturaIA(formData);
      setAiResult(result);
      setIsProcessingAI(false);
    } catch (err: any) {
      setIsProcessingAI(false);
      setAiError(err.message || 'Error procesando la factura con IA. Revisa tu conexión o API Key.');
    }
  };

  // Apply AI Results into Form
  const handleApplyAIResult = () => {
    if (!aiResult) return;

    // 1. Set Provider
    if (aiResult.proveedor_nombre) {
      setProvider(aiResult.proveedor_nombre);
      const matched = providerList.find(p => p.id_proveedor === aiResult.id_proveedor || p.razon_social.toLowerCase() === aiResult.proveedor_nombre.toLowerCase());
      setProviderId(matched?.id_proveedor);
      if (!matched) {
        setNewProvName(aiResult.proveedor_nombre);
        setNewProvRuc(aiResult.proveedor_ruc || '');
        setProviderModalTab('create');
        setIsNewProviderModalOpen(true);
        showToast('Registra el proveedor detectado antes de guardar la compra.');
      }
    }

    // 2. Set Invoice Number and Date
    if (aiResult.numero_factura) {
      setInvoiceNumber(aiResult.numero_factura);
    }
    if (aiResult.fecha_emision) {
      setInvoiceDate(aiResult.fecha_emision.includes('/') ? new Date().toISOString().split('T')[0] : aiResult.fecha_emision);
    }

    // 3. Set Items
    if (aiResult.items && aiResult.items.length > 0) {
      const draftItems: ReceptionDraftItem[] = aiResult.items.map((it, idx) => ({
        id: `rec-ai-${Date.now()}-${idx}`,
        code: it.codigo,
        name: it.nombre,
        quantityReceived: it.cantidad,
        unitCost: it.costo_unitario,
        previousCost: it.costo_anterior || it.costo_unitario,
        salePrice: it.precio_venta_actual || it.precio_venta_sugerido || Number((it.costo_unitario * 1.3).toFixed(2)),
        suggestedSalePrice: it.precio_venta_sugerido || Number((it.costo_unitario * 1.3).toFixed(2)),
        isNewProduct: it.es_nuevo
      }));

      setItems(draftItems);
    }

    setIsAIScannerModalOpen(false);
    setAiResult(null);
    setImagePreview(null);
    setSelectedFile(null);
    stopCamera();
    showToast('Productos y datos de la factura cargados con éxito.');
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

  // Calculations (when confirming a scheduled order pack, count only checked items)
  const confirmedItems = useMemo(
    () => (selectedOrderForReception ? items.filter(it => Boolean(confirmedItemIds[it.id])) : items),
    [selectedOrderForReception, items, confirmedItemIds]
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
        setConfirmedItemIds(prev => ({ ...prev, [existingInDraft.id]: true }));
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
        setConfirmedItemIds(prev => ({ ...prev, [newItem.id]: true }));
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
      setConfirmedItemIds(prev => ({ ...prev, [newItem.id]: true }));
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
    setConfirmedItemIds(prev => {
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

    const itemsToReceive = selectedOrderForReception ? confirmedItems : items;
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
    <div className="workspace-screen flex-1 flex flex-col h-full overflow-y-auto lg:overflow-hidden bg-[var(--ui-surface-muted)] p-4 md:p-6 gap-3.5 select-none">
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
      <div className="surface-card flex flex-col lg:flex-row items-start lg:items-center justify-between shrink-0 bg-[var(--ui-surface)] p-4 border border-[var(--ui-border)] rounded-xl gap-4 shadow-xs">
        <div>
          <p className="workspace-eyebrow ml-8 mb-1">Compras e inventario</p>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={() => setActiveScreen('inventory')}
              className="text-[var(--ui-muted)] hover:text-[var(--ui-brand-strong)] transition-colors p-1 rounded hover:bg-[var(--ui-surface-hover)]"
              title="Volver a Inventario"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="workspace-heading font-bold text-lg md:text-xl text-[var(--ui-text)]">
              Recepción de Mercancía
            </h1>
          </div>
          <p className="text-sm text-[var(--ui-muted)] ml-8">
            Registro de ingreso físico de compras e inventario al Kardex.
          </p>
        </div>

        {/* Metadata Inputs (Provider, Invoice, Date) */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Provider */}
          <div className="flex flex-col gap-0.5">
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
              className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none font-medium min-w-[200px]"
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
              className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none uppercase w-36 font-bold"
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
              className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none w-36"
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

        {/* AI Scanner Button */}
        <button
          type="button"
          onClick={() => {
            setIsAIScannerModalOpen(true);
            setAiError('');
            setAiResult(null);
          }}
          className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white px-5 py-2.5 rounded-xl font-semibold text-xs md:text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-white/90" />
          <span>Escanear Factura con IA</span>
          <Camera className="w-4 h-4 text-white/90" />
        </button>
        </div>
      )}

      {/* Main Items Data Table / Order Arrival Checklist */}
      <div className="table-shell flex-1 min-h-[280px] lg:min-h-0 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl overflow-hidden shadow-xs flex flex-col">
        {selectedOrderForReception && items.length > 0 && (
          <div className="px-4 py-2.5 bg-[var(--ui-surface-muted)] border-b border-[var(--ui-border)] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-[var(--ui-brand-strong)] shrink-0" />
              <span className="font-bold text-[var(--ui-text)]">
                Lista de Verificación del Pedido
              </span>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)]">
                {confirmedItems.length} de {items.length} confirmados
              </span>
            </div>

            <button
              type="button"
              onClick={toggleAllItemsConfirmed}
              className="px-3 py-1 rounded-lg text-xs font-bold border border-[var(--ui-brand-soft-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] transition-colors cursor-pointer"
            >
              {areAllItemsConfirmed ? 'Desmarcar todos' : `Marcar todos (${items.length})`}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[var(--ui-surface-hover)] z-10">
              <tr>
                {selectedOrderForReception && (
                  <th className="table-heading px-3 py-2.5 font-sans text-xs font-semibold text-[var(--ui-brand-strong)] text-center w-[72px] whitespace-nowrap">
                    Llegó
                  </th>
                )}
                <th className="table-heading hidden sm:table-cell px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] w-[120px]">
                  Código
                </th>
                <th className="table-heading px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] ">
                  Producto / Descripción
                </th>
                <th className="table-heading px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-center w-[120px]">
                  Cant. Recibida
                </th>
                <th className="table-heading px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-right w-[110px]">
                  Costo Unit. ($)
                </th>
                <th className="table-heading px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-right w-[120px]">
                  PVP Sugerido ($)
                </th>
                <th className="table-heading px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-right w-[110px]">
                  Subtotal ($)
                </th>
                <th className="table-heading px-4 py-2.5 font-sans text-xs md:text-xs font-semibold text-[var(--ui-muted)] text-center w-[50px]">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={selectedOrderForReception ? 8 : 7} className="py-16 text-center text-[var(--ui-subtle)]">
                    <div className="max-w-sm mx-auto space-y-2">
                      <FileText className="w-10 h-10 mx-auto text-[var(--ui-subtle)]" />
                      <p className="font-semibold text-sm text-[var(--ui-secondary)]">
                        No hay productos en esta recepción
                      </p>
                      <p className="text-xs">
                        Selecciona un pedido pendiente de arriba, escanea el código de barras o usa el botón de <strong>Escanear Factura con IA</strong>.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isConfirmed = !selectedOrderForReception || Boolean(confirmedItemIds[item.id]);
                  const subtotal = Number(((item.quantityReceived || 0) * (item.unitCost || 0)).toFixed(2));
                  const isCostHigher = item.unitCost > item.previousCost;

                  return (
                    <tr
                      key={item.id}
                      className={`text-xs transition-colors ${
                        selectedOrderForReception && isConfirmed
                          ? 'bg-[var(--ui-brand)]/5 hover:bg-[var(--ui-brand)]/10'
                          : selectedOrderForReception
                          ? 'opacity-65 hover:bg-[var(--ui-surface-muted)]'
                          : 'hover:bg-[var(--ui-surface-muted)]'
                      }`}
                    >
                      {selectedOrderForReception && (
                        <td className="px-3 py-2.5 text-center">
                          <label className="inline-flex items-center justify-center p-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isConfirmed}
                              onChange={() => toggleItemConfirmed(item.id)}
                              aria-label={`Confirmar recepción de ${item.name}`}
                              className="w-4 h-4 rounded border-[var(--ui-border)] accent-[var(--ui-brand)] cursor-pointer"
                            />
                          </label>
                        </td>
                      )}

                      <td className="hidden sm:table-cell px-4 py-2.5 font-mono font-bold text-[var(--ui-secondary)]">
                        {item.code}
                      </td>

                      <td className="px-3 sm:px-4 py-2.5 font-medium text-[var(--ui-text)]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{item.name}</span>
                          {item.isNewProduct && (
                            <span className="bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border border-[var(--ui-info-border)] px-1.5 py-0.2 rounded text-[10px] font-bold">
                              NUEVO
                            </span>
                          )}
                        </div>
                        <div className="sm:hidden text-[10px] font-mono text-[var(--ui-muted)] mt-0.5">
                          {item.code}
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-center">
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
                          className="w-20 px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded font-mono font-black text-center text-sm outline-none text-[var(--ui-text)]"
                        />
                      </td>

                      <td className="px-4 py-2.5 text-right">
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

                      <td className="px-4 py-2.5 text-right">
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

                      <td className="px-4 py-2.5 font-mono font-bold text-right text-[var(--ui-text)]">
                        ${subtotal.toFixed(2)}
                      </td>

                      <td className="px-4 py-2.5 text-center">
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
        <div className="px-6 py-3.5 bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs tabular-nums">
            <div>
              <span className="text-[var(--ui-muted)] font-sans mr-2">Total Ítems:</span>
              <strong className="text-[var(--ui-text)] text-sm">
                {selectedOrderForReception ? `${confirmedItems.length} / ${items.length}` : items.length}
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

      {/* Modal: Escaneo de Facturas con IA Gemini Vision */}
      {isAIScannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="surface-card bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--ui-border)] flex justify-between items-center bg-[var(--ui-surface-muted)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--ui-brand)] text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white/90" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--ui-text)]">Escáner de Facturas con Inteligencia Artificial</h3>
                  <p className="text-xs text-[var(--ui-muted)]">Reconocimiento automático de productos, cantidades y costos</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  setIsAIScannerModalOpen(false);
                }}
                className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Tab Selector: Upload or Camera */}
              <div className="flex items-center gap-2 border-b border-[var(--ui-border)] pb-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setAiScanTab('upload');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    aiScanTab === 'upload'
                      ? 'bg-[var(--ui-brand)] text-white'
                      : 'text-[var(--ui-muted)] hover:bg-[var(--ui-surface-hover)]'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Subir Imagen / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiScanTab('camera');
                    startCamera();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    aiScanTab === 'camera'
                      ? 'bg-[var(--ui-brand)] text-white'
                      : 'text-[var(--ui-muted)] hover:bg-[var(--ui-surface-hover)]'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Tomar Foto con Cámara</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              {aiScanTab === 'upload' && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className="border-2 border-dashed border-[var(--ui-border)] hover:border-[var(--ui-brand)] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[var(--ui-surface-muted)]"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,application/pdf';
                    input.onchange = (e: any) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelected(e.target.files[0]);
                      }
                    };
                    input.click();
                  }}
                >
                  {imagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={imagePreview}
                        alt="Previsualización de Factura"
                        className="max-h-56 mx-auto rounded-lg shadow-sm border border-[var(--ui-border)] object-contain"
                      />
                      <p className="text-xs text-[var(--ui-brand-strong)] font-semibold">
                        ✓ Imagen cargada. Clic para cambiar de archivo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-10 h-10 mx-auto text-[var(--ui-muted)]" />
                      <p className="font-semibold text-sm text-[var(--ui-text)]">
                        Arrastra y suelta la foto o PDF de la factura aquí
                      </p>
                      <p className="text-xs text-[var(--ui-muted)]">o haz clic para explorar tus archivos</p>
                    </div>
                  )}
                </div>
              )}

              {/* Camera Capture View */}
              {aiScanTab === 'camera' && (
                <div className="space-y-3 text-center">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-64 flex items-center justify-center border border-[var(--ui-border)]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="primary-action px-5 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 mx-auto cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capturar Fotografía</span>
                  </button>
                </div>
              )}

              {/* Error Alert */}
              {aiError && (
                <div className="p-3 bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] rounded-xl text-xs text-[var(--ui-danger-text)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* AI Processing Status */}
              {isProcessingAI && (
                <div className="py-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[var(--ui-brand-strong)] animate-spin mx-auto" />
                  <p className="font-semibold text-sm text-[var(--ui-text)]">
                    La IA de Gemini está analizando la factura y vinculando productos...
                  </p>
                  <p className="text-xs text-[var(--ui-muted)]">
                    Detectando distribuidor, números de factura, cantidades y costos unitarios.
                  </p>
                </div>
              )}

              {/* AI Extracted Summary Result */}
              {aiResult && !isProcessingAI && (
                <div className="space-y-3 bg-[var(--ui-brand-soft)] p-4 rounded-xl border border-[var(--ui-brand-soft-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--ui-brand-strong)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Factura Procesada con Éxito
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--ui-brand-strong)]">
                      {aiResult.items.length} productos detectados
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="bg-[var(--ui-surface)] p-2 rounded border border-[var(--ui-brand-soft-border)]">
                      <div className="text-[10px] text-[var(--ui-muted)] font-sans">Proveedor</div>
                      <div className="font-bold truncate text-[var(--ui-text)]">{aiResult.proveedor_nombre}</div>
                    </div>
                    <div className="bg-[var(--ui-surface)] p-2 rounded border border-[var(--ui-brand-soft-border)]">
                      <div className="text-[10px] text-[var(--ui-muted)] font-sans">Nro Factura</div>
                      <div className="font-bold text-[var(--ui-text)]">{aiResult.numero_factura}</div>
                    </div>
                    <div className="bg-[var(--ui-surface)] p-2 rounded border border-[var(--ui-brand-soft-border)]">
                      <div className="text-[10px] text-[var(--ui-muted)] font-sans">Total Factura</div>
                      <div className="font-bold text-[var(--ui-brand-strong)]">${aiResult.total.toFixed(2)}</div>
                    </div>
                    <div className="bg-[var(--ui-surface)] p-2 rounded border border-[var(--ui-brand-soft-border)]">
                      <div className="text-[10px] text-[var(--ui-muted)] font-sans">Fecha</div>
                      <div className="font-bold text-[var(--ui-text)]">{aiResult.fecha_emision}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-3.5 bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIsAIScannerModalOpen(false);
                }}
                className="secondary-action px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-lg border border-[var(--ui-border)]"
              >
                Cerrar
              </button>

              {aiResult ? (
                <button
                  type="button"
                  onClick={handleApplyAIResult}
                  className="primary-action px-5 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Aplicar Productos a Recepción</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleProcessInvoice}
                  disabled={isProcessingAI || (!imagePreview && !selectedFile)}
                  className="primary-action px-5 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-white/90" />
                  <span>{isProcessingAI ? 'Procesando...' : 'Analizar Factura'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
