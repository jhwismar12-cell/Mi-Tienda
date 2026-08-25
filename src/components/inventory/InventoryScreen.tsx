import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  ChevronRight,
  X,
  PlusCircle,
  MinusCircle,
  Flag,
  Package,
  ShoppingBag,
  AlertTriangle,
  UnfoldVertical,
  MoreVertical,
  Edit2,
  Trash2,
  TrendingDown,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product, Category, KardexMovement } from '../../types';

export const InventoryScreen: React.FC = () => {
  const {
    products,
    kardexMovements,
    selectedKardexProductId,
    setSelectedKardexProductId,
    adjustStock,
    setIsNewProductModalOpen,
    deleteProduct,
    showToast
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
  const [showAdjustModal, setShowAdjustModal] = useState<{ open: boolean; type: 'plus' | 'minus'; productId: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Categories list
  const categories: Category[] = ['Abarrotes', 'Lácteos', 'Bebidas', 'Limpieza', 'Snacks', 'Panadería', 'Embutidos'];

  // Counts
  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.stock === 0).length;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search text
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

      // Status
      let matchesStatus = true;
      if (statusFilter === 'low') {
        matchesStatus = p.stock > 0 && p.stock <= p.minStock;
      } else if (statusFilter === 'out') {
        matchesStatus = p.stock === 0;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // Selected product for Kardex drawer
  const selectedProduct = useMemo(() => {
    if (!selectedKardexProductId) return null;
    return products.find(p => p.id === selectedKardexProductId) || null;
  }, [products, selectedKardexProductId]);

  // Product Kardex movements
  const productKardex = useMemo(() => {
    if (!selectedKardexProductId) return [];
    return kardexMovements.filter(m => m.productId === selectedKardexProductId);
  }, [kardexMovements, selectedKardexProductId]);

  const handleExportCSV = () => {
    const headers = 'Código,Producto,Categoría,Precio Costo,Precio Venta,Stock,Stock Mínimo\n';
    const rows = products
      .map(
        p =>
          `"${p.code}","${p.name}","${p.category}",${p.costPrice.toFixed(2)},${p.salePrice.toFixed(2)},${p.stock},${p.minStock}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_tienda_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Inventario exportado en formato CSV');
  };

  const handleConfirmAdjust = () => {
    if (!showAdjustModal || !showAdjustModal.productId) return;
    const delta = showAdjustModal.type === 'plus' ? adjustAmount : -adjustAmount;
    const movementType = showAdjustModal.type === 'plus' ? 'AJUSTE_POSITIVO' : adjustReason.toLowerCase().includes('daño') || adjustReason.toLowerCase().includes('merma') ? 'DAÑO' : 'AJUSTE_NEGATIVO';
    
    adjustStock(showAdjustModal.productId, delta, movementType, adjustReason);
    setShowAdjustModal(null);
    setAdjustAmount(1);
    setAdjustReason('');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none relative">
      {/* Page Header & Filter Bar */}
      <div className="px-4 lg:px-6 py-4 border-b border-[#cbd5e1] bg-white shrink-0 z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="font-bold text-xl md:text-2xl text-[#111c2d] tracking-tight">
              Gestión de Inventario
            </h1>
            <p className="text-xs md:text-sm text-[#64748b] mt-0.5">
              {products.length} productos activos • Última sinc: Hace un momento
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={handleExportCSV}
              className="bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] text-xs md:text-sm font-semibold px-3.5 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4 text-[#64748b]" />
              <span>Exportar</span>
            </button>

            <button
              onClick={() => setIsNewProductModalOpen(true)}
              className="bg-[#006948] hover:bg-[#005137] text-white text-xs md:text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm relative group"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
              <span className="hidden sm:inline-block font-mono text-[10px] bg-black/30 text-[#85f8c4] px-1 py-0.5 rounded ml-1">
                [F2]
              </span>
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2.5 bg-[#f8fafc] p-2 rounded-xl border border-[#cbd5e1]">
          {/* Search Input */}
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por código o nombre..."
              className="w-full bg-white border border-[#cbd5e1] rounded-lg pl-9 pr-3 py-1.5 text-xs md:text-sm text-[#111c2d] focus:border-[#316bf3] focus:ring-1 focus:ring-[#316bf3] outline-none placeholder:text-[#94a3b8]"
            />
          </div>

          {/* Category Dropdown */}
          <div className="min-w-[160px]">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-white border border-[#cbd5e1] rounded-lg px-3 py-1.5 text-xs md:text-sm text-[#111c2d] focus:border-[#316bf3] focus:ring-1 focus:ring-[#316bf3] outline-none cursor-pointer"
            >
              <option value="all">Todas las Categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-[#cbd5e1] hidden sm:block" />

          {/* Status Filter Buttons */}
          <div className="flex bg-white rounded-lg border border-[#cbd5e1] overflow-hidden text-xs md:text-sm">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 font-semibold transition-colors border-r border-[#cbd5e1] ${
                statusFilter === 'all'
                  ? 'bg-[#e2e8f0] text-[#111c2d]'
                  : 'text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => setStatusFilter('low')}
              className={`px-3.5 py-1.5 font-semibold transition-colors border-r border-[#cbd5e1] flex items-center gap-1.5 ${
                statusFilter === 'low'
                  ? 'bg-[#fef3c7] text-[#92400e]'
                  : 'text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
              <span>Stock Bajo ({lowStockCount})</span>
            </button>

            <button
              onClick={() => setStatusFilter('out')}
              className={`px-3.5 py-1.5 font-semibold transition-colors flex items-center gap-1.5 ${
                statusFilter === 'out'
                  ? 'bg-[#fee2e2] text-[#991b1b]'
                  : 'text-[#64748b] hover:bg-[#f1f5f9]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
              <span>Agotados ({outOfStockCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Data Table + Kardex Slide-out Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Inventory Data Table */}
        <div className="flex-1 overflow-auto bg-white h-full">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#f1f5f9] z-10 shadow-[0_1px_0_0_#cbd5e1]">
              <tr>
                <th className="px-4 py-2.5 font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider w-[130px]">
                  Código
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">
                  Precio Venta
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider text-right">
                  Stock Físico
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] md:text-xs font-bold text-[#64748b] uppercase tracking-wider w-[60px] text-center">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#94a3b8]">
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedKardexProductId === product.id;
                  const isLow = product.stock > 0 && product.stock <= product.minStock;
                  const isOut = product.stock === 0;

                  return (
                    <tr
                      key={product.id}
                      onClick={() => setSelectedKardexProductId(product.id)}
                      className={`transition-colors cursor-pointer group text-sm ${
                        isSelected
                          ? 'bg-[#006948]/10 shadow-[inset_4px_0_0_0_#006948]'
                          : isOut
                          ? 'bg-[#f8fafc] hover:bg-[#f1f5f9]'
                          : 'bg-white hover:bg-[#f8fafc]'
                      }`}
                    >
                      {/* Code */}
                      <td className={`px-4 py-2.5 font-mono text-xs ${isSelected ? 'text-[#006948] font-bold' : 'text-[#475569]'}`}>
                        {product.code}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-2.5">
                        <div className={`font-semibold ${isOut ? 'line-through text-[#94a3b8]' : isSelected ? 'text-[#006948]' : 'text-[#111c2d]'}`}>
                          {product.name}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-2.5 text-xs text-[#64748b]">
                        <span className="bg-[#f1f5f9] px-2 py-0.5 rounded border border-[#e2e8f0]">
                          {product.category}
                        </span>
                      </td>

                      {/* Sale Price */}
                      <td className="px-4 py-2.5 font-mono font-medium text-[#111c2d] text-right text-xs md:text-sm">
                        $ {product.salePrice.toFixed(2)}
                      </td>

                      {/* Stock Badge */}
                      <td className="px-4 py-2.5 text-right">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] font-mono text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                            Agotado (0 un)
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fffbeb] text-[#b45309] border border-[#fde68a] font-mono text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                            Stock Bajo ({product.stock} un / Mín: {product.minStock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] font-mono text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                            En Stock ({product.stock} un)
                          </span>
                        )}
                      </td>

                      {/* Chevron Action */}
                      <td className="px-4 py-2.5 text-right">
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${
                            isSelected ? 'text-[#006948] translate-x-1' : 'text-[#cbd5e1] group-hover:text-[#64748b]'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Kardex Slide-out Drawer */}
        {selectedProduct && (
          <aside className="w-full max-w-[420px] bg-white border-l border-[#cbd5e1] shadow-[-4px_0_24px_rgba(0,0,0,0.06)] h-full flex flex-col shrink-0 z-20">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-[#cbd5e1] bg-[#f8fafc] flex justify-between items-start sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#006948]/15 text-[#006948] font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                    KARDEX ACTIVO
                  </span>
                  <span className="font-mono text-xs text-[#64748b]">
                    ID: {selectedProduct.code}
                  </span>
                </div>
                <h3 className="font-bold text-base md:text-lg text-[#111c2d] leading-tight">
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-[#64748b] mt-1">
                  Stock Actual:{' '}
                  <span
                    className={`font-bold ${
                      selectedProduct.stock === 0
                        ? 'text-[#dc2626]'
                        : selectedProduct.stock <= selectedProduct.minStock
                        ? 'text-[#b45309]'
                        : 'text-[#047857]'
                    }`}
                  >
                    {selectedProduct.stock} un
                  </span>{' '}
                  • Mínimo: {selectedProduct.minStock} un
                </p>
              </div>

              <button
                onClick={() => setSelectedKardexProductId(null)}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#111c2d] transition-colors"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Adjust Buttons */}
            <div className="px-5 py-2.5 border-b border-[#cbd5e1] bg-white flex gap-2">
              <button
                onClick={() => setShowAdjustModal({ open: true, type: 'plus', productId: selectedProduct.id })}
                className="flex-1 bg-white border border-[#cbd5e1] text-[#111c2d] text-xs py-2 rounded-lg font-semibold hover:bg-[#f1f5f9] transition-colors flex justify-center items-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-[#006948]" />
                <span>Ajuste [+]</span>
              </button>

              <button
                onClick={() => setShowAdjustModal({ open: true, type: 'minus', productId: selectedProduct.id })}
                className="flex-1 bg-white border border-[#cbd5e1] text-[#111c2d] text-xs py-2 rounded-lg font-semibold hover:bg-[#f1f5f9] transition-colors flex justify-center items-center gap-1.5 shadow-xs"
              >
                <MinusCircle className="w-4 h-4 text-[#dc2626]" />
                <span>Ajuste [-]</span>
              </button>
            </div>

            {/* Kardex Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-white relative space-y-4">
              {/* Timeline continuous vertical line */}
              <div className="absolute left-[37px] top-6 bottom-6 w-0.5 bg-[#e2e8f0] z-0" />

              {productKardex.length === 0 ? (
                <div className="text-center py-8 text-[#94a3b8] text-xs">
                  No hay movimientos registrados para este producto.
                </div>
              ) : (
                productKardex.map((mov) => {
                  const isPositive = mov.quantityChange > 0;
                  const isNegative = mov.quantityChange < 0;

                  return (
                    <div key={mov.id} className="relative z-10 flex gap-3.5">
                      {/* Timeline Icon Badge */}
                      <div
                        className={`w-9 h-9 rounded-full border-2 border-white flex items-center justify-center shrink-0 shadow-sm ${
                          mov.type === 'INICIAL'
                            ? 'bg-[#e2e8f0] text-[#475569]'
                            : mov.type === 'COMPRA'
                            ? 'bg-[#ecfdf5] text-[#059669]'
                            : mov.type === 'DAÑO'
                            ? 'bg-[#fef2f2] text-[#dc2626]'
                            : 'bg-[#eff6ff] text-[#2563eb]'
                        }`}
                      >
                        {mov.type === 'INICIAL' && <Flag className="w-4 h-4" />}
                        {mov.type === 'COMPRA' && <Package className="w-4 h-4" />}
                        {mov.type === 'DAÑO' && <AlertTriangle className="w-4 h-4" />}
                        {(mov.type === 'VENTA' || mov.type === 'VENTA MAYORISTA') && (
                          <ShoppingBag className="w-4 h-4" />
                        )}
                        {mov.type === 'AJUSTE_POSITIVO' && <TrendingUp className="w-4 h-4" />}
                        {mov.type === 'AJUSTE_NEGATIVO' && <TrendingDown className="w-4 h-4" />}
                      </div>

                      {/* Movement Card */}
                      <div
                        className={`flex-1 rounded-xl p-3 border shadow-xs relative overflow-hidden ${
                          mov.type === 'DAÑO'
                            ? 'bg-white border-[#fecaca]'
                            : mov.type === 'COMPRA'
                            ? 'bg-white border-[#a7f3d0]'
                            : 'bg-white border-[#cbd5e1]'
                        }`}
                      >
                        {/* Status accent bar */}
                        <div
                          className={`absolute right-0 top-0 bottom-0 w-1 ${
                            mov.type === 'COMPRA'
                              ? 'bg-[#10b981]'
                              : mov.type === 'DAÑO'
                              ? 'bg-[#ef4444]'
                              : mov.type === 'INICIAL'
                              ? 'bg-[#94a3b8]'
                              : 'bg-[#3b82f6]'
                          }`}
                        />

                        {/* Top line: Type & Time */}
                        <div className="flex justify-between items-start mb-1">
                          <span
                            className={`font-mono text-xs font-bold ${
                              mov.type === 'COMPRA'
                                ? 'text-[#059669]'
                                : mov.type === 'DAÑO'
                                ? 'text-[#dc2626]'
                                : mov.type === 'INICIAL'
                                ? 'text-[#475569]'
                                : 'text-[#2563eb]'
                            }`}
                          >
                            {mov.type}
                          </span>
                          <span className="font-mono text-[11px] text-[#64748b]">
                            {mov.date}, {mov.time}
                          </span>
                        </div>

                        {/* Note if damage/observation */}
                        {mov.notes && (
                          <p
                            className={`text-xs mb-1.5 italic ${
                              mov.type === 'DAÑO' ? 'text-[#dc2626]' : 'text-[#64748b]'
                            }`}
                          >
                            {mov.notes}
                          </p>
                        )}

                        {/* Bottom line: Doc ref + Quantity & Running Balance */}
                        <div className="flex justify-between items-end mt-1 text-xs">
                          <div className="text-[11px] text-[#64748b] space-y-0.5">
                            <p>Doc: <span className="font-mono text-[#334155]">{mov.docNumber}</span></p>
                            <p>Resp: {mov.responsible}</p>
                          </div>

                          <div className="text-right">
                            {mov.quantityChange !== 0 ? (
                              <span
                                className={`font-mono font-bold text-sm block ${
                                  isPositive
                                    ? 'text-[#059669]'
                                    : 'text-[#dc2626]'
                                }`}
                              >
                                {isPositive ? `+${mov.quantityChange}` : mov.quantityChange}
                              </span>
                            ) : (
                              <span className="font-mono font-bold text-sm text-[#475569] block">
                                0 un
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-[#64748b]">
                              Saldo: {mov.balance}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl max-w-sm w-full p-5">
            <h3 className="font-bold text-base text-[#111c2d] mb-1 flex items-center gap-2">
              {showAdjustModal.type === 'plus' ? (
                <>
                  <PlusCircle className="w-5 h-5 text-[#006948]" />
                  <span>Ajuste de Entrada [+]</span>
                </>
              ) : (
                <>
                  <MinusCircle className="w-5 h-5 text-[#dc2626]" />
                  <span>Ajuste de Salida / Merma [-]</span>
                </>
              )}
            </h3>
            <p className="text-xs text-[#64748b] mb-4">
              {selectedProduct?.name} (Stock actual: {selectedProduct?.stock} un)
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Cantidad a {showAdjustModal.type === 'plus' ? 'Ingresar' : 'Descontar'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-[#cbd5e1] rounded-lg px-3 py-2 text-sm font-mono font-bold outline-none focus:border-[#316bf3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Motivo / Observación
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={
                    showAdjustModal.type === 'plus'
                      ? 'Ej: Devolución proveedor, inventario físico'
                      : 'Ej: Empaque roto, caducidad, merma'
                  }
                  className="w-full border border-[#cbd5e1] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#316bf3]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setShowAdjustModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] rounded-lg border border-[#cbd5e1]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAdjust}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs ${
                  showAdjustModal.type === 'plus'
                    ? 'bg-[#006948] hover:bg-[#005137]'
                    : 'bg-[#dc2626] hover:bg-[#b91c1c]'
                }`}
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
