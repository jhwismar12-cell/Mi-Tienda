import React, { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { TopHeader } from './components/TopHeader';
import { Sidebar, MobileBottomNav } from './components/Sidebar';
import { PosScreen } from './components/pos/PosScreen';
import { DebtorsScreen } from './components/debtors/DebtorsScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
import { ProvidersScreen } from './components/providers/ProvidersScreen';
import { OrderPlannerScreen } from './components/orders/OrderPlannerScreen';
import { ReceptionScreen } from './components/inventory/ReceptionScreen';
import { KardexScreen } from './components/kardex/KardexScreen';
import { DashboardScreen } from './components/reports/DashboardScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { AltaAlVueloModal } from './components/modals/AltaAlVueloModal';
import { ReceiptModal } from './components/modals/ReceiptModal';
import { ReportZModal } from './components/modals/ReportZModal';
import { NewProductModal } from './components/modals/NewProductModal';
import { CashMovementModal } from './components/modals/CashMovementModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { OpenShiftModal } from './components/modals/OpenShiftModal';
import { LoginScreen, ForcePasswordChangeModal } from './components/auth/LoginScreen';
import { CheckCircle2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeScreen, toastMessage, currentUser } = useStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell flex flex-col h-[100dvh] w-full overflow-hidden bg-[var(--ui-bg)] font-sans antialiased text-[var(--ui-text)]">
      {/* Top Header App Bar */}
      <TopHeader onToggleMobileMenu={() => setIsMobileMenuOpen(v => !v)} />

      {/* Main Content Area: Sidebar + Screen */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Navigation Sidebar (desktop persistent + mobile/tablet drawer) */}
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Dynamic Screen View */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--ui-bg)]">
          {activeScreen === 'pos' && <PosScreen />}
          {activeScreen === 'debtors' && <DebtorsScreen />}
          {activeScreen === 'inventory' && <InventoryScreen />}
          {activeScreen === 'providers' && <ProvidersScreen />}
          {activeScreen === 'orders' && <OrderPlannerScreen />}
          {activeScreen === 'reception' && <ReceptionScreen />}
          {activeScreen === 'kardex' && <KardexScreen />}
          {activeScreen === 'reports' && <DashboardScreen />}
          {activeScreen === 'settings' && <SettingsScreen />}
        </main>
      </div>

      {/* Sticky Bottom Quick Nav for Mobile & Tablet */}
      <MobileBottomNav onOpenMore={() => setIsMobileMenuOpen(true)} />

      {/* Modals */}
      <ForcePasswordChangeModal />
      <OpenShiftModal />
      <AltaAlVueloModal />
      <ReceiptModal />
      <ReportZModal />
      <NewProductModal />
      <CashMovementModal />
      <GlobalSearchModal />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="app-toast fixed bottom-16 lg:bottom-5 left-3 right-3 sm:left-auto sm:right-5 z-50 bg-[var(--ui-chrome)] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs md:text-sm font-medium border border-[var(--ui-border-strong)] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[var(--ui-mint)] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  // Apply persisted theme on app boot (before any screen mounts)
  useEffect(() => {
    try {
      if (localStorage.getItem('tienda_theme') === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch { /* noop */ }
  }, []);

  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}
