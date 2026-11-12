import React, { useRef, useState } from 'react';
import { Plus, X, Package, CheckCircle2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';

export const NewProductModal: React.FC = () => {
  const { isNewProductModalOpen, setIsNewProductModalOpen, addProduct } = useStore();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<Category>('Abarrotes');
  const [costPrice, setCostPrice] = useState('1.00');
  const [salePrice, setSalePrice] = useState('1.50');
  const [stock, setStock] = useState('20');
  const [minStock, setMinStock] = useState('5');
  const [isSaving, setIsSaving] = useState(false);
  const savingProduct = useRef(false);

  if (!isNewProductModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || savingProduct.current) return;

    const finalCode = code.trim() || `AUT-${Math.floor(100000 + Math.random() * 900000)}`;

    savingProduct.current = true;
    setIsSaving(true);
    try {
      await addProduct({
        code: finalCode,
        barcode: barcode.trim() || undefined,
        name: name.trim(),
        category,
        costPrice: parseFloat(costPrice) || 0,
        salePrice: parseFloat(salePrice) || 0,
        stock: parseInt(stock) || 0,
        minStock: parseInt(minStock) || 5,
        lastUpdated: new Date().toISOString()
      });
      setIsNewProductModalOpen(false);
    } catch {
      // The store shows the error; preserve the form for correction and retry.
    } finally {
      savingProduct.current = false;
      setIsSaving(false);
    }
  };

  const categories: Category[] = [
    'Abarrotes',
    'Lácteos',
    'Bebidas',
    'Snacks',
    'Limpieza',
    'Panadería',
    'Embutidos',
    'Condimentos',
    'Hogar'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[var(--ui-chrome)] px-6 py-4 flex items-center justify-between text-white border-b border-[var(--ui-border-strong)]">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--ui-mint)]" />
            <h2 className="font-bold text-base md:text-lg text-white">
              Crear Nuevo Producto en Inventario
            </h2>
          </div>
          <button
            onClick={() => setIsNewProductModalOpen(false)}
            className="p-1 rounded-lg text-[var(--ui-subtle)] hover:text-white hover:bg-[var(--ui-surface)]/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold text-[var(--ui-text)] mb-1">
              Nombre del Producto <span className="text-[var(--ui-danger-text)]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Leche Entera 1 Litro"
              className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Código Interno / SKU
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Automático"
                className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Código de Barras (EAN-13)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Precio de Costo ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-[var(--ui-brand-strong)] mb-1">
                Precio de Venta ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full bg-[var(--ui-surface-muted)] border-2 border-[var(--ui-brand)]/30 rounded-lg px-3 py-2 text-[var(--ui-brand-strong)] outline-none font-mono font-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Stock Inicial
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                min="1"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-[var(--ui-border)] mt-4">
            <button
              type="button"
              onClick={() => setIsNewProductModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-xl border border-[var(--ui-border)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[var(--ui-mint)]" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Producto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
