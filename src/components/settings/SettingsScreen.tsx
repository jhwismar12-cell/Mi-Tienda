import React, { useState } from 'react';
import {
  Settings,
  Store,
  Printer,
  Barcode,
  Keyboard,
  Shield,
  Save,
  Volume2,
  BellRing,
  RotateCcw
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const SettingsScreen: React.FC = () => {
  const { cashShift, setCashierName: updateGlobalCashierName, showToast } = useStore();

  const [storeName, setStoreName] = useState('Mi Tienda Familiar');
  const [storeTaxId, setStoreTaxId] = useState('1792348590001');
  const [storeAddress, setStoreAddress] = useState('Av. Amazonas y Naciones Unidas #402, Quito');
  const [storePhone, setStorePhone] = useState('+593 99 123 4567');
  const [cashierName, setCashierName] = useState(cashShift.cashierName);
  const [ticketFooter, setTicketFooter] = useState('¡Gracias por su compra! Vuelva pronto.');
  const [printerWidth, setPrinterWidth] = useState<'80mm' | '58mm'>('80mm');
  const [soundFeedback, setSoundFeedback] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashierName.trim()) {
      updateGlobalCashierName(cashierName.trim());
    }
    showToast('Configuraciones guardadas exitosamente');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#f8fafc] select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-bold text-xl md:text-2xl text-[#111c2d]">
            Ajustes del Sistema
          </h1>
          <p className="text-xs md:text-sm text-[#64748b] mt-0.5">
            Personalización de tienda, caja registradora, periféricos y atajos de teclado.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Store Information */}
          <div className="bg-white border border-[#cbd5e1] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[#111c2d] mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-[#006948]" />
              <span>Datos del Negocio / Comprobantes</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  RUC / NIT / Identificación Tributaria
                </label>
                <input
                  type="text"
                  value={storeTaxId}
                  onChange={(e) => setStoreTaxId(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-[#475569] mb-1">
                  Mensaje de Pie de Ticket
                </label>
                <input
                  type="text"
                  value={ticketFooter}
                  onChange={(e) => setTicketFooter(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
                />
              </div>
            </div>
          </div>

          {/* POS & Peripherals */}
          <div className="bg-white border border-[#cbd5e1] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[#111c2d] mb-4 flex items-center gap-2">
              <Printer className="w-5 h-5 text-[#316bf3]" />
              <span>Impresión y Periféricos</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Formato de Impresora Térmica
                </label>
                <select
                  value={printerWidth}
                  onChange={(e) => setPrinterWidth(e.target.value as any)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
                >
                  <option value="80mm">Térmica 80mm (Estándar Punto de Venta)</option>
                  <option value="58mm">Térmica 58mm (Compacta)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  Cajero Predeterminado
                </label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-2 text-[#111c2d] outline-none focus:border-[#316bf3]"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg border border-[#cbd5e1]">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-[#006948]" />
                  <div>
                    <p className="font-bold text-xs md:text-sm text-[#111c2d]">
                      Efectos de Sonido (Beep de escáner y caja)
                    </p>
                    <p className="text-xs text-[#64748b]">
                      Emite retroalimentación acústica inmediata al escanear o cobrar
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundFeedback}
                  onChange={(e) => setSoundFeedback(e.target.checked)}
                  className="w-4 h-4 text-[#006948] rounded focus:ring-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="bg-white border border-[#cbd5e1] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[#111c2d] mb-4 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-[#475569]" />
              <span>Guía Rápida de Atajos de Teclado (Hotkeys)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Venta Rápida Pan</span>
                <kbd className="font-mono bg-[#111c2d] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F1]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Venta Rápida Huevos</span>
                <kbd className="font-mono bg-[#111c2d] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F2]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Foco Escáner / Búsqueda</span>
                <kbd className="font-mono bg-[#111c2d] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F3]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Venta Rápida Recargas</span>
                <kbd className="font-mono bg-[#111c2d] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F4]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Confirmar Cobro</span>
                <kbd className="font-mono bg-[#006948] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F5]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Guardar Recepción Compra</span>
                <kbd className="font-mono bg-[#006948] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F10]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Cerrar Caja / Reporte Z</span>
                <kbd className="font-mono bg-[#006948] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F12]</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Buscador Global</span>
                <kbd className="font-mono bg-[#111c2d] text-white px-2 py-0.5 rounded font-bold text-[11px]">⌘K / Ctrl+K</kbd>
              </div>
              <div className="p-2.5 bg-[#f8fafc] border border-[#cbd5e1] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[#334155]">Cerrar Ventana</span>
                <kbd className="font-mono bg-[#64748b] text-white px-2 py-0.5 rounded font-bold text-[11px]">ESC</kbd>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#006948] hover:bg-[#005137] text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
            >
              <Save className="w-4 h-4 text-[#85f8c4]" />
              <span>Guardar Configuraciones</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
