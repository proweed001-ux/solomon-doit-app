import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ArrowLeft, Save, TableProperties } from 'lucide-react';
import { displayDateKey } from '@/lib/dateNormalizer';
import { safeNonNegInt, safeNum } from '@/lib/fieldNormalizer';

type PivotRow = {
  invoiceDate: string;
  brand: string;
  size: string;
  sku: string;
  soTypeTotals: Record<string, { pcs: number; amt: number }>;
  rowTotal: { pcs: number; amt: number };
};

export default function PivotPage() {
  const { raw, psData, selectedPS, selectedDate, setScreen } = useAppStore();
  const [viewScope, setViewScope] = useState<'PS' | 'ALL'>('ALL');

  const dataToUse = viewScope === 'ALL' ? raw : psData;

  const { rows, soTypes } = useMemo(() => {
    const soTypeSet = new Set<string>();
    const rowMap = new Map<string, PivotRow>();

    for (const r of dataToUse) {
      if (r.cancelled) continue;

      const soType = r.soTypeId || 'UNKNOWN';
      soTypeSet.add(soType);

      const d = r.invoiceDate || 'No Date';
      const b = r.brand || 'อื่นๆ';
      const s = r.size || 'อื่นๆ';
      const sku = r.sku || 'Unknown SKU';

      const key = `${d}|${b}|${s}|${sku}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          invoiceDate: d,
          brand: b,
          size: s,
          sku: sku,
          soTypeTotals: {},
          rowTotal: { pcs: 0, amt: 0 }
        });
      }

      const row = rowMap.get(key)!;
      if (!row.soTypeTotals[soType]) {
        row.soTypeTotals[soType] = { pcs: 0, amt: 0 };
      }

      const pcs = safeNonNegInt(r.qtyShipPcs);
      const amt = safeNum(r.invoiceAmt);

      row.soTypeTotals[soType].pcs += pcs;
      row.soTypeTotals[soType].amt += amt;
      row.rowTotal.pcs += pcs;
      row.rowTotal.amt += amt;
    }

    const sortedRows = Array.from(rowMap.values()).sort((a, b) => {
      if (a.invoiceDate !== b.invoiceDate) return a.invoiceDate.localeCompare(b.invoiceDate);
      if (a.brand !== b.brand) return a.brand.localeCompare(b.brand, 'th');
      if (a.size !== b.size) return a.size.localeCompare(b.size, 'th');
      return a.sku.localeCompare(b.sku, 'th');
    });

    const sortedSoTypes = Array.from(soTypeSet).sort();

    return { rows: sortedRows, soTypes: sortedSoTypes };
  }, [dataToUse, selectedDate]);

  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  const fmtMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-full bg-slate-900 print:bg-white print:text-black">
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-4 shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('hub')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <TableProperties size={16} className="text-purple-400" />
              รายงาน Pivot Table (Solomon)
            </div>
            <div className="text-[10px] text-slate-400">
              {rows.length.toLocaleString()} รายการ
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={viewScope}
            onChange={(e) => setViewScope(e.target.value as 'PS' | 'ALL')}
            className="h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white outline-none"
          >
            <option value="ALL">ข้อมูลทั้งหมดในไฟล์</option>
            <option value="PS">เฉพาะ {selectedPS}</option>
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 print:p-0 print:overflow-visible">
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden print:border-none print:bg-transparent">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-left border-collapse print:text-[10px]">
              <thead className="bg-slate-900/80 text-slate-300 font-bold border-b border-slate-700 print:bg-transparent print:text-black print:border-black">
                <tr>
                  <th className="p-2 border-r border-slate-700/50 print:border-black whitespace-nowrap min-w-[100px]">Invoice_Date</th>
                  <th className="p-2 border-r border-slate-700/50 print:border-black whitespace-nowrap min-w-[100px]">Group Brand</th>
                  <th className="p-2 border-r border-slate-700/50 print:border-black whitespace-nowrap min-w-[100px]">TAS_SizeGroup</th>
                  <th className="p-2 border-r border-slate-700/50 print:border-black min-w-[200px]">SKU Description</th>
                  {soTypes.map(so => (
                    <th key={so} className="p-2 border-r border-slate-700/50 print:border-black text-center" colSpan={2}>
                      {so}
                    </th>
                  ))}
                  <th className="p-2 text-center" colSpan={2}>Grand Total</th>
                </tr>
                <tr className="border-b border-slate-700/50 print:border-black text-[10px] text-slate-400 print:text-gray-600">
                  <th className="p-2 border-r border-slate-700/50 print:border-black"></th>
                  <th className="p-2 border-r border-slate-700/50 print:border-black"></th>
                  <th className="p-2 border-r border-slate-700/50 print:border-black"></th>
                  <th className="p-2 border-r border-slate-700/50 print:border-black"></th>
                  {soTypes.map(so => (
                    <td key={so} colSpan={2} className="p-0 border-r border-slate-700/50 print:border-black">
                      <div className="flex w-full">
                        <div className="w-1/2 p-2 border-r border-slate-700/50 print:border-black text-center text-emerald-400 print:text-black">ShipQtyPCS</div>
                        <div className="w-1/2 p-2 text-center text-purple-400 print:text-black">InvoiceAmt</div>
                      </div>
                    </td>
                  ))}
                  <td colSpan={2} className="p-0">
                    <div className="flex w-full">
                      <div className="w-1/2 p-2 border-r border-slate-700/50 print:border-black text-center text-emerald-400 print:text-black">ShipQtyPCS</div>
                      <div className="w-1/2 p-2 text-center text-purple-400 print:text-black">InvoiceAmt</div>
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 print:divide-black text-slate-200 print:text-black">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-700/30 print:hover:bg-transparent">
                    <td className="p-2 border-r border-slate-700/50 print:border-black whitespace-nowrap">{displayDateKey(r.invoiceDate)}</td>
                    <td className="p-2 border-r border-slate-700/50 print:border-black whitespace-nowrap">{r.brand}</td>
                    <td className="p-2 border-r border-slate-700/50 print:border-black whitespace-nowrap">{r.size}</td>
                    <td className="p-2 border-r border-slate-700/50 print:border-black">{r.sku}</td>
                    
                    {soTypes.map(so => {
                      const stat = r.soTypeTotals[so];
                      return (
                        <td key={so} colSpan={2} className="p-0 border-r border-slate-700/50 print:border-black">
                          {stat ? (
                            <div className="flex w-full h-full min-h-[32px]">
                              <div className="w-1/2 p-2 px-3 border-r border-slate-700/50 print:border-black text-right">{fmt(stat.pcs)}</div>
                              <div className="w-1/2 p-2 px-3 text-right">{fmtMoney(stat.amt)}</div>
                            </div>
                          ) : (
                            <div className="flex w-full h-full min-h-[32px]">
                              <div className="w-1/2 p-2 px-3 border-r border-slate-700/50 print:border-black text-right text-slate-600 print:text-gray-400">-</div>
                              <div className="w-1/2 p-2 px-3 text-right text-slate-600 print:text-gray-400">-</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    
                    <td colSpan={2} className="p-0 font-bold bg-slate-800/30 print:bg-transparent">
                      <div className="flex w-full h-full min-h-[32px]">
                        <div className="w-1/2 p-2 px-3 border-r border-slate-700/50 print:border-black text-right text-emerald-400 print:text-black">{fmt(r.rowTotal.pcs)}</div>
                        <div className="w-1/2 p-2 px-3 text-right text-purple-400 print:text-black">{fmtMoney(r.rowTotal.amt)}</div>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {/* Grand Totals */}
                {(() => {
                  const grandTotalBySoType: Record<string, { pcs: number; amt: number }> = {};
                  let superGrandPcs = 0;
                  let superGrandAmt = 0;
                  
                  for (const r of rows) {
                    for (const so of soTypes) {
                      if (!grandTotalBySoType[so]) grandTotalBySoType[so] = { pcs: 0, amt: 0 };
                      if (r.soTypeTotals[so]) {
                        grandTotalBySoType[so].pcs += r.soTypeTotals[so].pcs;
                        grandTotalBySoType[so].amt += r.soTypeTotals[so].amt;
                      }
                    }
                    superGrandPcs += r.rowTotal.pcs;
                    superGrandAmt += r.rowTotal.amt;
                  }
                  
                  return (
                    <tr className="bg-slate-900 text-white font-bold print:bg-transparent print:text-black border-t-2 border-slate-600 print:border-black">
                      <td colSpan={4} className="p-3 text-right border-r border-slate-700/50 print:border-black bg-slate-800">
                        รวมทั้งหมด (Grand Total)
                      </td>
                      {soTypes.map(so => (
                        <td key={so} colSpan={2} className="p-0 border-r border-slate-700/50 print:border-black">
                          <div className="flex w-full">
                            <div className="w-1/2 p-3 border-r border-slate-700/50 print:border-black text-right text-emerald-400 print:text-black">{fmt(grandTotalBySoType[so]?.pcs || 0)}</div>
                            <div className="w-1/2 p-3 text-right text-purple-400 print:text-black">{fmtMoney(grandTotalBySoType[so]?.amt || 0)}</div>
                          </div>
                        </td>
                      ))}
                      <td colSpan={2} className="p-0 bg-slate-800 print:bg-transparent">
                        <div className="flex w-full">
                          <div className="w-1/2 p-3 border-r border-slate-700/50 print:border-black text-right text-emerald-400 print:text-black">{fmt(superGrandPcs)}</div>
                          <div className="w-1/2 p-3 text-right text-purple-400 print:text-black">{fmtMoney(superGrandAmt)}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
