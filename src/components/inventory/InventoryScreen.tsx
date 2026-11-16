import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  PlusCircle,
  MinusCircle,
  Flag,
  Package,
  ShoppingBag,
  AlertTriangle,
  UnfoldVertical,
  MoreVertical,
  Edit2,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  Undo2,
  DollarSign,
  Building2,
  ArrowUpDown,
  SortAsc,
  Sparkles,
  Menu,
  Check,
  Barcode,
  ScanLine,
  Camera
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, Category, KardexMovement, STORE_CATEGORIES } from '../../types';
import { BarcodeCameraModal } from '../modals/BarcodeCameraModal';
import { DeleteProductModal } from '../modals/DeleteProductModal';
import { ProviderSelectorField } from '../modals/ProviderSelectorField';
import { useStoreProviders } from '../../utils/providers';
import { formatCostPrice, parseDecimalInput, roundCostPrice } from '../../utils/currency';
import { sounds } from '../../utils/audio';

function looksLikeBarcode(query: string): boolean {
  const trimmed = query.trim();
  return /^[0-9A-Za-z-]{4,32}$/.test(trimmed) && /\d/.test(trimmed);
}

type SortOption = 
  | 'name_asc' 
  | 'name_desc' 
  | 'supplier_asc' 
  | 'stock_asc' 
  | 'stock_desc' 
  | 'price_asc' 
  | 'price_desc' 
  | 'cost_asc' 
  | 'cost_desc' 
  | 'margin_desc';

