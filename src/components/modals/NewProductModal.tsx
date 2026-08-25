import React, { useState } from 'react';
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

  if (!isNewProductModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalCode = code.trim() || `AUT-${Math.floor(100000 + Math.random() * 900000)}`;

    addProduct({
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
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#85f8c4]" />
            <h2 className="font-bold text-base md:text-lg text-white">
              Crear Nuevo Producto en Inventario
            </h2>
          </div>
          <button
            onClick={() => setIsNewProductModalOpen(false)}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-bold text-[#111c2d] mb-1">
              Nombre del Producto <span className="text-[#dc2626]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Leche Entera 1 Litro"
              className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Código Interno / SKU
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Automático"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Código de Barras (EAN-13)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Opcional"
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Categoría
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Precio de Costo ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-[#006948] mb-1">
                Precio de Venta ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full bg-[#f8fafc] border-2 border-[#006948]/30 rounded-lg px-3 py-2 text-[#006948] outline-none font-mono font-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Stock Inicial
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#475569] mb-1">
                Stock Mínimo (Alerta)
              </label>
              <input
                type="number"
                min="1"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-[#cbd5e1] mt-4">
            <button
              type="button"
              onClick={() => setIsNewProductModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] rounded-xl border border-[#cbd5e1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#006948] hover:bg-[#005137] rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#85f8c4]" />
              <span>Guardar Producto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
