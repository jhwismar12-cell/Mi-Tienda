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
      const salePrice =
        typeof mov.salePriceUnit === 'number' && Number.isFinite(mov.salePriceUnit)
          ? mov.salePriceUnit
          : product
          ? product.salePrice
          : 0;
      return {
        ...mov,
        productName: product ? product.name : 'Producto General',
        productCode: product ? product.code : 'S/C',
        salePrice,
        totalPvp: Number((Math.abs(mov.quantityChange) * salePrice).toFixed(2))
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
    const headers = 'Fecha,Hora,Código,Producto,Tipo,Documento,Responsable,Cantidad,PVP Unit,Total PVP,Saldo,Costo Unit,Notas\n';
    const rows = filteredMovements
      .map(
        m =>
          `"${m.date}","${m.time}","${m.productCode}","${m.productName}","${m.type}","${m.docNumber}","${m.responsible}",${m.quantityChange},${m.salePrice.toFixed(2)},${m.totalPvp.toFixed(2)},${m.balance},${m.costUnit || 0},"${m.notes || ''}"`
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
    <div className="workspace-screen flex-1 flex flex-col h-full overflow-hidden bg-[var(--ui-surface)] select-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <p className="workspace-eyebrow">Trazabilidad del inventario</p>
            <h1 className="workspace-heading font-bold text-xl md:text-2xl text-[var(--ui-text)]">
              Kardex General de Movimientos
            </h1>
            <p className="text-xs md:text-sm text-[var(--ui-muted)] mt-0.5">
              Auditoría y trazabilidad completa de entradas, salidas, ventas y mermas.
            </p>
          </div>

          <button
            onClick={handleExportKardex}
            className="bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-text)] px-4 py-2 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-[var(--ui-muted)]" />
            <span>Exportar Kardex (CSV)</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3 bg-[var(--ui-surface-muted)] p-2.5 rounded-xl border border-[var(--ui-border)]">
          {/* Search */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-[var(--ui-subtle)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por producto, código, documento o responsable..."
              className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg pl-9 pr-3 py-1.5 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
            />
          </div>

          {/* Type Filter */}
          <div className="min-w-[180px]">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-1.5 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
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
              className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-1.5 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
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
      <div className="flex-1 overflow-auto bg-[var(--ui-surface)]">
        <table className="kardex-table w-full text-left border-collapse">
          <thead className="table-heading sticky top-0 bg-[var(--ui-surface-hover)] z-10">
            <tr className="font-mono text-[11px] md:text-xs font-bold text-[var(--ui-muted)] uppercase tracking-wider">
              <th className="px-4 py-2.5">Fecha & Hora</th>
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5">Tipo Movimiento</th>
              <th className="px-4 py-2.5">Doc / Ref</th>
              <th className="px-4 py-2.5">Responsable</th>
              <th className="px-4 py-2.5 text-right">Variación</th>
              <th className="px-4 py-2.5 text-right">PVP</th>
              <th className="px-4 py-2.5 text-right">Saldo</th>
              <th className="px-4 py-2.5">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ui-border)] text-xs md:text-sm">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[var(--ui-subtle)]">
                  No se encontraron registros de Kardex con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredMovements.map((mov) => {
                const isPositive = mov.quantityChange > 0;
                const isNegative = mov.quantityChange < 0;

                return (
                  <tr key={mov.id} className="hover:bg-[var(--ui-surface-muted)] transition-colors">
                    {/* Date / Time */}
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--ui-muted)] whitespace-nowrap">
                      {mov.date} {mov.time}
                    </td>

                    {/* Product */}
                    <td className="px-4 py-2.5 font-semibold text-[var(--ui-text)]">
                      <div>{mov.productName}</div>
                      <div className="font-mono text-[11px] text-[var(--ui-muted)] font-normal">{mov.productCode}</div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-2.5">
                      <span
                        className={`status-pill inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          mov.type === 'INICIAL'
                            ? 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] border border-[var(--ui-border)]'
                            : mov.type === 'COMPRA'
                            ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]'
                            : mov.type === 'DAÑO'
                            ? 'bg-[var(--ui-danger-bg)] text-[var(--ui-danger-text)] border border-[var(--ui-danger-border)]'
                            : 'bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border border-[var(--ui-info-border)]'
                        }`}
                      >
                        {mov.type}
                      </span>
                    </td>

                    {/* Doc */}
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--ui-secondary)]">
                      {mov.docNumber}
                    </td>

                    {/* Responsible */}
                    <td className="px-4 py-2.5 text-xs text-[var(--ui-muted)]">
                      {mov.responsible}
                    </td>

                    {/* Variation */}
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-xs md:text-sm">
                      {isPositive ? (
                        <span className="text-[var(--ui-brand-strong)]">+{mov.quantityChange}</span>
                      ) : isNegative ? (
                        <span className="text-[var(--ui-danger-text)]">{mov.quantityChange}</span>
                      ) : (
                        <span className="text-[var(--ui-muted)]">0</span>
                      )}
                    </td>

                    {/* PVP */}
                    <td className="px-4 py-2.5 text-right font-mono text-xs md:text-sm whitespace-nowrap">
                      <div className="font-bold text-[var(--ui-brand-strong)]">
                        ${mov.salePrice.toFixed(2)}
                      </div>
                      {Math.abs(mov.quantityChange) !== 1 && mov.totalPvp > 0 && (
                        <div className="text-[10px] text-[var(--ui-muted)]">
                          Tot: ${mov.totalPvp.toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-xs md:text-sm text-[var(--ui-text)]">
                      {mov.balance} un
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-2.5 text-xs text-[var(--ui-muted)] italic max-w-xs truncate">
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
