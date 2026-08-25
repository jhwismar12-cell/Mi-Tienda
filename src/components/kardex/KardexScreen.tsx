import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  Package,
  Flag,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  User,
  FileText
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { KardexType } from '../../types';

export const KardexScreen: React.FC = () => {
  const { products, kardexMovements, showToast } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

  const movementTypes: { id: string; label: string }[] = [
    { id: 'all', label: 'Todos los tipos' },
    { id: 'INICIAL', label: 'Inventario Inicial' },
    { id: 'COMPRA', label: 'Compras / Recepción' },
    { id: 'VENTA', label: 'Ventas en Caja' },
    { id: 'VENTA MAYORISTA', label: 'Venta Mayorista' },
    { id: 'DAÑO', label: 'Mermas / Daños' },
    { id: 'AJUSTE_POSITIVO', label: 'Ajuste Entrada' },
    { id: 'AJUSTE_NEGATIVO', label: 'Ajuste Salida' }
  ];

  const enrichedMovements = useMemo(() => {
    return kardexMovements.map(mov => {
      const product = products.find(p => p.id === mov.productId);
      return {
        ...mov,
        productName: product ? product.name : 'Producto General',
        productCode: product ? product.code : 'S/C'
      };
    });
  }, [kardexMovements, products]);

  const filteredMovements = useMemo(() => {
    return enrichedMovements.filter(mov => {
      const matchesSearch =
        mov.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mov.productCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mov.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mov.responsible.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'all' || mov.type === selectedType;
      const matchesProduct = selectedProductFilter === 'all' || mov.productId === selectedProductFilter;

      return matchesSearch && matchesType && matchesProduct;
    });
  }, [enrichedMovements, searchQuery, selectedType, selectedProductFilter]);

  const handleExportKardex = () => {
    const headers = 'Fecha,Hora,Código,Producto,Tipo,Documento,Responsable,Cantidad,Saldo,Costo Unit,Notas\n';
    const rows = filteredMovements
      .map(
        m =>
          `"${m.date}","${m.time}","${m.productCode}","${m.productName}","${m.type}","${m.docNumber}","${m.responsible}",${m.quantityChange},${m.balance},${m.costUnit || 0},"${m.notes || ''}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kardex_general_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Kardex completo exportado a CSV');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#cbd5e1] bg-white shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="font-bold text-xl md:text-2xl text-[#111c2d]">
              Kardex General de Movimientos
            </h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-0.5">
              Auditoría y trazabilidad completa de entradas, salidas, ventas y mermas.
            </p>
          </div>

          <button
            onClick={handleExportKardex}
            className="bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] text-[#111c2d] px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-[#64748b]" />
            <span>Exportar Kardex (CSV)</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3 bg-[#f8fafc] p-2.5 rounded-xl border border-[#cbd5e1]">
          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por producto, código, documento o responsable..."
              className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-9 pr-3 py-1.5 text-xs md:text-sm text-[#111c2d] outline-none focus:border-[#316bf3]"
            />
          </div>

          {/* Type Filter */}
          <div className="min-w-[180px]">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs md:text-sm text-[#111c2d] outline-none focus:border-[#316bf3]"
            >
              {movementTypes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div className="min-w-[200px]">
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs md:text-sm text-[#111c2d] outline-none focus:border-[#316bf3]"
            >
              <option value="all">Todos los productos</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#f1f5f9] z-10 shadow-[0_1px_0_0_#cbd5e1]">
            <tr className="font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider">
              <th className="px-4 py-2.5">Fecha & Hora</th>
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5">Tipo Movimiento</th>
              <th className="px-4 py-2.5">Doc / Ref</th>
              <th className="px-4 py-2.5">Responsable</th>
              <th className="px-4 py-2.5 text-right">Variación</th>
              <th className="px-4 py-2.5 text-right">Saldo</th>
              <th className="px-4 py-2.5">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0] text-xs md:text-sm">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#94a3b8]">
                  No se encontraron registros de Kardex con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((mov) => {
                const isPositive = mov.quantityChange > 0;
                const isNegative = mov.quantityChange < 0;

                return (
                  <tr key={mov.id} className="hover:bg-[#f8fafc] transition-colors">
                    {/* Date / Time */}
                    <td className="px-4 py-2.5 font-mono text-xs text-[#64748b] whitespace-nowrap">
                      {mov.date} {mov.time}
                    </td>

                    {/* Product */}
                    <td className="px-4 py-2.5 font-semibold text-[#111c2d]">
                      <div>{mov.productName}</div>
                      <div className="font-mono text-[11px] text-[#64748b] font-normal">{mov.productCode}</div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          mov.type === 'INICIAL'
                            ? 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]'
                            : mov.type === 'COMPRA'
                            ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]'
                            : mov.type === 'DAÑO'
                            ? 'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]'
                            : 'bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe]'
                        }`}
                      >
                        {mov.type}
                      </span>
                    </td>

                    {/* Doc */}
                    <td className="px-4 py-2.5 font-mono text-xs text-[#334155]">
                      {mov.docNumber}
                    </td>

                    {/* Responsible */}
                    <td className="px-4 py-2.5 text-xs text-[#64748b]">
                      {mov.responsible}
                    </td>

                    {/* Variation */}
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-xs md:text-sm">
                      {isPositive ? (
                        <span className="text-[#059669]">+{mov.quantityChange}</span>
                      ) : isNegative ? (
                        <span className="text-[#dc2626]">{mov.quantityChange}</span>
                      ) : (
                        <span className="text-[#64748b]">0</span>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-xs md:text-sm text-[#111c2d]">
                      {mov.balance} un
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-2.5 text-xs text-[#64748b] italic max-w-xs truncate">
                      {mov.notes || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
