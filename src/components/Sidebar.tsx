import React from 'react';
import {
  ShoppingBag,
  Package,
  History,
  BarChart3,
  Settings,
  Truck,
  HelpCircle,
  LogOut,
  Receipt,
  Store,
  DollarSign
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ScreenType } from '../types';

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen, closeShiftAndGenerateReport, showToast } = useStore();

  const navItems: { id: ScreenType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'reception', label: 'Recepción de Mercancía', icon: Truck },
    { id: 'kardex', label: 'Kardex', icon: History },
    { id: 'reports', label: 'Reportes', icon: BarChart3 },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <aside className="w-[240px] bg-white border-r border-[#cbd5e1] flex flex-col h-full shrink-0 select-none z-20">
      {/* Store Sub-header (only visible in sidebar) */}
      <div className="px-4 py-3.5 border-b border-[#e2e8f0] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#006948] text-white flex items-center justify-center font-bold text-sm shadow-sm">
          <Store className="w-4 h-4 text-[#85f8c4]" />
        </div>
        <div className="overflow-hidden">
          <h2 className="font-bold text-sm text-[#111c2d] truncate">Mi Tienda Familiar</h2>
          <p className="text-[11px] text-[#64748b] font-medium">Sucursal Central</p>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                isActive
                  ? 'bg-[#316bf3] text-white font-bold shadow-sm'
                  : 'text-[#475569] hover:bg-[#f1f5f9] hover:text-[#1e293b]'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-white' : 'text-[#64748b]'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions & Close Shift */}
      <div className="p-3 border-t border-[#e2e8f0] space-y-2 bg-[#f8fafc]">
        {/* Cerrar Caja Button */}
        <button
          onClick={closeShiftAndGenerateReport}
          className="w-full py-2.5 px-3 bg-[#006948] hover:bg-[#005137] active:scale-[0.98] text-white rounded-lg font-bold text-sm transition-all shadow-sm flex items-center justify-between group"
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#85f8c4]" />
            <span>Cerrar Caja</span>
          </div>
          <span className="font-mono text-[11px] bg-black/30 text-[#85f8c4] px-1.5 py-0.5 rounded border border-white/10 font-bold">
            [F12]
          </span>
        </button>

        {/* Secondary Links */}
        <div className="pt-1 flex flex-col space-y-0.5 text-xs text-[#64748b]">
          <button
            onClick={() => showToast('Manual de usuario y atajos de teclado disponible en Ajustes')}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded hover:bg-[#e2e8f0] text-left transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-[#94a3b8]" />
            <span>Ayuda</span>
          </button>
          <button
            onClick={() => showToast('Sesión guardada en dispositivo')}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded hover:bg-[#fee2e2] hover:text-[#dc2626] text-left transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#ef4444]" />
            <span className="text-[#dc2626]">Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
