import React, { useState } from 'react';
import { Radio, X, ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const CashMovementModal: React.FC = () => {
  const { isCashMovementModalOpen, setIsCashMovementModalOpen, addCashMovement } = useStore();

  const [type, setType] = useState<'RETIRO' | 'INGRESO'>('RETIRO');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('10.00');

  if (!isCashMovementModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount) || 0;
    if (parsed <= 0 || !description.trim()) return;

    addCashMovement(type, description.trim(), parsed);
    setIsCashMovementModalOpen(false);
    setDescription('');
    setAmount('10.00');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#111c2d] px-5 py-4 flex items-center justify-between text-white border-b border-[#334155]">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#85f8c4]" />
            <h2 className="font-bold text-sm md:text-base text-white">
              Movimiento de Caja / Gastos
            </h2>
          </div>
          <button
            onClick={() => setIsCashMovementModalOpen(false)}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs md:text-sm">
          {/* Type Toggle */}
          <div className="flex rounded-lg bg-[#f1f5f9] p-1 border border-[#cbd5e1]">
            <button
              type="button"
              onClick={() => setType('RETIRO')}
              className={`flex-1 py-1.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                type === 'RETIRO'
                  ? 'bg-white text-[#dc2626] shadow-sm border border-[#cbd5e1]'
                  : 'text-[#64748b]'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Retiro / Pago</span>
            </button>
            <button
              type="button"
              onClick={() => setType('INGRESO')}
              className={`flex-1 py-1.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                type === 'INGRESO'
                  ? 'bg-white text-[#006948] shadow-sm border border-[#cbd5e1]'
                  : 'text-[#64748b]'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Ingreso Extra</span>
            </button>
          </div>

          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Monto en Efectivo ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 font-mono text-sm font-bold text-[#64748b]">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg font-mono font-bold text-base text-[#111c2d] outline-none focus:border-[#316bf3]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#475569] mb-1">
              Concepto / Motivo
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'RETIRO'
                  ? 'Ej: Pago proveedor de pan, compra de bolsas'
                  : 'Ej: Aporte de cambio, fondo adicional'
              }
              className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#cbd5e1]">
            <button
              type="button"
              onClick={() => setIsCashMovementModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] rounded-lg border border-[#cbd5e1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm ${
                type === 'RETIRO'
                  ? 'bg-[#dc2626] hover:bg-[#b91c1c]'
                  : 'bg-[#006948] hover:bg-[#005137]'
              }`}
            >
              Registrar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
