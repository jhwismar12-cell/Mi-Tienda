import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Scale, Tag } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category, Product } from '../../types';
import { useStoreCategories } from '../../utils/categories';
import { useStoreProviders } from '../../utils/providers';
import { parseDecimalInput, roundCostPrice } from '../../utils/currency';
import { ProviderSelectorField } from '../modals/ProviderSelectorField';
import { BulkSubcategory, isBulkEligibleProduct } from './bulkCategories';

export { isBulkEligibleProduct };

export function formatPromoDescription(
  qtyRaw: string | number,
  totalRaw: string | number,
  note?: string
): string | undefined {
  const qty = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw).trim(), 10);
  const total =
    typeof totalRaw === 'number'
      ? totalRaw
      : parseFloat(String(totalRaw).trim().replace(',', '.'));

  const hasPromo = Number.isFinite(qty) && qty > 0 && Number.isFinite(total) && total > 0;
  const trimmedNote = (note || '').trim();

  if (hasPromo && trimmedNote) {
    return `Promo: ${qty} x $${total.toFixed(2)} — ${trimmedNote}`;
  }
  if (hasPromo) {
    return `Promo: ${qty} x $${total.toFixed(2)}`;
  }
  return trimmedNote || undefined;
}

interface BulkProductCreateFormProps {
  initialName?: string;
  initialGroup?: BulkSubcategory;
  onCancel: () => void;
  onCreated: (product: Product) => void;
}

