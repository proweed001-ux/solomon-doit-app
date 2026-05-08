import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';

import HomePage from '@/pages/HomePage';
import PSSelectPage from '@/pages/PSSelectPage';
import DateSelectPage from '@/pages/DateSelectPage';
import HubPage from '@/pages/HubPage';
import TODPage from '@/pages/TODPage';
import DashboardPage from '@/pages/DashboardPage';
import DistributionPage from '@/pages/DistributionPage';
import BillPage from '@/pages/BillPage';
import PivotPage from '@/pages/PivotPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';

import LoadingOverlay from '@/components/LoadingOverlay';
import Toast from '@/components/Toast';

export default function App() {
  const { screen, settings, toast, clearToast, init } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  // Apply font scale to document root
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * settings.fontScale}px`;
  }, [settings.fontScale]);

  return (
    <div className={`w-full min-h-screen bg-slate-900 text-slate-200 overflow-hidden print:overflow-visible print:h-auto print:min-h-0 ${settings.darkMode ? 'dark' : ''}`}>
      <div className="max-w-md mx-auto w-full h-[100dvh] bg-slate-900 relative shadow-2xl flex flex-col border-x border-slate-800 print:max-w-none print:w-full print:h-auto print:min-h-0 print:border-none print:shadow-none print:block">
        
        {/* Main Router */}
        <div className="flex-1 overflow-hidden relative print:overflow-visible print:h-auto print:block">
          {screen === 'upload' && <HomePage />}
          {screen === 'ps-select' && <PSSelectPage />}
          {screen === 'date-select' && <DateSelectPage />}
          {screen === 'hub' && <HubPage />}
          {screen === 'tod' && <TODPage />}
          {screen === 'dashboard' && <DashboardPage />}
          {screen === 'distribution' && <DistributionPage />}
          {screen === 'bill' && <BillPage />}
          {screen === 'pivot' && <PivotPage />}
          {screen === 'history' && <HistoryPage />}
          {screen === 'settings' && <SettingsPage />}
        </div>
      </div>

      {/* Global Overlays */}
      <LoadingOverlay />
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={clearToast}
        />
      )}
    </div>
  );
}
