import { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { dbGet } from '@/lib/indexedDB';
import type { HistoryEntry } from '@/types';
import { ArrowLeft, Clock } from 'lucide-react';

export default function HistoryPage() {
  const { setScreen, showToast } = useAppStore();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importStats, setImportStats] = useState<any>(null);

  useEffect(() => {
    loadHistory();
    // Show import warnings from store
    const state = useAppStore.getState();
    setImportWarnings(state.importWarnings);
    setImportStats(state.importStats);
  }, []);

  const loadHistory = async () => {
    const hist = (await dbGet<HistoryEntry[]>('history', 'entries')) || [];
    setEntries(hist);
  };

  const clearHistory = async () => {
    const { clearHistory: clear } = await import('@/lib/indexedDB');
    await clear();
    setEntries([]);
    showToast('ล้างประวัติแล้ว', 'ok');
  };

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('hub')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">ประวัติการทำงาน</div>
        </div>
        {entries.length > 0 && (
          <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 font-semibold">
            ล้าง
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Import Warnings */}
        {importWarnings.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">ข้อควรระวังจากการนำเข้า</div>
            <ul className="space-y-1">
              {importWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300/80 flex items-start gap-2">
                  <span className="text-amber-400 shrink-0">⚠</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Import Stats */}
        {importStats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <div className="text-lg font-extrabold text-blue-400">{importStats.rawCount?.toLocaleString('th-TH') || '—'}</div>
              <div className="text-[10px] text-slate-500">แถวดิบ</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <div className="text-lg font-extrabold text-amber-400">{importStats.duplicatesRemoved?.toLocaleString('th-TH') || '—'}</div>
              <div className="text-[10px] text-slate-500">ตัดซ้ำ</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
              <div className="text-lg font-extrabold text-emerald-400">{importStats.mappedFields || '—'}</div>
              <div className="text-[10px] text-slate-500">ฟิลด์</div>
            </div>
          </div>
        )}

        {/* History Entries */}
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={40} className="mx-auto text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">ยังไม่มีประวัติ</div>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-200">{e.action}</div>
                  <div className="text-xs text-slate-500">{e.details}</div>
                </div>
                <div className="text-[10px] text-slate-600 shrink-0">{new Date(e.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