export const BulkProductCreateForm: React.FC<BulkProductCreateFormProps> = ({
  initialName = '',
  initialGroup = 'all',
  onCancel,
  onCreated
}) => {
  const { products, addProduct } = useStore();
  const categories = useStoreCategories(true, products);
  const { providers, addLocalProvider } = useStoreProviders(true, products);

  const defaultCat =
    initialGroup === 'verdes' && categories.includes('Frutas y Verduras')
      ? 'Frutas y Verduras'
      : categories[0] || 'Abarrotes';

  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<string>(defaultCat);
  const [providerId, setProviderId] = useState<number | undefined>(undefined);
  const [distributor, setDistributor] = useState<string | undefined>(undefined);
  const [unit, setUnit] = useState<'UNIDAD' | 'LIBRA' | 'KG' | 'GALON'>(
    initialGroup === 'granos_harinas' ? 'LIBRA' : 'UNIDAD'
  );
  const [allowFraction, setAllowFraction] = useState(initialGroup === 'granos_harinas');
  const [salePrice, setSalePrice] = useState('0.50');
  const [costPrice, setCostPrice] = useState('0.00');
  const [stock, setStock] = useState('0');
  const [comboQty, setComboQty] = useState('');
  const [comboTotal, setComboTotal] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  const parsedComboQty = parseInt(comboQty.trim(), 10);
  const parsedComboTotal = parseFloat(comboTotal.trim().replace(',', '.'));
  const hasValidCombo =
    Number.isFinite(parsedComboQty) &&
    parsedComboQty > 0 &&
    Number.isFinite(parsedComboTotal) &&
    parsedComboTotal > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;

    const cleanName = name.trim();
    const parsedSale = parseFloat(salePrice.replace(',', '.'));
    const parsedCost = roundCostPrice(parseDecimalInput(costPrice));
    const parsedStock = parseFloat(stock.replace(',', '.'));

    if (!cleanName) {
      setFormError('Escribe el nombre del producto.');
      nameRef.current?.focus();
      return;
    }
    if (!Number.isFinite(parsedSale) || parsedSale <= 0) {
      setFormError('El precio de venta debe ser mayor a $0.00.');
      return;
    }
    if ((comboQty.trim() && !comboTotal.trim()) || (!comboQty.trim() && comboTotal.trim())) {
      setFormError('Para guardar un combo completa tanto la cantidad como el precio total.');
      return;
    }

    setFormError(null);
    savingRef.current = true;
    setIsSaving(true);

    const codePrefix = unit === 'UNIDAD' && !hasValidCombo && !allowFraction ? 'SINCOD' : 'GRN';
    const generatedCode = `${codePrefix}-${Date.now().toString().slice(-6)}`;
    const description = formatPromoDescription(comboQty, comboTotal, note);

    try {
      const created = await addProduct({
        code: generatedCode,
        barcode: undefined,
        name: cleanName,
        category: category as Category,
        providerId,
        distributor,
        unit,
        allowFraction,
        description,
        costPrice: Number.isFinite(parsedCost) && parsedCost >= 0 ? parsedCost : 0,
        salePrice: parsedSale,
        stock: Number.isFinite(parsedStock) && parsedStock >= 0 ? parsedStock : 0,
        minStock: 5,
        lastUpdated: new Date().toISOString()
      });
      onCreated(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 bg-[var(--ui-surface-muted)]/30"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-xl bg-[var(--ui-surface)] border border-[var(--ui-border-strong)] text-xs font-bold text-[var(--ui-text)] flex items-center gap-1.5 hover:bg-[var(--ui-surface-hover)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[var(--ui-brand-strong)]" />
          <span>Volver al listado</span>
        </button>
        <span className="text-[11px] font-semibold text-[var(--ui-muted)] flex items-center gap-1">
          <Scale className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
          <span>Sin código de barras</span>
        </span>
      </div>

      {formError && (
        <div className="p-3 rounded-xl bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] text-xs font-semibold">
          {formError}
        </div>
      )}

      <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl p-4 space-y-3.5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
              Nombre del Producto *
            </label>
            <input
              ref={nameRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Arroz Conejo, Huevo, Cartulina A4..."
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-sm text-[var(--ui-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-sm text-[var(--ui-text)] outline-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ProviderSelectorField
          providers={providers}
          selectedProviderId={providerId}
          onSelectProvider={(prov) => {
            setProviderId(prov?.id);
            setDistributor(prov?.name);
          }}
          onProviderCreated={addLocalProvider}
          labelClassName="text-xs font-bold text-[var(--ui-secondary)]"
        />

        <div className="space-y-2">
          <label className="block text-xs font-bold text-[var(--ui-secondary)]">
            Forma de venta / Medida
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {(['UNIDAD', 'LIBRA', 'KG', 'GALON'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUnit(u);
                  setAllowFraction(u === 'LIBRA' || u === 'KG' || u === 'GALON');
                }}
                className={`py-2 px-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  unit === u
                    ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)] shadow-xs'
                    : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)] hover:text-[var(--ui-text)]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--ui-text)] pt-1">
            <input
              type="checkbox"
              checked={allowFraction}
              onChange={(e) => setAllowFraction(e.target.checked)}
              className="rounded border-[var(--ui-border)] accent-[var(--ui-brand)] w-4 h-4"
            />
            <span>Permitir decimales / fracción (ej: 0.5 lb o venta por valor $)</span>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="block text-xs font-bold text-[var(--ui-brand-strong)] mb-1">
              Precio Venta ($) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border-2 border-[var(--ui-brand)]/35 focus:border-[var(--ui-brand)] rounded-xl font-mono font-black text-sm text-[var(--ui-brand-strong)] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
              Costo ($)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl font-mono text-sm text-[var(--ui-text)] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
              Stock Inicial
            </label>
            <input
              type="number"
              step={allowFraction ? '0.01' : '1'}
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl font-mono text-sm text-[var(--ui-text)] outline-none"
            />
          </div>
        </div>

        {/* Combo Promocional Opcional */}
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Combo promocional (Opcional)</span>
            </span>
            <span className="text-[10px] text-[var(--ui-muted)]">Ej: 6 × $1.00, 3 × $0.50</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ui-secondary)] mb-1">
                Cantidad en combo
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={comboQty}
                onChange={(e) => setComboQty(e.target.value)}
                placeholder="Ej: 6"
                className="w-full px-3 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg font-mono text-sm text-[var(--ui-text)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ui-secondary)] mb-1">
                Precio del combo ($)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={comboTotal}
                onChange={(e) => setComboTotal(e.target.value)}
                placeholder="Ej: 1.00"
                className="w-full px-3 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg font-mono text-sm text-[var(--ui-text)] outline-none"
              />
            </div>
          </div>
          {hasValidCombo && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              Botón rápido en Caja: Combo {parsedComboQty} × ${parsedComboTotal.toFixed(2)} ($
              {(parsedComboTotal / parsedComboQty).toFixed(3)} c/u)
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
            Nota corta (Opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Tamaño grande, color blanco..."
            className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-xs text-[var(--ui-text)] outline-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2.5 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-[var(--ui-border)] text-xs font-bold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface)] cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 text-[var(--ui-mint)]" />
          <span>{isSaving ? 'Guardando...' : 'Guardar y Usar'}</span>
        </button>
      </div>
    </form>
  );
};
