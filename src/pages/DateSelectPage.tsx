import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { normalizeDateKey, displayDateKey } from '@/lib/dateNormalizer';
import { samePerson } from '@/lib/fieldNormalizer';
import { CalendarDays, User, Calendar } from 'lucide-react';

export default function DateSelectPage() {
  const { raw, selectedPS, selectDate, setScreen, settings } = useAppStore();

  // Use the configured date field for grouping
  const dateField = settings.dashboardDateField;
  const dateFieldLabel = dateField === 'soDate' ? 'SO_Date' : 'Invoice_Date';

  const dates = useMemo(() => {
    if (!selectedPS) return [];
    const map = new Map<string, number>();
    raw.forEach(r => {
      if (!samePerson(r.psName || r.psCode || '', selectedPS)) return;
      // Use the configured date field
      const dateValue = (r[dateField as keyof typeof r] as string) || r.date || r.dateRaw || r._rawDate;
      const key = normalizeDateKey(dateValue);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0]), 'th'));
  }, [raw, selectedPS, dateField]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('ps-select')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">เลือกวันที่</div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <Calendar size={10} />
            ใช้ฟิลด์: <span className="text-blue-400">{dateFieldLabel}</span>
            {' · '}ขั้นตอน 2 / 3
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
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 flex-1">
          <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">2</div>
          <span>วันที่</span>
        </div>
        <div className="flex-1 h-0.5 bg-slate-700" />
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 flex-1">
          <div className="w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center text-[10px]">3</div>
          <span>งาน</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* PS info */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm">
          <User size={16} className="text-blue-400" />
          <span className="font-bold text-blue-300">{selectedPS}</span>
        </div>

        {/* Date field indicator */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <Calendar size={10} />
          กำลังแสดงวันที่ตามฟิลด์: <span className="font-semibold text-blue-400">{dateFieldLabel}</span>
          <span className="text-slate-600">(เปลี่ยนได้ในตั้งค่า)</span>
        </div>

        {/* Date label */}
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          วันที่มียอดขาย ({dateFieldLabel})
        </div>

        {/* Date grid */}
        {dates.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays size={40} className="mx-auto text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">ไม่พบวันที่</div>
            <div className="text-xs text-slate-500 mt-1">
              ตรวจสอบฟิลด์ {dateFieldLabel} จากต้นทาง
              {dateField === 'invoiceDate' && (
                <button
                  onClick={() => useAppStore.getState().updateSetting('dashboardDateField', 'soDate')}
                  className="ml-1 text-blue-400 underline"
                >
                  ลองเปลี่ยนเป็น SO_Date
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {dates.map(([date, count]) => (
              <button
                key={date}
                onClick={() => selectDate(date)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/50 hover:bg-blue-500/5 active:scale-[0.98] transition-all"
              >
                <div className="text-sm font-bold text-slate-100">{displayDateKey(date)}</div>
                <div className="text-xs text-slate-500">{count.toLocaleString('th-TH')} รายการ</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
