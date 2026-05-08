/* ============================================================
   Dashboard Page - SOLOMON COMPLIANT
   - Global overview (not tied to single PS)
   - Filters: SOTypeID, DateField, DateRange, PS, Store, Brand
   - KPIs: PCS, CSE, InvoiceAmt, InvoiceCount, StoreCount, SKUCount
   - Top lists: Brand, Size, SKU, Store
   - SOType breakdown
   ============================================================ */

import { useMemo, useState, ReactNode } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { safeNonNegInt, safeNum } from '@/lib/fieldNormalizer';
import { displayDateKey } from '@/lib/dateNormalizer';
import {
  ArrowLeft, BarChart3, Store, Package, ShoppingCart, TrendingUp,
  Receipt, Boxes, Calendar, Filter, X, ChevronDown, Tag,
  User, Building2,
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const {
    psData, raw, globalStats, dashboardFilters, setDashboardFilters,
    getFilteredData, getDistinctSoTypeIds, settings, setScreen,
    selectedPS, selectedDate, dashFilter, setDashFilter,
  } = useAppStore();

  const [showFilters, setShowFilters] = useState(false);

  // Use global filtered data if available, otherwise fall back to psData
  const dataToUse = useMemo(() => {
    if (raw.length > 0) {
      return getFilteredData();
    }
    return psData;
  }, [raw, psData, dashboardFilters, getFilteredData]);

  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const fmtMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // KPIs
  const kpis = useMemo(() => {
    let totalPcs = 0;
    let totalCse = 0;
    let totalInvoiceAmt = 0;
    const stores = new Set<string>();
    const skus = new Set<string>();
    const invoices = new Set<string>();
    const soTypes: Record<string, number> = {};

    for (const r of dataToUse) {
      totalPcs += safeNonNegInt(r.qtyShipPcs);
      totalCse += safeNonNegInt(r.qtyShipCse);
      totalInvoiceAmt += safeNum(r.invoiceAmt);
      if (r.store) stores.add(r.store);
      if (r.sku) skus.add(r.sku);
      if (r.invoiceNo) invoices.add(r.invoiceNo);
      const st = r.soTypeId || 'ไม่ระบุ';
      soTypes[st] = (soTypes[st] || 0) + safeNonNegInt(r.qtyShipPcs);
    }

    return { totalPcs, totalCse, totalInvoiceAmt, storeCount: stores.size, skuCount: skus.size, invoiceCount: invoices.size, soTypes };
  }, [dataToUse]);

  // Top lists
  const topLists = useMemo(() => {
    const brandMap: Record<string, { pcs: number; amt: number }> = {};
    const sizeMap: Record<string, { pcs: number; amt: number }> = {};
    const skuMap: Record<string, { pcs: number; amt: number; skuCode: string }> = {};
    const storeMap: Record<string, { pcs: number; amt: number }> = {};

    for (const r of dataToUse) {
      const pcs = safeNonNegInt(r.qtyShipPcs);
      const amt = safeNum(r.invoiceAmt);

      const b = r.brand || 'อื่นๆ';
      if (!brandMap[b]) brandMap[b] = { pcs: 0, amt: 0 };
      brandMap[b].pcs += pcs;
      brandMap[b].amt += amt;

      const s = r.size || 'อื่นๆ';
      if (!sizeMap[s]) sizeMap[s] = { pcs: 0, amt: 0 };
      sizeMap[s].pcs += pcs;
      sizeMap[s].amt += amt;

      const sk = r.sku || '—';
      if (!skuMap[sk]) skuMap[sk] = { pcs: 0, amt: 0, skuCode: r.skuCode || '' };
      skuMap[sk].pcs += pcs;
      skuMap[sk].amt += amt;

      const st = r.store || 'ไม่ระบุ';
      if (!storeMap[st]) storeMap[st] = { pcs: 0, amt: 0 };
      storeMap[st].pcs += pcs;
      storeMap[st].amt += amt;
    }

    const sortByPcs = (map: Record<string, any>) =>
      Object.entries(map).sort((a, b) => (b[1].pcs || 0) - (a[1].pcs || 0)).slice(0, 10);

    return {
      brands: sortByPcs(brandMap),
      sizes: sortByPcs(sizeMap),
      skus: sortByPcs(skuMap),
      stores: sortByPcs(storeMap),
    };
  }, [dataToUse]);

  // Chart data
  const chartData = useMemo(() => {
    const groupMap: Record<string, number> = {};
    const amtMap: Record<string, number> = {};

    const keyFn = (r: any) => {
      if (dashFilter === 'store') return r.store || 'ไม่ระบุ';
      if (dashFilter === 'size') return r.size || 'ไม่ระบุ';
      return r.brand || 'อื่นๆ';
    };

    dataToUse.forEach(r => {
      const k = keyFn(r);
      groupMap[k] = (groupMap[k] || 0) + safeNonNegInt(r.qtyShipPcs);
      amtMap[k] = (amtMap[k] || 0) + safeNum(r.invoiceAmt);
    });

    const sorted = Object.entries(groupMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sorted.map(([k]) => k);
    const data = sorted.map(([, v]) => v);
    const amounts = sorted.map(([k]) => amtMap[k] || 0);

    return { labels, data, amounts };
  }, [dataToUse, dashFilter]);

  const filters: { key: 'all' | 'brand' | 'store' | 'size'; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'brand', label: 'รายแบรนด์' },
    { key: 'store', label: 'รายร้าน' },
    { key: 'size', label: 'รายขนาด' },
  ];

  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#0ea5e9', '#a855f7'];

  const chartConfig = {
    labels: chartData.labels,
    datasets: [{
      label: 'ชิ้น',
      data: chartData.data,
      backgroundColor: chartData.data.map((_, i) => colors[i] || '#94a3b8'),
      borderWidth: 0,
      borderRadius: 5,
    }],
  };

  const soTypeIds = getDistinctSoTypeIds();

  const activeDateField = dashboardFilters.dateField;
  const dateFieldLabel = activeDateField === 'soDate' ? 'SO_Date' : 'Invoice_Date';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('hub')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">สรุปภาพรวม</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar size={10} />
            ใช้วันที่: <span className="text-blue-400 font-semibold">{dateFieldLabel}</span>
            {selectedPS && <span className="ml-2 text-slate-500">| {selectedPS}</span>}
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showFilters ? 'bg-blue-500/20 border border-blue-500/50 text-blue-400' : 'bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white'}`}
        >
          <Filter size={16} />
        </button>
      </header>

      {/* Filter Panel */}
      {showFilters && (
        <div className="shrink-0 px-4 py-3 bg-slate-800/60 border-b border-slate-700/50 space-y-3">
          {/* Date Field Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              <Calendar size={10} className="inline mr-1" />ฟิลด์วันที่
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDashboardFilters({ dateField: 'invoiceDate' })}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${dashboardFilters.dateField === 'invoiceDate' ? 'bg-blue-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
              >
                Invoice_Date
              </button>
              <button
                onClick={() => setDashboardFilters({ dateField: 'soDate' })}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${dashboardFilters.dateField === 'soDate' ? 'bg-blue-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
              >
                SO_Date
              </button>
            </div>
          </div>

          {/* SOTypeID Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              <Tag size={10} className="inline mr-1" />ประเภทเอกสาร (SOTypeID)
            </label>
            <select
              value={dashboardFilters.soTypeId}
              onChange={(e) => setDashboardFilters({ soTypeId: e.target.value })}
              className="w-full h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 outline-none"
            >
              <option value="">ทั้งหมด</option>
              {soTypeIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">ตั้งแต่</label>
              <input
                type="date"
                value={dashboardFilters.dateFrom}
                onChange={(e) => setDashboardFilters({ dateFrom: e.target.value })}
                className="w-full h-9 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">ถึง</label>
              <input
                type="date"
                value={dashboardFilters.dateTo}
                onChange={(e) => setDashboardFilters({ dateTo: e.target.value })}
                className="w-full h-9 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() => useAppStore.getState().resetDashboardFilters()}
            className="w-full h-8 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1"
          >
            <X size={12} /> รีเซ็ตตัวกรอง
          </button>
        </div>
      )}

      {/* Chart filters */}
      <div className="flex gap-1.5 px-4 py-2 bg-slate-800/40 border-b border-slate-700/40 shrink-0 overflow-x-auto">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setDashFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              dashFilter === f.key
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {dataToUse.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 size={48} className="text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">ไม่มีข้อมูล</div>
            <div className="text-xs text-slate-500 mt-1">กรุณาเลือกพนักงานขายและวันที่ก่อน</div>
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-blue-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ยอด InvoiceAmt</span>
                </div>
                <div className="text-xl font-extrabold text-blue-400">฿{fmtMoney(kpis.totalInvoiceAmt)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Package size={16} className="text-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จำนวนชิ้น (PCS)</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-400">{fmt(kpis.totalPcs)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Boxes size={16} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จำนวนลัง (CSE)</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-400">{fmt(kpis.totalCse)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Receipt size={16} className="text-purple-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">จำนวนบิล</span>
                </div>
                <div className="text-2xl font-extrabold text-purple-400">{fmt(kpis.invoiceCount)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Store size={16} className="text-cyan-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ร้านค้า</span>
                </div>
                <div className="text-2xl font-extrabold text-cyan-400">{fmt(kpis.storeCount)}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <ShoppingCart size={16} className="text-sky-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SKU</span>
                </div>
                <div className="text-2xl font-extrabold text-sky-400">{fmt(kpis.skuCount)}</div>
              </div>
            </div>

            {/* Chart */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                ยอดขาย{filters.find(f => f.key === dashFilter)?.label} (ชิ้น)
              </div>
              <div className="h-[200px]">
                <Bar
                  data={chartConfig}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: { label: (c: any) => ` ${c.raw.toLocaleString('th-TH')} ชิ้น` },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { callback: (v: any) => fmt(v), font: { size: 10 }, color: '#64748b' },
                        grid: { color: '#334155' },
                      },
                      x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 }, color: '#64748b' },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* SOType Breakdown */}
            {Object.keys(kpis.soTypes).length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  <Tag size={10} className="inline mr-1" />สรุปตามประเภทเอกสาร (SOTypeID)
                </div>
                <div className="space-y-2">
                  {Object.entries(kpis.soTypes).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).map(([type, pcs]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">{type}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-300">{fmt(pcs as number)} ชิ้น</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Table */}
            <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">ตารางสรุป</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 font-bold text-[10px] border-b border-slate-700/50">
                      <th className="text-left py-2 pr-3">กลุ่ม</th>
                      <th className="text-right py-2 px-2">ชิ้น</th>
                      <th className="text-right py-2 px-2">ยอด (฿)</th>
                      <th className="text-right py-2 pl-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.labels.map((label, i) => {
                      const pct = kpis.totalPcs ? Math.round(chartData.data[i] / kpis.totalPcs * 100) : 0;
                      return (
                        <tr key={label} className="border-b border-slate-700/30 hover:bg-white/[0.02]">
                          <td className="py-2 pr-3 font-medium text-slate-200">{label}</td>
                          <td className="text-right py-2 px-2 font-bold text-slate-200">{fmt(chartData.data[i])}</td>
                          <td className="text-right py-2 px-2 text-slate-400">{fmtMoney(chartData.amounts[i])}</td>
                          <td className="text-right py-2 pl-2 text-slate-500">{pct}%</td>
                        </tr>
                      );
                    })}
                    <tr className="font-extrabold">
                      <td className="py-2 pr-3 text-slate-200">รวม</td>
                      <td className="text-right py-2 px-2 text-slate-200">{fmt(kpis.totalPcs)}</td>
                      <td className="text-right py-2 px-2 text-slate-400">{fmtMoney(kpis.totalInvoiceAmt)}</td>
                      <td className="text-right py-2 pl-2 text-slate-500">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Lists */}
            <TopList title="แบรนด์ยอดนิยม" icon={<Tag size={12} />} items={topLists.brands} />
            <TopList title="ไซส์กรุ๊ปยอดนิยม" icon={<Boxes size={12} />} items={topLists.sizes} />
            <TopList title="SKU ยอดนิยม" icon={<ShoppingCart size={12} />} items={topLists.skus.map(([name, d]: [string, any]) => [name, d])} showCode />
            <TopList title="ร้านค้ายอดนิยม" icon={<Store size={12} />} items={topLists.stores} />

            {/* Data Source Info */}
            <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <div className="text-[10px] text-slate-500 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Calendar size={10} />
                  ใช้วันที่: <span className="text-blue-400 font-semibold">{dateFieldLabel}</span>
                </div>
                <div>จำนวนแถวที่ใช้: {dataToUse.length.toLocaleString('th-TH')}</div>
                <div>จำนวนแถวทั้งหมดในระบบ: {raw.length.toLocaleString('th-TH')}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Top List Component ---- */
function TopList({ title, icon, items, showCode }: { title: string; icon: ReactNode; items: [string, any][]; showCode?: boolean }) {
  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const fmtMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (!items.length) return null;

  return (
    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        {icon} {title}
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map(([name, data], i) => (
          <div key={name} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold text-slate-600 w-4">{i + 1}</span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate max-w-[200px]">{name}</div>
                {showCode && data.skuCode && <div className="text-[9px] text-slate-500 font-mono">{data.skuCode}</div>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-blue-400">{fmt(data.pcs)} ชิ้น</div>
              <div className="text-[10px] text-slate-500">฿{fmtMoney(data.amt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
