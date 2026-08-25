import React, { useRef } from 'react';
import { Printer, CheckCircle2, AlertTriangle, X, Receipt, Download } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ReportZModal: React.FC = () => {
  const { isReportZModalOpen, setIsReportZModalOpen, cashShift, sales, showToast } = useStore();
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isReportZModalOpen) return null;

  const totalSalesCount = sales.length;
  const difference = cashShift.countedCash - cashShift.expectedCash;
  const now = new Date();
  const reportId = `Z-${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-01`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#111c2d] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#334155]">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#85f8c4]" />
            <div>
              <h2 className="font-bold text-sm leading-tight text-white">
                Reporte Z / Cierre de Caja
              </h2>
              <span className="font-mono text-[10px] text-[#85f8c4]">
                {reportId}
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsReportZModalOpen(false)}
            className="p-1 rounded-lg text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Report Content (Thermal Style) */}
        <div className="p-6 overflow-y-auto bg-[#fafafa]">
          <div
            ref={reportRef}
            className="bg-white p-5 border border-[#cbd5e1] rounded-xl font-mono text-xs text-[#1e293b] space-y-4 shadow-xs"
          >
            {/* Header info */}
            <div className="text-center space-y-0.5 border-b border-dashed border-[#cbd5e1] pb-3">
              <h3 className="font-bold text-sm text-[#006948] font-sans">MI TIENDA FAMILIAR</h3>
              <p className="text-[10px] text-[#64748b]">CIERRE DIARIO FISCAL - CORTE Z</p>
              <p className="text-[10px] text-[#64748b]">Fecha: {now.toLocaleDateString('es-ES')} {now.toLocaleTimeString('es-ES')}</p>
              <p className="text-[10px] text-[#64748b]">Cajero: {cashShift.cashierName}</p>
            </div>

            {/* Shift Breakdown */}
            <div className="space-y-2 border-b border-dashed border-[#cbd5e1] pb-3">
              <div className="flex justify-between">
                <span>Fondo Inicial Apertura:</span>
                <span className="font-bold">$ {cashShift.initialCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#006948]">
                <span>(+) Ventas Efectivo ({sales.filter(s => s.paymentMethod === 'cash').length} tkts):</span>
                <span className="font-bold">$ {cashShift.cashSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#0051d5]">
                <span>(+) Ventas Transferencia ({sales.filter(s => s.paymentMethod === 'transfer').length} tkts):</span>
                <span className="font-bold">$ {cashShift.transferSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#dc2626]">
                <span>(-) Retiros / Pagos Caja:</span>
                <span className="font-bold">$ {cashShift.withdrawalsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#059669]">
                <span>(+) Ingresos Adicionales:</span>
                <span className="font-bold">$ {cashShift.depositsTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Cash Audit Outcome */}
            <div className="space-y-2 border-b border-dashed border-[#cbd5e1] pb-3 bg-[#f8fafc] p-3 rounded-lg border">
              <div className="flex justify-between font-semibold">
                <span>Efectivo Físico Esperado:</span>
                <span className="font-bold text-sm">$ {cashShift.expectedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Efectivo Real Contado:</span>
                <span className="font-bold text-sm">$ {cashShift.countedCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-[#cbd5e1]">
                <span>Diferencia de Cuadre:</span>
                <span
                  className={
                    Math.abs(difference) < 0.01
                      ? 'text-[#006948]'
                      : difference < 0
                      ? 'text-[#dc2626]'
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
            <div className="pt-4 grid grid-cols-2 gap-4 text-center text-[10px] text-[#64748b]">
              <div className="border-t border-[#cbd5e1] pt-2">
                Firma Cajero
              </div>
              <div className="border-t border-[#cbd5e1] pt-2">
                Firma Supervisor
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-white border-t border-[#cbd5e1] flex gap-2">
          <button
            onClick={() => setIsReportZModalOpen(false)}
            className="flex-1 py-2.5 px-3 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] font-bold rounded-xl text-xs transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-[#006948] hover:bg-[#005137] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-[#85f8c4]" />
            <span>Imprimir Reporte Z</span>
          </button>
        </div>
      </div>
    </div>
  );
};
