/* ============================================================
   TOD (Picking) Page - SOLOMON COMPLIANT
   - QtyShipPCS as primary quantity display
   - QtyShipCSE shown separately
   - InvoiceAmt shown
   - SOTypeID badges
   - Labels indicating which fields are used
   ============================================================ */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { safeNonNegInt } from '@/lib/fieldNormalizer';
import {
  ArrowLeft, Package, Search, FolderOpen, FolderClosed,
  Plus, Undo2, Redo2, Receipt, FileDown, Phone,
  Boxes, Tag, TrendingUp, Info, List, LayoutGrid, CheckCircle2
} from 'lucide-react';

/* ---- Fast Input (Prevents Focus Loss) ---- */
function FastInput({ val, onChange, className }: { val: number | string; onChange: (v: string) => void; className?: string }) {
  const [local, setLocal] = useState(val);
  
  useEffect(() => {
    setLocal(val);
  }, [val]);

  return (
    <input
      type="number"
      min={0}
      value={local || ''}
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
      className={className}
    />
  );
}

export default function TODPage() {
  const {
    todData, storeCols, storeList,
    groups, todBrandFilter, todSearch, settings, teleData, selectedPS, selectedDate,
    setScreen, toggleGroup, collapseAll, expandAll, addStoreColumn,
    changeStore, updateStore, updateExtra, undo, redo,
    insertRow, exportCSV, buildBillData, calcRem, setTodBrandFilter,
    setTodSearch, showToast,
  } = useAppStore();

  const [searchQ, setSearchQ] = useState('');
  const [showTele, setShowTele] = useState(!settings.teleHidden && teleData.length > 0);
  const [insertModal, setInsertModal] = useState<{brand:string;size:string}|null>(null);
  const [insertSku, setInsertSku] = useState('');
  const [insertSkuCode, setInsertSkuCode] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [activeStoreMode, setActiveStoreMode] = useState<string | 'ALL'>('ALL');
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTodSearch(searchQ.trim()), 120);
    return () => clearTimeout(timer);
  }, [searchQ, setTodSearch]);

  // Group data
  const skuKeys = useMemo(() => {
    const data = todData;
    const keys = Object.keys(data);
    let filtered = keys;
    if (todBrandFilter) filtered = filtered.filter(k => data[k].brand === todBrandFilter);
    if (todSearch) {
      const q = todSearch.toLowerCase();
      filtered = filtered.filter(k =>
        data[k].sku.toLowerCase().includes(q) ||
        data[k].skuCode.toLowerCase().includes(q)
      );
    }

    // Sort simply by SKU name
    return filtered.sort((a, b) => data[a].sku.localeCompare(data[b].sku, 'th'));
  }, [todData, todBrandFilter, todSearch]);

  const brands = useMemo(() => {
    return [...new Set(Object.values(todData).map(d => d.brand))].sort((a, b) => a.localeCompare(b, 'th'));
  }, [todData]);

  // Grand totals
  const viewStoreCols = activeStoreMode === 'ALL' ? storeCols : [activeStoreMode];

  const grandTotals = useMemo(() => {
    let pcs = 0, amt: number | null = null, add = 0, rem = 0;
    const storeSums: number[] = viewStoreCols.map(() => 0);
    Object.values(todData).forEach(d => {
      pcs += d.totalPcs;
      if (d.detailAmt != null) amt = (amt ?? 0) + d.detailAmt;
      add += d.add;
      rem += d.remove;
      viewStoreCols.forEach((s, i) => { storeSums[i] += (d.stores?.[s] || 0); });
    });
    const storeTotal = storeSums.reduce((a, b) => a + b, 0);
    return { pcs, amt, add, rem, storeSums, remain: pcs - storeTotal + add - rem };
  }, [todData, viewStoreCols]);

  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const fmtMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('hub')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">ถอดของ</div>
          <div className="text-[10px] text-slate-400 truncate">
            {Object.keys(todData).length.toLocaleString('th-TH')} SKU · {storeList.length} ร้าน
            <span className="text-blue-400 ml-1">| PCS หลัก</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowInfo(!showInfo)} className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${showInfo ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'}`} title="ข้อมูลฟิลด์">
            <Info size={16} />
          </button>
          <button onClick={() => { const bd = buildBillData(); if (Object.values(bd).some(v => v.length)) setScreen('bill'); else showToast('ยังไม่มีข้อมูลบิล', 'info'); }} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all" title="สรุปบิล">
            <Receipt size={16} />
          </button>
          <button onClick={() => exportCSV()} className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all" title="ส่งออก CSV">
            <FileDown size={16} />
          </button>
          {teleData.length > 0 && (
            <button onClick={() => setShowTele(!showTele)} className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${showTele ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'}`} title="Telesale">
              <Phone size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Info Banner */}
      {showInfo && (
        <div className="shrink-0 px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="text-[10px] text-blue-300 space-y-0.5">
            <div className="flex items-center gap-1"><Package size={10} /> จำนวนชิ้น = QtyShipPCS</div>
            <div className="flex items-center gap-1"><TrendingUp size={10} /> ยอดเงิน = row.amt เท่านั้น</div>
            <div className="flex items-center gap-1"><Tag size={10} /> SOTypeID แสดงประเภทเอกสาร</div>
          </div>
        </div>
      )}

      {/* Summary Bar */}
      <div className="shrink-0 flex gap-2 px-4 py-2 bg-slate-800/40 border-b border-slate-700/40 overflow-x-auto">
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
          <Package size={10} /> {fmt(grandTotals.pcs)} ชิ้น
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400">
          <TrendingUp size={10} /> {grandTotals.amt == null ? '—' : `฿${fmtMoney(grandTotals.amt)}`}
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold text-purple-400">
          <Receipt size={10} /> {fmt(Object.values(todData).reduce((s, d) => s + d.invoiceNos.length, 0))} บิล
        </span>
      </div>

      {/* Store Mode Tabs & Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-slate-800/60 border-b border-slate-700/50 flex-wrap">
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700/50 overflow-x-auto shrink-0 max-w-full">
          <button
            onClick={() => setActiveStoreMode('ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${activeStoreMode === 'ALL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <LayoutGrid size={13} /> โหมดรวมทุกร้าน
          </button>
          <button
            onClick={() => setActiveStoreMode(storeCols[0] || 'ALL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${activeStoreMode !== 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <List size={13} /> โหมดแยกรายร้าน
          </button>
        </div>
        
        {activeStoreMode !== 'ALL' && (
          <button
            onClick={() => { const bd = buildBillData(); if (bd[activeStoreMode]?.length) setScreen('bill'); else showToast('ยังไม่มีข้อมูลบิลสำหรับร้านนี้', 'info'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold rounded-lg text-[11px] hover:bg-emerald-500/30 transition-all shrink-0 whitespace-nowrap"
          >
            <CheckCircle2 size={13} /> กดผ่าน (ไปหน้าบิลร้านนี้)
          </button>
        )}
      </div>

      {activeStoreMode !== 'ALL' && (
        <div className="flex gap-2 px-4 py-2 bg-slate-800/40 border-b border-slate-700/40 shrink-0 overflow-x-auto">
          {storeCols.map(st => (
            <button
              key={st}
              onClick={() => setActiveStoreMode(st)}
              className={`shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold border transition-all ${
                activeStoreMode === st 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
          <button onClick={() => addStoreColumn()} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 border items-center border-slate-700 text-slate-400 hover:bg-slate-700 transition-all">
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/40 border-b border-slate-700/40 shrink-0 overflow-x-auto">
        <button onClick={collapseAll} className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all shrink-0">
          <FolderClosed size={13} /> พับ
        </button>
        <button onClick={expandAll} className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all shrink-0">
          <FolderOpen size={13} /> ขยาย
        </button>
        {activeStoreMode === 'ALL' && (
          <button onClick={() => addStoreColumn()} className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all shrink-0">
            <Plus size={13} /> ร้าน
          </button>
        )}
        <button onClick={undo} className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all shrink-0">
          <Undo2 size={13} /> Undo
        </button>
        <button onClick={redo} className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all shrink-0">
          <Redo2 size={13} /> Redo
        </button>
        <div className="flex-1 min-w-[100px]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="ค้นหา SKU / รหัส..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Brand Chips */}
      {brands.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2 bg-slate-800/20 border-b border-slate-700/30 shrink-0 overflow-x-auto">
          <button
            onClick={() => setTodBrandFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${todBrandFilter === null ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}
          >
            ทั้งหมด
          </button>
          {brands.map(b => (
            <button
              key={b}
              onClick={() => setTodBrandFilter(todBrandFilter === b ? null : b)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${todBrandFilter === b ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div ref={tableRef} className={`flex-1 overflow-y-auto ${activeStoreMode !== 'ALL' ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
        {Object.keys(todData).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Package size={48} className="text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">ยังไม่มีข้อมูล</div>
          </div>
        ) : (
          <table className={`w-full text-xs border-separate border-spacing-0 ${activeStoreMode !== 'ALL' ? 'table-fixed min-w-0' : 'min-w-[800px]'}`}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-900">
                <th className={`sticky left-0 z-30 bg-slate-900 text-left px-3 py-2 text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-r border-slate-700/50 shadow-[1px_0_0_0_#334155] ${activeStoreMode !== 'ALL' ? 'w-[40%]' : 'min-w-[150px] max-w-[200px]'}`}>
                  สินค้า
                </th>
                <th className={`px-2 py-2 text-center text-emerald-400 font-bold text-[10px] uppercase tracking-wider border-b border-r border-slate-700/50 ${activeStoreMode !== 'ALL' ? 'w-[45px]' : 'min-w-[55px]'}`}>
                  <Package size={10} className="inline" /> ชิ้น
                </th>
                <th className={`px-1 py-2 text-center text-blue-400 font-bold text-[10px] uppercase tracking-wider border-b border-r border-slate-700/50 ${activeStoreMode !== 'ALL' ? 'w-[55px]' : 'min-w-[70px]'}`}>
                  ฿ ยอด
                </th>
                {viewStoreCols.map((s, i) => (
                  <th key={s} className={`px-1 py-1 text-center text-slate-400 font-bold text-[10px] border-b border-r border-slate-700/50 ${activeStoreMode !== 'ALL' ? 'w-[65px]' : 'min-w-[90px] max-w-[120px]'}`}>
                    {activeStoreMode === 'ALL' ? (
                      <select
                        value={s}
                        onChange={(e) => changeStore(storeCols.indexOf(s), e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-white px-0.5 py-1 outline-none focus:border-blue-500 truncate"
                        title={s}
                      >
                        {storeList.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-[11px] px-1 py-1 text-center font-bold">
                        {s}
                      </div>
                    )}
                  </th>
                ))}
                {activeStoreMode === 'ALL' && (
                  <th className="px-1 py-2 border-b border-r border-slate-700/50 w-[28px]">
                    <button onClick={() => addStoreColumn()} className="text-slate-500 hover:text-white text-lg leading-none">+</button>
                  </th>
                )}
                {activeStoreMode === 'ALL' && <th className="px-2 py-2 text-center text-slate-400 font-bold text-[10px] border-b border-r border-slate-700/50 w-[52px]">เพิ่ม</th>}
                {activeStoreMode === 'ALL' && <th className="px-2 py-2 text-center text-slate-400 font-bold text-[10px] border-b border-r border-slate-700/50 w-[52px]">ดึงออก</th>}
                <th className={`px-1 py-2 text-center text-slate-400 font-bold text-[10px] border-b border-slate-700/50 ${activeStoreMode !== 'ALL' ? 'w-[45px]' : 'w-[60px]'}`}>คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {skuKeys.map(k => {
                const row = todData[k];
                const rem = calcRem(row);
                const remClass = rem > 0 ? 'text-emerald-400' : rem < 0 ? 'text-red-400' : 'text-slate-500';
                return (
                  <tr key={k} className="hover:bg-slate-700/30 group">
                    <td className="sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 px-2 py-1 border-b border-r border-slate-700/50 shadow-[1px_0_0_0_#334155] overflow-hidden">
                      <div className="flex justify-between items-start gap-1">
                        <div className="truncate font-medium text-slate-200 text-[11px]" title={row.sku}>{row.sku}</div>
                      </div>
                      {row.skuCode && <div className="text-[9px] text-slate-500 font-mono truncate">{row.skuCode}</div>}
                      {/* SOTypeID badges */}
                      {row.soTypeIds && row.soTypeIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {row.soTypeIds.map((tid: string) => (
                            <span key={tid} className="px-1 py-0 rounded bg-slate-700/50 text-[8px] text-slate-400">{tid}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1 text-center font-bold text-emerald-400 border-b border-r border-slate-700/30">{fmt(row.totalPcs)}</td>
                    <td className="px-1 py-1 text-center font-bold text-blue-400 border-b border-r border-slate-700/30 text-[9px] sm:text-[10px]">{row.detailAmt == null ? '—' : fmtMoney(row.detailAmt)}</td>
                    {viewStoreCols.map(s => {
                      const val = safeNonNegInt(row.stores?.[s]);
                      return (
                        <td key={s} className="px-0.5 py-0.5 border-b border-r border-slate-700/30">
                          <FastInput
                            val={val || ''}
                            onChange={(v) => updateStore(k, s, v)}
                            className={`w-full h-8 text-center text-[12px] font-bold rounded-md transition-all ${
                              activeStoreMode !== 'ALL' 
                                ? 'bg-slate-800 border border-slate-600 text-white focus:bg-blue-900/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                                : 'bg-transparent text-slate-200 focus:bg-blue-500/10 focus:outline-none focus:ring-1 focus:ring-blue-500/30'
                            }`}
                          />
                        </td>
                      );
                    })}
                    {activeStoreMode === 'ALL' && <td className="border-b border-r border-slate-700/30" />}
                    {activeStoreMode === 'ALL' && (
                      <td className="px-0.5 py-0.5 border-b border-r border-slate-700/30">
                        <FastInput
                          val={row.add || ''}
                          onChange={(v) => updateExtra(k, 'add', v)}
                          className="w-full h-8 text-center bg-transparent text-[11px] font-bold text-slate-200 focus:bg-emerald-500/10 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 rounded-md transition-all"
                        />
                      </td>
                    )}
                    {activeStoreMode === 'ALL' && (
                      <td className="px-0.5 py-0.5 border-b border-r border-slate-700/30">
                        <FastInput
                          val={row.remove || ''}
                          onChange={(v) => updateExtra(k, 'remove', v)}
                          className="w-full h-8 text-center bg-transparent text-[11px] font-bold text-slate-200 focus:bg-red-500/10 focus:outline-none focus:ring-1 focus:ring-red-500/30 rounded-md transition-all"
                        />
                      </td>
                    )}
                    <td className={`px-1 py-1 text-center font-extrabold border-b border-slate-700/30 ${remClass}`}>
                      {fmt(rem)}
                    </td>
                  </tr>
                );
              })}

              {/* Insert Row */}
              <tr>
                <td colSpan={4 + viewStoreCols.length + (activeStoreMode === 'ALL' ? 4 : 3)} className="px-3 py-2 border-b border-dashed border-slate-700/30 bg-slate-800/10 hover:bg-slate-800/30 transition-colors">
                  <button
                    onClick={() => setInsertModal({ brand: '', size: '' })}
                    className="w-full py-2 text-[12px] font-bold text-blue-400 border border-blue-500/30 border-dashed rounded-lg hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> แทรกออเดอร์ (Manual)
                  </button>
                </td>
              </tr>

              {/* Grand total */}
              <tr className="bg-slate-800 font-extrabold">
                <td className="sticky left-0 z-10 bg-slate-800 px-3 py-2 text-slate-200 border-b border-r border-slate-700/50 shadow-[1px_0_0_0_#334155]">รวมทั้งหมด</td>
                <td className="px-1 py-2 text-center text-emerald-400 font-bold border-b border-r border-slate-700/50">{fmt(grandTotals.pcs)}</td>
                <td className="px-1 py-2 text-center text-blue-400 font-bold border-b border-r border-slate-700/50">{grandTotals.amt == null ? '—' : fmtMoney(grandTotals.amt)}</td>
                {grandTotals.storeSums.map((v, i) => (
                  <td key={i} className="px-1 py-2 text-center font-semibold border-b border-r border-slate-700/50">{fmt(v)}</td>
                ))}
                {activeStoreMode === 'ALL' && <td className="border-b border-r border-slate-700/50" />}
                {activeStoreMode === 'ALL' && <td className="px-1 py-2 text-center font-semibold border-b border-r border-slate-700/50">{fmt(grandTotals.add)}</td>}
                {activeStoreMode === 'ALL' && <td className="px-1 py-2 text-center font-semibold border-b border-r border-slate-700/50">{fmt(grandTotals.rem)}</td>}
                <td className={`px-1 py-2 text-center font-extrabold border-b border-slate-700/50 ${grandTotals.remain > 0 ? 'text-emerald-400' : grandTotals.remain < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                  {fmt(grandTotals.remain)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Telesale Section */}
      {showTele && teleData.length > 0 && (
        <div className="shrink-0 border-t border-slate-700/50 mx-4 mb-3 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-t-xl">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Phone size={13} /> ออร์เดอร์ Telesale (แยกจาก PS ปกติ)
            </span>
            <button onClick={() => setShowTele(false)} className="text-amber-400/70 hover:text-amber-400">✕</button>
          </div>
          <div className="max-h-[200px] overflow-auto border border-t-0 border-slate-700/50 rounded-b-xl">
            <TeleTable teleData={teleData} />
          </div>
        </div>
      )}

      {/* Bottom Action */}
      <div className="shrink-0 p-3 bg-slate-900/80 border-t border-slate-700/50">
        <button
          onClick={() => setScreen('bill')}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all"
        >
          สรุปบิลส่งของ
        </button>
      </div>

      {/* Insert Modal */}
      {insertModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setInsertModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-t-2xl w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">เพิ่มสินค้า</h3>
            <div>
              <label className="text-xs text-slate-400 font-semibold">ชื่อสินค้า</label>
              <input value={insertSku} onChange={e => setInsertSku(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm mt-1 focus:border-blue-500 outline-none" placeholder="ชื่อสินค้า" />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold">รหัสสินค้า</label>
              <input value={insertSkuCode} onChange={e => setInsertSkuCode(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm mt-1 focus:border-blue-500 outline-none" placeholder="รหัส (ไม่บังคับ)" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setInsertModal(null)} className="flex-1 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm hover:bg-slate-700 transition-all">ยกเลิก</button>
              <button
                onClick={() => {
                  if (insertSku.trim()) {
                    insertRow(insertModal.brand, insertModal.size, insertSku.trim(), insertSkuCode.trim());
                    setInsertModal(null);
                    setInsertSku('');
                    setInsertSkuCode('');
                  }
                }}
                className="flex-1 h-10 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-all"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Telesale Table ---- */
function TeleTable({ teleData }: { teleData: any[] }) {
  const grouped = new Map<string, { sku: string; brand: string; pcs: number; stores: Record<string, number>; teleName: string }>();
  for (const r of teleData) {
    const k = r.sku || '—';
    if (!grouped.has(k)) grouped.set(k, { sku: k, brand: r.brand || '', pcs: 0, stores: {}, teleName: r.teleName || '' });
    const item = grouped.get(k)!;
    item.pcs += safeNonNegInt(r.qtyShipPcs || r.qty);
    if (r.store) item.stores[r.store] = (item.stores[r.store] || 0) + safeNonNegInt(r.qtyShipPcs || r.qty);
  }
  return (
    <table className="w-full text-[11px]">
      <thead className="sticky top-0 bg-slate-900/95 z-10">
        <tr className="text-slate-400 font-bold text-[10px]">
          <th className="text-left px-3 py-2 border-b border-slate-700/50">สินค้า (Telesale)</th>
          <th className="text-left px-2 py-2 border-b border-slate-700/50">ชื่อ Telesale</th>
          <th className="text-center px-2 py-2 border-b border-slate-700/50 w-[50px]">ชิ้น</th>
          <th className="text-left px-2 py-2 border-b border-slate-700/50">ร้านค้า</th>
        </tr>
      </thead>
      <tbody>
        {[...grouped.values()].map(d => (
          <tr key={d.sku} className="hover:bg-white/[0.02]">
            <td className="px-3 py-1.5 border-b border-slate-700/30 max-w-[200px] truncate font-medium">{d.sku}</td>
            <td className="px-2 py-1.5 border-b border-slate-700/30 text-slate-400">{d.teleName}</td>
            <td className="px-2 py-1.5 text-center font-bold text-blue-400 border-b border-slate-700/30">{d.pcs.toLocaleString('th-TH')}</td>
            <td className="px-2 py-1.5 border-b border-slate-700/30 text-slate-400 text-[10px]">
              {Object.entries(d.stores).map(([s, q]) => `${s}(${q})`).join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
