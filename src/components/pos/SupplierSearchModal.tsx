import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Search,
  X,
  Plus,
  Minus,
  ShoppingBag,
  Tag,
  PackageOpen,
  Check
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import { formatUnitShort } from './BulkSaleModal';

export const ALL_SUPPLIERS_KEY = '__ALL__';
export const NO_SUPPLIER_KEY = '__NONE__';

interface SupplierSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplier?: string | null;
}

export interface SupplierGroupSummary {
  key: string;
  label: string;
  count: number;
}

export function buildSupplierGroups(products: Product[]): SupplierGroupSummary[] {
  const counts = new Map<string, number>();
  let unassignedCount = 0;

  for (const p of products) {
    const sup = (p.distributor || '').trim();
    if (sup) {
      counts.set(sup, (counts.get(sup) || 0) + 1);
    } else {
      unassignedCount += 1;
    }
  }

  const namedGroups: SupplierGroupSummary[] = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
    .map(([label, count]) => ({ key: label, label, count }));

  const groups: SupplierGroupSummary[] = [
    { key: ALL_SUPPLIERS_KEY, label: 'Todos los proveedores', count: products.length },
    ...namedGroups
  ];

  if (unassignedCount > 0) {
    groups.push({ key: NO_SUPPLIER_KEY, label: 'Sin proveedor asignado', count: unassignedCount });
  }

  return groups;
}

