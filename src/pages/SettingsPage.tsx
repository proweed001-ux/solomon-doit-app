import { useAppStore } from '@/store/useAppStore';
import { ArrowLeft, RotateCcw, Calendar, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const { settings, updateSetting, setScreen, raw, getDistinctSoTypeIds } = useAppStore();
  const [fsVal, setFsVal] = useState(settings.fontScale);

  useEffect(() => { setFsVal(settings.fontScale); }, [settings.fontScale]);

  const soTypeIds = getDistinctSoTypeIds();

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0">
        <button onClick={() => setScreen('upload')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">ตั้งค่า</div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dashboard Settings */}
        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-3">
          <div className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar size={12} /> ตั้งค่า Dashboard
          </div>

          {/* Date Field */}
          <div>
            <label className="text-xs text-slate-400 font-semibold mb-1.5 block">ฟิลด์วันที่เริ่มต้น</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting('dashboardDateField', 'invoiceDate')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${settings.dashboardDateField === 'invoiceDate' ? 'bg-blue-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
              >
                Invoice_Date
              </button>
              <button
                onClick={() => updateSetting('dashboardDateField', 'soDate')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${settings.dashboardDateField === 'soDate' ? 'bg-blue-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400'}`}
              >
                SO_Date
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {settings.dashboardDateField === 'invoiceDate'
                ? 'ใช้ Invoice_Date เป็นหลัก (เหมาะกับสรุปยอดขาย)'
                : 'ใช้ SO_Date เป็นหลัก (เหมาะกับมุมมองออเดอร์)'}
            </p>
          </div>

          {/* Default SOTypeID */}
          <div>
            <label className="text-xs text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
              <Tag size={10} /> SOTypeID เริ่มต้น
            </label>
            <select
              value={settings.defaultSoTypeId}
              onChange={(e) => updateSetting('defaultSoTypeId', e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 outline-none"
            >
              <option value="">ทั้งหมด</option>
              {soTypeIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
              {!soTypeIds.includes('INVC') && <option value="INVC">INVC</option>}
              {!soTypeIds.includes('SO') && <option value="SO">SO</option>}
              {!soTypeIds.includes('RFC') && <option value="RFC">RFC</option>}
              {!soTypeIds.includes('CMP') && <option value="CMP">CMP</option>}
              {!soTypeIds.includes('DM') && <option value="DM">DM</option>}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              แนะนำ: INVC สำหรับยอดขายหลัก
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          <ToggleItem label="Auto Save" desc="บันทึกอัตโนมัติ" value={settings.autoSave} onChange={(v) => updateSetting('autoSave', v)} />
          <ToggleItem label="Subtotals" desc="แสดงรวมย่อยระหว่างรายการ" value={settings.subtotals} onChange={(v) => updateSetting('subtotals', v)} />
          <ToggleItem label="Dark Mode" desc="โหมดมืด (ตลอดเวลา)" value={settings.darkMode} onChange={(v) => updateSetting('darkMode', v)} />
          <ToggleItem label="Pro Mode" desc="โหมด Pro: เพิ่มฟังก์ชันขั้นสูง" value={settings.proMode} onChange={(v) => updateSetting('proMode', v)} />
          <ToggleItem label="ซ่อน Telesale" desc="ไม่แสดงส่วน Telesaleในถอดของ" value={settings.teleHidden} onChange={(v) => updateSetting('teleHidden', v)} />
        </div>

        {/* Font Scale */}
        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-slate-200">ขนาดตัวอักษร</div>
              <div className="text-xs text-slate-500">{Math.round(fsVal * 100)}%</div>
            </div>
            <button onClick={() => { updateSetting('fontScale', 1); setFsVal(1); }} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-400 hover:text-white transition-all">
              <RotateCcw size={12} className="inline mr-1" /> คืนค่าเริ่มต้น
            </button>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.3}
            step={0.05}
            value={fsVal}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFsVal(v);
              updateSetting('fontScale', v);
            }}
            className="w-full h-2 bg-slate-700 rounded-full appearance-none accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>เล็ก</span>
            <span>ปกติ</span>
            <span>ใหญ่</span>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">สถิติ</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">ข้อมูล</span>
            <span className="text-slate-200">{raw.length.toLocaleString('th-TH')} แถว</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">เวอร์ชัน</span>
            <span className="text-slate-200">2.0.0 - Solomon Edition</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleItem({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
      <div>
        <div className="text-sm font-semibold text-slate-200">{label}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full p-0.5 transition-all ${value ? 'bg-emerald-500' : 'bg-slate-600'}`}
      >
        <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
