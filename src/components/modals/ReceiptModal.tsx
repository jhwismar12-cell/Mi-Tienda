import React, { useRef } from 'react';
import { Printer, CheckCircle, X, Download, Share2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ReceiptModal: React.FC = () => {
  const { isReceiptModalOpen, setIsReceiptModalOpen, lastCompletedSale } = useStore();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isReceiptModalOpen || !lastCompletedSale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="bg-[#006948] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#85f8c4]" />
            <span className="font-bold text-sm">Venta Completada</span>
          </div>
          <button
            onClick={() => setIsReceiptModalOpen(false)}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-6 overflow-y-auto bg-[#fafafa]">
          <div
            ref={printRef}
            className="bg-white p-5 border border-[#e2e8f0] shadow-xs rounded-lg font-mono text-xs text-[#1e293b] space-y-3 leading-tight print:border-none print:shadow-none"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 border-b border-dashed border-[#cbd5e1] pb-3">
              <h2 className="font-bold text-sm text-[#006948] uppercase tracking-wider font-sans">
                MI TIENDA FAMILIAR
              </h2>
              <p className="text-[10px] text-[#64748b]">RUC: 1792348590001</p>
              <p className="text-[10px] text-[#64748b]">Av. Amazonas y Naciones Unidas</p>
              <p className="text-[10px] text-[#64748b]">Tel: (02) 245-8900</p>
              <div className="pt-1 text-[11px] font-bold text-[#111c2d]">
                COMPROBANTE DE VENTA
              </div>
            </div>

            {/* Ticket Info */}
            <div className="flex justify-between text-[11px] text-[#475569] border-b border-dashed border-[#cbd5e1] pb-2">
              <div>
                <p>Ticket: <strong>{lastCompletedSale.ticketNumber}</strong></p>
                <p>Fecha: {lastCompletedSale.date}</p>
              </div>
              <div className="text-right">
                <p>Hora: {lastCompletedSale.time}</p>
                <p>Caja: {lastCompletedSale.cashierName}</p>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-1.5 border-b border-dashed border-[#cbd5e1] pb-3">
              <div className="grid grid-cols-12 font-bold text-[10px] text-[#64748b] uppercase">
                <span className="col-span-6">Desc</span>
                <span className="col-span-2 text-center">Cant</span>
                <span className="col-span-2 text-right">P.U</span>
                <span className="col-span-2 text-right">Tot</span>
              </div>
              {lastCompletedSale.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 text-[11px]">
                  <span className="col-span-6 truncate font-medium">{item.name}</span>
                  <span className="col-span-2 text-center">{item.quantity}</span>
                  <span className="col-span-2 text-right">${item.unitPrice.toFixed(2)}</span>
                  <span className="col-span-2 text-right font-bold">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1 border-b border-dashed border-[#cbd5e1] pb-2 text-xs">
              <div className="flex justify-between">
                <span>Total Artículos:</span>
                <span>{lastCompletedSale.totalArticles} ({lastCompletedSale.totalUnits} un)</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 text-[#006948]">
                <span>TOTAL PAGADO:</span>
                <span>$ {lastCompletedSale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-[#64748b] pt-1">
                <span>Método de Pago:</span>
                <span className="uppercase font-semibold">{lastCompletedSale.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}</span>
              </div>
              {lastCompletedSale.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-[11px] text-[#64748b]">
                    <span>Efectivo Recibido:</span>
                    <span>$ {lastCompletedSale.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-[#047857]">
                    <span>Cambio / Vuelto:</span>
                    <span>$ {(lastCompletedSale.change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Barcode & Footer Greeting */}
            <div className="text-center pt-2 space-y-2">
              <div className="inline-block px-4 py-1.5 bg-[#f1f5f9] rounded border border-[#cbd5e1] tracking-widest text-xs font-mono font-bold">
                * {lastCompletedSale.ticketNumber} *
              </div>
              <p className="text-[10px] text-[#64748b] italic">
                ¡Gracias por su compra en Mi Tienda Familiar!
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-[#cbd5e1] flex gap-2">
          <button
            onClick={() => setIsReceiptModalOpen(false)}
            className="flex-1 py-2.5 px-3 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] font-bold rounded-xl text-xs transition-colors"
          >
            Nueva Venta
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-[#006948] hover:bg-[#005137] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-[#85f8c4]" />
            <span>Imprimir Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
