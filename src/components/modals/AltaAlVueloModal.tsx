import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Zap,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Category } from '../../types';

export const AltaAlVueloModal: React.FC = () => {
  const {
    isAltaAlVueloOpen,
    setIsAltaAlVueloOpen,
    unknownBarcode,
    handleSaveAltaAlVuelo
  } = useStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Abarrotes');
  const [costPrice, setCostPrice] = useState<string>('0.50');
  const [salePrice, setSalePrice] = useState<string>('0.75');
  const [initialStock, setInitialStock] = useState<string>('10');

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (isAltaAlVueloOpen) {
      setName('');
      setCostPrice('0.50');
      setSalePrice('0.75');
      setInitialStock('10');
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isAltaAlVueloOpen]);

  // Handle Enter/ESC key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAltaAlVueloOpen) return;
      if (e.key === 'Escape') {
        setIsAltaAlVueloOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAltaAlVueloOpen, setIsAltaAlVueloOpen]);

  if (!isAltaAlVueloOpen) return null;

  const costNum = parseFloat(costPrice) || 0;
  const saleNum = parseFloat(salePrice) || 0;
  const marginPercent =
    costNum > 0 && saleNum >= costNum
      ? (((saleNum - costNum) / costNum) * 100).toFixed(0)
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    handleSaveAltaAlVuelo({
      name: name.trim(),
      category,
      costPrice: costNum,
      salePrice: saleNum,
      initialStock: parseInt(initialStock) || 10
    });
  };

  const categories: Category[] = [
    'Abarrotes',
    'Lácteos',
    'Bebidas',
    'Snacks',
    'Limpieza',
    'Panadería',
    'Embutidos'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#111c2d] px-6 py-4 flex items-center justify-between text-white border-b border-[#334155]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00855d] flex items-center justify-center text-[#85f8c4] font-bold">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <span className="font-mono text-[10px] text-[#85f8c4] font-bold uppercase tracking-wider block">
                ALTA AL VUELO
              </span>
              <h2 className="font-bold text-base md:text-lg leading-none text-white">
                Producto Nuevo Detectado
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAltaAlVueloOpen(false)}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Notification Box */}
        <div className="p-5 space-y-4">
          <div className="bg-[#fef3c7] border border-[#fde68a] p-3.5 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#b45309] shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-[#92400e]">
              El código <strong className="font-mono text-[#78350f]">{unknownBarcode || '7701234567890'}</strong> no existe en la base de datos. Complete los datos básicos para continuar con la venta.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1">
                Nombre del Producto <span className="text-[#dc2626]">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Galletas Oreo 36g"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] focus:border-[#316bf3] focus:bg-white rounded-lg px-3.5 py-2.5 text-sm md:text-base font-semibold text-[#111c2d] outline-none transition-all placeholder:font-normal placeholder:text-[#94a3b8]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-[#111c2d] mb-1">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] focus:border-[#316bf3] focus:bg-white rounded-lg px-3.5 py-2 text-sm text-[#111c2d] outline-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Cost & Sale Price Grid */}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              {/* Cost Price */}
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1">
                  Precio Costo (Compra)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono text-sm text-[#64748b] font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] focus:border-[#316bf3] focus:bg-white rounded-lg font-mono font-bold text-sm text-[#111c2d] outline-none"
                  />
                </div>
              </div>

              {/* Sale Price */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-[#111c2d]">
                    Precio Venta (PVP)
                  </label>
                  {Number(marginPercent) > 0 && (
                    <span className="text-[10px] font-bold font-mono text-[#006948] bg-[#ecfdf5] px-1.5 py-0.2 rounded border border-[#a7f3d0]">
                      +{marginPercent}% Margen
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono text-sm text-[#006948] font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-[#f8fafc] border-2 border-[#006948]/40 focus:border-[#006948] focus:bg-white rounded-lg font-mono font-black text-sm text-[#006948] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Initial stock in background */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-[#64748b] mb-1">
                Stock Inicial en Bodega
              </label>
              <input
                type="number"
                min="1"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
                className="w-28 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-[#111c2d] outline-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 justify-end pt-4 border-t border-[#cbd5e1] mt-5">
              <button
                type="button"
                onClick={() => setIsAltaAlVueloOpen(false)}
                className="px-4 py-2.5 text-xs md:text-sm font-semibold text-[#475569] hover:bg-[#f1f5f9] rounded-xl border border-[#cbd5e1] transition-colors"
              >
                Cancelar <span className="font-mono text-[10px] opacity-70">[ESC]</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs md:text-sm font-bold text-white bg-[#006948] hover:bg-[#005137] rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
                <span>Guardar y Agregar al Carrito</span>
                <span className="font-mono text-[10px] bg-black/30 text-[#85f8c4] px-1.5 py-0.5 rounded font-bold">
                  [ENTER]
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
