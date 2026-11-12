import React, { useState, useRef } from 'react';
import { Radio, X, ArrowDownRight, ArrowUpRight, DollarSign } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const CashMovementModal: React.FC = () => {
  const { isCashMovementModalOpen, setIsCashMovementModalOpen, addCashMovement } = useStore();

  const [type, setType] = useState<'RETIRO' | 'INGRESO'>('RETIRO');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('10.00');
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCashMovementModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const parsed = parseFloat(amount) || 0;
    if (parsed <= 0 || !description.trim()) return;

    submitting.current = true;
    setIsSubmitting(true);
    try {
      await addCashMovement(type, description.trim(), parsed);
      setIsCashMovementModalOpen(false);
      setDescription('');
      setAmount('10.00');
    } catch {
      // Keep the form open; the store displays the error.
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[var(--ui-chrome)] px-5 py-4 flex items-center justify-between text-white border-b border-[var(--ui-border-strong)]">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[var(--ui-mint)]" />
            <h2 className="font-bold text-sm md:text-base text-white">
              Movimiento de Caja / Gastos
            </h2>
          </div>
          <button
            onClick={() => setIsCashMovementModalOpen(false)}
            className="p-1 rounded-lg text-[var(--ui-subtle)] hover:text-white hover:bg-[var(--ui-surface)]/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs md:text-sm">
          {/* Type Toggle */}
          <div className="flex rounded-lg bg-[var(--ui-surface-hover)] p-1 border border-[var(--ui-border)]">
            <button
              type="button"
              onClick={() => setType('RETIRO')}
              className={`flex-1 py-1.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                type === 'RETIRO'
                  ? 'bg-[var(--ui-surface)] text-[var(--ui-danger-text)] shadow-sm border border-[var(--ui-border)]'
                  : 'text-[var(--ui-muted)]'
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
                  ? 'bg-[var(--ui-surface)] text-[var(--ui-brand-strong)] shadow-sm border border-[var(--ui-border)]'
                  : 'text-[var(--ui-muted)]'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Ingreso Extra</span>
            </button>
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Monto en Efectivo ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 font-mono text-sm font-bold text-[var(--ui-muted)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono font-bold text-base text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
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
              className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
            <button
              type="button"
              onClick={() => setIsCashMovementModalOpen(false)}
              className="px-3.5 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-lg border border-[var(--ui-border)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm ${
                type === 'RETIRO'
                  ? 'bg-[var(--ui-danger-solid)] hover:bg-[var(--ui-danger-solid)]'
                  : 'bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)]'
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
