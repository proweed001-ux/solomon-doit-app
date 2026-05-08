import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { safeNonNegInt } from '@/lib/fieldNormalizer';
import { displayDateKey, normalizeDateKey } from '@/lib/dateNormalizer';
import { ArrowLeft, Search } from 'lucide-react';

export default function DistributionPage() {
  const { raw, selectedPS, setScreen } = useAppStore();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const s = query.trim().toLowerCase();
    const baseRows = selectedPS
      ? raw.filter(r => (r.psName || r.psCode || '') === selectedPS || r.psName?.includes(selectedPS))
      : raw.slice();

    const rows = s
      ? baseRows.filter(r =>
          (r.sku || '').toLowerCase().includes(s) ||
          (r.skuCode || '').toLowerCase().includes(s) ||
          (r.store || '').toLowerCase().includes(s) ||
          (r.brand || '').toLowerCase().includes(s)
        )
      : baseRows;

    // Group by SKU
    const skuMap = new Map<string, {
      sku: string; brand: string; size: string;
      stores: Map<string, { qty: number; cls: string }>;
      qty: number; dates: Set<string>;
    }>();

    rows.forEach(r => {
      const sku = r.sku || '—';
      const brand = r.brand || 'อื่นๆ';
      const size = r.size || 'อื่นๆ';
      const st = r.store || '—';
      const key = `${brand}||${size}||${sku}`;
      if (!skuMap.has(key)) skuMap.set(key, { sku, brand, size, stores: new Map(), qty: 0, dates: new Set() });
      const item = skuMap.get(key)!;
      const cur = item.stores.get(st) || { qty: 0, cls: r.storeClass || '' };
      cur.qty += safeNonNegInt(r.qtyShipPcs);
      cur.cls = cur.cls || (r.storeClass || '');
      item.stores.set(st, cur);
      item.qty += safeNonNegInt(r.qtyShipPcs);
      const dt = displayDateKey(normalizeDateKey(r.date || r.dateRaw || r._rawDate || ''));
      if (dt) item.dates.add(dt);
    });

    return [...skuMap.values()].sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku, 'th'));
  }, [raw, selectedPS, query]);

  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

  const clsTag = (c: string): string => {
    const s = (c || '').toUpperCase();
    if (s.includes('A')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (s.includes('B')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    if (s.includes('C')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('hub')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">เช็คการกระจายสินค้า</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์ชื่อสินค้า หรือ ร้านค้า..."
            className="w-full h-12 pl-10 pr-4 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
          />
        </div>

        {/* Results */}
        {results.length === 0 ? (
          <div className="text-center py-12">
            <Search size={40} className="mx-auto text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">{query ? 'ไม่พบข้อมูล' : 'ค้นหาสินค้าเพื่อดูการกระจาย'}</div>
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-500 font-semibold">
              {selectedPS || 'ทุกพนักงานขาย'} · {results.length} SKU
            </div>

            {results.map(item => {
              const ents = [...item.stores.entries()].sort((a, b) => b[1].qty - a[1].qty || a[0].localeCompare(b[0], 'th'));
              const tot = ents.reduce((s, [, v]) => s + v.qty, 0);
              return (
                <div key={item.sku} className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold text-white truncate">{item.sku}</div>
                      <div className="flex gap-2 text-xs text-slate-400 mt-1">
                        <span>{item.brand}</span>
                        <span>•</span>
                        <span>{item.size}</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">{fmt(tot)} ชิ้น</span>
                  </div>

                  <div className="border border-slate-700/50 rounded-xl overflow-hidden">
                    {ents.map(([st, v]) => (
                      <div key={st} className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30 last:border-b-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-slate-200 truncate">{st}</span>
                          {v.cls && (
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${clsTag(v.cls)}`}>
                              {v.cls}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-bold text-slate-300">{fmt(v.qty)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 text-xs text-slate-500">
                      <span>รวม {fmt(tot)} ชิ้น</span>
                      <span>{ents.length} ร้านค้า</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
