import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Barcode,
  Search,
  Trash2,
  Save,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Building,
  Calendar,
  FileText
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ReceptionDraftItem } from '../../types';

export const ReceptionScreen: React.FC = () => {
  const { products, receivePurchases, setActiveScreen, showToast } = useStore();

  const [provider, setProvider] = useState('Distribuidora Andina S.A.');
  const [invoiceNumber, setInvoiceNumber] = useState('F001-009843');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Initial reception items matching Image 9 / HTML 5
  const [items, setItems] = useState<ReceptionDraftItem[]>([
    {
      id: 'rec-1',
      code: '7702004001234',
      name: 'Arroz Blanco Superior 1kg',
      quantityReceived: 50,
      unitCost: 3.20,
      previousCost: 3.20,
      salePrice: 4.50,
      suggestedSalePrice: 4.50
    },
    {
      id: 'rec-2',
      code: '7703344556677',
      name: 'Aceite Vegetal Girasol 1L',
      quantityReceived: 24,
      unitCost: 8.50,
      previousCost: 7.40,
      salePrice: 9.50,
      suggestedSalePrice: 10.80
    },
    {
      id: 'rec-3',
      code: '7701122334455',
      name: 'Frijol Cargamanto 500g',
      quantityReceived: 100,
      unitCost: 4.10,
      previousCost: 4.10,
      salePrice: 5.80,
      suggestedSalePrice: 5.80
    }
  ]);

  // Calculations
  const totalUnits = items.reduce((sum, it) => sum + (it.quantityReceived || 0), 0);
  const totalAmount = Number(items.reduce((sum, it) => sum + (it.quantityReceived * it.unitCost), 0).toFixed(2));

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Keyboard shortcut for F10 (Guardar Compra)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSavePurchase();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, provider, invoiceNumber, invoiceDate]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const query = barcodeInput.trim();
    const existingInDraft = items.find(it => it.code === query);

    if (existingInDraft) {
      // Increment quantity
      setItems(prev =>
        prev.map(it =>
          it.id === existingInDraft.id
            ? { ...it, quantityReceived: it.quantityReceived + 1 }
            : it
        )
      );
      showToast(`Cantidad incrementada para ${existingInDraft.name}`);
    } else {
      // Find in existing catalog
      const product = products.find(p => p.code === query || p.barcode === query);
      if (product) {
        const newItem: ReceptionDraftItem = {
          id: `rec-${Date.now()}`,
          code: product.code,
          name: product.name,
          quantityReceived: 1,
          unitCost: product.costPrice,
          previousCost: product.costPrice,
          salePrice: product.salePrice,
          suggestedSalePrice: product.salePrice
        };
        setItems(prev => [...prev, newItem]);
        showToast(`Producto ${product.name} agregado a la recepción`);
      } else {
        // Unknown product added as new draft item
        const newItem: ReceptionDraftItem = {
          id: `rec-${Date.now()}`,
          code: query,
          name: `Nuevo Producto (${query})`,
          quantityReceived: 1,
          unitCost: 1.00,
          previousCost: 1.00,
          salePrice: 1.30,
          suggestedSalePrice: 1.30,
          isNewProduct: true
        };
        setItems(prev => [...prev, newItem]);
        showToast(`Nuevo ítem ${query} agregado`);
      }
    }

    setBarcodeInput('');
  };

  const handleUpdateItem = (id: string, updates: Partial<ReceptionDraftItem>) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          const updated = { ...it, ...updates };
          // If unit cost increased, recalculate suggested sale price (approx 25-30% margin)
          if (updates.unitCost !== undefined && updates.unitCost > it.previousCost) {
            updated.suggestedSalePrice = Number((updates.unitCost * 1.28).toFixed(2));
          }
          return updated;
        }
        return it;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleSavePurchase = () => {
    if (items.length === 0) {
      showToast('Debe agregar al menos un producto a la recepción');
      return;
    }

    receivePurchases({
      provider,
      invoiceNumber,
      date: invoiceDate,
      items,
      totalUnits,
      totalAmount
    });

    setActiveScreen('inventory');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f9f9ff] p-4 md:p-6 gap-3.5 select-none">
      {/* Context Header & Metadata */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between shrink-0 bg-white p-4 border border-[#cbd5e1] rounded-xl gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={() => setActiveScreen('inventory')}
              className="text-[#64748b] hover:text-[#006948] transition-colors p-1 rounded hover:bg-[#f1f5f9]"
              title="Volver a Inventario"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg md:text-xl text-[#111c2d]">
              Recepción de Mercancía
            </h1>
          </div>
          <p className="text-xs text-[#64748b] ml-8">
            Registro de ingreso de compras e inventario al Kardex.
          </p>
        </div>

        {/* Metadata Inputs (Provider, Invoice, Date) */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Provider */}
          <div className="flex flex-col gap-0.5">
            <label className="font-mono text-[10px] text-[#64748b] uppercase font-bold">
              Proveedor
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 text-xs text-[#111c2d] focus:border-[#006948] outline-none font-medium min-w-[200px]"
            >
              <option value="Distribuidora Andina S.A.">Distribuidora Andina S.A.</option>
              <option value="Lácteos del Valle">Lácteos del Valle</option>
              <option value="Gaseosas Nacionales">Gaseosas Nacionales</option>
              <option value="Distribuidora El Ahorro">Distribuidora El Ahorro</option>
              <option value="Bimbo Ecuador">Bimbo Ecuador</option>
            </select>
          </div>

          {/* Invoice / Guide */}
          <div className="flex flex-col gap-0.5">
            <label className="font-mono text-[10px] text-[#64748b] uppercase font-bold">
              Factura / Guía
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Nro Factura"
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[#111c2d] focus:border-[#006948] outline-none uppercase w-32 font-bold"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-0.5">
            <label className="font-mono text-[10px] text-[#64748b] uppercase font-bold">
              Fecha
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-2.5 py-1.5 font-mono text-xs text-[#111c2d] focus:border-[#006948] outline-none w-36"
            />
          </div>
        </div>
      </div>

      {/* Barcode Search Scanning Area */}
      <div className="shrink-0 flex gap-3 items-center">
        <form onSubmit={handleBarcodeSubmit} className="relative flex-1 group">
          <div className="relative bg-white border-2 border-[#cbd5e1] focus-within:border-[#316bf3] focus-within:ring-2 focus-within:ring-[#316bf3]/20 rounded-xl flex items-center px-4 py-2.5 transition-all shadow-xs">
            <Barcode className="w-5 h-5 text-[#64748b] mr-3 shrink-0" />
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Escanear código de barras para agregar producto..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-base font-mono text-[#111c2d] outline-none placeholder:text-[#94a3b8]"
            />
            <span className="text-[10px] font-bold text-[#475569] bg-[#f1f5f9] px-2 py-1 rounded border border-[#e2e8f0] uppercase tracking-wider shrink-0 ml-2">
              Modo Continuo
            </span>
          </div>
        </form>

        <button
          onClick={() => {
            const code = prompt('Ingrese el código de barras del producto:');
            if (code) {
              setBarcodeInput(code);
              setTimeout(() => barcodeRef.current?.form?.requestSubmit(), 50);
            }
          }}
          className="bg-white border border-[#cbd5e1] hover:bg-[#f1f5f9] text-[#111c2d] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Search className="w-4 h-4 text-[#64748b]" />
          <span>Buscar Manual</span>
        </button>
      </div>

      {/* Reception High Density Data Grid */}
      <div className="flex-1 bg-white border border-[#cbd5e1] rounded-xl flex flex-col overflow-hidden shadow-sm">
        {/* Grid Header */}
        <div className="grid grid-cols-12 bg-[#f1f5f9] border-b border-[#cbd5e1] py-2 px-4 sticky top-0 z-10 font-mono text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
          <div className="col-span-2">Código</div>
          <div className="col-span-3">Producto</div>
          <div className="col-span-1 text-right">Cant. Rec.</div>
          <div className="col-span-1 text-right">Costo Und.</div>
          <div className="col-span-1 text-right text-[#94a3b8]">Costo Ant.</div>
          <div className="col-span-1 text-right">P. Venta</div>
          <div className="col-span-3 pl-4">Alerta de Margen / Acción</div>
        </div>

        {/* Grid Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#e2e8f0]">
          {items.length === 0 ? (
            <div className="text-center py-12 text-[#94a3b8] text-sm">
              Escanee códigos de barras de la factura del proveedor para agregarlos a la lista.
            </div>
          ) : (
            items.map((item, idx) => {
              const costDiff = item.unitCost - item.previousCost;
              const hasCostIncreased = costDiff > 0.01;
              const percentIncrease = item.previousCost > 0 ? ((costDiff / item.previousCost) * 100).toFixed(0) : 0;
              const currentMargin = item.salePrice > 0 ? (((item.salePrice - item.unitCost) / item.unitCost) * 100).toFixed(0) : 0;

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 items-center py-2.5 px-4 text-xs md:text-sm transition-colors group ${
                    hasCostIncreased
                      ? 'bg-[#fffbeb] hover:bg-[#fef3c7]/60'
                      : idx % 2 === 0
                      ? 'bg-white hover:bg-[#f8fafc]'
                      : 'bg-[#f8fafc] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {/* Code */}
                  <div className="col-span-2 font-mono text-xs text-[#334155] font-semibold truncate pr-2">
                    {item.code}
                  </div>

                  {/* Name */}
                  <div className="col-span-3 font-semibold text-[#111c2d] truncate pr-2">
                    {item.name}
                  </div>

                  {/* Quantity Received Input */}
                  <div className="col-span-1 text-right pr-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantityReceived}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          quantityReceived: Math.max(1, parseInt(e.target.value) || 1)
                        })
                      }
                      className="w-16 text-right bg-white border border-[#cbd5e1] rounded px-1.5 py-1 font-mono font-bold text-xs text-[#111c2d] outline-none focus:border-[#316bf3]"
                    />
                  </div>

                  {/* Unit Cost Input */}
                  <div className="col-span-1 text-right pr-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.unitCost}
                      onChange={(e) =>
                        handleUpdateItem(item.id, {
                          unitCost: parseFloat(e.target.value) || 0
                        })
                      }
                      className={`w-16 text-right bg-white border rounded px-1.5 py-1 font-mono font-bold text-xs outline-none focus:border-[#316bf3] ${
                        hasCostIncreased
                          ? 'border-[#f59e0b] text-[#b45309] bg-[#fffbeb]'
                          : 'border-[#cbd5e1] text-[#111c2d]'
                      }`}
                    />
                  </div>

                  {/* Previous Cost */}
                  <div className="col-span-1 text-right font-mono text-xs text-[#94a3b8] pr-2">
                    <span className={hasCostIncreased ? 'line-through' : ''}>
                      {item.previousCost.toFixed(2)}
                    </span>
                  </div>

                  {/* Current Sale Price */}
                  <div className="col-span-1 text-right font-mono text-xs font-semibold text-[#111c2d] pr-2">
                    {item.salePrice.toFixed(2)}
                  </div>

                  {/* Margin Alert & Suggested Price */}
                  <div className="col-span-3 pl-4 flex items-center justify-between">
                    {hasCostIncreased ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-[#fef3c7] text-[#92400e] px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-[#fde68a] flex items-center gap-1 shadow-2xs">
                          ▲ Costo +{percentIncrease}% (Margen {currentMargin}%)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-[#64748b]">Sugerido:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={item.suggestedSalePrice || item.salePrice}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                suggestedSalePrice: parseFloat(e.target.value) || item.salePrice
                              })
                            }
                            className="w-16 text-right bg-white border border-[#cbd5e1] rounded px-1 py-0.5 font-mono text-xs font-bold text-[#006948] outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#94a3b8] italic">Sin cambios</span>
                    )}

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1 text-[#cbd5e1] hover:text-[#ef4444] rounded opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
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

        {/* Table Footer Totals */}
        <div className="bg-[#f1f5f9] border-t border-[#cbd5e1] px-5 py-3 flex justify-between items-center shrink-0">
          <span className="text-xs md:text-sm font-semibold text-[#475569]">
            {items.length} Ítems en recepción
          </span>
          <div className="flex items-center gap-6 font-mono">
            <div className="text-right">
              <span className="text-[10px] text-[#64748b] uppercase block font-bold">
                Total Unidades
              </span>
              <span className="text-base font-bold text-[#111c2d]">{totalUnits}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#64748b] uppercase block font-bold">
                Valor Total Compra
              </span>
              <span className="text-base font-bold text-[#006948] bg-[#006948]/10 px-2.5 py-0.5 rounded border border-[#006948]/20">
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save CTA Button */}
      <div className="shrink-0 flex justify-end">
        <button
          onClick={handleSavePurchase}
          className="bg-[#006948] hover:bg-[#005137] text-white font-bold px-6 py-3.5 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center gap-3 relative group"
        >
          <Save className="w-5 h-5 text-[#85f8c4]" />
          <span className="text-sm md:text-base tracking-wide">
            Guardar Compra e Incrementar Inventario
          </span>
          <span className="font-mono text-xs bg-black/30 text-[#85f8c4] px-2 py-0.5 rounded ml-2 font-bold border border-white/10">
            [ F10 ]
          </span>
        </button>
      </div>
    </div>
  );
};
