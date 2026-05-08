/* ============================================================
   Date Normalizer
   - Excel serial dates, ISO, locale formats, Thai Buddhist
   - Multiple format support with safe fallbacks
   ============================================================ */

import { toStr } from './fieldNormalizer';

/** Convert Excel serial number to YYYY-MM-DD key */
export function excelSerialToKey(serial: number): string {
  if (!Number.isFinite(serial) || serial <= 0) return '';
  const days = Math.floor(serial);
  const ms = Math.round((serial - days) * 86400 * 1000);
  const utc = Date.UTC(1899, 11, 30 + days) + ms;
  const d = new Date(utc);
  return keyFromDate(d);
}

/** Convert Date object to YYYY-MM-DD key */
export function keyFromDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  let y = d.getFullYear();
  let m = d.getMonth() + 1;
  let day = d.getDate();
  if (y > 2400 && y < 3000) y -= 543; // Thai Buddhist year
  if (y < 1000 || y < 2000 || y > 2100) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse month name/text to month index (1-12) */
function monthIndexFromText(txt: string): number {
  const t = toStr(txt).toLowerCase().replace(/\./g, '').trim();
  const map: Record<string, number> = {
    jan: 1, january: 1, มค: 1, มกราคม: 1,
    feb: 2, february: 2, กพ: 2, กุมภาพันธ์: 2,
    mar: 3, march: 3, มีค: 3, มีนาคม: 3,
    apr: 4, april: 4, เมย: 4, เมษายน: 4,
    may: 5, พค: 5, พฤษภาคม: 5,
    jun: 6, june: 6, มิย: 6, มิถุนายน: 6,
    jul: 7, july: 7, กค: 7, กรกฎาคม: 7,
    aug: 8, august: 8, สค: 8, สิงหาคม: 8,
    sep: 9, september: 9, กย: 9, กันยายน: 9,
    oct: 10, october: 10, ตค: 10, ตุลาคม: 10,
    nov: 11, november: 11, พย: 11, พฤศจิกายน: 11,
    dec: 12, december: 12, ธค: 12, ธันวาคม: 12,
  };
  return map[t] || 0;
}

/** Normalize any date value to YYYY-MM-DD key */
export function normalizeDateKey(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return keyFromDate(v);

  const raw = toStr(v).replace(/\u00a0/g, ' ').trim();
  if (!raw) return '';

  // Pure number = Excel serial or timestamp
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n > 1e12) return keyFromDate(new Date(n));
    if (n > 1e9 && n <= 1e12) return keyFromDate(new Date(n * 1000));
    if (n < 60000) return excelSerialToKey(n);
    // Large number might be a timestamp
    return keyFromDate(new Date(n));
  }

  // Clean string
  const cleaned = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

  // yyyy-mm-dd or yyyy/mm/dd
  let m = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\D.*)?$/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    return keyFromDate(new Date(y, mo - 1, d));
  }

  // dd-mm-yyyy or mm/dd/yyyy (heuristic)
  m = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\D.*)?$/);
  if (m) {
    let a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    if (y > 2400 && y < 3000) y -= 543;
    let mo = a, day = b;
    if (a > 12 && b <= 12) { day = a; mo = b; }
    else if (b > 12 && a <= 12) { mo = a; day = b; }
    return keyFromDate(new Date(y, mo - 1, day));
  }

  // dd month yyyy (English or Thai)
  m = cleaned.match(/^(\d{1,2})\s+([A-Za-zก-๙\.]+)\s+(\d{2,4})(?:\D.*)?$/);
  if (m) {
    let day = Number(m[1]), mo = monthIndexFromText(m[2]), y = Number(m[3]);
    if (y < 100) y += 2000;
    if (y > 2400 && y < 3000) y -= 543;
    if (mo) return keyFromDate(new Date(y, mo - 1, day));
  }

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return keyFromDate(parsed);

  return '';
}

/** Display a normalized date key in Thai locale */
export function displayDateKey(v: unknown): string {
  const key = normalizeDateKey(v) || toStr(v);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return toStr(v) || '—';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return key;
  return dt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' });
}

export function isoToDisplay(s: string): string {
  return displayDateKey(s);
}
