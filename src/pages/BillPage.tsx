import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { safeNonNegInt, safeNum } from '@/lib/fieldNormalizer';
import { displayDateKey } from '@/lib/dateNormalizer';
import { ArrowLeft, Receipt, Copy, Printer, Edit3 } from 'lucide-react';

function roundMoney(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((safeNum(value) + Number.EPSILON) * factor) / factor;
}

function lineTotal(qty: number, unitPrice: number): number {
  return roundMoney(safeNonNegInt(qty) * safeNum(unitPrice));
}

function unitPriceFromAmount(amount: number, qty: number): number {
  const pcs = safeNonNegInt(qty);
  if (pcs <= 0) return 0;
  return roundMoney(safeNum(amount) / pcs);
}

type BillLine = {
  sku: string;
  qty: number;
  skuCode: string;
  defaultPrice: number;
  correctAmount: number;
  priceSource: 'InvoiceAmt' | 'row.amt' | 'missing';
};

export default function BillPage() {
  const { selectedPS, selectedDate, storeCols, todData, setScreen, showToast } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<string>('');

  const billData = useMemo(() => {
    const map: Record<string, BillLine[]> = {};
    for (const store of storeCols) {
      map[store] = [];
      for (const row of Object.values(todData)) {
        const q = safeNonNegInt(row.stores?.[store]);
        if (q > 0) {
          // V2 DOIT CSV rule:
          // Qty PCS = ShipQtyPCS / totalPcs.
          // Correct Amount = InvoiceAmt when available; fallback to row.amt/detailAmt.
          // Unit price = Correct Amount / Qty PCS.
          // Do not use Correct Amount itself as price per unit.
          const correctAmount = safeNum(row.totalInvoiceAmt) > 0
            ? safeNum(row.totalInvoiceAmt)
            : row.detailAmt != null
              ? safeNum(row.detailAmt)
              : 0;
          const priceSource: BillLine['priceSource'] = safeNum(row.totalInvoiceAmt) > 0
            ? 'InvoiceAmt'
            : row.detailAmt != null && safeNum(row.detailAmt) > 0
              ? 'row.amt'
              : 'missing';
          const defaultPrice = unitPriceFromAmount(correctAmount, row.totalPcs);
          map[store].push({
            sku: row.sku,
            qty: q,
            skuCode: row.skuCode,
            defaultPrice,
            correctAmount: roundMoney(correctAmount),
            priceSource,
          });
        }
      }
      map[store].sort((a, b) => a.sku.localeCompare(b.sku, 'th'));
    }
    return map;
  }, [storeCols, todData]);

  const activeStore = storeCols[activeTab];
  const activeItems = billData[activeStore] || [];

  const storeSums = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const [st, items] of Object.entries(billData)) {
      sums[st] = items.reduce((s, i) => s + i.qty, 0);
    }
    return sums;
  }, [billData]);

  const grandTotal = Object.values(storeSums).reduce((a, b) => a + b, 0);
  const activeStoreTotalQty = activeItems.reduce((s, i) => s + i.qty, 0);
  const activeStoreTotalAmt = activeItems.reduce((s, i) => {
    const p = customPrices[i.sku] !== undefined ? customPrices[i.sku] : i.defaultPrice;
    return s + lineTotal(i.qty, p);
  }, 0);

  const fmt = (n: number) => n.toLocaleString('th-TH');
  const fmtMoney = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const copyText = (txt: string) => {
    if (!txt.trim()) return;
    navigator.clipboard.writeText(txt).then(() => showToast('คัดลอกข้อความแล้ว', 'ok'));
  };

  const getCurrentTab = () => {
    const lines: string[] = [];
    if (activeItems.length) {
      lines.push(`📋 ร้าน ${activeStore}`);
      lines.push(`วันที่ ${displayDateKey(selectedDate || '')} · พนักงานขาย ${selectedPS}`);
      lines.push('');
      activeItems.forEach((item, i) => {
        const p = customPrices[item.sku] !== undefined ? customPrices[item.sku] : item.defaultPrice;
        lines.push(`${i + 1}. ${item.sku} | ${item.qty} ชิ้น x ฿${fmtMoney(p)} = ฿${fmtMoney(lineTotal(item.qty, p))}`);
      });
      lines.push('');
      lines.push(`รวมทั้งหมด: ${fmt(activeStoreTotalQty)} ชิ้น`);
      lines.push(`ยอดรวม: ฿${fmtMoney(activeStoreTotalAmt)}`);
    }
    return lines.join('\n');
  };

  const handlePrint = () => {
    if (window.self !== window.top) {
      showToast('⚠️ กรุณาเปิดแอปในหน้าต่างใหม่ (New Tab) เพื่อให้สามารถปริ้นบิลได้ (ตีกรอบบนขวา)', 'warn', 5000);
      setTimeout(() => window.print(), 1000);
    } else {
      window.print();
    }
  };

  const startEditPrice = (sku: string, currentPrice: number) => {
    setEditingSku(sku);
    setEditPriceVal(currentPrice.toString());
  };

  const saveEditPrice = (sku: string) => {
    const p = parseFloat(editPriceVal);
    if (!isNaN(p) && p >= 0) {
      setCustomPrices(prev => ({ ...prev, [sku]: roundMoney(p) }));
    }
    setEditingSku(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 print:bg-white print:text-black print:h-auto print:min-h-screen print:block">
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center gap-3 px-4 shrink-0 print:hidden">
        <button onClick={() => setScreen('tod')} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100">สรุปบิล V2</div>
          <div className="text-xs text-slate-400">{storeCols.length} ร้าน · {Number(grandTotal).toLocaleString('th-TH')} ชิ้น · ราคา = ยอดเงิน ÷ ชิ้น</div>
        </div>
        <button onClick={handlePrint} className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30 font-bold transition-all">
          <Printer size={18} />
        </button>
      </header>

      <div className="flex gap-1 px-4 py-2 bg-slate-800/40 border-b border-slate-700/40 shrink-0 overflow-x-auto print:hidden">
        {storeCols.map((s, i) => (
          <button
            key={s}
            onClick={() => setActiveTab(i)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === i
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {s} ({storeSums[s] || 0})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 print:overflow-visible print:p-0 print:space-y-0 print:block">
        <div className="hidden print:block text-center border-b pb-4 border-black mb-4">
          <h1 className="text-2xl font-bold mb-1">ใบส่งสินค้า / ชำระเงิน</h1>
          <h2 className="text-xl font-bold mb-2">ร้าน: {activeStore}</h2>
          <div className="text-sm">
            <span>วันที่: {displayDateKey(selectedDate || '')}</span> | <span>พนักงานพรีเซล: {selectedPS}</span>
          </div>
        </div>

        {activeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center print:hidden">
            <Receipt size={48} className="text-slate-600 mb-3" />
            <div className="text-slate-400 font-semibold">ร้าน {activeStore}</div>
            <div className="text-xs text-slate-500 mt-1">ยังไม่มีรายการสินค้า</div>
          </div>
        ) : (
          <>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-emerald-500/10 border border-blue-500/20 print:hidden">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-100">ร้าน {activeStore}</span>
                <span className="text-xl font-extrabold text-blue-400">{fmt(activeStoreTotalQty)} ชิ้น</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                วันที่ {displayDateKey(selectedDate || '')} · พนักงานขาย {selectedPS} · V2: ใช้ราคา/ชิ้นจากยอดเงินหารจำนวนชิ้น
              </div>
            </div>

            <div className="hidden print:block w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="py-2 w-12 text-center">No.</th>
                    <th className="py-2">รายการสินค้า</th>
                    <th className="py-2 text-right">จำนวน</th>
                    <th className="py-2 text-right">ราคา/หน่วย</th>
                    <th className="py-2 text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item, i) => {
                    const p = customPrices[item.sku] !== undefined ? customPrices[item.sku] : item.defaultPrice;
                    return (
                      <tr key={i} className="border-b border-gray-300 print:text-sm">
                        <td className="py-2 text-center">{i + 1}</td>
                        <td className="py-2">{item.sku} {item.skuCode ? `(${item.skuCode})` : ''}</td>
                        <td className="py-2 text-right font-bold">{fmt(item.qty)} </td>
                        <td className="py-2 text-right">฿{fmtMoney(p)}</td>
                        <td className="py-2 text-right font-bold">฿{fmtMoney(lineTotal(item.qty, p))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="flex justify-end mt-4 text-lg">
                <div className="w-64">
                  <div className="flex justify-between font-bold border-b-2 border-black py-2">
                    <span>ยอดรวมสุทธิ</span>
                    <span>฿{fmtMoney(activeStoreTotalAmt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-16 px-8 text-center text-sm">
                <div>
                  <div className="border-b border-black w-40 mb-2 h-8"></div>
                  <div>ผู้รับสินค้า</div>
                </div>
                <div>
                  <div className="border-b border-black w-40 mb-2 h-8"></div>
                  <div>ผู้ส่งสินค้า</div>
                </div>
              </div>
            </div>

            <div className="space-y-2 print:hidden">
              {activeItems.map((item, i) => {
                const currentPrice = customPrices[item.sku] !== undefined ? customPrices[item.sku] : item.defaultPrice;
                const isEditing = editingSku === item.sku;
                const currentTotal = lineTotal(item.qty, currentPrice);
                return (
                  <div key={i} className="flex flex-col p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="text-[13px] font-semibold text-slate-200">{i + 1}. {item.sku}</div>
                        {item.skuCode && <div className="text-[10px] text-slate-500 font-mono">{item.skuCode}</div>}
                        <div className="text-[10px] text-slate-500 mt-0.5">แหล่งราคา: {item.priceSource} · ยอดตั้งต้น ฿{fmtMoney(item.correctAmount)}</div>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{fmt(item.qty)} ชิ้น</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-700/50 pt-2 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">ราคา/ชิ้น:</span>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={editPriceVal}
                              onChange={e => setEditPriceVal(e.target.value)}
                              className="w-16 h-6 px-1 text-xs bg-slate-900 border border-blue-500 text-white rounded outline-none"
                              autoFocus
                            />
                            <button onClick={() => saveEditPrice(item.sku)} className="h-6 px-2 bg-blue-500 text-white text-[10px] rounded font-bold hover:bg-blue-600">บันทึก</button>
                            <button onClick={() => setEditingSku(null)} className="h-6 px-2 bg-slate-700 text-slate-300 text-[10px] rounded hover:bg-slate-600">ยกเลิก</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group cursor-pointer" onClick={() => startEditPrice(item.sku, currentPrice)}>
                            <span className="text-[12px] font-bold text-blue-400">฿{fmtMoney(currentPrice)}</span>
                            <Edit3 size={12} className="text-slate-500 group-hover:text-amber-400" />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 mr-1">รวม:</span>
                        <span className="text-[13px] font-extrabold text-white">฿{fmtMoney(currentTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-600/50 print:hidden shadow-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] text-slate-400 font-semibold">จำนวนรวม</span>
                <span className="text-sm font-bold text-emerald-400">{fmt(activeStoreTotalQty)} ชิ้น</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">ยอดรวมสุทธิ</span>
                <span className="text-2xl font-extrabold text-blue-400">฿{fmtMoney(activeStoreTotalAmt)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 p-3 bg-slate-900/80 border-t border-slate-700/50 flex gap-2 print:hidden">
        <button
          onClick={() => copyText(getCurrentTab())}
          className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Copy size={16} /> 📋 ข้อความส่งร้าน
        </button>
        <button
          onClick={handlePrint}
          className="flex-1 h-12 rounded-xl bg-slate-800 border-2 border-slate-600 text-white font-bold text-sm hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
        >
          <Printer size={16} /> ออกบิล / ปริ้นท์
        </button>
      </div>
    </div>
  );
}
