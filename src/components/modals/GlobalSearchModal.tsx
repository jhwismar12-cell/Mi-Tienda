import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ShoppingBag, Truck } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';
import {
  ALL_SUPPLIERS_KEY,
  NO_SUPPLIER_KEY,
  buildSupplierGroups
} from '../pos/SupplierSearchModal';

export const GlobalSearchModal: React.FC = () => {
  const {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    products,
    addProductToCart,
    showToast
  } = useStore();

  const [query, setQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>(ALL_SUPPLIERS_KEY);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGlobalSearchOpen) {
      setQuery('');
      setSelectedSupplier(ALL_SUPPLIERS_KEY);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isGlobalSearchOpen]);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      } else if (e.key === 'Escape' && isGlobalSearchOpen) {
        setIsGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isGlobalSearchOpen, setIsGlobalSearchOpen]);

  const supplierGroups = useMemo(() => buildSupplierGroups(products), [products]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const sup = (p.distributor || '').trim();
      const matchesSupplier =
        selectedSupplier === ALL_SUPPLIERS_KEY
          ? true
          : selectedSupplier === NO_SUPPLIER_KEY
          ? !sup
          : sup === selectedSupplier;
      if (!matchesSupplier) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.distributor && p.distributor.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, selectedSupplier]);

  const handleSelect = (product: Product) => {
    addProductToCart(product, 1);
    setIsGlobalSearchOpen(false);
    showToast(`"${product.name}" agregado al carrito`);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = results[selectedIndex] || results[0];
      if (picked) handleSelect(picked);
    }
  };

  if (!isGlobalSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-4 pt-16 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search input header */}
        <div className="p-4 border-b border-[var(--ui-border)] flex items-center gap-3 bg-[var(--ui-surface)]">
          <Search className="w-5 h-5 text-[var(--ui-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Buscar por nombre, proveedor, código o categoría..."
            className="w-full text-base md:text-lg text-[var(--ui-text)] outline-none font-medium placeholder:text-[var(--ui-subtle)] bg-transparent"
          />
          <kbd className="font-mono text-xs bg-[var(--ui-surface-hover)] text-[var(--ui-muted)] px-2 py-0.5 rounded border border-[var(--ui-border)]">
            ESC
          </kbd>
        </div>

        {/* Supplier Filter Bar */}
        {supplierGroups.length > 1 && (
          <div className="px-4 py-2 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] flex items-center gap-2">
            <Truck className="w-3.5 h-3.5 text-[var(--ui-brand-strong)] shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ui-muted)] shrink-0">
              Proveedor:
            </span>
            <select
              aria-label="Filtrar búsqueda global por proveedor"
              value={selectedSupplier}
              onChange={(e) => {
                setSelectedSupplier(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)] cursor-pointer"
            >
              {supplierGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label} ({g.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-[var(--ui-border)] p-2 flex-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-[var(--ui-subtle)] text-sm">
              No se encontraron productos coincidentes.
            </div>
          ) : (
            results.map((product, idx) => {
              const isSelected = selectedIndex === idx;

              return (
                <div
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--ui-surface-hover)] ring-1 ring-inset ring-[var(--ui-brand)]/40' : 'hover:bg-[var(--ui-surface-muted)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] flex items-center justify-center font-bold text-xs shrink-0">
                      {product.category.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[var(--ui-text)] truncate">{product.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-[var(--ui-muted)] flex-wrap">
                        <span className="font-mono">{product.code}</span>
                        <span>•</span>
                        <span>{product.category}</span>
                        {product.distributor && (
                          <>
                            <span>•</span>
                            <span className="px-1.5 py-0.2 rounded bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] font-semibold truncate max-w-[160px]">
                              {product.distributor}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className={product.stock <= product.minStock ? 'text-[var(--ui-warning-text)] font-bold' : ''}>
                          Stock: {product.stock} un
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="font-mono font-bold text-sm text-[var(--ui-brand-strong)]">
                      ${product.salePrice.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white transition-colors"
                      title="Agregar al carrito"
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] flex justify-between items-center text-xs text-[var(--ui-muted)]">
          <span>{results.length} productos encontrados</span>
          <span>Click o presione Enter para agregar al carrito</span>
        </div>
      </div>
    </div>
  );
};
