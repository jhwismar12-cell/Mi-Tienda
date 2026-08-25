import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingBag, Barcode, ArrowRight } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';

export const GlobalSearchModal: React.FC = () => {
  const {
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    products,
    addProductToCart,
    showToast
  } = useStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGlobalSearchOpen) {
      setQuery('');
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

  const results = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(query.toLowerCase())) ||
      p.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (product: Product) => {
    addProductToCart(product, 1);
    setIsGlobalSearchOpen(false);
    showToast(`"${product.name}" agregado al carrito`);
  };

  if (!isGlobalSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-xs p-4 pt-20 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search input header */}
        <div className="p-4 border-b border-[#cbd5e1] flex items-center gap-3 bg-white">
          <Search className="w-5 h-5 text-[#64748b] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar por nombre, código de barras o categoría..."
            className="w-full text-base md:text-lg text-[#111c2d] outline-none font-medium placeholder:text-[#94a3b8]"
          />
          <kbd className="font-mono text-xs bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded border border-[#cbd5e1]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto divide-y divide-[#e2e8f0] p-2 flex-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-[#94a3b8] text-sm">
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
                    isSelected ? 'bg-[#f1f5f9]' : 'hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#006948]/10 text-[#006948] flex items-center justify-center font-bold text-xs">
                      {product.category.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#111c2d]">{product.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <span className="font-mono">{product.code}</span>
                        <span>•</span>
                        <span>{product.category}</span>
                        <span>•</span>
                        <span className={product.stock <= product.minStock ? 'text-[#b45309] font-bold' : ''}>
                          Stock: {product.stock} un
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-[#006948]">
                      ${product.salePrice.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg bg-[#006948] hover:bg-[#005137] text-white transition-colors"
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
        <div className="p-3 bg-[#f8fafc] border-t border-[#cbd5e1] flex justify-between items-center text-xs text-[#64748b]">
          <span>{results.length} productos encontrados</span>
          <span>Click o presione Enter para agregar al carrito</span>
        </div>
      </div>
    </div>
  );
};
