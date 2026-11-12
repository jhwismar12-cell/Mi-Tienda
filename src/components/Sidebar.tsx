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
  CalendarCheck
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ScreenType } from '../types';

export const Sidebar: React.FC = () => {
  const { activeScreen, setActiveScreen, closeShiftAndGenerateReport, purchaseOrders, showToast } = useStore();

  const pendingOrdersCount = purchaseOrders.filter(o => o.status === 'PENDIENTE').length;

  const navItems: { id: ScreenType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'orders', label: 'Agenda de Pedidos', icon: CalendarCheck, badge: pendingOrdersCount },
    { id: 'reception', label: 'Recepción de Mercancía', icon: Truck },
    { id: 'kardex', label: 'Kardex', icon: History },
    { id: 'reports', label: 'Reportes', icon: BarChart3 },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  return (
    <aside className="app-sidebar w-[240px] bg-[var(--ui-surface)] border-r border-[var(--ui-border)] flex flex-col h-full shrink-0 select-none z-20">
      {/* Store Sub-header (only visible in sidebar) */}
      <div className="px-5 py-5 border-b border-[var(--ui-border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] flex items-center justify-center shrink-0">
          <Store className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div className="overflow-hidden">
          <h2 className="font-semibold text-[13px] text-[var(--ui-text)] truncate">Mi Tienda Familiar</h2>
          <p className="text-[11px] text-[var(--ui-muted)] mt-0.5">Sucursal Central</p>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 py-5 px-3 space-y-1.5 overflow-y-auto" aria-label="Navegación principal">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ui-muted)]">Administración</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              aria-current={isActive ? 'page' : undefined}
              data-active={isActive}
              className={`nav-item relative w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-[13px] font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] ${
                isActive
                  ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] font-semibold'
                  : 'text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-text)]'
              }`}
            >
              {isActive && <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--ui-brand)]" />}
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    isActive ? 'text-[var(--ui-brand-strong)]' : 'text-[var(--ui-muted)]'
                  }`}
                />
                <span className="leading-5">{item.label}</span>
              </div>

              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] font-semibold tabular-nums px-1.5 py-0.5 min-w-5 text-center rounded-md shrink-0 ${
                  isActive ? 'bg-[var(--ui-brand)] text-[var(--ui-on-brand)]' : 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)]'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions & Close Shift */}
      <div className="p-3 border-t border-[var(--ui-border)] space-y-2 bg-[var(--ui-surface)]">
        {/* Cerrar Caja Button */}
        <button
          onClick={closeShiftAndGenerateReport}
          className="w-full py-3 px-3 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-[var(--ui-on-brand)] rounded-lg font-semibold text-[13px] transition-colors shadow-sm flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 opacity-85" />
            <span>Cerrar Caja</span>
          </div>
          <span className="font-mono text-[10px] bg-[var(--ui-surface)]/10 px-1.5 py-0.5 rounded border border-white/15 font-medium">
            [F12]
          </span>
        </button>

        {/* Secondary Links */}
        <div className="pt-1 flex flex-col space-y-0.5 text-xs text-[var(--ui-muted)]">
          <button
            onClick={() => showToast('Manual de usuario y atajos de teclado disponible en Ajustes')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-text)] text-left transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Ayuda</span>
          </button>
          <button
            onClick={() => showToast('Sesión guardada en dispositivo')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--ui-danger-solid)]/10 hover:text-[var(--ui-danger-text)] text-left transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
