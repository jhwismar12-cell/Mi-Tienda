import React, { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  Building2,
  CheckCircle2,
  Printer,
  Sparkles,
  ShoppingBag,
  RotateCcw
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';

export const PosScreen: React.FC = () => {
  const {
    products,
    cart,
    addToCartByBarcodeOrCode,
    addProductToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    selectedCartIndex,
    setSelectedCartIndex,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    confirmCheckout,
    setIsGlobalSearchOpen,
    closeShiftAndGenerateReport,
    showToast
  } = useStore();

  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Calculations
  const totalArticles = cart.length;
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Number(cart.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  
  const cashReceivedNumber = parseFloat(cashReceived) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, Number((cashReceivedNumber - subtotal).toFixed(2))) : 0;

  // Auto-focus barcode input
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Keyboard shortcut handler (F1-F5, F12)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a modal or text input (except barcode)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA';

      if (e.key === 'F1') {
        e.preventDefault();
        const pan = products.find(p => p.code === '00000004' || p.name.toLowerCase().includes('pan de agua'));
        if (pan) addProductToCart(pan, 1);
      } else if (e.key === 'F2') {
        e.preventDefault();
        const huevos = products.find(p => p.code === '78610002' || p.name.toLowerCase().includes('huevos'));
        if (huevos) addProductToCart(huevos, 1);
      } else if (e.key === 'F3') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        const recarga = products.find(p => p.code === '00000099' || p.name.toLowerCase().includes('recarga'));
        if (recarga) addProductToCart(recarga, 1);
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (cart.length > 0) {
          confirmCheckout();
        } else {
          showToast('El carrito está vacío');
        }
      } else if (e.key === 'F12') {
        e.preventDefault();
        closeShiftAndGenerateReport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart, confirmCheckout, addProductToCart, closeShiftAndGenerateReport, showToast]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    addToCartByBarcodeOrCode(barcodeInput.trim());
    setBarcodeInput('');
  };

  const handleQuickPay = (amount: number | 'exact') => {
    if (amount === 'exact') {
      setCashReceived(subtotal.toFixed(2));
    } else {
      setCashReceived(amount.toFixed(2));
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#f8fafc] select-none h-full">
      {/* Left Section: Cart (approx 65%) */}
      <div className="flex-1 lg:flex-[6.5] flex flex-col p-4 md:p-6 border-r border-[#cbd5e1] overflow-hidden min-w-0">
        
        {/* Barcode Search Input */}
        <form onSubmit={handleBarcodeSubmit} className="mb-4 relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748b]">
            <Barcode className="w-5 h-5" />
          </div>
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Escanee código de barras o presione F3 para buscar por nombre..."
            className="w-full pl-11 pr-20 py-3.5 bg-white border-2 border-[#cbd5e1] focus:border-[#316bf3] focus:ring-2 focus:ring-[#316bf3]/20 rounded-lg font-mono text-sm md:text-base text-[#111c2d] shadow-sm transition-all outline-none placeholder:font-sans placeholder:text-[#94a3b8]"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsGlobalSearchOpen(true)}
              className="p-1 hover:bg-[#f1f5f9] rounded text-[#64748b] transition-colors"
              title="Buscar en catálogo (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs bg-[#1e293b] text-white px-2 py-1 rounded font-bold">
              [F3]
            </span>
          </div>
        </form>

        {/* Quick Access Bar (F1 - F4) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => {
              const p = products.find(p => p.code === '00000004') || products[2];
              if (p) addProductToCart(p, 1);
            }}
            className="bg-white border border-[#cbd5e1] py-2.5 px-3 rounded-lg relative hover:bg-[#f1f5f9] hover:border-[#94a3b8] active:scale-[0.98] transition-all shadow-sm flex flex-col items-center justify-center text-center group"
          >
            <span className="font-mono text-[10px] absolute top-1.5 right-1.5 bg-[#1e293b] text-white px-1.5 py-0.5 rounded font-bold">
              [F1]
            </span>
            <span className="font-medium text-xs md:text-sm text-[#111c2d] group-hover:text-[#006948] transition-colors">
              Pan de Agua
            </span>
            <span className="font-mono text-[11px] text-[#64748b] mt-0.5">$0.15</span>
          </button>

          <button
            onClick={() => {
              const p = products.find(p => p.code === '78610002') || products[3];
              if (p) addProductToCart(p, 1);
            }}
            className="bg-white border border-[#cbd5e1] py-2.5 px-3 rounded-lg relative hover:bg-[#f1f5f9] hover:border-[#94a3b8] active:scale-[0.98] transition-all shadow-sm flex flex-col items-center justify-center text-center group"
          >
            <span className="font-mono text-[10px] absolute top-1.5 right-1.5 bg-[#1e293b] text-white px-1.5 py-0.5 rounded font-bold">
              [F2]
            </span>
            <span className="font-medium text-xs md:text-sm text-[#111c2d] group-hover:text-[#006948] transition-colors">
              Huevos
            </span>
            <span className="font-mono text-[11px] text-[#64748b] mt-0.5">$0.18</span>
          </button>

          <button
            onClick={() => {
              const p = products.find(p => p.code === '78610003') || products[4];
              if (p) addProductToCart(p, 1);
            }}
            className="bg-white border border-[#cbd5e1] py-2.5 px-3 rounded-lg relative hover:bg-[#f1f5f9] hover:border-[#94a3b8] active:scale-[0.98] transition-all shadow-sm flex flex-col items-center justify-center text-center group"
          >
            <span className="font-mono text-[10px] absolute top-1.5 right-1.5 bg-[#1e293b] text-white px-1.5 py-0.5 rounded font-bold">
              [F3]
            </span>
            <span className="font-medium text-xs md:text-sm text-[#111c2d] group-hover:text-[#006948] transition-colors">
              Queso
            </span>
            <span className="font-mono text-[11px] text-[#64748b] mt-0.5">$2.80</span>
          </button>

          <button
            onClick={() => {
              const p = products.find(p => p.code === '00000099') || products[5];
              if (p) addProductToCart(p, 1);
            }}
            className="bg-white border border-[#cbd5e1] py-2.5 px-3 rounded-lg relative hover:bg-[#f1f5f9] hover:border-[#94a3b8] active:scale-[0.98] transition-all shadow-sm flex flex-col items-center justify-center text-center group"
          >
            <span className="font-mono text-[10px] absolute top-1.5 right-1.5 bg-[#1e293b] text-white px-1.5 py-0.5 rounded font-bold">
              [F4]
            </span>
            <span className="font-medium text-xs md:text-sm text-[#111c2d] group-hover:text-[#006948] transition-colors">
              Recarga
            </span>
            <span className="font-mono text-[11px] text-[#64748b] mt-0.5">$1.00</span>
          </button>
        </div>

        {/* Cart Table Container */}
        <div className="flex-1 bg-white border border-[#cbd5e1] rounded-lg overflow-hidden flex flex-col shadow-sm">
          {/* Table Header */}
          <div className="bg-[#f1f5f9] border-b border-[#cbd5e1] px-4 py-2.5 grid grid-cols-12 text-xs font-mono font-bold text-[#64748b] uppercase tracking-wider shrink-0">
            <div className="col-span-1">#</div>
            <div className="col-span-2">Código</div>
            <div className="col-span-4">Descripción</div>
            <div className="col-span-2 text-center">Cant.</div>
            <div className="col-span-1 text-right">P. Unit</div>
            <div className="col-span-1 text-right">Subtotal</div>
            <div className="col-span-1 text-center">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[#ef4444] hover:text-[#b91c1c] text-[10px] uppercase font-bold"
                  title="Vaciar carrito"
                >
                  Vaciar
                </button>
              )}
            </div>
          </div>

          {/* Table Scrollable Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#e2e8f0]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[#94a3b8]">
                <ShoppingBag className="w-12 h-12 text-[#cbd5e1] mb-2" />
                <p className="font-semibold text-sm text-[#64748b]">Carrito vacío</p>
                <p className="text-xs text-[#94a3b8] max-w-xs mt-1">
                  Escanee un código de barras o use los botones de acceso rápido [F1 - F4] para comenzar a vender.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isSelected = selectedCartIndex === idx;

                return (
                  <div
                    key={item.product.id}
                    onClick={() => setSelectedCartIndex(idx)}
                    className={`grid grid-cols-12 items-center px-4 py-2.5 transition-colors cursor-pointer text-sm ${
                      isSelected
                        ? 'bg-[#316bf3]/10 ring-1 ring-inset ring-[#316bf3] shadow-sm'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-[#f8fafc]'
                        : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    {/* # Index */}
                    <div className="col-span-1 font-mono text-xs text-[#64748b]">
                      {idx + 1}
                    </div>

                    {/* Code */}
                    <div className="col-span-2 font-mono text-xs text-[#475569] truncate pr-2">
                      {item.product.code}
                    </div>

                    {/* Description */}
                    <div className="col-span-4 font-semibold text-[#111c2d] truncate pr-2">
                      <span className={isSelected ? 'text-[#0051d5]' : ''}>
                        {item.product.name}
                      </span>
                    </div>

                    {/* Quantity Controls */}
                    <div className="col-span-2 flex items-center justify-center">
                      <div
                        className={`flex items-center rounded border ${
                          isSelected
                            ? 'border-[#316bf3] bg-white shadow-xs'
                            : 'border-[#cbd5e1] bg-[#f8fafc]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCartQuantity(item.product.id, item.quantity - 1);
                          }}
                          className={`px-2 py-0.5 text-xs font-bold hover:bg-[#e2e8f0] ${
                            isSelected ? 'text-[#316bf3]' : 'text-[#475569]'
                          }`}
                        >
                          -
                        </button>
                        <span
                          className={`px-2.5 py-0.5 font-mono text-xs font-bold bg-white border-x ${
                            isSelected
                              ? 'border-[#316bf3] text-[#316bf3]'
                              : 'border-[#cbd5e1] text-[#111c2d]'
                          }`}
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateCartQuantity(item.product.id, item.quantity + 1);
                          }}
                          className={`px-2 py-0.5 text-xs font-bold hover:bg-[#e2e8f0] ${
                            isSelected ? 'text-[#316bf3]' : 'text-[#475569]'
                          }`}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-1 font-mono text-xs text-[#64748b] text-right">
                      ${item.unitPrice.toFixed(2)}
                    </div>

                    {/* Subtotal */}
                    <div
                      className={`col-span-1 font-mono text-sm font-bold text-right ${
                        isSelected ? 'text-[#316bf3]' : 'text-[#111c2d]'
                      }`}
                    >
                      ${item.subtotal.toFixed(2)}
                    </div>

                    {/* Delete button */}
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(item.product.id);
                        }}
                        className="p-1 text-[#ef4444] hover:bg-[#fee2e2] rounded transition-colors"
                        title="Eliminar de la lista"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Section: Checkout (approx 35%) */}
      <div className="w-full lg:w-[380px] xl:w-[420px] bg-white border-t lg:border-t-0 lg:border-l border-[#cbd5e1] flex flex-col p-4 md:p-6 overflow-y-auto shrink-0">
        
        {/* Summary Card */}
        <div className="bg-[#f8fafc] border border-[#cbd5e1] p-4 rounded-lg mb-4 shadow-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs md:text-sm text-[#64748b] font-medium">Total Artículos</span>
            <span className="font-mono text-sm font-bold text-[#111c2d]">{totalArticles}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs md:text-sm text-[#64748b] font-medium">Total Unidades</span>
            <span className="font-mono text-sm font-bold text-[#111c2d]">{totalUnits}</span>
          </div>
          <div className="flex justify-between items-center border-t border-[#cbd5e1] pt-2 mt-2">
            <span className="text-xs md:text-sm text-[#475569] font-semibold">Subtotal</span>
            <span className="font-mono text-sm md:text-base font-bold text-[#111c2d]">
              ${subtotal.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Digital Cash Register Display */}
        <div className="bg-[#0f172a] rounded-xl p-5 mb-4 border border-[#334155] shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-emerald-600 via-[#85f8c4] to-emerald-600 opacity-60" />
          <span className="text-[11px] md:text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            TOTAL A COBRAR
          </span>
          <span className="font-mono text-4xl md:text-5xl lg:text-[56px] font-black text-[#34d399] tracking-tight leading-tight drop-shadow-sm">
            $ {subtotal.toFixed(2)}
          </span>
        </div>

        {/* Payment Method Selector */}
        <div className="flex space-x-1 p-1 bg-[#f1f5f9] rounded-lg mb-4 border border-[#cbd5e1]">
          <button
            type="button"
            onClick={() => setPaymentMethod('cash')}
            className={`flex-1 py-2 rounded-md font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${
              paymentMethod === 'cash'
                ? 'bg-white text-[#111c2d] shadow-sm border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#111c2d]'
            }`}
          >
            <Banknote className="w-4 h-4 text-[#006948]" />
            <span>Efectivo</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('transfer')}
            className={`flex-1 py-2 rounded-md font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${
              paymentMethod === 'transfer'
                ? 'bg-white text-[#111c2d] shadow-sm border border-[#cbd5e1]'
                : 'text-[#64748b] hover:text-[#111c2d]'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#0051d5]" />
            <span>Transferencia</span>
          </button>
        </div>

        {/* Cash Calculation & Fast Buttons */}
        {paymentMethod === 'cash' ? (
          <div className="mb-4 flex-1">
            <label className="block text-xs font-semibold text-[#475569] mb-1">
              Efectivo Recibido
            </label>
            <div className="relative mb-2.5">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-mono text-lg font-bold text-[#94a3b8]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-[#cbd5e1] focus:border-[#316bf3] focus:ring-0 rounded-lg font-mono text-xl font-bold text-[#111c2d] text-right outline-none"
              />
            </div>

            {/* Quick Bill / Denomination Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPay(5)}
                className="py-2 bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-lg font-mono text-xs md:text-sm font-bold text-[#111c2d] shadow-xs active:scale-95 transition-all"
              >
                $5
              </button>
              <button
                type="button"
                onClick={() => handleQuickPay(10)}
                className="py-2 bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-lg font-mono text-xs md:text-sm font-bold text-[#111c2d] shadow-xs active:scale-95 transition-all"
              >
                $10
              </button>
              <button
                type="button"
                onClick={() => handleQuickPay(20)}
                className="py-2 bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-lg font-mono text-xs md:text-sm font-bold text-[#111c2d] shadow-xs active:scale-95 transition-all"
              >
                $20
              </button>
              <button
                type="button"
                onClick={() => handleQuickPay(50)}
                className="py-2 bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] rounded-lg font-mono text-xs md:text-sm font-bold text-[#111c2d] shadow-xs active:scale-95 transition-all"
              >
                $50
              </button>
              <button
                type="button"
                onClick={() => handleQuickPay('exact')}
                className="col-span-2 py-2 bg-[#f1f5f9] border border-[#cbd5e1] hover:bg-[#e2e8f0] rounded-lg font-sans text-xs md:text-sm font-bold text-[#111c2d] shadow-xs active:scale-95 transition-all"
              >
                Exacto
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg text-xs text-[#1e40af] flex-1">
            <p className="font-bold text-sm mb-1">Pago por Transferencia / DeUna / Banco</p>
            <p>
              Verifique el comprobante de transferencia bancaria por <strong>${subtotal.toFixed(2)}</strong> antes de confirmar la venta.
            </p>
          </div>
        )}

        {/* Change / Vuelto Box */}
        {paymentMethod === 'cash' && (
          <div className="bg-[#ecfdf5] border border-[#a7f3d0] p-3.5 rounded-lg mb-4 flex justify-between items-center shadow-xs">
            <span className="font-bold text-sm md:text-base text-[#065f46]">
              Cambio / Vuelto
            </span>
            <span className="font-mono text-xl md:text-2xl font-black text-[#047857]">
              $ {change.toFixed(2)}
            </span>
          </div>
        )}

        {/* Confirm Checkout Button */}
        <button
          type="button"
          onClick={() => {
            if (cart.length === 0) {
              showToast('Agregue productos al carrito antes de cobrar');
              return;
            }
            confirmCheckout();
          }}
          disabled={cart.length === 0}
          className={`w-full py-4 px-4 rounded-xl font-bold text-base md:text-lg shadow-md transition-all active:scale-[0.98] flex flex-col items-center justify-center relative overflow-hidden ${
            cart.length > 0
              ? 'bg-[#006948] hover:bg-[#005137] text-white cursor-pointer'
              : 'bg-[#94a3b8] text-white/70 cursor-not-allowed'
          }`}
        >
          <span className="font-mono text-xs absolute top-2 right-2 bg-black/40 text-white px-2 py-0.5 rounded font-bold">
            [F5]
          </span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>CONFIRMAR COBRO</span>
          </div>
          <span className="text-xs font-normal opacity-85 mt-0.5 tracking-wider">
            E IMPRIMIR TICKET
          </span>
        </button>

      </div>
    </div>
  );
};
