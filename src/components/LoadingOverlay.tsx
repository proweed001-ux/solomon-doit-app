import { useAppStore } from '@/store/useAppStore';
import { Loader2 } from 'lucide-react';

export default function LoadingOverlay() {
  const { loading, loadingText, loadingPct } = useAppStore();

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 bg-slate-900/90 border border-slate-700/50 rounded-3xl p-8 min-w-[280px] shadow-2xl">
        <Loader2 size={40} className="text-blue-500 animate-spin" />
        <div className="text-3xl font-black text-blue-400 tabular-nums">{Math.round(loadingPct)}%</div>
        <div className="text-sm font-bold text-slate-200">{loadingText || 'กำลังประมวลผล...'}</div>
        <div className="w-full max-w-[200px] h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, loadingPct))}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-500">ระบบกำลังเตรียมข้อมูล</div>
      </div>
    </div>
  );
}
