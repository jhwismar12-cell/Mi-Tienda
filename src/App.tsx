import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { TopHeader } from './components/TopHeader';
import { Sidebar } from './components/Sidebar';
import { PosScreen } from './components/pos/PosScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
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
import { CheckCircle2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeScreen, toastMessage } = useStore();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f1f5f9] font-sans antialiased text-[#111c2d]">
      {/* Top Header App Bar */}
      <TopHeader />

      {/* Main Content Area: Sidebar + Screen */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Screen View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          {activeScreen === 'pos' && <PosScreen />}
          {activeScreen === 'inventory' && <InventoryScreen />}
          {activeScreen === 'reception' && <ReceptionScreen />}
          {activeScreen === 'kardex' && <KardexScreen />}
          {activeScreen === 'reports' && <DashboardScreen />}
          {activeScreen === 'settings' && <SettingsScreen />}
        </main>
      </div>

      {/* Modals */}
      <AltaAlVueloModal />
      <ReceiptModal />
      <ReportZModal />
      <NewProductModal />
      <CashMovementModal />
      <GlobalSearchModal />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#111c2d] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs md:text-sm font-medium border border-[#334155] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#85f8c4] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}
