import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { TopHeader } from './components/TopHeader';
import { Sidebar } from './components/Sidebar';
import { PosScreen } from './components/pos/PosScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
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

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="app-shell flex flex-col h-screen w-screen overflow-hidden bg-[var(--ui-bg)] font-sans antialiased text-[var(--ui-text)]">
      {/* Top Header App Bar */}
      <TopHeader />

      {/* Main Content Area: Sidebar + Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Screen View */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--ui-bg)]">
          {activeScreen === 'pos' && <PosScreen />}
          {activeScreen === 'inventory' && <InventoryScreen />}
          {activeScreen === 'orders' && <OrderPlannerScreen />}
          {activeScreen === 'reception' && <ReceptionScreen />}
          {activeScreen === 'kardex' && <KardexScreen />}
          {activeScreen === 'reports' && <DashboardScreen />}
          {activeScreen === 'settings' && <SettingsScreen />}
        </main>
      </div>

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
        <div className="app-toast fixed bottom-5 right-5 z-50 bg-[var(--ui-chrome)] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs md:text-sm font-medium border border-[var(--ui-border-strong)] animate-in fade-in slide-in-from-bottom-3 duration-200">
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
