import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, Package, CheckCircle2, Camera, AlertTriangle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';
import { useStoreCategories } from '../../utils/categories';
import { useStoreProviders } from '../../utils/providers';
import { parseDecimalInput, roundCostPrice } from '../../utils/currency';
import { BarcodeCameraModal } from './BarcodeCameraModal';
import { ProviderSelectorField } from './ProviderSelectorField';

export const NewProductModal: React.FC = () => {
  const {
    isNewProductModalOpen,
    setIsNewProductModalOpen,
    newProductPrefillBarcode,
    addProduct,
    products
  } = useStore();
  const categories = useStoreCategories(isNewProductModalOpen, products);
  const { providers, addLocalProvider } = useStoreProviders(isNewProductModalOpen, products);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState(false);
  const [category, setCategory] = useState<Category>('Abarrotes');
  const [providerId, setProviderId] = useState<number | undefined>(undefined);
  const [distributor, setDistributor] = useState<string | undefined>(undefined);
  const [unit, setUnit] = useState('UNIDAD');
  const [allowFraction, setAllowFraction] = useState(false);
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState('1.00');
  const [salePrice, setSalePrice] = useState('1.50');
  const [stock, setStock] = useState('20');
  const [minStock, setMinStock] = useState('5');
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savingProduct = useRef(false);
  const wasOpenRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    if (isNewProductModalOpen && !wasOpenRef.current) {
      setName('');
      setCode('');
      setBarcode(newProductPrefillBarcode || '');
      setProviderId(undefined);
      setDistributor(undefined);
      setUnit('UNIDAD');
      setAllowFraction(false);
      setDescription('');
      setCostPrice('1.00');
      setSalePrice('1.50');
      setStock('20');
      setMinStock('5');
      setSubmitError(null);
      if (newProductPrefillBarcode) {
        focusTimer = setTimeout(() => {
          nameInputRef.current?.focus();
        }, 50);
      }
    }
    wasOpenRef.current = isNewProductModalOpen;
    return () => {
      if (focusTimer !== undefined) {
        clearTimeout(focusTimer);
      }
    };
  }, [isNewProductModalOpen, newProductPrefillBarcode]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0] as Category);
    }
  }, [categories, category]);

  if (!isNewProductModalOpen) return null;

  const normalizedBarcode = barcode.trim();
  const duplicateBarcodeProduct = normalizedBarcode
    ? products.find((p) => (p.barcode || '').trim() === normalizedBarcode)
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || savingProduct.current) return;
    if (duplicateBarcodeProduct) {
      setSubmitError(
        `El código de barras "${normalizedBarcode}" ya pertenece a "${duplicateBarcodeProduct.name}" (${duplicateBarcodeProduct.code}).`
      );
      return;
    }

    const finalCode = code.trim() || `AUT-${Math.floor(100000 + Math.random() * 900000)}`;

    savingProduct.current = true;
    setIsSaving(true);
    setSubmitError(null);
    try {
      await addProduct({
        code: finalCode,
        barcode: normalizedBarcode || undefined,
        name: name.trim(),
        category,
        providerId,
        distributor,
        unit,
        allowFraction,
        description: description.trim() || undefined,
        costPrice: roundCostPrice(parseDecimalInput(costPrice)),
        salePrice: parseDecimalInput(salePrice),
        stock: parseFloat(stock) || 0,
        minStock: parseFloat(minStock) || 5,
        lastUpdated: new Date().toISOString()
      });
      setProviderId(undefined);
      setDistributor(undefined);
      setSubmitError(null);
      setIsNewProductModalOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      savingProduct.current = false;
      setIsSaving(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[var(--ui-chrome)] px-6 py-4 flex items-center justify-between text-white border-b border-[var(--ui-border-strong)] shrink-0">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs md:text-sm overflow-y-auto flex-1 min-h-0">
          {newProductPrefillBarcode && (
            <div className="bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-[var(--ui-brand-strong)]">
              <span>Código escaneado listo para registrar:</span>
              <span className="font-mono font-bold bg-[var(--ui-surface)] px-2 py-0.5 rounded border border-[var(--ui-brand-soft-border)]">
                {newProductPrefillBarcode}
              </span>
            </div>
          )}

          <div>
            <label className="block font-bold text-[var(--ui-text)] mb-1">
              Nombre del Producto <span className="text-[var(--ui-danger-text)]">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              aria-label="Nombre del producto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Leche Entera 1 Litro"
              className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Código Interno / SKU
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
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
                  aria-label="Código de barras"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    if (submitError) setSubmitError(null);
                  }}
                  placeholder="Opcional"
                  className={`flex-1 min-w-0 bg-[var(--ui-surface-muted)] border rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none font-mono ${
                    duplicateBarcodeProduct
                      ? 'border-[var(--ui-danger-border)] ring-1 ring-[var(--ui-danger-border)]'
                      : 'border-[var(--ui-border)]'
                  }`}
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

          {duplicateBarcodeProduct && (
            <div
              role="alert"
              className="bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[var(--ui-danger-text)]"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="font-bold">
                  Este código de barras ya existe en el inventario
                </p>
                <p>
                  Ya pertenece a <strong className="break-words">{duplicateBarcodeProduct.name}</strong>{' '}
                  (<span className="font-mono">{duplicateBarcodeProduct.code}</span>
                  {duplicateBarcodeProduct.distributor ? ` · ${duplicateBarcodeProduct.distributor}` : ''}
                  {' · '}PVP ${duplicateBarcodeProduct.salePrice.toFixed(2)} · Stock {duplicateBarcodeProduct.stock} un).
                </p>
                <p className="opacity-90">
                  Búscalo en el inventario para editarlo en lugar de duplicarlo, o cambia el código de barras.
                </p>
              </div>
            </div>
          )}

          {submitError && !duplicateBarcodeProduct && (
            <div
              role="alert"
              className="bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[var(--ui-danger-text)]"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="font-semibold break-words">{submitError}</p>
            </div>
          )}

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

          <ProviderSelectorField
            providers={providers}
            selectedProviderId={providerId}
            onSelectProvider={(prov) => {
              setProviderId(prov?.id);
              setDistributor(prov?.name);
            }}
            onProviderCreated={addLocalProvider}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                Precio de Costo ($)
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                aria-label="Precio de Costo ($)"
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
              disabled={isSaving || Boolean(duplicateBarcodeProduct)}
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
