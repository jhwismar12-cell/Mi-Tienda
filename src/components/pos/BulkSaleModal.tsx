import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scale,
  Search,
  X,
  PackageOpen,
  DollarSign,
  Tag,
  Plus,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  ShoppingCart
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { canAutoFocusInput } from '../../utils/responsive';
import { BulkProductCreateForm, isBulkEligibleProduct } from './BulkProductCreateForm';
import {
  BULK_SUBCATEGORIES,
  BulkSubcategory,
  ParsedPromo,
  classifyBulkSubcategory,
  extractNoteFromDescription,
  parsePromoFromDescription,
  parsePromosFromDescription,
  serializePromosToDescription
} from './bulkCategories';

export type { ParsedPromo };
export { parsePromoFromDescription, parsePromosFromDescription };

export function formatUnitShort(unit?: string): string {
  const u = (unit || 'UNIDAD').toUpperCase();
  if (u === 'LIBRA') return 'lb';
  if (u === 'KG') return 'kg';
  if (u === 'GALON') return 'gal';
  return 'un';
}

interface BulkSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkSaleModal: React.FC<BulkSaleModalProps> = ({ isOpen, onClose }) => {
  const { products, cart, addProductToCart, updateProduct, setActiveScreen, showToast } = useStore();
  const [tab, setTab] = useState<'bulk' | 'all_unbarcoded'>('bulk');
  const [bulkSubcategory, setBulkSubcategory] = useState<BulkSubcategory>('all');
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState<'list' | 'detail'>('list');
  const [weightInput, setWeightInput] = useState<string>('1');
  const [dollarInput, setDollarInput] = useState<string>('1.00');
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createInitialName, setCreateInitialName] = useState('');

  // Multi-item session feedback (modal stays open until cashier clicks "Productos de Granel Listos")
  const [addedCount, setAddedCount] = useState(0);
  const [lastAddedFeedback, setLastAddedFeedback] = useState<string | null>(null);

  // Inline named combo editor state
  const [isAddingCombo, setIsAddingCombo] = useState(false);
  const [newComboName, setNewComboName] = useState('');
  const [newComboQty, setNewComboQty] = useState('');
  const [newComboTotal, setNewComboTotal] = useState('');
  const [comboError, setComboError] = useState<string | null>(null);
  const [isSavingCombo, setIsSavingCombo] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const openCreateMode = (prefillName = '') => {
    setCreateInitialName(prefillName);
    setIsCreateMode(true);
  };

  const unbarcodedProducts = useMemo(() => {
    return products.filter(p => !p.barcode || p.barcode.trim() === '');
  }, [products]);

  // Include all bulk-eligible, tobacco & stationery products (even if they also have a barcode)
  const bulkProducts = useMemo(() => {
    return products.filter(isBulkEligibleProduct);
  }, [products]);

  const subcategoryCounts = useMemo(() => {
    const counts: Record<BulkSubcategory, number> = {
      all: bulkProducts.length,
      verdes: 0,
      granos_harinas: 0,
      tabacos: 0,
      papeleria: 0,
      otros: 0
    };
    for (const p of bulkProducts) {
      counts[classifyBulkSubcategory(p)] += 1;
    }
    return counts;
  }, [bulkProducts]);

  const filteredList = useMemo(() => {
    let base = tab === 'bulk' ? bulkProducts : unbarcodedProducts;
    if (tab === 'bulk' && bulkSubcategory !== 'all') {
      base = base.filter(p => classifyBulkSubcategory(p) === bulkSubcategory);
    }
    const q = search.trim().toLowerCase();
    const matched = !q
      ? base
      : base.filter(
          p =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
    // Keep available stock first, then alphabetical
    return [...matched].sort((a, b) => {
      const aHas = a.stock > 0 ? 1 : 0;
      const bHas = b.stock > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return a.name.localeCompare(b.name);
    });
  }, [tab, bulkSubcategory, bulkProducts, unbarcodedProducts, search]);

  const selectedProduct: Product | null = useMemo(() => {
    if (!filteredList.length) return null;
    if (selectedProductId) {
      const found = filteredList.find(p => p.id === selectedProductId);
      if (found) return found;
    }
    return filteredList[0];
  }, [filteredList, selectedProductId]);

  const cartTotal = useMemo(() => {
    return Number(cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  }, [cart]);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setBulkSubcategory('all');
    setMobileStep('list');
    setIsCreateMode(false);
    setCreateInitialName('');
    setAddedCount(0);
    setLastAddedFeedback(null);
    setIsAddingCombo(false);
    setComboError(null);
    const t = canAutoFocusInput()
      ? setTimeout(() => searchRef.current?.focus(), 40)
      : undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      if (t !== undefined) clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selectedProduct) return;
    setWeightInput(selectedProduct.allowFraction ? '0.5' : '1');
    setDollarInput('1.00');
    setIsAddingCombo(false);
    setNewComboName('');
    setNewComboQty('');
    setNewComboTotal('');
    setComboError(null);
  }, [selectedProduct?.id]);

  if (!isOpen) return null;

  const selectedPromos = selectedProduct ? parsePromosFromDescription(selectedProduct.description) : [];
  const selectedUnitShort = formatUnitShort(selectedProduct?.unit);
  const weightNum = parseFloat(weightInput.replace(',', '.')) || 0;
  const dollarNum = parseFloat(dollarInput.replace(',', '.')) || 0;

  const computeDollarSelection = (prod: Product, dollars: number) => {
    if (!Number.isFinite(dollars) || dollars <= 0) return null;
    const promos = parsePromosFromDescription(prod.description);
    for (const promo of promos) {
      if (Math.abs(dollars % promo.total) < 1e-4) {
        const mult = Math.round(dollars / promo.total);
        if (mult >= 1) {
          const qty = Number((mult * promo.qty).toFixed(3));
          return {
            qty,
            unitPrice: Number((promo.total / promo.qty).toFixed(6)),
            subtotal: Number((mult * promo.total).toFixed(2)),
            promoLabel: mult === 1 ? promo.label : `${mult}×(${promo.label})`
          };
        }
      }
    }
    if (prod.salePrice <= 0) return null;
    if (prod.allowFraction) {
      const qty = Number((dollars / prod.salePrice).toFixed(3));
      if (qty <= 0) return null;
      return {
        qty,
        unitPrice: prod.salePrice,
        subtotal: Number((qty * prod.salePrice).toFixed(2)),
        promoLabel: `$${dollars.toFixed(2)}`
      };
    }
    const qty = Math.floor(dollars / prod.salePrice + 1e-6);
    if (qty <= 0) return null;
    return {
      qty,
      unitPrice: prod.salePrice,
      subtotal: Number((qty * prod.salePrice).toFixed(2)),
      promoLabel: undefined
    };
  };

  const recordAdded = (summary: string) => {
    setAddedCount(prev => prev + 1);
    setLastAddedFeedback(summary);
    setMobileStep('list');
  };

  const handleAddWeight = (qtyOverride?: number) => {
    if (!selectedProduct) return;
    const qty = qtyOverride ?? weightNum;
    if (!Number.isFinite(qty) || qty <= 0) return;
    addProductToCart(selectedProduct, qty);
    recordAdded(`${qty} ${selectedUnitShort} · ${selectedProduct.name}`);
  };

  const handleAddPromo = (prod: Product, promo: ParsedPromo) => {
    const unitPrice = Number((promo.total / promo.qty).toFixed(6));
    addProductToCart(prod, promo.qty, { unitPrice, promoLabel: promo.label });
    recordAdded(`${promo.label} · ${prod.name}`);
  };

  const handleAddByDollar = (dollarsOverride?: number) => {
    if (!selectedProduct) return;
    const d = dollarsOverride ?? dollarNum;
    const calc = computeDollarSelection(selectedProduct, d);
    if (!calc) return;
    addProductToCart(selectedProduct, calc.qty, {
      unitPrice: calc.unitPrice,
      promoLabel: calc.promoLabel
    });
    recordAdded(`$${d.toFixed(2)} (${calc.qty} ${selectedUnitShort}) · ${selectedProduct.name}`);
  };

  const handleSaveNewCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || isSavingCombo) return;

    const cleanName = newComboName.trim();
    const qty = parseFloat(newComboQty.replace(',', '.'));
    const total = parseFloat(newComboTotal.replace(',', '.'));

    if (!cleanName) {
      setComboError('Escribe un nombre para el combo (ej: Cubeta de huevos).');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setComboError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setComboError('El precio total del combo debe ser mayor a $0.00.');
      return;
    }

    const existingPromos = parsePromosFromDescription(selectedProduct.description);
    const existingNote = extractNoteFromDescription(selectedProduct.description);
    const nextDescription = serializePromosToDescription(
      [
        ...existingPromos.map(p => ({ name: p.name, qty: p.qty, total: p.total })),
        { name: cleanName, qty, total }
      ],
      existingNote
    );

    setComboError(null);
    setIsSavingCombo(true);
    try {
      await updateProduct(selectedProduct.id, { description: nextDescription ?? '' });
      setIsAddingCombo(false);
      setNewComboName('');
      setNewComboQty('');
      setNewComboTotal('');
      showToast(`Combo "${cleanName}" agregado a ${selectedProduct.name}`);
    } catch (err) {
      setComboError(err instanceof Error ? err.message : 'No se pudo guardar el combo.');
    } finally {
      setIsSavingCombo(false);
    }
  };

  const handleDeleteCombo = async (indexToRemove: number) => {
    if (!selectedProduct || isSavingCombo) return;
    const existingPromos = parsePromosFromDescription(selectedProduct.description);
    const existingNote = extractNoteFromDescription(selectedProduct.description);
    const remaining = existingPromos
      .filter((_, idx) => idx !== indexToRemove)
      .map(p => ({ name: p.name, qty: p.qty, total: p.total }));
    const nextDescription = serializePromosToDescription(remaining, existingNote) ?? '';

    setIsSavingCombo(true);
    try {
      await updateProduct(selectedProduct.id, { description: nextDescription });
      showToast('Combo eliminado');
    } catch (err) {
      setComboError(err instanceof Error ? err.message : 'No se pudo eliminar el combo.');
    } finally {
      setIsSavingCombo(false);
    }
  };

  const dollarPreview = selectedProduct ? computeDollarSelection(selectedProduct, dollarNum) : null;
  const fractionPresets = [0.25, 0.5, 1, 1.5, 2, 3];
  const unitPresets = [1, 2, 3, 4, 6, 9, 12];
  const dollarPresets = [0.25, 0.5, 1.0, 1.5, 2.0, 5.0];

  const parsedNewComboQty = parseFloat(newComboQty.replace(',', '.'));
  const parsedNewComboTotal = parseFloat(newComboTotal.replace(',', '.'));
  const hasValidNewComboPreview =
    Number.isFinite(parsedNewComboQty) &&
    parsedNewComboQty > 0 &&
    Number.isFinite(parsedNewComboTotal) &&
    parsedNewComboTotal > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-[var(--ui-surface)] border-0 sm:border border-[var(--ui-border)] rounded-none sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--ui-chrome)] text-white px-5 py-3.5 flex items-center justify-between border-b border-[var(--ui-border-strong)] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--ui-brand)] flex items-center justify-center text-[var(--ui-mint)] shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base leading-tight truncate">
                Granel, Verdes, Granos, Tabacos y Papelería
              </h2>
              <p className="text-[11px] text-white/70 truncate">
                Agrega varios productos y combos; al terminar presiona "Productos de Granel Listos"
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isCreateMode && (
              <button
                type="button"
                onClick={() => openCreateMode()}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--ui-brand)] hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 transition-opacity cursor-pointer"
                title="Crear producto a granel, combo o sin código"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Granel</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isCreateMode ? (
          <BulkProductCreateForm
            initialName={createInitialName}
            initialGroup={bulkSubcategory}
            onCancel={() => {
              setIsCreateMode(false);
              setCreateInitialName('');
            }}
            onCreated={(created) => {
              const eligible = isBulkEligibleProduct(created);
              setTab(eligible ? 'bulk' : 'all_unbarcoded');
              setBulkSubcategory(eligible ? classifyBulkSubcategory(created) : 'all');
              setSearch('');
              setSelectedProductId(created.id);
              setIsCreateMode(false);
              setCreateInitialName('');
              setMobileStep('detail');
            }}
          />
        ) : (
          <>
            {/* Search & Tabs */}
            <div
              className={`p-3 sm:p-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] flex-col gap-2.5 shrink-0 ${
                mobileStep === 'detail' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
                <div className="flex bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-1 gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTab('bulk')}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors truncate cursor-pointer ${
                      tab === 'bulk'
                        ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                        : 'text-[var(--ui-secondary)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    ⚖️ Granel y Más ({bulkProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('all_unbarcoded')}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors truncate cursor-pointer ${
                      tab === 'all_unbarcoded'
                        ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                        : 'text-[var(--ui-secondary)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    📦 Todos sin Código ({unbarcodedProducts.length})
                  </button>
                </div>

                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar arroz, tomate, huevo, maduro, lenteja, limón..."
                    className="w-full pl-9 pr-8 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-sm text-[var(--ui-text)] outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-2.5 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Subcategory filter pills for Granel */}
              {tab === 'bulk' && (
                <div
                  className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
                  role="tablist"
                  aria-label="Categorías de granel"
                >
                  {BULK_SUBCATEGORIES.filter(
                    (sub) => sub.key !== 'otros' || subcategoryCounts.otros > 0
                  ).map((sub) => {
                    const active = bulkSubcategory === sub.key;
                    const count = subcategoryCounts[sub.key];
                    return (
                      <button
                        key={sub.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setBulkSubcategory(sub.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)] shadow-xs'
                            : 'bg-[var(--ui-surface)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:border-[var(--ui-brand)] hover:text-[var(--ui-text)]'
                        }`}
                      >
                        <span>{sub.emoji}</span>
                        <span>{sub.label}</span>
                        <span className={`font-mono text-[10px] ${active ? 'opacity-90' : 'opacity-70'}`}>
                          ({count})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Content Split */}
            <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 overflow-hidden">
              {/* Left Product List */}
              <div
                className={`${
                  mobileStep === 'list' ? 'flex-1' : 'hidden lg:block'
                } lg:col-span-7 overflow-y-auto p-3 sm:p-4 lg:border-r border-[var(--ui-border)]`}
              >
                {filteredList.length === 0 ? (
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center text-[var(--ui-muted)] p-6">
                    <PackageOpen className="w-10 h-10 mb-2 opacity-40" />
                    <p className="font-semibold text-sm text-[var(--ui-text)]">No se encontraron productos</p>
                    <p className="text-xs mt-1">Prueba cambiando de pestaña, buscando otro nombre o créalo aquí mismo.</p>
                    <button
                      type="button"
                      onClick={() => openCreateMode(search.trim())}
                      className="mt-3 px-3.5 py-2 rounded-xl bg-[var(--ui-brand)] hover:opacity-90 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        {search.trim()
                          ? `Crear "${search.trim()}" sin código`
                          : 'Crear producto a granel o sin código'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredList.map(prod => {
                      const promos = parsePromosFromDescription(prod.description);
                      const unitShort = formatUnitShort(prod.unit);
                      const isSelected = selectedProduct?.id === prod.id;
                      const outOfStock = prod.stock <= 0;
                      const subMeta =
                        tab === 'bulk' && bulkSubcategory === 'all'
                          ? BULK_SUBCATEGORIES.find(s => s.key === classifyBulkSubcategory(prod))
                          : undefined;

                      return (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setSelectedProductId(prod.id);
                            setMobileStep('detail');
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'border-[var(--ui-brand)] bg-[var(--ui-brand-soft)] shadow-xs ring-1 ring-[var(--ui-brand)]/30'
                              : 'border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-xs sm:text-sm text-[var(--ui-text)] truncate">
                                {prod.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] text-[var(--ui-secondary)] font-semibold uppercase">
                                  {prod.unit || 'UNIDAD'}
                                </span>
                                {subMeta && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] font-semibold">
                                    {subMeta.emoji} {subMeta.label}
                                  </span>
                                )}
                                {outOfStock ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)]">
                                    Stock: 0
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-semibold text-[var(--ui-brand-strong)]">
                                    Stock: {prod.stock} {unitShort}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-black text-sm text-[var(--ui-brand-strong)]">
                                ${prod.salePrice.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-[var(--ui-muted)]">por {unitShort}</div>
                            </div>
                          </div>

                          {promos.length > 0 && (
                            <div className="space-y-1">
                              {promos.slice(0, 2).map((promo, pIdx) => (
                                <button
                                  key={`${prod.id}-promo-${pIdx}`}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProductId(prod.id);
                                    handleAddPromo(prod, promo);
                                  }}
                                  className="w-full py-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center justify-between gap-1 transition-colors cursor-pointer"
                                >
                                  <span className="flex items-center gap-1 min-w-0 truncate">
                                    <Tag className="w-3 h-3 shrink-0" />
                                    <span className="truncate">Combo {promo.label}</span>
                                  </span>
                                  <span className="text-[10px] underline shrink-0">+ Agregar</span>
                                </button>
                              ))}
                              {promos.length > 2 && (
                                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold text-right">
                                  +{promos.length - 2} combo(s) más en detalle
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Action Panel */}
              <div
                className={`${
                  mobileStep === 'detail' ? 'flex-1' : 'hidden lg:flex'
                } lg:col-span-5 overflow-y-auto p-3.5 sm:p-4 bg-[var(--ui-surface-muted)]/40 flex flex-col gap-3`}
              >
                {selectedProduct ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMobileStep('list')}
                      className="lg:hidden w-full py-2.5 px-3 rounded-xl bg-[var(--ui-surface)] border border-[var(--ui-border-strong)] text-xs font-bold text-[var(--ui-text)] flex items-center justify-between gap-2 shadow-xs cursor-pointer shrink-0"
                    >
                      <span className="flex items-center gap-1.5">
                        <ArrowLeft className="w-4 h-4 text-[var(--ui-brand-strong)]" />
                        <span>Volver a la lista de productos</span>
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ui-muted)]">
                        {filteredList.length} disp.
                      </span>
                    </button>

                    <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono text-[var(--ui-muted)]">{selectedProduct.code}</span>
                          <h3 className="font-bold text-base text-[var(--ui-text)] leading-snug">
                            {selectedProduct.name}
                          </h3>
                          <p className="text-xs text-[var(--ui-secondary)]">
                            {selectedProduct.category} · Medida: <strong>{selectedProduct.unit || 'UNIDAD'}</strong>
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-black text-lg text-[var(--ui-brand-strong)]">
                            ${selectedProduct.salePrice.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-[var(--ui-muted)]">/ {selectedUnitShort}</div>
                        </div>
                      </div>

                      {selectedProduct.stock <= 0 ? (
                        <div className="p-2.5 rounded-lg bg-[var(--ui-warning-bg)] border border-[var(--ui-warning-border)] text-[var(--ui-warning-text)] text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Stock actual: 0 (venta permitida sin stock)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              setActiveScreen('inventory');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[var(--ui-text)] font-bold text-[11px] hover:bg-[var(--ui-surface-hover)] shrink-0 cursor-pointer"
                          >
                            <span>Cargar stock</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-[var(--ui-brand-strong)]">
                          Disponible: <span className="font-mono font-bold">{selectedProduct.stock} {selectedUnitShort}</span>
                        </div>
                      )}
                    </div>

                    {/* Named Multi-Combos Section (available on EVERY granel product) */}
                    <div className="bg-[var(--ui-surface)] border border-amber-500/40 rounded-xl p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" />
                          <span>Combos Rápidos ({selectedPromos.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingCombo(prev => !prev);
                            setComboError(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-800 dark:text-amber-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isAddingCombo ? 'Cancelar' : 'Agregar Combo'}</span>
                        </button>
                      </div>

                      {selectedPromos.length > 0 && (
                        <div className="space-y-1.5">
                          {selectedPromos.map((promo, idx) => (
                            <div key={`detail-promo-${idx}`} className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleAddPromo(selectedProduct, promo)}
                                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm flex items-center justify-between gap-2 shadow-xs transition-colors cursor-pointer"
                              >
                                <span className="flex items-center gap-1.5 min-w-0 truncate">
                                  <Plus className="w-4 h-4 shrink-0" />
                                  <span className="truncate">{promo.label}</span>
                                </span>
                                <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded shrink-0">
                                  -{promo.qty} {selectedUnitShort}
                                </span>
                              </button>
                              <button
                                type="button"
                                disabled={isSavingCombo}
                                onClick={() => handleDeleteCombo(idx)}
                                title="Eliminar este combo"
                                aria-label={`Eliminar combo ${promo.label}`}
                                className="p-2 rounded-xl border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] hover:border-[var(--ui-danger-border)] transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedPromos.length === 0 && !isAddingCombo && (
                        <p className="text-[11px] text-[var(--ui-muted)]">
                          Sin combos todavía. Crea uno (ej. <strong>Cubeta de huevos</strong>: 30 × $4.50) para venderlo en 1 toque y descontar las unidades exactas del stock.
                        </p>
                      )}

                      {isAddingCombo && (
                        <form
                          onSubmit={handleSaveNewCombo}
                          className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2"
                        >
                          <div>
                            <label className="block text-[11px] font-bold text-[var(--ui-secondary)] mb-1">
                              Nombre del combo *
                            </label>
                            <input
                              type="text"
                              value={newComboName}
                              onChange={(e) => setNewComboName(e.target.value)}
                              placeholder="Ej: Cubeta de huevos, Media docena, Paquete..."
                              className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-amber-500 rounded-lg text-xs text-[var(--ui-text)] outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-[var(--ui-secondary)] mb-1">
                                Cantidad ({selectedUnitShort}) *
                              </label>
                              <input
                                type="number"
                                min={selectedProduct.allowFraction ? '0.01' : '1'}
                                step={selectedProduct.allowFraction ? '0.01' : '1'}
                                value={newComboQty}
                                onChange={(e) => setNewComboQty(e.target.value)}
                                placeholder="Ej: 30"
                                className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-amber-500 rounded-lg font-mono text-xs text-[var(--ui-text)] outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-[var(--ui-secondary)] mb-1">
                                Precio total ($) *
                              </label>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={newComboTotal}
                                onChange={(e) => setNewComboTotal(e.target.value)}
                                placeholder="Ej: 4.50"
                                className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-amber-500 rounded-lg font-mono text-xs text-[var(--ui-text)] outline-none"
                              />
                            </div>
                          </div>
                          {hasValidNewComboPreview && (
                            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                              Descuenta {parsedNewComboQty} {selectedUnitShort} · $
                              {(parsedNewComboTotal / parsedNewComboQty).toFixed(3)} c/{selectedUnitShort}
                            </p>
                          )}
                          {comboError && (
                            <p className="text-[11px] font-semibold text-[var(--ui-danger-text)]">
                              {comboError}
                            </p>
                          )}
                          <button
                            type="submit"
                            disabled={isSavingCombo}
                            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isSavingCombo ? 'Guardando...' : 'Guardar Combo'}</span>
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Mode 1: By weight or quantity */}
                    <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--ui-text)] flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                          {selectedProduct.allowFraction
                            ? `Por peso / cantidad (${selectedUnitShort})`
                            : `Por cantidad (${selectedUnitShort})`}
                        </span>
                        {weightNum > 0 && (
                          <span className="text-xs font-mono font-bold text-[var(--ui-brand-strong)]">
                            Total: ${(weightNum * selectedProduct.salePrice).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(selectedProduct.allowFraction ? fractionPresets : unitPresets).map(preset => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleAddWeight(preset)}
                            className="px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] hover:border-[var(--ui-brand)] hover:bg-[var(--ui-brand-soft)] font-mono font-bold text-xs text-[var(--ui-text)] transition-colors cursor-pointer"
                          >
                            {preset} {selectedUnitShort}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <input
                          type="number"
                          step={selectedProduct.allowFraction ? '0.01' : '1'}
                          min={selectedProduct.allowFraction ? '0.01' : '1'}
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddWeight();
                            }
                          }}
                          className="flex-1 min-w-0 px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl font-mono font-bold text-sm text-[var(--ui-text)] outline-none"
                        />
                        <button
                          type="button"
                          disabled={weightNum <= 0}
                          onClick={() => handleAddWeight()}
                          className="primary-action shrink-0 whitespace-nowrap px-4 py-2 rounded-xl bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Agregar</span>
                        </button>
                      </div>
                    </div>

                    {/* Mode 2: By dollar amount ("Deme $...") */}
                    <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--ui-text)] flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                          Vender por Valor ("Deme $...")
                        </span>
                        {dollarPreview && (
                          <span className="text-[11px] font-mono font-bold text-[var(--ui-brand-strong)]">
                            = {dollarPreview.qty} {selectedUnitShort}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {dollarPresets.map(d => {
                          const sim = computeDollarSelection(selectedProduct, d);
                          return (
                            <button
                              key={d}
                              type="button"
                              disabled={!sim}
                              onClick={() => handleAddByDollar(d)}
                              className="px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] hover:border-[var(--ui-brand)] hover:bg-[var(--ui-brand-soft)] disabled:opacity-40 disabled:cursor-not-allowed font-mono font-bold text-xs text-[var(--ui-text)] transition-colors cursor-pointer"
                            >
                              ${d.toFixed(2)}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <div className="relative flex-1 min-w-0">
                          <span className="absolute left-3 top-2 font-mono font-bold text-sm text-[var(--ui-muted)]">$</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            value={dollarInput}
                            onChange={(e) => setDollarInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddByDollar();
                              }
                            }}
                            className="w-full pl-7 pr-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl font-mono font-bold text-sm text-[var(--ui-text)] outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={!dollarPreview}
                          onClick={() => handleAddByDollar()}
                          className="primary-action shrink-0 whitespace-nowrap px-4 py-2 rounded-xl bg-[var(--ui-chrome)] hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Vender ${dollarNum > 0 ? dollarNum.toFixed(2) : '0.00'}</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--ui-muted)]">
                    Selecciona un producto de la lista izquierda.
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Bottom Bar: Multi-product status + "Productos de Granel Listos" exit CTA */}
            <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[var(--ui-surface)] border-t border-[var(--ui-border-strong)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0 text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] font-semibold text-[var(--ui-text)] shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                  <span>
                    Carrito: {cart.length} {cart.length === 1 ? 'art.' : 'arts.'}
                  </span>
                  <span className="font-mono font-bold text-[var(--ui-brand-strong)]">
                    (${cartTotal.toFixed(2)})
                  </span>
                </div>
                {lastAddedFeedback ? (
                  <span className="text-[var(--ui-brand-strong)] font-semibold truncate flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Agregado ({addedCount}): {lastAddedFeedback}
                    </span>
                  </span>
                ) : (
                  <span className="text-[var(--ui-muted)] truncate hidden sm:inline">
                    Puedes agregar varios productos seguidos antes de volver a caja
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <CheckCircle2 className="w-4 h-4 text-[var(--ui-mint)]" />
                <span>
                  Productos de Granel Listos{addedCount > 0 ? ` (${addedCount})` : ''}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
