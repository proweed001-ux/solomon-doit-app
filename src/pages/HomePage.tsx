import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Upload, FileSpreadsheet, HardDrive } from 'lucide-react';

export default function HomePage() {
  const { handleFile, raw, fileMeta, recent } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [storageInfo, setStorageInfo] = useState<string>('—');
  const [isDragOver, setIsDragOver] = useState(false);

  const onFileSelect = useCallback((f: File | null | undefined) => {
    if (f) handleFile(f);
  }, [handleFile]);

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        const used = ((est.usage || 0) / 1024 / 1024).toFixed(1);
        const total = ((est.quota || 0) / 1024 / 1024 / 1024).toFixed(1);
        const pct = est.quota ? Math.min(100, Math.round((est.usage || 0) / est.quota * 100)) : 0;
        setStorageInfo(`${used} MB / ${total} GB (${pct}%)`);
      });
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-lg shadow-lg shadow-blue-500/20">
          🏪
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">AYA DOIT Pro</div>
          <div className="text-xs text-slate-400">ระบบถอดของ & ติดตามยอดขาย</div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => useAppStore.getState().setScreen('settings')}
            className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            aria-label="ตั้งค่า"
          >
            ⚙️
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-extrabold text-white leading-tight">ระบบแอดมิน (Admin)</h1>
          <p className="text-sm text-slate-400 mt-1">อัปโหลดและจัดการข้อมูลจาก Solomon ERP</p>
        </div>

        {/* Upload Zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
            isDragOver
              ? 'border-blue-400 bg-blue-500/10'
              : 'border-slate-600 bg-slate-800/50 hover:border-blue-500/50 hover:bg-blue-500/5'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onFileSelect(e.dataTransfer?.files?.[0]); }}
        >
          <div className="text-5xl mb-3 animate-bounce">📊</div>
          <div className="text-lg font-bold text-white mb-1">แตะเพื่อเลือกไฟล์</div>
          <div className="text-sm text-slate-400 mb-5">.xlsx จากระบบ Solomon (รองรับ Pivot Cache)</div>
          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Upload size={18} />
            เลือกไฟล์ Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => { onFileSelect(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>

        {/* Recent Files */}
        {recent.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ไฟล์ล่าสุด</div>
            <div className="space-y-2">
              {recent.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <FileSpreadsheet size={20} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate">{f.name}</div>
                    <div className="text-xs text-slate-500">{f.date} · {f.rows.toLocaleString('th-TH')} แถว</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current file info */}
        {raw.length > 0 && fileMeta && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <FileSpreadsheet size={16} />
              <span className="font-semibold">{fileMeta.name}</span>
            </div>
            <div className="text-xs text-emerald-400/70 mt-2 flex flex-col gap-2">
              <div>{raw.length.toLocaleString('th-TH')} แถวในระบบ</div>
              <div className="flex gap-2">
                <button
                  onClick={() => useAppStore.getState().setScreen('ps-select')}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors"
                >
                  เริ่มงาน (เลือกพนักงาน) →
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('คุณต้องการลบข้อมูลทั้งหมดใช่หรือไม่?')) {
                      useAppStore.getState().clearAllData();
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-colors"
                >
                  ล้างข้อมูล
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Storage Status */}
        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <HardDrive size={14} /> พื้นที่จัดเก็บ
            </span>
            <span className="text-xs text-slate-500">{storageInfo}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all" style={{ width: '15%' }} />
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
