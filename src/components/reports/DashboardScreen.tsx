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
  Download,
  Edit2,
  DollarSign,
  X,
  Save,
  RotateCcw,
  Search,
  Eye,
  User,
  ShoppingBag
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const DashboardScreen: React.FC = () => {
  const {
    products,
    sales,
    cashShift,
    setCountedCash,
    updateInitialCash,
    closeShiftAndGenerateReport,
    setIsCashMovementModalOpen,
    setLastCompletedSale,
    setIsReceiptModalOpen,
    showToast
  } = useStore();

  const [inputCountedCash, setInputCountedCash] = useState<string>(
    cashShift.countedCash.toFixed(2)
  );
  const [salesSearchTerm, setSalesSearchTerm] = useState('');

  // Edit Initial Cash Modal State
  const [isEditInitialCashModalOpen, setIsEditInitialCashModalOpen] = useState(false);
  const [editInitialCashValue, setEditInitialCashValue] = useState<string>(
    cashShift.initialCash.toFixed(2)
  );

  // Live Calculations (only today's sales; `sales` also holds history from previous days)
  const todaySales = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return sales.filter(s => s.date === todayStr);
  }, [sales]);

  const todaySalesTotal = useMemo(() => {
    return Number(todaySales.reduce((sum, s) => sum + s.subtotal, 0).toFixed(2));
  }, [todaySales]);

  const grossProfit = useMemo(() => {
    let profit = 0;
    todaySales.forEach(s => {
      s.items.forEach(it => {
        profit += (it.unitPrice - (it.costPrice || it.unitPrice * 0.7)) * it.quantity;
      });
    });
    return Number(profit.toFixed(2));
  }, [todaySales]);

  const inventoryCostValue = useMemo(() => {
    return Number(products.reduce((sum, p) => sum + p.costPrice * p.stock, 0).toFixed(2));
  }, [products]);

  const inventorySaleValue = useMemo(() => {
    return Number(products.reduce((sum, p) => sum + p.salePrice * p.stock, 0).toFixed(2));
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.stock === 0).length;
  }, [products]);

  const filteredSales = useMemo(() => {
    if (!salesSearchTerm.trim()) return sales;
    const term = salesSearchTerm.trim().toLowerCase();
    return sales.filter(s =>
      (s.ticketNumber && s.ticketNumber.toLowerCase().includes(term)) ||
      (s.cashierName && s.cashierName.toLowerCase().includes(term)) ||
      (s.date && s.date.includes(term))
    );
  }, [sales, salesSearchTerm]);

  const countedNum = parseFloat(inputCountedCash) || 0;
  const difference = Number((countedNum - cashShift.expectedCash).toFixed(2));
  const isPerfectMatch = Math.abs(difference) < 0.01;
  const isMissing = difference < -0.01;
  const isSurplus = difference > 0.01;

  const handleCountedChange = (val: string) => {
    setInputCountedCash(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setCountedCash(parsed);
    }
  };

  const handleSaveInitialCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAmt = parseFloat(editInitialCashValue);
    if (isNaN(newAmt) || newAmt < 0) {
      showToast('⚠️ El monto del fondo inicial debe ser un número válido mayor o igual a 0.');
      return;
    }

    try {
      await updateInitialCash(newAmt);
      setIsEditInitialCashModalOpen(false);
    } catch {
      // Keep the form open; the store displays the error.
    }
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
    <div className="workspace-screen flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[var(--ui-surface-muted)] select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
          <div>
            <p className="workspace-eyebrow mb-1">Resumen operativo</p>
            <h1 className="workspace-heading font-bold text-xl md:text-2xl text-[var(--ui-text)]">
              Reportes y arqueo de caja
            </h1>
            <p className="text-xs md:text-sm text-[var(--ui-muted)] mt-0.5">
              Resumen del turno actual - {cashShift.cashierName} (Abierto {cashShift.openedAt})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCashMovementModalOpen(true)}
              className="bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-text)] px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
              <span>Registrar Retiro / Pago</span>
            </button>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border border-[var(--ui-warning-border)] rounded-lg text-xs font-bold shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{outOfStockCount > 0 ? `${outOfStockCount} Alertas de Stock` : 'Turno Normal'}</span>
            </span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ventas de Hoy */}
          <div className="metric-card surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-4 flex flex-col justify-between shadow-xs">
            <div className="text-[var(--ui-muted)] text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-[var(--ui-brand-strong)]" />
              <span>Ventas de Hoy</span>
            </div>
            <div className="metric-value font-mono text-2xl font-bold text-[var(--ui-text)]">
              $ {todaySalesTotal.toFixed(2)}
            </div>
            <div className="text-[11px] text-[var(--ui-muted)] mt-1.5">
              {sales.length} tickets emitidos
            </div>
          </div>

          {/* KPI 2: Ganancia Bruta */}
          <div className="metric-card surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-4 flex flex-col justify-between shadow-xs">
            <div className="text-[var(--ui-muted)] text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[var(--ui-brand-strong)]" />
              <span>Ganancia Bruta</span>
            </div>
            <div className="metric-value font-mono text-2xl font-bold text-[var(--ui-brand-strong)]">
              $ {grossProfit.toFixed(2)}
            </div>
            <div className="text-[11px] text-[var(--ui-brand-strong)] mt-1.5 font-bold">
              +30% margen promedio
            </div>
          </div>

          {/* KPI 3: Valor Inventario (Costo / Venta) */}
          <div className="metric-card surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-4 flex flex-col justify-between sm:col-span-2 shadow-xs">
            <div className="text-[var(--ui-muted)] text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[var(--ui-brand-strong)]" />
              <span>Valor Inventario (Costo / Venta)</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="metric-value font-mono text-2xl font-bold text-[var(--ui-muted)]">
                $ {inventoryCostValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[var(--ui-subtle)] font-bold text-lg">/</span>
              <span className="metric-value font-mono text-2xl font-bold text-[var(--ui-text)]">
                $ {inventorySaleValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              {outOfStockCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ui-danger-text)] bg-[var(--ui-danger-bg)] px-2 py-0.5 rounded border border-[var(--ui-danger-border)]">
                  {outOfStockCount} Agotados
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--ui-warning-text)] bg-[var(--ui-warning-bg)] px-2 py-0.5 rounded border border-[var(--ui-warning-border)]">
                1 Costo incrementado
              </span>
            </div>
          </div>
        </div>

        {/* Main Work Area: Arqueo de Caja & Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cierre de Turno (Arqueo) - Left Column */}
          <div className="lg:col-span-5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl overflow-hidden shadow-xs flex flex-col">
            <div className="bg-[var(--ui-surface-muted)] px-5 py-3.5 border-b border-[var(--ui-border)]">
              <h2 className="font-bold text-base md:text-lg text-[var(--ui-text)]">
                Cierre de Turno (Arqueo)
              </h2>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-4">
              {/* Comparative Panel */}
              <div className="bg-[var(--ui-surface-muted)] p-4 rounded-xl border border-[var(--ui-border)] space-y-2.5 text-xs md:text-sm">
                {/* Fondo Inicial Editable */}
                <div className="flex justify-between items-center text-[var(--ui-secondary)]">
                  <div className="flex items-center gap-2">
                    <span>Fondo Inicial Caja:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditInitialCashValue(cashShift.initialCash.toFixed(2));
                        setIsEditInitialCashModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--ui-brand-strong)] hover:text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 hover:bg-[var(--ui-brand)]/20 px-2 py-0.5 rounded font-bold transition-all cursor-pointer group"
                      title="Clic para modificar el fondo inicial de apertura de caja"
                    >
                      <Edit2 className="w-3 h-3 text-[var(--ui-brand-strong)]" />
                      <span>Editar</span>
                    </button>
                  </div>
                  <span className="font-mono font-bold text-sm text-[var(--ui-text)]">
                    $ {cashShift.initialCash.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[var(--ui-secondary)]">
                  <span>Ventas en Efectivo (+):</span>
                  <span className="font-mono font-bold text-[var(--ui-brand-strong)]">
                    $ {cashShift.cashSalesTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[var(--ui-secondary)]">
                  <span>Retiros / Pagos (-):</span>
                  <span className="font-mono font-bold text-[var(--ui-danger-text)]">
                    $ {cashShift.withdrawalsTotal.toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-[var(--ui-border)] pt-2.5 mt-2 flex justify-between items-center font-bold text-sm md:text-base">
                  <span className="text-[var(--ui-text)]">Efectivo Esperado:</span>
                  <span className="font-mono text-base md:text-lg text-[var(--ui-brand-strong)] font-black">
                    $ {cashShift.expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Input Area: Efectivo Real Contado */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--ui-text)]">
                  Efectivo Real Contado en Gaveta
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-[var(--ui-muted)]">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={inputCountedCash}
                    onChange={(e) => handleCountedChange(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-[var(--ui-surface)] border-2 border-[var(--ui-border)] rounded-lg font-mono text-base md:text-lg font-bold text-right text-[var(--ui-text)] focus:border-[var(--ui-brand)] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Balance Indicator Status */}
              {isPerfectMatch ? (
                <div className="flex items-center justify-center p-3 bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] rounded-xl text-[var(--ui-brand-strong)] font-bold text-xs md:text-sm gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cuadre Perfecto ($ 0.00)</span>
                </div>
              ) : isMissing ? (
                <div className="flex items-center justify-center p-3 bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] rounded-xl text-[var(--ui-danger-text)] font-bold text-xs md:text-sm gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Faltante en Caja ({difference.toFixed(2)})</span>
                </div>
              ) : (
                <div className="flex items-center justify-center p-3 bg-[var(--ui-info-bg)] border border-[var(--ui-info-border)] rounded-xl text-[var(--ui-info-text)] font-bold text-xs md:text-sm gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sobrante en Caja (+${difference.toFixed(2)})</span>
                </div>
              )}
            </div>

            {/* Final Action Button */}
            <div className="p-4 bg-[var(--ui-surface-muted)] border-t border-[var(--ui-border)] mt-auto">
              <button
                onClick={closeShiftAndGenerateReport}
                className="w-full bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-colors shadow-sm active:scale-[0.98] cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-[var(--ui-mint)]" />
                <span className="text-xs md:text-sm">
                  Cerrar Turno e Imprimir Reporte Z [F12]
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Hourly Sales Chart & Quick Stats */}
          <div className="lg:col-span-7 space-y-6">
            {/* Hourly Sales Visualization */}
            <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-base text-[var(--ui-text)]">
                    Ventas por Hora (Turno Actual)
                  </h3>
                  <p className="text-xs text-[var(--ui-muted)]">Comportamiento de la afluencia en caja</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-2.5 py-1 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pico: 14:00 - 16:00</span>
                </div>
              </div>

              {/* Chart Bars */}
              <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-[var(--ui-border)]">
                {hourlyData.map((d) => (
                  <div key={d.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[10px] font-bold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-1 rounded">
                      ${d.amount}
                    </div>
                    <div
                      style={{ height: d.height }}
                      className="w-full max-w-[42px] bg-[var(--ui-brand)] group-hover:bg-[var(--ui-brand)] rounded-t-lg transition-all shadow-xs"
                    />
                    <span className="font-mono text-[11px] text-[var(--ui-muted)]">{d.hour}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Session Details & Cash Breakdown */}
            <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
              <h3 className="font-bold text-sm text-[var(--ui-text)] mb-3">
                Desglose de Movimientos del Turno
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[var(--ui-surface-muted)] rounded-lg border border-[var(--ui-border)]">
                  <div className="text-[var(--ui-muted)] font-medium">Apertura</div>
                  <div className="font-mono font-bold text-sm text-[var(--ui-text)] mt-0.5">
                    ${cashShift.initialCash.toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-[var(--ui-brand-soft)] rounded-lg border border-[var(--ui-brand-soft-border)]">
                  <div className="text-[var(--ui-brand-strong)] font-medium">Ventas Efectivo</div>
                  <div className="font-mono font-bold text-sm text-[var(--ui-brand-strong)] mt-0.5">
                    ${cashShift.cashSalesTotal.toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-[var(--ui-info-bg)] rounded-lg border border-[var(--ui-info-border)]">
                  <div className="text-[var(--ui-info-text)] font-medium">Transferencias</div>
                  <div className="font-mono font-bold text-sm text-[var(--ui-info-text)] mt-0.5">
                    ${cashShift.transferSalesTotal.toFixed(2)}
                  </div>
                </div>

                <div className="p-3 bg-[var(--ui-danger-bg)] rounded-lg border border-[var(--ui-danger-border)]">
                  <div className="text-[var(--ui-danger-text)] font-medium">Retiros / Gastos</div>
                  <div className="font-mono font-bold text-sm text-[var(--ui-danger-text)] mt-0.5">
                    ${cashShift.withdrawalsTotal.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sales History & Cashier in Charge Table */}
        <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 md:p-5 border-b border-[var(--ui-border)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-base text-[var(--ui-text)] flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--ui-brand-strong)]" />
                <span>Historial de Ventas y Personas a Cargo</span>
              </h3>
              <p className="text-xs text-[var(--ui-muted)] mt-0.5">
                Auditoría detallada de tickets emitidos y qué trabajador estuvo atendiendo en cada venta.
              </p>
            </div>

            {/* Search Filter */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={salesSearchTerm}
                  onChange={(e) => setSalesSearchTerm(e.target.value)}
                  placeholder="Buscar por ticket o trabajador..."
                  className="pl-9 pr-3 py-1.5 text-xs bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)] w-56 md:w-64"
                />
              </div>
              <span className="px-2.5 py-1 bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] border border-[var(--ui-border)] rounded-lg font-mono text-xs font-bold shrink-0">
                {filteredSales.length} ventas
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-[var(--ui-surface-muted)] border-b border-[var(--ui-border)] font-mono text-[11px] font-bold text-[var(--ui-muted)] uppercase tracking-wider">
                  <th className="px-4 py-3"># Ticket</th>
                  <th className="px-4 py-3">Fecha & Hora</th>
                  <th className="px-4 py-3">Persona a Cargo</th>
                  <th className="px-4 py-3">Artículos / Cantidad</th>
                  <th className="px-4 py-3">Método de Pago</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Comprobante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ui-border)]">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--ui-subtle)]">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-[var(--ui-subtle)]" />
                      <p className="font-semibold text-sm text-[var(--ui-muted)]">No hay ventas registradas</p>
                      <p className="text-xs text-[var(--ui-subtle)] mt-0.5">
                        Las ventas realizadas desde el Punto de Venta aparecerán aquí detallando quién estuvo a cargo.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-[var(--ui-surface-muted)] transition-colors">
                      {/* Ticket Number */}
                      <td className="px-4 py-3 font-mono font-bold text-xs text-[var(--ui-brand-strong)]">
                        {sale.ticketNumber}
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ui-muted)] whitespace-nowrap">
                        {sale.date} <span className="text-[var(--ui-subtle)]">{sale.time}</span>
                      </td>

                      {/* Person in Charge */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--ui-brand)]/15 text-[var(--ui-brand-strong)] font-bold text-xs flex items-center justify-center ring-1 ring-[var(--ui-brand)]/30 shrink-0">
                            {(sale.cashierName || 'W').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-xs text-[var(--ui-text)]">
                            {sale.cashierName || 'Wismar (Administrador)'}
                          </span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3 text-xs text-[var(--ui-secondary)]">
                        <span>{sale.totalArticles || sale.items.length} productos</span>
                        <span className="text-[10px] text-[var(--ui-muted)] block">
                          ({sale.totalUnits} unidades)
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase ${
                          sale.paymentMethod === 'cash'
                            ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]'
                            : 'bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border border-[var(--ui-info-border)]'
                        }`}>
                          {sale.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-sm text-[var(--ui-text)]">
                        ${sale.subtotal.toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setLastCompletedSale(sale);
                            setIsReceiptModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-[var(--ui-surface-hover)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-text)] rounded-lg border border-[var(--ui-border)] transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="Ver y reimprimir comprobante"
                        >
                          <Eye className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Modificar Fondo Inicial de Caja */}
      {isEditInitialCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--ui-border)] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[var(--ui-text)]">
                  Editar Fondo Inicial de Caja
                </h3>
              </div>
              <button
                onClick={() => setIsEditInitialCashModalOpen(false)}
                className="text-[var(--ui-muted)] hover:text-[var(--ui-text)] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--ui-muted)]">
              Modifica el monto de dinero con el que abrió la caja hoy. El <strong>efectivo esperado</strong> y el balance del arqueo se recalcularán automáticamente.
            </p>

            <form onSubmit={handleSaveInitialCash} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--ui-text)] mb-1">
                  Nuevo Fondo Inicial ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-base font-bold text-[var(--ui-muted)]">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editInitialCashValue}
                    onChange={(e) => setEditInitialCashValue(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-[var(--ui-surface-muted)] border-2 border-[var(--ui-brand)] rounded-xl font-mono text-lg font-black text-[var(--ui-brand-strong)] outline-none focus:ring-2 focus:ring-[var(--ui-brand)]/20"
                    placeholder="25.00"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] font-semibold text-[var(--ui-muted)]">Montos rápidos:</span>
                {[10, 20, 25, 50, 100].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setEditInitialCashValue(amt.toFixed(2))}
                    className="px-2 py-1 bg-[var(--ui-surface-hover)] hover:bg-[var(--ui-surface-hover)] font-mono text-xs font-bold text-[var(--ui-secondary)] rounded-md transition-colors cursor-pointer"
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setIsEditInitialCashModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-lg border border-[var(--ui-border)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Fondo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
