import React, { useRef } from 'react';
import { Printer, CheckCircle2, AlertTriangle, X, Receipt, Download, Lock } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ReportZModal: React.FC = () => {
  const { isReportZModalOpen, setIsReportZModalOpen, cashShift, sales, closeShift, showToast } = useStore();
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isReportZModalOpen) return null;

  const totalSalesCount = sales.length;
  const difference = cashShift.countedCash - cashShift.expectedCash;
  const now = new Date();
  const reportId = `Z-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-01`;

  const handleCloseShift = async () => {
      if (!window.confirm('¿Confirmas el Cierre del Turno y Arqueo de Caja del día?')) return;
      try {
        await closeShift(cashShift.countedCash);
        setIsReportZModalOpen(false);
      } catch {
        // Keep the report open; the store displays the backend error.
      }
    };

    const handlePrint = () => {
      if (!reportRef.current) return;
      const printWindow = window.open('', '_blank', 'width=420,height=600');
      if (!printWindow) {
        showToast('Permite las ventanas emergentes para imprimir el reporte.');
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Reporte Z - ${reportId}</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; color: #1e293b; padding: 16px; }
            </style>
          </head>
          <body>${reportRef.current.innerHTML}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[var(--ui-chrome)] text-white px-5 py-3.5 flex items-center justify-between border-b border-[var(--ui-border-strong)]">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[var(--ui-mint)]" />
            <div>
              <h2 className="font-bold text-sm leading-tight text-white">
                Reporte Z / Cierre de Caja
              </h2>
              <span className="font-mono text-[10px] text-[var(--ui-mint)]">
                {reportId}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsReportZModalOpen(false)}
            className="p-1 rounded-lg text-[var(--ui-subtle)] hover:text-white hover:bg-[var(--ui-surface)]/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Content (Thermal Style) */}
        <div className="p-6 overflow-y-auto bg-[var(--ui-surface-muted)]">
          <div
            ref={reportRef}
            className="receipt-paper bg-[var(--ui-surface)] p-5 border border-[var(--ui-border)] rounded-xl font-mono text-xs text-[var(--ui-text)] space-y-4 shadow-xs"
          >
            {/* Header info */}
            <div className="text-center space-y-0.5 border-b border-dashed border-[var(--ui-border)] pb-3">
              <h3 className="font-bold text-sm text-[var(--ui-brand-strong)] font-sans">MI TIENDA FAMILIAR</h3>
              <p className="text-[10px] text-[var(--ui-muted)]">CIERRE DIARIO FISCAL - CORTE Z</p>
              <p className="text-[10px] text-[var(--ui-muted)]">Fecha: {now.toLocaleDateString('es-ES')} {now.toLocaleTimeString('es-ES')}</p>
              <p className="text-[10px] text-[var(--ui-muted)]">Cajero: {cashShift.cashierName}</p>
            </div>

            {/* Shift Breakdown */}
            <div className="space-y-2 border-b border-dashed border-[var(--ui-border)] pb-3">
              <div className="flex justify-between">
                <span>Fondo Inicial Apertura:</span>
                <span className="font-bold">$ {cashShift.initialCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--ui-brand-strong)]">
                <span>(+) Ventas Efectivo ({sales.filter(s => s.paymentMethod === 'cash').length} tkts):</span>
                <span className="font-bold">$ {cashShift.cashSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#0051d5]">
                <span>(+) Ventas Transferencia ({sales.filter(s => s.paymentMethod === 'transfer').length} tkts):</span>
                <span className="font-bold">$ {cashShift.transferSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--ui-danger-text)]">
                <span>(-) Retiros / Pagos Caja:</span>
                <span className="font-bold">$ {cashShift.withdrawalsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[var(--ui-brand-strong)]">
                <span>(+) Ingresos Adicionales:</span>
                <span className="font-bold">$ {cashShift.depositsTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Cash Audit Outcome */}
            <div className="space-y-2 border-b border-dashed border-[var(--ui-border)] pb-3 bg-[var(--ui-surface-muted)] p-3 rounded-lg border">
              <div className="flex justify-between font-semibold">
                <span>Efectivo Físico Esperado:</span>
                <span className="font-bold text-sm">$ {cashShift.expectedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Efectivo Real Contado:</span>
                <span className="font-bold text-sm">$ {cashShift.countedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-[var(--ui-border)]">
                <span>Diferencia de Cuadre:</span>
                <span
                  className={
                    Math.abs(difference) < 0.01
                      ? 'text-[var(--ui-brand-strong)]'
                      : difference < 0
                      ? 'text-[var(--ui-danger-text)]'
                      : 'text-[#0051d5]'
                  }
                >
                  {Math.abs(difference) < 0.01
                    ? 'CUADRE EXACTO ($0.00)'
                    : difference < 0
                    ? `FALTANTE -$${Math.abs(difference).toFixed(2)}`
                    : `SOBRANTE +$${difference.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[10px] text-[var(--ui-muted)]">
              <div className="border-t border-[var(--ui-border)] pt-2">
                Firma Cajero
              </div>
              <div className="border-t border-[var(--ui-border)] pt-2">
                Firma Supervisor
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-[var(--ui-surface)] border-t border-[var(--ui-border)] flex flex-wrap gap-2">
          <button
            onClick={() => setIsReportZModalOpen(false)}
            className="px-3.5 py-2.5 bg-[var(--ui-surface-hover)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] font-bold rounded-xl text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-muted)] text-[var(--ui-text)] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[var(--ui-muted)]" />
            <span>Imprimir Ticket</span>
          </button>
          <button
            onClick={handleCloseShift}
            className="flex-1 py-2.5 px-3 bg-[var(--ui-danger-solid)] hover:bg-[var(--ui-danger-solid)] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Lock className="w-4 h-4 text-white" />
            <span>Finalizar Turno</span>
          </button>
        </div>
      </div>
    </div>
  );
};
