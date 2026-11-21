import React, { useRef } from 'react';
import { Printer, CheckCircle, X, Download, Share2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ReceiptModal: React.FC = () => {
  const { isReceiptModalOpen, setIsReceiptModalOpen, lastCompletedSale, storeConfig } = useStore();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isReceiptModalOpen || !lastCompletedSale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="bg-[var(--ui-brand)] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[var(--ui-mint)]" />
            <span className="font-bold text-sm">Venta Completada</span>
          </div>
          <button
            onClick={() => setIsReceiptModalOpen(false)}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-[var(--ui-surface)]/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-6 overflow-y-auto bg-[var(--ui-surface-muted)]">
          <div
            ref={printRef}
            className="receipt-paper bg-[var(--ui-surface)] p-5 border border-[var(--ui-border)] shadow-xs rounded-lg font-mono text-xs text-[var(--ui-text)] space-y-3 leading-tight print:border-none print:shadow-none"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 border-b border-dashed border-[var(--ui-border)] pb-3">
              <h2 className="font-bold text-sm text-[var(--ui-brand-strong)] uppercase tracking-wider font-sans">
                {storeConfig.storeName}
              </h2>
              {storeConfig.ruc && <p className="text-[10px] text-[var(--ui-muted)]">RUC: {storeConfig.ruc}</p>}
              {storeConfig.address && <p className="text-[10px] text-[var(--ui-muted)]">{storeConfig.address}</p>}
              {storeConfig.phone && <p className="text-[10px] text-[var(--ui-muted)]">Tel: {storeConfig.phone}</p>}
              <div className="pt-1 text-[11px] font-bold text-[var(--ui-text)]">
                COMPROBANTE DE VENTA
              </div>
            </div>

            {/* Ticket Info */}
            <div className="flex justify-between text-[11px] text-[var(--ui-secondary)] border-b border-dashed border-[var(--ui-border)] pb-2">
              <div>
                <p>Ticket: <strong>{lastCompletedSale.ticketNumber}</strong></p>
                <p>Fecha: {lastCompletedSale.date}</p>
              </div>
              <div className="text-right">
                <p>Hora: {lastCompletedSale.time}</p>
                <p>A cargo: <strong>{lastCompletedSale.cashierName || 'Wismar'}</strong></p>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-1.5 border-b border-dashed border-[var(--ui-border)] pb-3">
              <div className="grid grid-cols-12 font-bold text-[10px] text-[var(--ui-muted)] uppercase">
                <span className="col-span-6">Desc</span>
                <span className="col-span-2 text-center">Cant</span>
                <span className="col-span-2 text-right">P.U</span>
                <span className="col-span-2 text-right">Tot</span>
              </div>
              {lastCompletedSale.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 text-[11px]">
                  <span className="col-span-6 truncate font-medium">{item.name}</span>
                  <span className="col-span-2 text-center">{Number(item.quantity.toFixed(3))}</span>
                  <span className="col-span-2 text-right">${item.unitPrice.toFixed(2)}</span>
                  <span className="col-span-2 text-right font-bold">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="space-y-1 border-b border-dashed border-[var(--ui-border)] pb-2 text-xs">
              <div className="flex justify-between">
                <span>Total Artículos:</span>
                <span>{lastCompletedSale.totalArticles} ({Number(lastCompletedSale.totalUnits.toFixed(3))} un)</span>
              </div>
              {(lastCompletedSale.discount || 0) > 0 && (
                <div className="flex justify-between text-[11px] text-[var(--ui-danger-text)]">
                  <span>Descuento aplicado:</span>
                  <span>- $ {(lastCompletedSale.discount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 text-[var(--ui-brand-strong)]">
                <span>TOTAL PAGADO:</span>
                <span>$ {(lastCompletedSale.total ?? lastCompletedSale.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-[var(--ui-muted)] pt-1">
                <span>Método de Pago:</span>
                <span className="uppercase font-semibold">
                  {lastCompletedSale.paymentMethod === 'cash'
                    ? 'Efectivo'
                    : lastCompletedSale.paymentMethod === 'mixed'
                      ? 'Mixto (Ef. + Transf.)'
                      : 'Transferencia'}
                </span>
              </div>
              {lastCompletedSale.paymentMethod === 'mixed' && (
                <>
                  <div className="flex justify-between text-[11px] text-[var(--ui-muted)]">
                    <span>Parte Efectivo:</span>
                    <span>$ {(lastCompletedSale.cashAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--ui-muted)]">
                    <span>Parte Transferencia:</span>
                    <span>$ {(lastCompletedSale.transferAmount || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
              {lastCompletedSale.paymentMethod !== 'transfer' && lastCompletedSale.cashReceived !== undefined && (
                <>
                  <div className="flex justify-between text-[11px] text-[var(--ui-muted)]">
                    <span>Efectivo Recibido:</span>
                    <span>$ {lastCompletedSale.cashReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-[var(--ui-brand-strong)]">
                    <span>Cambio / Vuelto:</span>
                    <span>$ {(lastCompletedSale.change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Barcode & Footer Greeting */}
            <div className="text-center pt-2 space-y-2">
              <div className="inline-block px-4 py-1.5 bg-[var(--ui-surface-hover)] rounded border border-[var(--ui-border)] tracking-widest text-xs font-mono font-bold">
                * {lastCompletedSale.ticketNumber} *
              </div>
              <p className="text-[10px] text-[var(--ui-muted)] italic">
                {storeConfig.receiptFooter}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-[var(--ui-surface)] border-t border-[var(--ui-border)] flex gap-2">
          <button
            onClick={() => setIsReceiptModalOpen(false)}
            className="flex-1 py-2.5 px-3 bg-[var(--ui-surface-hover)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] font-bold rounded-xl text-xs transition-colors"
          >
            Nueva Venta
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-[var(--ui-mint)]" />
            <span>Imprimir Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};
