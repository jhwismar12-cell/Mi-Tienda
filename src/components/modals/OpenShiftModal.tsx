import React, { useState } from 'react';
import { Lock, Unlock, DollarSign, User, FileText, CheckCircle2, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const OpenShiftModal: React.FC = () => {
  const {
    isOpenShiftModalOpen,
    setIsOpenShiftModalOpen,
    openShift,
    cashShift,
    showToast,
    workers,
    activeWorkerName,
    setActiveWorker
  } = useStore();
  const [initialAmount, setInitialAmount] = useState<string>('20.00');
  const [cashier, setCashier] = useState<string>(activeWorkerName || cashShift.cashierName || 'Wismar (Administrador)');
  const [notes, setNotes] = useState<string>('Apertura de turno - Base de caja');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpenShiftModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(initialAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      showToast('Por favor ingresa un monto válido de apertura');
      return;
    }

    try {
      setIsSubmitting(true);
      await openShift(amountNum, cashier);
      setActiveWorker(cashier);
      setIsOpenShiftModalOpen(false);
    } catch (err) {
      // Handled in store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[var(--ui-chrome)] px-6 py-4 flex items-center justify-between text-white border-b border-[var(--ui-border-strong)]">
          <div className="flex items-center gap-2.5">
            <Unlock className="w-5 h-5 text-[var(--ui-mint)]" />
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Apertura de Caja
              </h3>
              <p className="text-[11px] text-[var(--ui-subtle)]">
                Ingresa el fondo inicial en efectivo para comenzar las ventas del día.
              </p>
            </div>
          </div>
          {cashShift.isOpen && (
            <button
              type="button"
              onClick={() => setIsOpenShiftModalOpen(false)}
              className="p-1 rounded-lg text-[var(--ui-subtle)] hover:text-white hover:bg-[var(--ui-surface)]/10"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs md:text-sm">
          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Cajero / Responsable del Turno
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5 z-10" />
              <select
                value={cashier}
                onChange={(e) => setCashier(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-[var(--ui-text)] font-semibold outline-none focus:border-[var(--ui-brand)]"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.name}>
                    {w.name} ({w.role || 'Cajero'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[var(--ui-brand-strong)] mb-1">
              Fondo Base Inicial en Efectivo ($) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-mono text-sm font-bold text-[var(--ui-brand-strong)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 bg-[var(--ui-surface)] border-2 border-[var(--ui-brand)] rounded-xl font-mono font-black text-lg text-[var(--ui-brand-strong)] outline-none focus:ring-2 focus:ring-[var(--ui-brand)]/20"
              />
            </div>
            <p className="text-[11px] text-[var(--ui-muted)] mt-1">
              Efectivo físico disponible en gaveta para vuelto / cambio inicial.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
              Observaciones de Apertura
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Inicio de turno matutino"
              className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--ui-border)]">
            {cashShift.isOpen && (
              <button
                type="button"
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-xl border border-[var(--ui-border)]"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 text-xs md:text-sm font-bold text-white bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[var(--ui-mint)]" />
              <span>{isSubmitting ? 'Abriendo Caja...' : 'Confirmar Apertura de Caja'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
