import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Search, User, Package, Store } from 'lucide-react';

export default function PSSelectPage() {
  const { psList, fileMeta, selectPS, setScreen } = useAppStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return psList;
    const q = search.toLowerCase();
    return psList.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q)
    );
  }, [psList, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('upload')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">เลือกพนักงานขาย</div>
          <div className="text-xs text-slate-400">ขั้นตอน 1 / 3</div>
        </div>
      </header>

      {/* Steps */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/40 border-b border-slate-700/40 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 flex-1">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">1</div>
          <span>พนักงาน</span>
        </div>
        <div className="flex-1 h-0.5 bg-slate-700" />
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 flex-1">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center text-[10px]">2</div>
          <span>วันที่</span>
        </div>
        <div className="flex-1 h-0.5 bg-slate-700" />
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 flex-1">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center text-[10px]">3</div>
          <span>งาน</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File info */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
          <span>ℹ️</span>
          <span className="font-medium">{fileMeta?.name || 'ไฟล์ยังไม่โหลด'} ({psList.reduce((s, p) => s + p.orders, 0).toLocaleString('th-TH')} ออร์เดอร์)</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อพนักงานขาย..."
            className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
          />
        </div>

        {/* PS Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <User size={40} className="mx-auto text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">ไม่พบพนักงาน</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {filtered.map((ps) => (
              <button
                key={ps.name}
                onClick={() => selectPS(ps.name)}
                className="flex flex-col gap-1 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-left hover:border-blue-500/50 hover:bg-blue-500/5 active:scale-[0.99] transition-all group"
              >
                <div className="flex items-center gap-2">
                  <User size={16} className="text-blue-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-100 group-hover:text-blue-300 transition-colors">{ps.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 pl-6">
                  {ps.code && <span className="font-mono">{ps.code}</span>}
                  <span className="flex items-center gap-1"><Package size={10} />{ps.orders.toLocaleString('th-TH')} ออร์เดอร์</span>
                  <span className="flex items-center gap-1"><Store size={10} />{ps.stores.size} ร้าน</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
