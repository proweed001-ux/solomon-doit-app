import { ArrowLeft, Settings, Info, Trash2, History, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: 'settings' | 'hub' | 'tod';
}

export default function Header({ title, subtitle, showBack = true, actions }: HeaderProps) {
  const { goBack } = useAppStore();

  return (
    <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
      {showBack && (
        <button onClick={goBack} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={22} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-100 truncate">{title}</div>
        {subtitle && <div className="text-xs text-slate-400 truncate">{subtitle}</div>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {actions === 'settings' && (
          <>
            <button onClick={() => useAppStore.getState().setScreen('settings')} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="ตั้งค่า">
              <Settings size={16} />
            </button>
            <button onClick={() => useAppStore.getState().showToast('AYA DOIT Pro v1.0', 'ok')} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="เกี่ยวกับ">
              <Info size={16} />
            </button>
          </>
        )}
        {actions === 'hub' && (
          <>
            <button onClick={() => useAppStore.getState().setScreen('history')} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="ประวัติ">
              <History size={16} />
            </button>
            <button onClick={() => { if (window.confirm('ต้องการล้างข้อมูลทั้งหมด?')) useAppStore.getState().clearAllData(); }} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-all" aria-label="ล้างข้อมูล">
              <Trash2 size={16} />
            </button>
          </>
        )}
        {actions === 'tod' && (
          <button onClick={() => useAppStore.getState().buildTODData()} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all" aria-label="รีเฟรช">
            <RefreshCw size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
