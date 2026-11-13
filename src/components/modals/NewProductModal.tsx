import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Package, CheckCircle2, Camera } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';
import { useStoreCategories } from '../../utils/categories';
import { BarcodeCameraModal } from './BarcodeCameraModal';

export const NewProductModal: React.FC = () => {
  const { isNewProductModalOpen, setIsNewProductModalOpen, addProduct, products } = useStore();
  const categories = useStoreCategories(isNewProductModalOpen, products);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false);
  const [category, setCategory] = useState<Category>('Abarrotes');
  const [unit, setUnit] = useState('UNIDAD');
  const [allowFraction, setAllowFraction] = useState(false);
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState('1.00');
  const [salePrice, setSalePrice] = useState('1.50');
  const [stock, setStock] = useState('20');
  const [minStock, setMinStock] = useState('5');
  const [isSaving, setIsSaving] = useState(false);
  const savingProduct = useRef(false);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0] as Category);
    }
  }, [categories, category]);

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
        unit,
        allowFraction,
        description: description.trim() || undefined,
        costPrice: parseFloat(costPrice) || 0,
        salePrice: parseFloat(salePrice) || 0,
        stock: parseFloat(stock) || 0,
        minStock: parseFloat(minStock) || 5,
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

  return (
    <>
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
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Opcional"
                  className="flex-1 min-w-0 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setIsBarcodeCameraOpen(true)}
                  aria-label="Escanear código de barras con cámara"
                  title="Escanear código de barras con cámara"
                  className="px-3 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Cámara</span>
                </button>
              </div>
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
                step="0.01"
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
                step="0.01"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Unidad de Medida
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['UNIDAD', 'LIBRA', 'KG', 'GALON'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setUnit(u);
                      setAllowFraction(u === 'LIBRA' || u === 'KG' || u === 'GALON');
                    }}
                    className={`py-2 px-1 rounded-lg border text-[11px] font-bold transition-colors ${
                      unit === u
                        ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)]'
                        : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ui-text)]">
                <input
                  type="checkbox"
                  checked={allowFraction}
                  onChange={(e) => setAllowFraction(e.target.checked)}
                  className="rounded border-[var(--ui-border)] accent-[var(--ui-brand)] w-4 h-4"
                />
                <span>Permite decimales (peso/granel)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Descripción / Promo Combo (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Promo: 6 x $1.00"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none text-xs"
            />
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

    <BarcodeCameraModal
      isOpen={isBarcodeCameraOpen}
      onClose={() => setIsBarcodeCameraOpen(false)}
      onDetected={(scanned) => setBarcode(scanned)}
      title="Capturar Código de Barras"
      subtitle="Escanea el código del envase para asignarlo al nuevo producto"
    />
    </>
  );
};