export const InventoryScreen: React.FC = () => {
  const {
    products,
    kardexMovements,
    selectedKardexProductId,
    setSelectedKardexProductId,
    adjustStock,
    updateProduct,
    openNewProductModal,
    inventoryScanEvent,
    clearInventoryScanEvent,
    deleteProduct,
    deleteKardexMovement,
    returnProduct,
    showToast
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [detectedNewBarcode, setDetectedNewBarcode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [isSupplierMenuOpen, setIsSupplierMenuOpen] = useState(false);

  const supplierMenuRef = useRef<HTMLDivElement>(null);

  // Close supplier dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierMenuRef.current && !supplierMenuRef.current.contains(event.target as Node)) {
        setIsSupplierMenuOpen(false);
      }
    };
    if (isSupplierMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSupplierMenuOpen]);

  // Stock Adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState<{
    open: boolean;
    type: 'plus' | 'minus';
    productId: string;
  } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('1');
  const [adjustReason, setAdjustReason] = useState('');

  // Customer Return Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState('Devolución de cliente');
  const [returnAffectsCash, setReturnAffectsCash] = useState(false);
  const [returnRefundAmount, setReturnRefundAmount] = useState('');

  // Edit Product / Price & Barcode Modal
  const [editProductModal, setEditProductModal] = useState<Product | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editProviderId, setEditProviderId] = useState<number | undefined>(undefined);
  const [editDistributor, setEditDistributor] = useState<string | undefined>(undefined);
  const [editBarcode, setEditBarcode] = useState<string>('');
  const [cameraTarget, setCameraTarget] = useState<'search' | 'edit' | null>(null);
  const [editSalePrice, setEditSalePrice] = useState<string>('');
  const [editCostPrice, setEditCostPrice] = useState<string>('');
  const [editUnit, setEditUnit] = useState<string>('UNIDAD');
  const [editAllowFraction, setEditAllowFraction] = useState<boolean>(false);
  const [editDescription, setEditDescription] = useState<string>('');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const { providers: editProviders, addLocalProvider: addLocalEditProvider } = useStoreProviders(
    Boolean(editProductModal),
    products
  );

  useEffect(() => {
    if (!editProductModal || editProviderId !== undefined || !editDistributor) return;
    const match = editProviders.find(
      p => p.razon_social.trim().toLowerCase() === editDistributor.trim().toLowerCase()
    );
    if (match) {
      setEditProviderId(match.id_proveedor);
    }
  }, [editProductModal, editProviderId, editDistributor, editProviders]);

  const openEditModal = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditProductModal(product);
    setEditName(product.name || '');
    setEditProviderId(product.providerId);
    setEditDistributor(product.distributor);
    setEditBarcode(product.barcode || '');
    setEditSalePrice(product.salePrice.toFixed(2));
    setEditCostPrice(formatCostPrice(product.costPrice));
    setEditUnit(product.unit || 'UNIDAD');
    setEditAllowFraction(Boolean(product.allowFraction));
    setEditDescription(product.description || '');
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProductModal) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      showToast('El nombre del producto es obligatorio');
      return;
    }
    const sPrice = parseDecimalInput(editSalePrice);
    const cPrice = roundCostPrice(parseDecimalInput(editCostPrice));
    if (sPrice <= 0) {
      showToast('El precio de venta debe ser mayor a 0');
      return;
    }

    const cleanBc = editBarcode.trim();

    await updateProduct(editProductModal.id, {
      name: cleanName,
      providerId: editProviderId,
      distributor: editDistributor,
      salePrice: sPrice,
      costPrice: cPrice,
      barcode: cleanBc,
      unit: editUnit,
      allowFraction: editAllowFraction,
      description: editDescription.trim() || ''
    });

    showToast(`Producto "${cleanName}" actualizado con éxito`);
    setEditProductModal(null);
  };

  const openDeleteModal = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProductToDelete(product);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete || isDeletingProduct) return;
    setIsDeletingProduct(true);
    try {
      await deleteProduct(productToDelete.id);
      if (editProductModal?.id === productToDelete.id) {
        setEditProductModal(null);
      }
      setProductToDelete(null);
    } catch {
      // StoreContext already notifies ApiError
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const findProductByScan = (rawCode: string): Product | undefined => {
    const upper = rawCode.trim().toUpperCase();
    if (!upper) return undefined;
    return products.find(
      p => (p.barcode && p.barcode.toUpperCase() === upper) || p.code.toUpperCase() === upper
    );
  };

  const handleInventoryBarcodeScan = (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    setSearchQuery(trimmed);
    const matched = findProductByScan(trimmed);
    if (matched) {
      setDetectedNewBarcode(null);
      if (selectedCategory !== 'all') setSelectedCategory('all');
      if (selectedSupplier !== 'all') setSelectedSupplier('all');
      if (statusFilter !== 'all') setStatusFilter('all');
      setSelectedKardexProductId(matched.id);
      showToast(`Producto encontrado: ${matched.name}`);
      return;
    }

    setDetectedNewBarcode(trimmed);
    sounds.playErrorBeep();
    showToast(`Código ${trimmed} no está en inventario. Puedes añadirlo ahora.`);
  };

  useEffect(() => {
    if (!inventoryScanEvent) return;
    handleInventoryBarcodeScan(inventoryScanEvent.code);
    clearInventoryScanEvent();
  }, [inventoryScanEvent]);

  useEffect(() => {
    if (detectedNewBarcode && findProductByScan(detectedNewBarcode)) {
      setDetectedNewBarcode(null);
    }
  }, [products, detectedNewBarcode]);

  // Categories list
  const categories = STORE_CATEGORIES;

  // Suppliers list & counts
  const suppliersList = useMemo(() => {
    const suppliers = new Set<string>();
    products.forEach(p => {
      if (p.distributor) suppliers.add(p.distributor);
    });
    return Array.from(suppliers).sort();
  }, [products]);

  // Counts
  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.stock === 0).length;
  }, [products]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      // Search text
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.distributor && p.distributor.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

      // Supplier
      const matchesSupplier = selectedSupplier === 'all' || p.distributor === selectedSupplier;

      // Status
      let matchesStatus = true;
      if (statusFilter === 'low') {
        matchesStatus = p.stock > 0 && p.stock <= p.minStock;
      } else if (statusFilter === 'out') {
        matchesStatus = p.stock === 0;
      }

      return matchesSearch && matchesCategory && matchesSupplier && matchesStatus;
    });

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
        case 'supplier_asc': {
          const supA = a.distributor || 'Z_SinProveedor';
          const supB = b.distributor || 'Z_SinProveedor';
          const cmp = supA.localeCompare(supB, 'es', { sensitivity: 'base' });
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
        }
        case 'stock_asc':
          return a.stock - b.stock;
        case 'stock_desc':
          return b.stock - a.stock;
        case 'price_asc':
          return a.salePrice - b.salePrice;
        case 'price_desc':
          return b.salePrice - a.salePrice;
        case 'cost_asc':
          return a.costPrice - b.costPrice;
        case 'cost_desc':
          return b.costPrice - a.costPrice;
        case 'margin_desc': {
          const marginA = a.costPrice > 0 ? (a.salePrice - a.costPrice) / a.costPrice : 0;
          const marginB = b.costPrice > 0 ? (b.salePrice - b.costPrice) / b.costPrice : 0;
          return marginB - marginA;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [products, searchQuery, selectedCategory, selectedSupplier, statusFilter, sortBy]);

  // Selected product for Kardex drawer
  const selectedProduct = useMemo(() => {
    if (!selectedKardexProductId) return null;
    return products.find(p => p.id === selectedKardexProductId) || null;
  }, [products, selectedKardexProductId]);

  // Product Kardex movements
  const productKardex = useMemo(() => {
    if (!selectedKardexProductId) return [];
    return kardexMovements.filter(m => m.productId === selectedKardexProductId);
  }, [kardexMovements, selectedKardexProductId]);

  const handleExportCSV = () => {
    const headers = 'Código Factura,Código de Barras,Producto,Distribuidor,Categoría,Precio Costo,Precio Venta,Stock,Stock Mínimo\n';
    const rows = products
      .map(
        p =>
          `"${p.code}","${p.barcode || ''}","${p.name}","${p.distributor || 'General'}","${p.category}",${formatCostPrice(p.costPrice)},${p.salePrice.toFixed(2)},${p.stock},${p.minStock}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_tienda_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Inventario exportado en formato CSV');
  };

  const handleConfirmAdjust = () => {
    if (!showAdjustModal || !showAdjustModal.productId) return;
    const parsedQty = parseFloat(adjustAmount.replace(',', '.'));
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      showToast('Ingresa una cantidad mayor a 0');
      return;
    }
    const cleanQty = Number(parsedQty.toFixed(3));
    const delta = showAdjustModal.type === 'plus' ? cleanQty : -cleanQty;
    const movementType = showAdjustModal.type === 'plus' ? 'AJUSTE_POSITIVO' : adjustReason.toLowerCase().includes('daño') || adjustReason.toLowerCase().includes('merma') ? 'DAÑO' : 'AJUSTE_NEGATIVO';
    
    adjustStock(showAdjustModal.productId, delta, movementType, adjustReason);
    setShowAdjustModal(null);
    setAdjustAmount('1');
    setAdjustReason('');
  };

  // Delete / Revert movement handler
  const handleDeleteMovement = async (movId: string, movType: string, qtyChange: number) => {
    const isSalida = qtyChange < 0;
    const stockMsg = isSalida
      ? `Se sumarán +${Math.abs(qtyChange)} un de regreso al inventario.`
      : qtyChange > 0
      ? `Se restarán -${qtyChange} un del inventario.`
      : 'No afectará la cantidad física.';

    const confirmMsg = `¿Deseas eliminar este movimiento (${movType})?\n${stockMsg}\n\nEsta acción revertirá el balance del Kardex.`;
    if (!window.confirm(confirmMsg)) return;

    await deleteKardexMovement(movId, true);
  };

  // Open Return Modal
  const openReturnModal = () => {
    if (!selectedProduct) return;
    setReturnQuantity(1);
    setReturnReason('Devolución de cliente');
    setReturnAffectsCash(false);
    setReturnRefundAmount(selectedProduct.salePrice.toFixed(2));
    setShowReturnModal(true);
  };

  // Confirm Customer Return
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (returnQuantity <= 0) {
      showToast('La cantidad devuelta debe ser mayor a 0');
      return;
    }

    const refundNum = returnAffectsCash ? parseFloat(returnRefundAmount) || 0 : 0;

    try {
      await returnProduct(
        selectedProduct.id,
        returnQuantity,
        returnReason.trim() || 'Devolución de cliente',
        refundNum,
        returnAffectsCash
      );

      setShowReturnModal(false);
      setReturnQuantity(1);
      setReturnReason('Devolución de cliente');
      setReturnAffectsCash(false);
      setReturnRefundAmount('');
    } catch {
      // Leave the form open; the store displays the failed operation.
    }
  };

  const candidateNewBarcode = useMemo(() => {
    if (detectedNewBarcode && !findProductByScan(detectedNewBarcode)) {
      return detectedNewBarcode;
    }
    const trimmed = searchQuery.trim();
    if (filteredProducts.length === 0 && looksLikeBarcode(trimmed) && !findProductByScan(trimmed)) {
      return trimmed;
    }
    return null;
  }, [detectedNewBarcode, searchQuery, filteredProducts.length, products]);

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
      {/* Page Header & Filter Bar - Higher Z-Index than table (z-10) but below TopHeader (z-40) */}
      <div className="px-4 lg:px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] shrink-0 z-20 relative space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <p className="workspace-eyebrow mb-1">Control de existencias</p>
            <h1 className="workspace-heading font-bold text-xl md:text-2xl text-[var(--ui-text)] tracking-tight flex flex-wrap items-center gap-2">
              <span>Gestión de Inventario</span>
              <span className="status-pill text-xs bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] px-2.5 py-0.5 rounded-full font-semibold">
                {filteredProducts.length} de {products.length} productos
              </span>
            </h1>
            <p className="text-sm text-[var(--ui-muted)] mt-1">
              {products.length} productos activos • Última sinc: Hace un momento
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleExportCSV}
              className="secondary-action bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] text-xs md:text-sm font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-[var(--ui-muted)]" />
              <span>Exportar</span>
            </button>

            <button
              onClick={() => openNewProductModal()}
              className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs md:text-sm font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm relative group cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          </div>
        </div>

        {/* Search Bar Row & Quick Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input with 3 Horizontal Lines Menu */}
          <div className="flex-1 relative" ref={supplierMenuRef}>
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--ui-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const next = e.target.value;
                setSearchQuery(next);
                if (detectedNewBarcode && next.trim() !== detectedNewBarcode) {
                  setDetectedNewBarcode(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  e.preventDefault();
                  handleInventoryBarcodeScan(searchQuery);
                }
              }}
              placeholder="Buscar por nombre, código de factura o código de barras..."
              className="w-full pl-9 pr-24 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs md:text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-subtle)] outline-none focus:border-[var(--ui-brand)] focus:bg-[var(--ui-surface)] transition-all shadow-xs"
            />
            
            <div className="absolute right-1.5 top-1 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDetectedNewBarcode(null);
                  }}
                  className="p-1.5 text-[var(--ui-subtle)] hover:text-[var(--ui-text)] rounded transition-colors cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setCameraTarget('search')}
                aria-label="Escanear código de barras para buscar"
                title="Escanear código con cámara (Celular / Tablet)"
                className="p-1.5 text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 hover:bg-[var(--ui-brand)]/20 rounded-md transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
              </button>
              
              {/* 3 Horizontal Lines Button */}
              <button
                type="button"
                onClick={() => setIsSupplierMenuOpen(!isSupplierMenuOpen)}
                className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center border ${
                  isSupplierMenuOpen || selectedSupplier !== 'all' || sortBy === 'supplier_asc'
                    ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)] shadow-xs'
                    : 'bg-[var(--ui-surface)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] hover:text-[var(--ui-text)]'
                }`}
                title="Organizar por proveedor o alfabéticamente"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown Menu Floating On Top of Everything (z-50) */}
            {isSupplierMenuOpen && (
              <div className="surface-card absolute left-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5">
                {/* Menu Header */}
                <div className="px-2 py-1 flex items-center justify-between border-b border-[var(--ui-border)]">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--ui-text)]">
                    <Building2 className="w-4 h-4 text-[var(--ui-brand-strong)]" />
                    <span className="lg:hidden">Filtrar por Proveedor / Distribuidor</span>
                    <span className="hidden lg:inline">Organizar por Proveedor / Distribuidor</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSupplierMenuOpen(false)}
                    className="p-1 text-[var(--ui-subtle)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)] rounded-lg cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Sort Options (desktop only; hidden in phone/tablet menu) */}
                <div className="hidden lg:block space-y-2.5">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-[var(--ui-muted)] uppercase tracking-wider px-2 pt-0.5">
                      Modo de Organización
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy('supplier_asc');
                        setIsSupplierMenuOpen(false);
                        showToast('Productos organizados por Proveedor (A → Z)');
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                        sortBy === 'supplier_asc'
                          ? 'bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] font-bold border border-[var(--ui-brand)]/30'
                          : 'text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-muted)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[var(--ui-brand-strong)]" />
                        <div>
                          <div className="font-semibold">Organizar por Proveedor (A → Z)</div>
                          <div className="text-[10px] text-[var(--ui-muted)] font-normal">Agrupa y ordena todos los productos según su distribuidor</div>
                        </div>
                      </div>
                      {sortBy === 'supplier_asc' && <Check className="w-4 h-4 text-[var(--ui-brand-strong)] shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSortBy('name_asc');
                        setIsSupplierMenuOpen(false);
                        showToast('Productos ordenados alfabéticamente (A → Z)');
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                        sortBy === 'name_asc'
                          ? 'bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] font-bold border border-[var(--ui-brand)]/30'
                          : 'text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-muted)] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-1.5 py-0.5 rounded">A-Z</span>
                        <div>
                          <div className="font-semibold">Organizar Alfabéticamente (A → Z)</div>
                          <div className="text-[10px] text-[var(--ui-muted)] font-normal">Orden estándar por nombre de producto</div>
                        </div>
                      </div>
                      {sortBy === 'name_asc' && <Check className="w-4 h-4 text-[var(--ui-brand-strong)] shrink-0" />}
                    </button>
                  </div>

                  <div className="border-t border-[var(--ui-border)]" />
                </div>

                {/* Filter by Specific Supplier */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-[var(--ui-muted)] uppercase tracking-wider px-2 flex justify-between items-center">
                    <span>Filtrar un Proveedor</span>
                    {selectedSupplier !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplier('all');
                          showToast('Mostrando todos los proveedores');
                        }}
                        className="text-[var(--ui-brand-strong)] hover:underline normal-case font-bold cursor-pointer"
                      >
                        Ver todos
                      </button>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplier('all');
                      setIsSupplierMenuOpen(false);
                      showToast('Mostrando todos los proveedores');
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                      selectedSupplier === 'all'
                        ? 'bg-[var(--ui-chrome)] text-white font-bold'
                        : 'text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>🏢 Todos los Proveedores</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-85">({products.length} productos)</span>
                  </button>

                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {suppliersList.map((sup) => {
                      const count = products.filter(p => p.distributor === sup).length;
                      const isSelected = selectedSupplier === sup;
                      return (
                        <button
                          key={sup}
                          type="button"
                          onClick={() => {
                            setSelectedSupplier(sup);
                            setIsSupplierMenuOpen(false);
                            showToast(`Filtrado por: ${sup}`);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--ui-brand)] text-white font-bold shadow-xs'
                              : 'text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="truncate">{sup}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                            isSelected ? 'bg-[var(--ui-surface)]/20 text-white' : 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)]'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Supplier Pill Tag (when filtered) */}
          {selectedSupplier !== 'all' && (
            <div className="flex items-center gap-1.5 bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] border border-[var(--ui-brand)]/30 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">{selectedSupplier}</span>
              <button
                type="button"
                onClick={() => setSelectedSupplier('all')}
                className="hover:text-[var(--ui-text)] p-0.5 cursor-pointer"
                title="Quitar filtro de proveedor"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Stock Filters */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setStatusFilter(prev => prev === 'low' ? 'all' : 'low')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer ${
                statusFilter === 'low'
                  ? 'bg-[var(--ui-warning-solid)] text-white'
                  : 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border border-[var(--ui-warning-border)] hover:bg-[var(--ui-warning-bg)]'
              }`}
              title="Filtrar productos con stock bajo"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Bajo ({lowStockCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter(prev => prev === 'out' ? 'all' : 'out')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer ${
                statusFilter === 'out'
                  ? 'bg-[var(--ui-danger-solid)] text-white'
                  : 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border border-[var(--ui-danger-border)] hover:bg-[var(--ui-danger-bg)]'
              }`}
              title="Filtrar productos con 0 unidades"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>0 un ({outOfStockCount})</span>
            </button>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[var(--ui-chrome)] text-white shadow-xs'
                : 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)]'
            }`}
          >
            Todas las categorías ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter(p => p.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                    : 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)]'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {candidateNewBarcode && filteredProducts.length > 0 && (
        <div
          role="status"
          className="mx-4 lg:mx-6 mt-3 px-4 py-2.5 bg-[var(--ui-warning-bg)] border border-[var(--ui-warning-border)] rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm"
        >
          <div className="flex items-center gap-2 text-[var(--ui-warning-text)] font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Código escaneado{' '}
              <strong className="font-mono font-bold">{candidateNewBarcode}</strong>{' '}
              no está registrado como producto exacto.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openNewProductModal(candidateNewBarcode)}
              className="px-3 py-1.5 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir producto con este código</span>
            </button>
            <button
              type="button"
              onClick={() => setDetectedNewBarcode(null)}
              className="px-2.5 py-1.5 text-xs font-semibold text-[var(--ui-secondary)] hover:text-[var(--ui-text)] cursor-pointer"
            >
              Ocultar
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Table & Slide-out Kardex Drawer */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Products Table Container */}
        <div className="table-shell flex-1 overflow-auto bg-[var(--ui-surface)]">
          <table className="inventory-table w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[var(--ui-surface-muted)] z-10">
              <tr>
                {/* 1. Código de Factura */}
                <th 
                  onClick={() => setSortBy(prev => prev === 'name_asc' ? 'name_desc' : 'name_asc')}
                  className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors w-[110px] whitespace-nowrap"
                  title="Código interno o SKU según la factura del proveedor"
                >
                  <div className="flex items-center gap-1">
                    <span>Cód. Factura</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--ui-subtle)]" />
                  </div>
                </th>

                {/* 2. Código de Barras (NUEVA COLUMNA DESTACADA) */}
                <th 
                  className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/5 border-x border-[var(--ui-border)]/60 min-w-[150px]"
                  title="Código de barras EAN-13 / barra física del producto para ventas rápidas con escáner"
                >
                  <div className="flex items-center gap-1.5">
                    <Barcode className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                    <span>Código de Barras</span>
                  </div>
                </th>

                {/* 3. Producto */}
                <th 
                  onClick={() => setSortBy(prev => prev === 'name_asc' ? 'name_desc' : 'name_asc')}
                  className="table-heading px-4 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Producto</span>
                    {sortBy === 'name_asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" /> : sortBy === 'name_desc' ? <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" /> : <ArrowUpDown className="w-3 h-3 text-[var(--ui-subtle)]" />}
                  </div>
                </th>

                {/* 4. Distribuidor / Proveedor */}
                <th 
                  onClick={() => setSortBy('supplier_asc')}
                  className="table-heading px-4 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors hidden md:table-cell min-w-[180px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Distribuidor / Proveedor</span>
                    {sortBy === 'supplier_asc' && <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />}
                  </div>
                </th>

                {/* 5. Categoría */}
                <th className="table-heading px-4 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] hidden lg:table-cell">
                  Categoría
                </th>

                {/* 6. Costo */}
                <th 
                  onClick={() => setSortBy(prev => prev === 'cost_asc' ? 'cost_desc' : 'cost_asc')}
                  className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] text-right cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Costo ($)</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--ui-subtle)]" />
                  </div>
                </th>

                {/* 7. PVP Venta */}
                <th 
                  onClick={() => setSortBy(prev => prev === 'price_asc' ? 'price_desc' : 'price_asc')}
                  className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] text-right cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>PVP Venta ($)</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--ui-subtle)]" />
                  </div>
                </th>

                {/* 8. Margen */}
                <th 
                  onClick={() => setSortBy('margin_desc')}
                  className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] text-right cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Margen (%)</span>
                    <ArrowUpDown className="w-3 h-3 text-[var(--ui-subtle)]" />
                  </div>
                </th>

                {/* 9. Stock */}
                <th 
                  onClick={() => setSortBy(prev => prev === 'stock_asc' ? 'stock_desc' : 'stock_asc')}
                  className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] text-center cursor-pointer hover:bg-[var(--ui-surface-hover)] transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Stock</span>
                    {sortBy === 'stock_asc' ? <ChevronUp className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" /> : sortBy === 'stock_desc' ? <ChevronDown className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" /> : <ArrowUpDown className="w-3 h-3 text-[var(--ui-subtle)]" />}
                  </div>
                </th>

                {/* 10. Acciones */}
                <th className="table-heading px-3 py-3 font-sans text-xs font-semibold text-[var(--ui-muted)] text-center w-[100px]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 px-4 text-center text-[var(--ui-subtle)] text-xs md:text-sm">
                    {candidateNewBarcode ? (
                      <div className="max-w-md mx-auto bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-2xl p-5 space-y-3 shadow-xs">
                        <div className="w-10 h-10 mx-auto rounded-xl bg-[var(--ui-warning-bg)] border border-[var(--ui-warning-border)] flex items-center justify-center text-[var(--ui-warning-text)]">
                          <ScanLine className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-sm md:text-base text-[var(--ui-text)]">
                            Producto nuevo detectado
                          </p>
                          <p className="text-xs md:text-sm text-[var(--ui-secondary)]">
                            No existe ningún producto registrado con el código{' '}
                            <span className="font-mono font-bold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-2 py-0.5 rounded">
                              {candidateNewBarcode}
                            </span>
                            .
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openNewProductModal(candidateNewBarcode)}
                            className="px-4 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold rounded-xl text-xs md:text-sm flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Añadir producto con este código</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setDetectedNewBarcode(null);
                            }}
                            className="px-3.5 py-2 bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)] border border-[var(--ui-border)] text-[var(--ui-secondary)] font-semibold rounded-xl text-xs md:text-sm transition-colors cursor-pointer"
                          >
                            Limpiar búsqueda
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span>No se encontraron productos coincidentes con los filtros seleccionados.</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedKardexProductId === product.id;
                  const isOutOfStock = product.stock === 0;
                  const isLowStock = product.stock > 0 && product.stock <= product.minStock;
                  const marginPercent = product.costPrice > 0 
                    ? ((product.salePrice - product.costPrice) / product.costPrice) * 100 
                    : 0;

                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedKardexProductId(product.id)}
                      className={`hover:bg-[var(--ui-surface-hover)] cursor-pointer transition-colors text-xs md:text-sm ${
                        isSelected ? 'bg-[var(--ui-surface-hover)] font-semibold' : ''
                      }`}
                    >
                      {/* 1. Código de Factura */}
                      <td className="px-3 py-3 font-mono text-xs font-bold text-[var(--ui-secondary)] whitespace-nowrap">
                        {product.code}
                      </td>

                      {/* 2. Código de Barras (DESTACADO / VACÍO HASTA ASIGNAR) */}
                      <td className="px-3 py-3 bg-[var(--ui-brand)]/2 border-x border-[var(--ui-border)]/40">
                        {product.barcode ? (
                          <button
                            type="button"
                            onClick={(e) => openEditModal(product, e)}
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 hover:bg-[var(--ui-brand)]/20 px-2 py-0.5 rounded transition-all cursor-pointer group"
                            title="Clic para modificar código de barras"
                          >
                            <Barcode className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                            <span>{product.barcode}</span>
                            <Edit2 className="w-2.5 h-2.5 text-[var(--ui-brand-strong)] opacity-0 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => openEditModal(product, e)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ui-subtle)] hover:text-[var(--ui-brand-strong)] hover:bg-[var(--ui-surface)] px-2 py-0.5 rounded border border-dashed border-[var(--ui-border)] hover:border-[var(--ui-brand)] transition-all cursor-pointer"
                            title="Clic para registrar código de barras"
                          >
                            <ScanLine className="w-3 h-3" />
                            <span>— (Vacío)</span>
                          </button>
                        )}
                      </td>

                      {/* 3. Nombre del Producto */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--ui-text)] leading-tight">
                          {product.name}
                        </div>
                      </td>

                      {/* 4. Distribuidor / Proveedor */}
                      <td className="px-4 py-3 hidden md:table-cell min-w-[180px]">
                        {product.distributor ? (
                          <span title={product.distributor} className={`inline-block max-w-[160px] truncate align-middle px-2 py-0.5 rounded text-[10px] font-semibold border ${getSupplierBadgeStyle(product.distributor)}`}>
                            {product.distributor}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--ui-subtle)]">General</span>
                        )}
                      </td>

                      {/* 5. Categoría */}
                      <td className="px-4 py-3 hidden lg:table-cell text-[var(--ui-secondary)]">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--ui-surface-hover)] text-[11px] font-medium">
                          {product.category}
                        </span>
                      </td>

                      {/* 6. Costo */}
                      <td className="px-3 py-3 font-mono text-right text-[var(--ui-muted)]">
                        ${formatCostPrice(product.costPrice)}
                      </td>

                      {/* 7. Sale Price (Interactive Button) */}
                      <td className="px-3 py-3 font-mono text-right font-bold text-[var(--ui-text)]">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(product, e)}
                          className="inline-flex items-center gap-1 hover:text-[var(--ui-brand-strong)] hover:bg-[var(--ui-brand)]/10 px-2 py-0.5 rounded transition-all group cursor-pointer"
                          title="Clic para modificar precio de venta o código"
                        >
                          <span>${product.salePrice.toFixed(2)}</span>
                          <Edit2 className="w-3 h-3 text-[var(--ui-brand-strong)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>

                      {/* 8. Margin % */}
                      <td className="px-3 py-3 font-mono text-right font-medium">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            marginPercent < 15
                              ? 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)]'
                              : marginPercent >= 25
                              ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]'
                              : 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)]'
                          }`}
                        >
                          {marginPercent.toFixed(1)}%
                        </span>
                      </td>

                      {/* 9. Stock Badge */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                            isOutOfStock
                              ? 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border border-[var(--ui-danger-border)]'
                              : isLowStock
                              ? 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border border-[var(--ui-warning-border)]'
                              : 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]'
                          }`}
                        >
                          {product.stock} un
                        </span>
                      </td>

                      {/* 10. Quick Actions */}
                      <td className="px-3 py-3 text-center space-x-1 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedKardexProductId(product.id);
                          }}
                          className="p-1.5 text-[var(--ui-muted)] hover:bg-[var(--ui-border)]/50 rounded-lg transition-colors inline-block cursor-pointer"
                          title="Ver Kardex"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => openEditModal(product, e)}
                          className="p-1.5 text-[var(--ui-brand-strong)] hover:bg-[var(--ui-brand)]/10 rounded-lg transition-colors inline-block cursor-pointer"
                          title="Editar Código de Barras y Precio"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => openDeleteModal(product, e)}
                          aria-label={`Eliminar producto ${product.name}`}
                          className="p-1.5 text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] rounded-lg transition-colors inline-block cursor-pointer"
                          title="Eliminar producto de raíz"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Kardex Slide-out Drawer */}
        {selectedProduct && (
          <aside className="w-full max-w-[420px] bg-[var(--ui-surface)] border-l border-[var(--ui-border)] shadow-[-4px_0_24px_rgba(0,0,0,0.06)] h-full flex flex-col shrink-0 z-20">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] flex justify-between items-start sticky top-0 z-10">
              <div className="overflow-hidden pr-2">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className="font-mono text-xs font-bold text-[var(--ui-muted)] bg-[var(--ui-surface-hover)] px-1.5 py-0.5 rounded" title="Código de Factura">
                    Factura: {selectedProduct.code}
                  </span>
                  {selectedProduct.barcode ? (
                    <span className="font-mono text-xs font-bold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-1.5 py-0.5 rounded" title="Código de Barras">
                      Barras: {selectedProduct.barcode}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-[var(--ui-subtle)] bg-[var(--ui-surface)] border border-[var(--ui-border)] px-1.5 py-0.5 rounded">
                      Barras: (Sin Asignar)
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-[var(--ui-secondary)] bg-[var(--ui-surface)] border border-[var(--ui-border)] px-2 py-0.5 rounded-full">
                    {selectedProduct.category}
                  </span>
                </div>
                <h3 className="font-bold text-base text-[var(--ui-text)] leading-tight truncate" title={selectedProduct.name}>
                  {selectedProduct.name}
                </h3>
                {selectedProduct.distributor && (
                  <p className="text-[11px] text-[var(--ui-brand-strong)] font-semibold mt-0.5">
                    Proveedor: {selectedProduct.distributor}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedKardexProductId(null)}
                className="p-1 text-[var(--ui-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)] rounded-lg transition-colors cursor-pointer"
                title="Cerrar detalle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Stats Grid */}
            <div className="p-4 grid grid-cols-3 gap-2 bg-[var(--ui-surface-muted)] border-b border-[var(--ui-border)] shrink-0 text-center font-mono">
              <div className="bg-[var(--ui-surface)] p-2.5 rounded-lg border border-[var(--ui-border)]">
                <div className="text-[10px] text-[var(--ui-muted)] uppercase font-sans font-semibold">Stock Actual</div>
                <div className={`text-lg font-black ${selectedProduct.stock === 0 ? 'text-[var(--ui-danger-text)]' : 'text-[var(--ui-brand-strong)]'}`}>
                  {selectedProduct.stock} un
                </div>
              </div>
              <div className="bg-[var(--ui-surface)] p-2.5 rounded-lg border border-[var(--ui-border)]">
                <div className="text-[10px] text-[var(--ui-muted)] uppercase font-sans font-semibold">PVP Venta</div>
                <div className="text-lg font-black text-[var(--ui-text)]">
                  ${selectedProduct.salePrice.toFixed(2)}
                </div>
              </div>
              <div className="bg-[var(--ui-surface)] p-2.5 rounded-lg border border-[var(--ui-border)]">
                <div className="text-[10px] text-[var(--ui-muted)] uppercase font-sans font-semibold">Costo Compra</div>
                <div className="text-lg font-black text-[var(--ui-muted)]">
                  ${formatCostPrice(selectedProduct.costPrice)}
                </div>
              </div>
            </div>

            {/* Quick Actions in Kardex */}
            <div className="p-3 bg-[var(--ui-surface)] border-b border-[var(--ui-border)] flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => setShowAdjustModal({ open: true, type: 'plus', productId: selectedProduct.id })}
                className="flex-1 py-1.5 px-2 bg-[var(--ui-brand-soft)] hover:bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] text-[var(--ui-brand-strong)] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Ajuste</span>
              </button>

              <button
                onClick={() => setShowAdjustModal({ open: true, type: 'minus', productId: selectedProduct.id })}
                className="flex-1 py-1.5 px-2 bg-[var(--ui-danger-bg)] hover:bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>- Merma</span>
              </button>

              <button
                onClick={openReturnModal}
                className="flex-1 py-1.5 px-2 bg-[var(--ui-info-bg)] hover:bg-[var(--ui-info-bg)] border border-[var(--ui-info-border)] text-[var(--ui-info-text)] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Registrar devolución de producto por cliente"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Devolución</span>
              </button>

              <button
                onClick={(e) => openEditModal(selectedProduct, e)}
                className="flex-1 py-1.5 px-2 bg-[var(--ui-surface-muted)] hover:bg-[var(--ui-surface-hover)] border border-[var(--ui-border)] text-[var(--ui-secondary)] font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Modificar precio o código de barras"
              >
                <Edit2 className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={(e) => openDeleteModal(selectedProduct, e)}
                aria-label={`Eliminar producto ${selectedProduct.name} del catálogo`}
                className="flex-1 py-1.5 px-2 bg-[var(--ui-danger-bg)] hover:bg-[var(--ui-danger-solid)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] hover:text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                title="Eliminar producto de raíz"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>

            {/* Kardex Movements Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="workspace-eyebrow text-xs font-semibold text-[var(--ui-muted)]">
                  Historial de Kardex ({productKardex.length})
                </span>
                <span className="text-[10px] text-[var(--ui-subtle)]">Orden Cronológico</span>
              </div>

              {productKardex.length === 0 ? (
                <div className="py-8 text-center text-[var(--ui-subtle)] text-xs">
                  Sin movimientos registrados para este producto.
                </div>
              ) : (
                productKardex.map((mov) => {
                  const isIngreso = mov.quantityChange > 0;
                  const isVenta = mov.type === 'VENTA';
                  const isCompra = mov.type === 'COMPRA';
                  const isDevolucion = mov.type === 'DEVOLUCION_CLIENTE' || mov.type === 'DEVOLUCION';

                  return (
                    <div
                      key={mov.id}
                      className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-3 shadow-2xs hover:border-[var(--ui-border-strong)] transition-colors relative text-xs"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              isCompra
                                ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]'
                                : isVenta
                                ? 'bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border border-[var(--ui-info-border)]'
                                : isDevolucion
                                ? 'bg-[var(--ui-purple-bg)] text-[var(--ui-purple-text)] border border-[var(--ui-purple-border)]'
                                : 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border border-[var(--ui-warning-border)]'
                            }`}
                          >
                            {mov.type}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ui-muted)]">
                            {mov.docNumber}
                          </span>
                        </div>

                        {/* Quantity change and Delete button */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isIngreso ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-danger-text)]'
                            }`}
                          >
                            {isIngreso ? `+${mov.quantityChange}` : mov.quantityChange} un
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMovement(mov.id, mov.type, mov.quantityChange);
                            }}
                            className="p-1 text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] rounded transition-colors cursor-pointer"
                            title="Eliminar este movimiento del Kardex y revertir balance"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--ui-secondary)] mb-1">
                        {mov.notes || 'Operación regular'}
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-[var(--ui-muted)] font-mono border-t border-dashed border-[var(--ui-border)] pt-1.5 mt-1.5">
                        <span>{mov.date} {mov.time}</span>
                        <span>Balance: <strong className="text-[var(--ui-text)]">{mov.balance} un</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal: Ajuste Manual de Stock */}
      {showAdjustModal && showAdjustModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="surface-card bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--ui-border)] pb-2">
              <h3 className="font-bold text-sm text-[var(--ui-text)]">
                {showAdjustModal.type === 'plus' ? 'Ingreso / Ajuste Positivo' : 'Merma / Ajuste Negativo'}
              </h3>
              <button
                onClick={() => setShowAdjustModal(null)}
                className="text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                Cantidad a {showAdjustModal.type === 'plus' ? 'Ingresar' : 'Restar'} (acepta decimales, ej: 25.5)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono font-bold text-base outline-none focus:border-[var(--ui-brand)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                Motivo / Justificación
              </label>
              <input
                type="text"
                placeholder={showAdjustModal.type === 'plus' ? 'Ej: Inventario físico inicial' : 'Ej: Producto caducado / daño'}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ui-border)]">
              <button
                onClick={() => setShowAdjustModal(null)}
                className="secondary-action px-3 py-1.5 text-xs font-semibold text-[var(--ui-muted)] hover:bg-[var(--ui-surface-hover)] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAdjust}
                className="primary-action px-4 py-1.5 text-xs font-semibold text-white bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] rounded-lg shadow-sm"
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Devolución de Cliente */}
      {showReturnModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="surface-card bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--ui-border)] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-[var(--ui-info-text)]" />
                <h3 className="font-bold text-base text-[var(--ui-text)]">
                  Devolución de Producto
                </h3>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[var(--ui-info-bg)] border border-[var(--ui-info-border)] rounded-xl text-xs text-[var(--ui-info-text)]">
              <div className="font-bold text-sm text-[var(--ui-info-text)]">{selectedProduct.name}</div>
              <div className="font-mono mt-0.5">Cód. Factura: {selectedProduct.code} | PVP: ${selectedProduct.salePrice.toFixed(2)}</div>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Cantidad de unidades a reingresar al inventario *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={returnQuantity}
                  onChange={(e) => {
                    const qty = Math.max(1, parseInt(e.target.value) || 1);
                    setReturnQuantity(qty);
                    setReturnRefundAmount((qty * selectedProduct.salePrice).toFixed(2));
                  }}
                  className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono font-bold text-sm outline-none focus:border-[var(--ui-info-text)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Motivo de la Devolución *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Cliente cambió de parecer / Error en cobro"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-info-text)]"
                />
              </div>

              <div className="pt-2 border-t border-[var(--ui-border)]">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={returnAffectsCash}
                    onChange={(e) => setReturnAffectsCash(e.target.checked)}
                    className="w-4 h-4 text-[var(--ui-info-text)] rounded border-[var(--ui-border)] focus:ring-0 cursor-pointer"
                  />
                  <span className="font-semibold text-[var(--ui-text)]">
                    ¿Reembolsar dinero en efectivo de la caja?
                  </span>
                </label>
              </div>

              {returnAffectsCash && (
                <div className="p-3 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl space-y-2">
                  <label className="block font-bold text-[var(--ui-danger-text)]">
                    Monto a retirar de caja ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-mono text-sm font-bold text-[var(--ui-muted)]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={returnRefundAmount}
                      onChange={(e) => setReturnRefundAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg font-mono font-bold text-sm text-[var(--ui-danger-text)] outline-none focus:border-[var(--ui-danger-text)]"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--ui-muted)]">
                    Se registrará automáticamente una salida de caja bajo "RETIRO (Devolución Cliente)".
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="secondary-action px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-lg border border-[var(--ui-border)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action px-4 py-2 text-xs font-semibold text-white bg-[var(--ui-info-solid)] hover:bg-[var(--ui-info-solid)] rounded-lg shadow-sm"
                >
                  Registrar Devolución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Producto (Nombre, Distribuidor, Código de Barras y Precios) */}
      {editProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="surface-card bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center border-b border-[var(--ui-border)] px-5 py-3.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Edit2 className="w-4 h-4 text-[var(--ui-brand-strong)]" />
                <h3 className="font-bold text-sm text-[var(--ui-text)]">
                  Editar Datos del Producto
                </h3>
              </div>
              <button
                onClick={() => setEditProductModal(null)}
                className="text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="p-5 space-y-3 text-xs overflow-y-auto flex-1 min-h-0">
              <div className="text-xs text-[var(--ui-muted)] bg-[var(--ui-surface-muted)] px-3 py-2 rounded-xl border border-[var(--ui-border)] font-mono flex justify-between gap-2">
                <span>Cód. Factura: {editProductModal.code}</span>
                <span className="text-[var(--ui-brand-strong)] font-bold truncate">
                  {editDistributor || 'Sin distribuidor'}
                </span>
              </div>

              {/* Nombre del Producto */}
              <div>
                <label className="block font-bold text-[var(--ui-text)] mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  aria-label="Nombre del producto"
                  placeholder="Nombre del producto..."
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-lg font-semibold text-xs sm:text-sm text-[var(--ui-text)] outline-none focus:ring-2 focus:ring-[var(--ui-brand)]/20"
                />
              </div>

              {/* Distribuidor */}
              <ProviderSelectorField
                providers={editProviders}
                selectedProviderId={editProviderId}
                onSelectProvider={(prov) => {
                  setEditProviderId(prov?.id);
                  setEditDistributor(prov?.name);
                }}
                onProviderCreated={addLocalEditProvider}
                labelClassName="text-xs font-semibold text-[var(--ui-secondary)]"
              />

              {/* Código de Barras */}
              <div>
                <label className="block font-bold text-[var(--ui-brand-strong)] mb-1 flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5" />
                  <span>Código de Barras (EAN-13 / Barra física)</span>
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    placeholder="Escanea o escribe el código de barras..."
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 bg-[var(--ui-surface)] border border-[var(--ui-brand)]/50 focus:border-[var(--ui-brand)] rounded-lg font-mono font-bold text-sm text-[var(--ui-brand-strong)] outline-none focus:ring-2 focus:ring-[var(--ui-brand)]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setCameraTarget('edit')}
                    aria-label="Escanear código de barras con cámara"
                    title="Escanear código con cámara"
                    className="px-3 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>Cámara</span>
                  </button>
                </div>
                <p className="text-[10px] text-[var(--ui-muted)] mt-0.5">
                  Este código permite vender el producto inmediatamente con la pistola lectora o cámara.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Precio de Compra / Costo ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-mono text-xs text-[var(--ui-muted)]">$</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    aria-label="Precio de Compra / Costo ($)"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono font-semibold text-xs outline-none focus:border-[var(--ui-brand)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--ui-brand-strong)] mb-1">
                  PVP Precio de Venta al Público ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-mono text-sm font-bold text-[var(--ui-brand-strong)]">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-[var(--ui-surface)] border-2 border-[var(--ui-brand)] rounded-xl font-mono font-black text-base text-[var(--ui-brand-strong)] outline-none focus:ring-2 focus:ring-[var(--ui-brand)]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                    Unidad de Medida
                  </label>
                  <select
                    value={editUnit}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEditUnit(next);
                      setEditAllowFraction(next === 'LIBRA' || next === 'KG' || next === 'GALON');
                    }}
                    className="w-full px-2.5 py-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
                  >
                    <option value="UNIDAD">UNIDAD</option>
                    <option value="LIBRA">LIBRA</option>
                    <option value="KG">KG</option>
                    <option value="GALON">GALON</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[var(--ui-text)]">
                    <input
                      type="checkbox"
                      checked={editAllowFraction}
                      onChange={(e) => setEditAllowFraction(e.target.checked)}
                      className="rounded border-[var(--ui-border)] accent-[var(--ui-brand)] w-3.5 h-3.5"
                    />
                    <span>Permite peso decimal</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Descripción / Combo Promo (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Promo: 6 x $1.00"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setEditProductModal(null)}
                  className="secondary-action px-3 py-1.5 text-xs font-semibold text-[var(--ui-muted)] hover:bg-[var(--ui-surface-hover)] rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action px-4 py-1.5 text-xs font-semibold text-white bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] rounded-lg shadow-sm cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteProductModal
        product={productToDelete}
        isDeleting={isDeletingProduct}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleConfirmDeleteProduct}
      />

      <BarcodeCameraModal
        isOpen={cameraTarget !== null}
        onClose={() => setCameraTarget(null)}
        onDetected={(scanned) => {
          if (cameraTarget === 'edit') {
            setEditBarcode(scanned);
            showToast(`Código asignado: ${scanned}`);
          } else {
            handleInventoryBarcodeScan(scanned);
          }
          setCameraTarget(null);
        }}
        title={
          cameraTarget === 'edit'
            ? 'Asignar Código de Barras con Cámara'
            : 'Buscar Producto por Código'
        }
        subtitle={
          cameraTarget === 'edit'
            ? 'Escanea el código del producto para guardarlo en su ficha'
            : 'Apunta la cámara al producto para localizarlo en el inventario'
        }
      />
    </div>
  );
};
