import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  Radio,
  Lock,
  Unlock,
  Sparkles,
  Barcode,
  Volume2,
  VolumeX,
  Keyboard
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const TopHeader: React.FC = () => {
  const {
    cashShift,
    setIsGlobalSearchOpen,
    setIsCashMovementModalOpen,
    closeShiftAndGenerateReport,
    activeScreen
  } = useStore();

  const [timeString, setTimeString] = useState<string>('');
  const [scannerPulse, setScannerPulse] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('es-ES', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#111c2d] border-b border-[#334155] flex justify-between items-center w-full px-4 lg:px-6 py-2 h-16 z-30 shrink-0 select-none text-[#f9f9ff]">
      {/* Brand & Scanner Status */}
      <div className="flex items-center space-x-3 md:space-x-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00855d] flex items-center justify-center text-[#f5fff7] font-black text-lg shadow-sm">
            🏪
          </div>
          <span className="font-sans text-xl md:text-2xl font-black text-[#85f8c4] tracking-tight whitespace-nowrap">
            Mi Tienda Familiar
          </span>
        </div>

        <div className="hidden sm:block h-6 w-px bg-[#3d4a42] mx-2" />

        <div className="hidden sm:flex items-center space-x-2 text-[#85f8c4] font-mono text-xs md:text-sm bg-[#85f8c4]/10 px-2.5 py-1 rounded border border-[#85f8c4]/20">
          <span className="relative flex h-2.5 w-2.5">
            {scannerPulse && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#85f8c4] opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#85f8c4]" />
          </span>
          <span className="font-semibold tracking-wide">[ Escáner USB Listo ]</span>
        </div>
      </div>

      {/* Global Quick Search (Middle / Right) */}
      <div className="hidden md:flex flex-1 max-w-sm mx-4">
        <button
          onClick={() => setIsGlobalSearchOpen(true)}
          className="w-full flex items-center justify-between bg-[#1e293b] hover:bg-[#273549] text-[#94a3b8] hover:text-[#e2e8f0] px-3.5 py-1.5 rounded-full text-xs md:text-sm border border-[#334155] transition-colors"
          title="Buscar productos, precios o códigos (⌘K)"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#64748b]" />
            <span>Buscar producto, código...</span>
          </div>
          <span className="bg-[#0f172a] text-[#85f8c4] font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#334155]">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Controls & Cashier Info */}
      <div className="flex items-center space-x-3 md:space-x-5 text-[#85f8c4]">
        {/* Cashier & Status */}
        <div className="flex items-center space-x-3 text-sm">
          <div className="flex items-center gap-1.5 font-medium text-[#f1f5f9]">
            <div className="w-7 h-7 rounded-full bg-[#316bf3] text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#334155]">
              {(cashShift.cashierName || 'Wismar').charAt(0)}
            </div>
            <span id="cashier-display-name" className="font-semibold text-xs md:text-sm">{cashShift.cashierName || 'Wismar'}</span>
          </div>

          <span className="inline-flex items-center gap-1 text-[#85f8c4] font-bold bg-[#85f8c4]/15 px-2 py-0.5 rounded text-xs border border-[#85f8c4]/30">
            <Unlock className="w-3 h-3 text-[#85f8c4]" />
            <span className="tracking-wider">ABIERTA</span>
          </span>
        </div>

        {/* Quick Action Icons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsCashMovementModalOpen(true)}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#85f8c4] transition-colors"
            title="Registrar Retiro o Ingreso de Efectivo"
          >
            <Radio className="w-4 h-4" />
          </button>
        </div>

        {/* Live Digital Clock */}
        <div className="font-mono text-sm md:text-base font-bold bg-[#0f172a] text-[#85f8c4] px-2.5 py-1 rounded border border-[#334155] shadow-inner tracking-wider">
          {timeString || '14:32:05'}
        </div>
      </div>
    </header>
  );
};