export const SupplierSearchModal: React.FC<SupplierSearchModalProps> = ({
  isOpen,
  onClose,
  initialSupplier
}) => {
  const { products, cart, addProductToCart, updateCartQuantity, showToast } = useStore();
  const [selectedSupplier, setSelectedSupplier] = useState<string>(ALL_SUPPLIERS_KEY);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const productSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedSupplier(initialSupplier || ALL_SUPPLIERS_KEY);
      setSupplierFilter('');
      setProductSearch('');
      setSelectedCategory('ALL');
      setTimeout(() => productSearchRef.current?.focus(), 60);
    }
  }, [isOpen, initialSupplier]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const supplierGroups = useMemo(() => buildSupplierGroups(products), [products]);

  const visibleSuppliers = useMemo(() => {
    const q = supplierFilter.trim().toLowerCase();
    if (!q) return supplierGroups;
    return supplierGroups.filter(
      g => g.key === ALL_SUPPLIERS_KEY || g.label.toLowerCase().includes(q)
    );
  }, [supplierGroups, supplierFilter]);

  const productsForSupplier = useMemo(() => {
    if (selectedSupplier === ALL_SUPPLIERS_KEY) return products;
    if (selectedSupplier === NO_SUPPLIER_KEY) {
      return products.filter(p => !(p.distributor || '').trim());
    }
    return products.filter(p => (p.distributor || '').trim() === selectedSupplier);
  }, [products, selectedSupplier]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    productsForSupplier.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [productsForSupplier]);

  useEffect(() => {
    setSelectedCategory('ALL');
  }, [selectedSupplier]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return productsForSupplier
      .filter(p => {
        const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
        if (!matchesCat) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.distributor && p.distributor.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [productsForSupplier, selectedCategory, productSearch]);

  const cartSummary = useMemo(() => {
    const totalItems = cart.length;
    const totalAmount = Number(cart.reduce((sum, it) => sum + it.subtotal, 0).toFixed(2));
    return { totalItems, totalAmount };
  }, [cart]);

  if (!isOpen) return null;

  const activeSupplierLabel =
    supplierGroups.find(g => g.key === selectedSupplier)?.label || 'Todos los proveedores';

  const getCartEntry = (productId: string) => {
    const index = cart.findIndex(it => it.product.id === productId && !it.promoLabel);
    if (index === -1) return null;
    return { index, item: cart[index] };
  };

  const handleAddProduct = (product: Product) => {
    addProductToCart(product, 1);
    showToast(`"${product.name}" agregado al carrito`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[var(--ui-border)] bg-[var(--ui-chrome)] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-[var(--ui-mint)]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base sm:text-lg leading-tight truncate">
                Buscar y Vender por Proveedor
              </h2>
              <p className="text-[11px] text-white/75 truncate">
                Encuentra productos agrupados por distribuidor sin usar escáner de código de barras
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar búsqueda por proveedor"
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Left Suppliers List + Right Product Catalog */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left Panel: Suppliers */}
          <div className="md:w-72 border-b md:border-b-0 md:border-r border-[var(--ui-border)] bg-[var(--ui-surface-muted)] flex flex-col shrink-0 max-h-48 md:max-h-none">
            <div className="p-2.5 border-b border-[var(--ui-border)]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--ui-muted)] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={supplierFilter}
                  onChange={e => setSupplierFilter(e.target.value)}
                  placeholder="Filtrar distribuidor..."
                  className="w-full pl-8 pr-7 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
                {supplierFilter && (
                  <button
                    type="button"
                    onClick={() => setSupplierFilter('')}
                    aria-label="Limpiar filtro de proveedor"
                    className="absolute right-2 top-2 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto md:overflow-y-auto p-2 flex md:flex-col gap-1.5">
              {visibleSuppliers.map(group => {
                const isActive = selectedSupplier === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      setSelectedSupplier(group.key);
                      setTimeout(() => productSearchRef.current?.focus(), 20);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 text-left transition-all shrink-0 md:shrink cursor-pointer border ${
                      isActive
                        ? 'bg-[var(--ui-chrome)] text-white border-[var(--ui-chrome)] font-bold shadow-xs'
                        : 'bg-[var(--ui-surface)] text-[var(--ui-text)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] font-medium'
                    }`}
                  >
                    <span className="truncate">{group.label}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]'
                      }`}
                    >
                      {group.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Products for selected supplier */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[var(--ui-surface)]">
            <div className="p-3 sm:p-4 border-b border-[var(--ui-border)] space-y-2.5 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-2.5 py-1 rounded-lg truncate">
                    {activeSupplierLabel}
                  </span>
                  <span className="text-xs font-mono text-[var(--ui-muted)] shrink-0">
                    ({filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'})
                  </span>
                </div>

                {selectedSupplier !== ALL_SUPPLIERS_KEY && (
                  <button
                    type="button"
                    onClick={() => setSelectedSupplier(ALL_SUPPLIERS_KEY)}
                    className="text-xs font-semibold text-[var(--ui-brand-strong)] hover:underline text-left sm:text-right cursor-pointer shrink-0"
                  >
                    Ver todos los proveedores
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5" />
                <input
                  ref={productSearchRef}
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder={`Buscar producto en ${activeSupplierLabel} (nombre, código o categoría)...`}
                  className="w-full pl-9 pr-8 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-sm text-[var(--ui-text)] outline-none transition-colors"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    aria-label="Limpiar búsqueda de producto"
                    className="absolute right-2.5 top-2.5 text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {availableCategories.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer border transition-colors ${
                      selectedCategory === 'ALL'
                        ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)]'
                        : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)]'
                    }`}
                  >
                    Todas
                  </button>
                  {availableCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer border transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)]'
                          : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {filteredProducts.length === 0 ? (
                <div className="h-full min-h-40 flex flex-col items-center justify-center text-center text-[var(--ui-subtle)] py-10">
                  <PackageOpen className="w-10 h-10 mb-2 opacity-60" />
                  <p className="text-sm font-semibold text-[var(--ui-muted)]">
                    No se encontraron productos para este filtro
                  </p>
                  <p className="text-xs mt-1">
                    Prueba limpiando la búsqueda o seleccionando &quot;Todos los proveedores&quot;.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredProducts.map(product => {
                    const cartEntry = getCartEntry(product.id);
                    const unitShort = formatUnitShort(product.unit);
                    const isZeroStock = product.stock <= 0;

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group ${
                          cartEntry
                            ? 'bg-[var(--ui-brand)]/5 border-[var(--ui-brand)] shadow-xs'
                            : 'bg-[var(--ui-surface-muted)] border-[var(--ui-border)] hover:border-[var(--ui-brand)] hover:bg-[var(--ui-surface-hover)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm text-[var(--ui-text)] group-hover:text-[var(--ui-brand-strong)] leading-snug line-clamp-2">
                              {product.name}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] text-[var(--ui-muted)]">
                              <span className="font-mono">{product.code}</span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Tag className="w-3 h-3" />
                                {product.category}
                              </span>
                              {product.distributor && (
                                <>
                                  <span>·</span>
                                  <span className="font-semibold text-[var(--ui-secondary)] truncate max-w-[140px]">
                                    {product.distributor}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-black text-base text-[var(--ui-brand-strong)]">
                              ${product.salePrice.toFixed(2)}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--ui-muted)] uppercase">
                              / {unitShort}
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--ui-border)]/70"
                          onClick={e => e.stopPropagation()}
                        >
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                              isZeroStock
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-[var(--ui-surface)] text-[var(--ui-muted)] border border-[var(--ui-border)]'
                            }`}
                          >
                            Stock: {product.stock} {unitShort}
                          </span>

                          {cartEntry ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-[var(--ui-brand-strong)] flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                {cartEntry.item.quantity} en carrito
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQuantity(
                                    cartEntry.index,
                                    Number((cartEntry.item.quantity - 1).toFixed(3))
                                  )
                                }
                                aria-label={`Restar ${product.name}`}
                                className="w-7 h-7 rounded-lg bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] flex items-center justify-center text-[var(--ui-text)] cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddProduct(product)}
                                aria-label={`Sumar ${product.name}`}
                                className="w-7 h-7 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddProduct(product)}
                              className="px-3 py-1 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Agregar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-[var(--ui-border)] bg-[var(--ui-surface-muted)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--ui-text)]">
            <ShoppingBag className="w-4 h-4 text-[var(--ui-brand-strong)]" />
            <span>
              Carrito actual: <strong className="font-mono">{cartSummary.totalItems}</strong>{' '}
              {cartSummary.totalItems === 1 ? 'ítem' : 'ítems'} ·{' '}
              <strong className="font-mono text-[var(--ui-brand-strong)]">
                ${cartSummary.totalAmount.toFixed(2)}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--ui-chrome)] hover:bg-[var(--ui-chrome-raised)] text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span>Listo · Volver al carrito</span>
            <kbd className="font-mono text-[10px] bg-white/15 px-1.5 py-0.5 rounded">ESC</kbd>
          </button>
        </div>
      </div>
    </div>
  );
};
