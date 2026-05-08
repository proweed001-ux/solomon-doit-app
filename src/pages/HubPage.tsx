import { useAppStore } from '@/store/useAppStore';
import { displayDateKey } from '@/lib/dateNormalizer';
import {
  Package, BarChart3, Search, Receipt, Phone, Calendar,
  PackageOpen, Boxes, TrendingUp,
} from 'lucide-react';

export default function HubPage() {
  const {
    selectedPS, selectedDate, psData, storeList,
    teleData, settings, setScreen,
  } = useAppStore();

  const skuCount = new Set(psData.map(r => r.sku).filter(Boolean)).size;
  const orderCount = psData.length;
  const storeCount = storeList.length;
  const teleCount = teleData.length;

  // Calculate totals from psData
  let totalPcs = 0, totalCse = 0, totalAmt = 0, totalInvoices = 0;
  const invoices = new Set<string>();
  psData.forEach(r => {
    totalPcs += (r.qtyShipPcs || 0);
    totalCse += (r.qtyShipCse || 0);
    totalAmt += (r.invoiceAmt || 0);
    if (r.invoiceNo) invoices.add(r.invoiceNo);
  });
  totalInvoices = invoices.size;

  const dateField = settings.dashboardDateField;
  const dateFieldLabel = dateField === 'soDate' ? 'SO_Date' : 'Invoice_Date';

  const hubs = [
    {
      id: 'tod', label: 'ถอดของ', sub: 'กระจายสินค้าตามร้าน (QtyShipPCS)',
      icon: Package, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400',
    },
    {
      id: 'dashboard', label: 'สรุป Dashboard', sub: 'วิเคราะห์ยอดขายภาพรวมระบบ',
      icon: BarChart3, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400',
    },
    {
      id: 'distribution', label: 'เช็คกระจาย', sub: 'สินค้าตัวนี้เข้าร้านไหนบ้าง',
      icon: Search, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400',
    },
    {
      id: 'pivot', label: 'ตาราง Pivot (ยอดแบบแยก SOType)', sub: 'สรุป ShipQty และ InvoiceAmt ตาม SOTypeID',
      icon: Receipt, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400',
    },
    {
      id: 'bill', label: 'สรุปบิล', sub: 'แยกร้าน พร้อมส่ง LINE',
      icon: Receipt, color: 'from-sky-500 to-sky-600', bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400',
    },
  ];

  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const fmtMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('date-select')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100 truncate">{selectedPS}</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar size={10} />
            {displayDateKey(selectedDate || '')}
            <span className="text-blue-400 ml-1">({dateFieldLabel})</span>
            {' · '}
            {orderCount.toLocaleString('th-TH')} ออร์เดอร์
          </div>
        </div>
      </header>

      {/* Steps */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/40 border-b border-slate-700/40 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 flex-1">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
          <span>พนักงาน</span>
        </div>
        <div className="flex-1 h-0.5 bg-emerald-500/50" />
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 flex-1">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">✓</div>
          <span>วันที่</span>
        </div>
        <div className="flex-1 h-0.5 bg-emerald-500/50" />
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 flex-1">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">3</div>
          <span>งาน</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Badges */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <PackageOpen size={12} className="text-emerald-400" />
            </div>
            <div className="text-sm font-extrabold text-emerald-400">{fmt(totalPcs)}</div>
            <div className="text-[8px] font-bold text-emerald-500/70 uppercase">ชิ้น PCS</div>
          </div>
          {totalCse > 0 && (
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Boxes size={12} className="text-amber-400" />
              </div>
              <div className="text-sm font-extrabold text-amber-400">{fmt(totalCse)}</div>
              <div className="text-[8px] font-bold text-amber-500/70 uppercase">ลัง CSE</div>
            </div>
          )}
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <TrendingUp size={12} className="text-blue-400" />
            </div>
            <div className="text-sm font-extrabold text-blue-400">฿{fmtMoney(totalAmt)}</div>
            <div className="text-[8px] font-bold text-blue-500/70 uppercase">InvoiceAmt</div>
          </div>
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Receipt size={12} className="text-purple-400" />
            </div>
            <div className="text-sm font-extrabold text-purple-400">{fmt(totalInvoices)}</div>
            <div className="text-[8px] font-bold text-purple-500/70 uppercase">บิล</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
            <div className="text-xl font-extrabold text-blue-400">{orderCount.toLocaleString('th-TH')}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">ออร์เดอร์</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
            <div className="text-xl font-extrabold text-emerald-400">{skuCount.toLocaleString('th-TH')}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">SKU</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
            <div className="text-xl font-extrabold text-amber-400">{storeCount.toLocaleString('th-TH')}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">ร้านค้า</div>
          </div>
        </div>

        {/* Hub Cards */}
        <div className="grid grid-cols-2 gap-3">
          {hubs.map((h) => (
            <button
              key={h.id}
              onClick={() => setScreen(h.id as any)}
              className={`flex flex-col items-center gap-2 p-5 rounded-2xl bg-slate-800/50 border ${h.border} hover:bg-slate-700/50 active:scale-[0.97] transition-all group text-center`}
            >
              <div className={`w-13 h-13 rounded-xl ${h.bg} flex items-center justify-center`}>
                <h.icon size={24} className={h.text} />
              </div>
              <div className="text-sm font-bold text-slate-100 group-hover:text-white">{h.label}</div>
              <div className="text-[11px] text-slate-500 leading-tight">{h.sub}</div>
              <div className={`h-1 w-full rounded-full bg-gradient-to-r ${h.color} opacity-80`} />
            </button>
          ))}
        </div>

        {/* Telesale notice */}
        {teleCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
            <Phone size={16} className="shrink-0" />
            <span>มีออร์เดอร์ Telesale <strong>{teleCount.toLocaleString('th-TH')}</strong> รายการ</span>
          </div>
        )}

        {/* Date field info */}
        <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Calendar size={10} />
            กำลังใช้วันที่: <span className="text-blue-400 font-semibold">{dateFieldLabel}</span>
            {' · '}
            {dateFieldLabel === 'Invoice_Date'
              ? 'เหมาะสำหรับสรุปยอดขายตามวันออกบิล'
              : 'เหมาะสำหรับดูมุมมองการสั่งซื้อ'}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}
