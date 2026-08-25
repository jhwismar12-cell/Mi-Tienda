import React, { useState, useMemo } from 'react';
import {
  Banknote,
  TrendingUp,
  Package,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Download
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const DashboardScreen: React.FC = () => {
  const {
    products,
    sales,
    cashShift,
    setCountedCash,
    closeShiftAndGenerateReport,
    setIsCashMovementModalOpen,
    showToast
  } = useStore();

  const [inputCountedCash, setInputCountedCash] = useState<string>(
    cashShift.countedCash.toFixed(2)
  );

  // Live Calculations
  const todaySalesTotal = useMemo(() => {
    return Number(sales.reduce((sum, s) => sum + s.subtotal, 0).toFixed(2));
  }, [sales]);

  const grossProfit = useMemo(() => {
    let profit = 0;
    sales.forEach(s => {
      s.items.forEach(it => {
        profit += (it.unitPrice - (it.costPrice || it.unitPrice * 0.7)) * it.quantity;
      });
    });
    return Number(profit.toFixed(2));
  }, [sales]);

  const inventoryCostValue = useMemo(() => {
    return Number(products.reduce((sum, p) => sum + p.costPrice * p.stock, 0).toFixed(2));
  }, [products]);

  const inventorySaleValue = useMemo(() => {
    return Number(products.reduce((sum, p) => sum + p.salePrice * p.stock, 0).toFixed(2));
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.stock === 0).length;
  }, [products]);

  const countedNum = parseFloat(inputCountedCash) || 0;
  const difference = Number((countedNum - cashShift.expectedCash).toFixed(2));
  const isPerfectMatch = Math.abs(difference) < 0.01;
  const isMissing = difference < -0.01;
  const isSurplus = difference > 0.01;

  const handleCountedChange = (val: string) => {
    setInputCountedChangeState(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setCountedCash(parsed);
    }
  };

  const setInputCountedChangeState = (val: string) => {
    setInputCountedCash(val);
  };

  // Hourly sales chart simulation data
  const hourlyData = [
    { hour: '08:00', amount: 45, height: '22%' },
    { hour: '10:00', amount: 110, height: '48%' },
    { hour: '12:00', amount: 80, height: '35%' },
    { hour: '14:00', amount: 210, height: '85%' },
    { hour: '16:00', amount: 130, height: '58%' },
    { hour: '18:00', amount: 25, height: '16%' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#f8fafc] select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div>
            <h1 className="font-bold text-xl md:text-2xl text-[#111c2d]">
              Dashboard & Arqueo de Caja
            </h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-0.5">
              Resumen del turno actual - {cashShift.cashierName} (Abierto {cashShift.openedAt})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCashMovementModalOpen(true)}
              className="bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] text-[#111c2d] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#006948]" />
              <span>Registrar Retiro / Pago</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#fff8e1] text-[#b45309] border border-[#fde68a] rounded-lg text-xs font-bold shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{outOfStockCount > 0 ? `${outOfStockCount} Alertas de Stock` : 'Turno Normal'}</span>
            </span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ventas de Hoy */}
          <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 flex flex-col justify-between shadow-xs">
            <div className="text-[#64748b] text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-[#006948]" />
              <span>Ventas de Hoy</span>
            </div>
            <div className="font-mono text-2xl font-bold text-[#111c2d]">
              $ {todaySalesTotal.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#64748b] mt-1.5">
              {sales.length} tickets emitidos
            </div>
          </div>

          {/* KPI 2: Ganancia Bruta */}
          <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 flex flex-col justify-between shadow-xs">
            <div className="text-[#64748b] text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#00855d]" />
              <span>Ganancia Bruta</span>
            </div>
            <div className="font-mono text-2xl font-bold text-[#006948]">
              $ {grossProfit.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#00855d] mt-1.5 font-bold">
              +30% margen promedio
            </div>
          </div>

          {/* KPI 3: Valor Inventario (Costo / Venta) */}
          <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 flex flex-col justify-between sm:col-span-2 shadow-xs">
            <div className="text-[#64748b] text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#316bf3]" />
              <span>Valor Inventario (Costo / Venta)</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-[#64748b]">
                $ {inventoryCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[#94a3b8] font-bold text-lg">/</span>
              <span className="font-mono text-2xl font-bold text-[#111c2d]">
                $ {inventorySaleValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              {outOfStockCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b91c1c] bg-[#fef2f2] px-2 py-0.5 rounded border border-[#fecaca]">
                  {outOfStockCount} Agotados
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b45309] bg-[#fffbeb] px-2 py-0.5 rounded border border-[#fde68a]">
                1 Costo incrementado
              </span>
            </div>
          </div>
        </div>

        {/* Main Work Area: Arqueo de Caja & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cierre de Turno (Arqueo) - Left Column */}
          <div className="lg:col-span-5 bg-white border border-[#cbd5e1] rounded-xl overflow-hidden shadow-xs flex flex-col">
            <div className="bg-[#f8fafc] px-5 py-3.5 border-b border-[#cbd5e1]">
              <h2 className="font-bold text-base md:text-lg text-[#111c2d]">
                Cierre de Turno (Arqueo)
              </h2>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
              {/* Comparative Panel */}
              <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#cbd5e1] space-y-2 text-xs md:text-sm">
                <div className="flex justify-between items-center text-[#475569]">
                  <span>Fondo Inicial Caja:</span>
                  <span className="font-mono font-semibold text-[#111c2d]">
                    $ {cashShift.initialCash.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[#475569]">
                  <span>Ventas en Efectivo (+):</span>
                  <span className="font-mono font-bold text-[#006948]">
                    $ {cashShift.cashSalesTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[#475569]">
                  <span>Retiros / Pagos (-):</span>
                  <span className="font-mono font-bold text-[#dc2626]">
                    $ {cashShift.withdrawalsTotal.toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-[#cbd5e1] pt-2.5 mt-2 flex justify-between items-center font-bold text-sm md:text-base">
                  <span className="text-[#111c2d]">Efectivo Esperado:</span>
                  <span className="font-mono text-base md:text-lg text-[#111c2d]">
                    $ {cashShift.expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Input Area: Efectivo Real Contado */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#111c2d]">
                  Efectivo Real Contado
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-[#64748b]">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={inputCountedCash}
                    onChange={(e) => handleCountedChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-[#cbd5e1] rounded-lg font-mono text-base md:text-lg font-bold text-right text-[#111c2d] focus:border-[#316bf3] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Balance Indicator Status */}
              {isPerfectMatch ? (
                <div className="flex items-center justify-center p-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl text-[#047857] font-bold text-xs md:text-sm gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cuadre Perfecto ($ 0.00)</span>
                </div>
              ) : isMissing ? (
                <div className="flex items-center justify-center p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-[#b91c1c] font-bold text-xs md:text-sm gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Faltante en Caja ({difference.toFixed(2)})</span>
                </div>
              ) : (
                <div className="flex items-center justify-center p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl text-[#1e40af] font-bold text-xs md:text-sm gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sobrante en Caja (+${difference.toFixed(2)})</span>
                </div>
              )}
            </div>

            {/* Final Action Button */}
            <div className="p-4 bg-[#f8fafc] border-t border-[#cbd5e1] mt-auto">
              <button
                onClick={closeShiftAndGenerateReport}
                className="w-full bg-[#006948] hover:bg-[#005137] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-colors shadow-sm active:scale-[0.98]"
              >
                <Receipt className="w-4 h-4 text-[#85f8c4]" />
                <span className="text-xs md:text-sm">
                  Cerrar Turno e Imprimir Reporte Z
                </span>
              </button>
            </div>
          </div>

          {/* Chart & Recent Activity - Right Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Chart: Ventas por Hora */}
            <div className="bg-white border border-[#cbd5e1] rounded-xl p-5 shadow-xs flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm md:text-base text-[#111c2d]">
                  Ventas por Hora
                </h3>
                <span className="text-[11px] font-mono text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded">
                  Turno Activo
                </span>
              </div>

              {/* Chart Visual Representation */}
              <div className="h-44 relative border-l border-b border-[#cbd5e1] ml-4 mb-2 flex items-end justify-between px-3 pt-3 gap-3">
                {hourlyData.map((item, idx) => (
                  <div
                    key={item.hour}
                    className="w-full flex flex-col items-center h-full justify-end group relative"
                  >
                    {/* Hover tooltip */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#111c2d] text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap pointer-events-none">
                      ${item.amount}
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: item.height }}
                      className={`w-full rounded-t transition-all ${
                        idx === 3
                          ? 'bg-[#006948] hover:bg-[#00855d]'
                          : 'bg-[#006948]/30 hover:bg-[#006948]/50'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* X Axis Labels */}
              <div className="flex justify-between text-xs text-[#64748b] font-mono ml-4 px-2">
                {hourlyData.map(item => (
                  <span key={item.hour}>{item.hour}</span>
                ))}
              </div>
            </div>

            {/* Table: Últimos Movimientos */}
            <div className="bg-white border border-[#cbd5e1] rounded-xl p-5 shadow-xs flex-1">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm md:text-base text-[#111c2d]">
                  Últimos Movimientos de Caja
                </h3>
                <button
                  onClick={() => setIsCashMovementModalOpen(true)}
                  className="text-xs text-[#316bf3] hover:underline font-semibold"
                >
                  + Agregar Retiro / Pago
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] font-mono text-[11px] uppercase text-[#64748b] border-b border-[#cbd5e1]">
                      <th className="p-2.5">Hora</th>
                      <th className="p-2.5">Tipo / Descripción</th>
                      <th className="p-2.5 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs md:text-sm divide-y divide-[#e2e8f0]">
                    {cashShift.movements.slice(0, 5).map((mov) => {
                      const isNegative = mov.amount < 0 || mov.type === 'RETIRO';

                      return (
                        <tr key={mov.id} className="hover:bg-[#f8fafc] transition-colors">
                          <td className="p-2.5 font-mono text-xs text-[#64748b]">
                            {mov.time}
                          </td>
                          <td className="p-2.5 font-medium text-[#111c2d]">
                            {mov.description}
                          </td>
                          <td
                            className={`p-2.5 font-mono font-bold text-right ${
                              isNegative ? 'text-[#dc2626]' : 'text-[#006948]'
                            }`}
                          >
                            {isNegative ? `-$ ${Math.abs(mov.amount).toFixed(2)}` : `+$ ${mov.amount.toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
