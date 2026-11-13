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
  CalendarCheck,
  X,
  Menu
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ScreenType } from '../types';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS_DEF: { id: ScreenType; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'pos', label: 'Punto de Venta', shortLabel: 'Venta', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventario', shortLabel: 'Inventario', icon: Package },
  { id: 'orders', label: 'Agenda de Pedidos', shortLabel: 'Pedidos', icon: CalendarCheck },
  { id: 'reception', label: 'Recepción de Mercancía', shortLabel: 'Recepción', icon: Truck },
  { id: 'kardex', label: 'Kardex', shortLabel: 'Kardex', icon: History },
  { id: 'reports', label: 'Reportes', shortLabel: 'Reportes', icon: BarChart3 },
  { id: 'settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onCloseMobile }) => {
  const { activeScreen, setActiveScreen, closeShiftAndGenerateReport, purchaseOrders, showToast } = useStore();

  const pendingOrdersCount = purchaseOrders.filter(o => o.status === 'PENDIENTE').length;

  const navItems = NAV_ITEMS_DEF.map(item => ({
    ...item,
    badge: item.id === 'orders' ? pendingOrdersCount : undefined
  }));

  const handleSelectScreen = (id: ScreenType) => {
    setActiveScreen(id);
    onCloseMobile?.();
  };

  const renderSidebarContent = (isDrawer: boolean) => (
    <>
      {/* Store Sub-header */}
      <div className="px-5 py-4 lg:py-5 border-b border-[var(--ui-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <div className="overflow-hidden">
            <h2 className="font-semibold text-[13px] text-[var(--ui-text)] truncate">Mi Tienda Familiar</h2>
            <p className="text-[11px] text-[var(--ui-muted)] mt-0.5">Sucursal Central</p>
          </div>
        </div>
        {isDrawer && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className="p-2 rounded-lg hover:bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] hover:text-[var(--ui-text)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 py-4 lg:py-5 px-3 space-y-1.5 overflow-y-auto" aria-label="Navegación principal">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ui-muted)]">Administración</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleSelectScreen(item.id)}
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
        <button
          onClick={() => {
            onCloseMobile?.();
            closeShiftAndGenerateReport();
          }}
          className="w-full py-3 px-3 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-[var(--ui-on-brand)] rounded-lg font-semibold text-[13px] transition-colors shadow-sm flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-brand)] focus-visible:ring-offset-2 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 opacity-85" />
            <span>Cerrar Caja</span>
          </div>
          <span className="hidden lg:inline font-mono text-[10px] bg-[var(--ui-surface)]/10 px-1.5 py-0.5 rounded border border-white/15 font-medium">
            [F12]
          </span>
        </button>

        <div className="pt-1 flex flex-col space-y-0.5 text-xs text-[var(--ui-muted)]">
          <button
            onClick={() => {
              onCloseMobile?.();
              showToast('Manual de usuario y atajos disponible en Ajustes');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-text)] text-left transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Ayuda</span>
          </button>
          <button
            onClick={() => {
              onCloseMobile?.();
              showToast('Sesión guardada en dispositivo');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--ui-danger-solid)]/10 hover:text-[var(--ui-danger-text)] text-left transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="app-sidebar hidden lg:flex w-[240px] bg-[var(--ui-surface)] border-r border-[var(--ui-border)] flex-col h-full shrink-0 select-none z-20">
        {renderSidebarContent(false)}
      </aside>

      {/* Tablet & Mobile slide-over drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="app-sidebar relative z-10 w-[272px] max-w-[82vw] bg-[var(--ui-surface)] border-r border-[var(--ui-border)] flex flex-col h-full shadow-2xl select-none animate-in slide-in-from-left duration-150">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};

interface MobileBottomNavProps {
  onOpenMore: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMore }) => {
  const { activeScreen, setActiveScreen, purchaseOrders } = useStore();
  const pendingOrdersCount = purchaseOrders.filter(o => o.status === 'PENDIENTE').length;

  const quickTabs = NAV_ITEMS_DEF.slice(0, 4); // Venta, Inventario, Pedidos, Recepción
  const isOverflowActive = !quickTabs.some(t => t.id === activeScreen);

  return (
    <nav
      aria-label="Navegación rápida móvil y tablet"
      className="lg:hidden shrink-0 bg-[var(--ui-surface)] border-t border-[var(--ui-border)] grid grid-cols-5 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] select-none z-30"
    >
      {quickTabs.map((item) => {
        const Icon = item.icon;
        const isActive = activeScreen === item.id;
        const badge = item.id === 'orders' ? pendingOrdersCount : 0;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveScreen(item.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-semibold transition-colors min-h-[50px] cursor-pointer ${
              isActive
                ? 'text-[var(--ui-brand-strong)] bg-[var(--ui-brand-soft)]'
                : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 rounded-full bg-[var(--ui-brand)] text-white text-[9px] font-bold flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            <span className="mt-0.5 truncate max-w-full">{item.shortLabel}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onOpenMore}
        className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] sm:text-xs font-semibold transition-colors min-h-[50px] cursor-pointer ${
          isOverflowActive
            ? 'text-[var(--ui-brand-strong)] bg-[var(--ui-brand-soft)]'
            : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
        }`}
      >
        <Menu className="w-5 h-5" />
        <span className="mt-0.5">Menú</span>
      </button>
    </nav>
  );
};
