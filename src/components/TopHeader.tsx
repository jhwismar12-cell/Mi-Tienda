import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Radio,
  Lock,
  Unlock,
  Barcode,
  Moon,
  Sun,
  ChevronDown,
  Check,
  ShieldCheck,
  Store,
  Settings,
  LogOut,
  Menu
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface TopHeaderProps {
  onToggleMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onToggleMobileMenu }) => {
  const {
    cashShift,
    setIsGlobalSearchOpen,
    setIsCashMovementModalOpen,
    closeShiftAndGenerateReport,
    setIsOpenShiftModalOpen,
    darkMode,
    toggleDarkMode,
    showToast,
    currentUser,
    logoutUser,
    workers,
    activeWorkerName,
    setActiveWorker,
    setActiveScreen
  } = useStore();

  const [timeString, setTimeString] = useState<string>('');
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const workerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (workerDropdownRef.current && !workerDropdownRef.current.contains(e.target as Node)) {
        setIsWorkerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <header className="app-header relative z-40 bg-[var(--ui-chrome)] border-b border-white/10 flex justify-between items-center gap-2 sm:gap-3 w-full px-3 sm:px-4 lg:px-6 min-h-14 lg:h-16 py-2 lg:py-0 shrink-0 select-none text-[var(--ui-chrome-text)]">
      {/* Brand, Mobile Menu Button & Scanner Status */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Abrir menú"
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="brand-mark w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--ui-brand)] flex items-center justify-center text-white ring-1 ring-white/10 shrink-0">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.8} />
          </div>
          <span className="font-sans text-sm sm:text-base xl:text-lg font-semibold text-white tracking-tight whitespace-nowrap">
            <span className="sm:hidden">Mi Tienda</span>
            <span className="hidden sm:inline">Mi Tienda Familiar</span>
          </span>
        </div>

        <div className="hidden xl:flex items-center gap-2 text-slate-300 text-xs" title="Escáner USB Listo" aria-label="Escáner USB Listo">
          <Barcode className="w-4 h-4 text-slate-400" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-300" />
          <span className="hidden 2xl:inline font-medium whitespace-nowrap">Escáner USB Listo</span>
        </div>
      </div>

      {/* Global Quick Search */}
      <div className="flex flex-1 min-w-10 max-w-[44px] sm:max-w-xs justify-end sm:justify-start">
      <button
          onClick={() => setIsGlobalSearchOpen(true)}
          className="w-full h-9 flex items-center justify-center sm:justify-between gap-2 sm:gap-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 sm:px-3 rounded-lg text-xs border border-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 cursor-pointer"
          title="Buscar productos, precios o códigos (⌘K)"
          aria-label="Buscar productos, precios o códigos (⌘K)"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="hidden md:inline truncate">Buscar producto, proveedor...</span>
          </div>
          <span className="hidden lg:inline shrink-0 text-slate-400 font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/15">
            ⌘K
          </span>
        </button>
      </div>

      {/* Right Controls & Cashier Info */}
      <div className="flex items-center gap-1.5 sm:gap-2 xl:gap-3 shrink-0 text-slate-300">
        <div className="flex items-center gap-1.5 sm:gap-2 text-sm">
          <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 text-[11px] font-medium text-slate-300" title={`Sesión iniciada como ${currentUser?.username || 'admin'} (${currentUser?.role_name || 'ADMINISTRADOR'})`}>
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentUser?.role_name === 'ADMINISTRADOR' ? 'Admin' : (currentUser?.role_name || 'Cajero')}</span>
          </div>

          {/* Active Worker Selector */}
          <div className="relative" ref={workerDropdownRef}>
            <button
              onClick={() => setIsWorkerDropdownOpen(v => !v)}
              className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2 sm:px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              title="Clic para cambiar quién está a cargo del turno"
              aria-expanded={isWorkerDropdownOpen}
              aria-haspopup="true"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-teal-400/15 text-teal-100 flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-teal-300/20">
                {(activeWorkerName || cashShift.cashierName || 'W').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="hidden md:block text-[9px] text-slate-400 font-medium leading-tight">A cargo ahora</span>
                <span className="truncate max-w-[75px] md:max-w-[105px] xl:max-w-[130px] text-white text-xs font-semibold leading-tight">
                  {activeWorkerName || cashShift.cashierName || 'Wismar'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isWorkerDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[var(--ui-surface)] text-[var(--ui-text)] border border-[var(--ui-border)] rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-4 py-2 border-b border-[var(--ui-border)] mb-1">
                  <p className="text-xs font-semibold text-[var(--ui-text)]">Persona a Cargo del Turno</p>
                  <p className="text-[11px] text-[var(--ui-muted)] mt-1">Selecciona quién atiende en este momento:</p>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {workers.map(w => {
                    const isSelected = w.name.trim().toLowerCase() === (activeWorkerName || cashShift.cashierName || '').trim().toLowerCase();
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setActiveWorker(w.name);
                          setIsWorkerDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-[var(--ui-surface-muted)] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]' : 'text-[var(--ui-text)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-semibold ${
                            isSelected ? 'bg-[var(--ui-brand)] text-[var(--ui-on-brand)]' : 'bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]'
                          }`}>
                            {w.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold leading-tight truncate">{w.name}</p>
                            <p className="text-[11px] text-[var(--ui-muted)] mt-0.5">{w.role || 'Cajero'}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 shrink-0 text-[var(--ui-brand-strong)]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 mt-1 border-t border-[var(--ui-border)] px-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWorkerDropdownOpen(false);
                      setActiveScreen('settings');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-medium text-[var(--ui-muted)] hover:text-[var(--ui-brand)] hover:bg-[var(--ui-surface-muted)] rounded-lg transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Gestionar lista de trabajadores...
                  </button>
                </div>
              </div>
            )}
          </div>

          {cashShift.isOpen ? (
            <button
              onClick={() => closeShiftAndGenerateReport()}
              className="inline-flex items-center gap-1 sm:gap-1.5 h-9 text-teal-100 hover:text-white font-semibold bg-teal-400/10 hover:bg-teal-400/20 px-2 sm:px-2.5 rounded-lg text-[11px] border border-teal-300/25 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              title="Caja Abierta • Clic o [F12] para Arqueo / Cierre de Caja"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">ABIERTA</span>
              <span className="hidden lg:inline font-mono text-teal-200/70">[F12]</span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpenShiftModalOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 h-9 text-amber-100 hover:text-white font-semibold bg-amber-400/10 hover:bg-amber-400/20 px-2 sm:px-2.5 rounded-lg text-[11px] border border-amber-300/25 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              title="Caja Cerrada • Clic para Apertura de Caja"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>CERRADA</span>
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              toggleDarkMode();
              showToast(!darkMode ? '🌙 Modo Oscuro activado' : '☀️ Modo Claro activado');
            }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsCashMovementModalOpen(true)}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            title="Registrar Retiro o Ingreso de Efectivo"
            aria-label="Registrar Retiro o Ingreso de Efectivo"
          >
            <Radio className="w-4 h-4" />
          </button>

          <button
            onClick={() => logoutUser()}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/10 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Live Digital Clock */}
        <div className="hidden md:block font-mono text-xs xl:text-sm font-medium text-slate-300 pl-3 border-l border-white/15 tabular-nums tracking-wide">
          {timeString || '14:32:05'}
        </div>
      </div>
    </header>
  );
};
