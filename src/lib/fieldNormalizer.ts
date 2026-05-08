/* ============================================================
   Field Normalizer - Solomon Compliant
   - Strict QtyShipPCS priority
   - InvoiceAmt as primary amount
   - SOTypeID, SO_Date, Invoice_Date separation
   ============================================================ */

import type { NormalizedRow } from '@/types';

/** Normalize a string for comparison */
export function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\s\-_\/().,|]+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Safe string conversion */
export function toStr(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(/[\u0000\u0008\u000b\u000c\u001a]/g, '').trim();
}

/** Safe non-negative integer */
export function safeNonNegInt(v: unknown): number {
  if (typeof v === 'string') {
    const s = v.replace(/,/g, '').trim();
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Safe number */
export function safeNum(v: unknown): number {
  if (typeof v === 'string') {
    const s = v.replace(/,/g, '').trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Pick first non-empty value from candidates */
export function pickFirst(...vals: unknown[]): string {
  for (const v of vals) { const s = toStr(v); if (s) return s; }
  return '';
}

/** Check if value indicates cancelled */
export function isCancelled(v: unknown): boolean {
  const s = toStr(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'cancelled' || s === 'ยกเลิก';
}

/** Check if two person names are the same (fuzzy) */
export function samePerson(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Check if two store names are the same (fuzzy) */
export function sameStore(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/* ---- Field Aliases - SOLOMON COMPLIANT ----
   Priority order matters! First match wins.
   QtyShipPCS must match BEFORE QtyShip
*/
export const FIELD_ALIASES: Record<string, string[]> = {
  // Salesperson
  psName: ['salesperson_name', 'seller_name', 'so_sellerid', 'psname', 'salesperson', 'seller', 'user', 'employee', 'salesrep', 'repname', 'sales', 'พนักงานขาย', 'ชื่อพนักงานขาย', 'ชื่อพนักงาน', 'salesman', 'พนักงาน'],
  psCode: ['salespersonid', 'so_sellerid', 'sellerid', 'employeeid', 'salesrepid', 'seller_id', 'รหัสพนักงานขาย', 'salesmanid', 'so_salespersonid'],

  // Dates
  soDate: ['so_date', 'sodate', 'orderdate', 'วันที่ออเดอร์', 'วันที่สั่งซื้อ', 'soDate'],
  invoiceDate: ['invoice_date', 'invcdate', 'invdate', 'invoicedate', 'วันที่ใบแจ้งหนี้', 'วันที่invoice'],
  date: ['date', 'docdate', 'postingdate', 'transactiondate', 'วันที่', 'วันที่ขาย', 'วันที่เอกสาร', 'salesdate', 'วันที่ขายจริง'],

  // Document identifiers
  soTypeId: ['sotypeid', 'doctype', 'type', 'doc_type', 'ordertype', 'ประเภทเอกสาร'],
  invoiceNo: ['invoice_no', 'invoiceno', 'invcnbr', 'invno', 'invoice_number', 'เลขใบแจ้งหนี้'],
  shipperNo: ['shipper_no', 'shipperno', 'ship_nbr', 'shippernum', 'เลขใบส่งของ'],
  lineRef: ['lineref', 'line_ref', 'soline', 'line_number', 'เลขบรรทัด'],
  cancelled: ['cancelled', 'canceled', 'cancel', 'is_cancelled', 'void', 'voided', 'status', 'ยกเลิก', 'สถานะ'],

  // Store / Customer
  store: ['c_name', 'customer_name', 'customername', 'store', 'shop', 'branch', 'storename', 'shopname', 'branchname', 'outlet', 'outletname', 'store_name', 'ชื่อร้าน', 'ชื่อร้านค้า', 'ร้านค้า', 'ลูกค้า', 'ชื่อลูกค้า', 'สาขา'],
  storeId: ['customerid', 'custid', 'cid', 'customer_code', 'shopid', 'branchid', 'outletid', 'c_id'],
  storeClass: ['class', 'customerclass', 'storeclass', 'grade', 'customer_grade', 'segment', 'classid', 'invclassid'],

  // Product
  brand: ['brand', 'branddesc', 'brand_desc', 'groupbrand', 'brandname', 'brand_name', 'แบรนด์', 'branddescription', 'แบรนด์สินค้า', 'group_brand', 'tas_brand'],
  size: ['tas_sizegroup', 'sizegroup', 'size_group', 'sizegroup', 'ขนาด', 'ขนาดสินค้า', 'sku_size', 'sku_sizegroup'],
  sku: ['sku_desc', 'skudesc', 'sku_description', 'itemname', 'productname', 'product_name', 'product', 'itemdescription', 'description', 'ชื่อสินค้า', 'itemdesc', 'tas_enname', 'tas_thname'],
  skuCode: ['sku_code', 'skucode', 'itemcode', 'productcode', 'barcode', 'code', 'รหัสสินค้า', 'item_id'],

  // Quantities - STRICT: QtyShipPCS first
  qtyShipPcs: ['qtyshippcs', 'shipqtypcs', 'qtypcs', 'shipqty_pcs', 'จำนวนชิ้น', 'qty_ship_pcs', 'shipped_pcs', 'sumofqtyshippcs', 'ผลรวมของqtyshippcs', 'sum_of_qty_ship_pcs'],
  qtyShipCse: ['qtyshipcse', 'shipqtycse', 'qtycse', 'shipqty_cse', 'qty_ship_cse', 'จำนวนลัง', 'shipped_cse', 'qtycse', 'sumofqtyshipcse', 'ผลรวมของqtyshipcse'],
  qtyOrder: ['qtyorder', 'orderqty', 'quantityordered', 'จำนวนสั่ง'],

  // Amounts - strictly use amt / invoiceamtwithout_tax / invoiceamt as primary
  invoiceAmt: ['amt', 'amount', 'invoiceamtwithout_tax', 'invoiceamt', 'invcamt', 'ยอด', 'ยอดเงิน', 'ยอดขาย', 'ราคารวม', 'ยอดรวม', 'ยอดสุทธิ', 'จำนวนเงิน', 'จำนวนเงินรวม', 'ยอดเงินรวม', 'ราคา', 'มูลค่า', 'netamount', 'net_amount', 'totalamount', 'total_amount', 'grandtotal', 'grand_total'],
  invoiceAmtWithTax: [], // ห้ามใช้ amtVat / invoiceamtwith_tax

  // Telesale
  teleName: ['telesalename', 'tele_name', 'salesname', 'tele', 'teleperson', 'telesale_name'],
  teleId: ['telesaleid', 'teleid', 'telesale_id'],
};

/** Score how well a field name matches an alias */
function aliasScore(field: string, alias: string): number {
  const f = norm(field);
  const a = norm(alias);
  if (!f || !a) return 0;
  
  // Prevent matching vat/tax columns to non-vat/tax aliases
  if (!a.includes('vat') && !a.includes('tax') && !a.includes('ภาษี')) {
    if (f.includes('vat') || f.includes('tax') || f.includes('ภาษี')) return 0;
  }
  // Prevent matching "with_tax" if alias does not have it
  if (!a.includes('withtax') && f.includes('withtax')) return 0;

  if (f === a) return 100;
  
  // If alias is very short like "amt" or "ยอด", only allow exact match or word boundary
  if (a === 'amt' || a === 'ยอด') {
    if (f.startsWith(a) || f.endsWith(a)) return 60;
    return 0; // Don't allow arbitrary inclusion for short words
  }

  if (f.includes(a) || a.includes(f)) return 60;
  // Check for keyword containment
  const fWords = f.split(/(?=[A-Z])/).map(w => w.toLowerCase());
  const aWords = a.split(/(?=[A-Z])/).map(w => w.toLowerCase());
  if (fWords.some(fw => aWords.some(aw => fw.includes(aw) || aw.includes(fw)))) return 30;
  return 0;
}

/** Find best field index for a canonical field from available column names */
export function pickFieldIndex(names: string[], aliases: string[]): number {
  let best = -1;
  let bestScore = 0; // Must be 0 so we don't pick 0 score matches
  let bestAliasIdx = Infinity; // Lower is better

  names.forEach((name, idx) => {
    aliases.forEach((alias, aliasIdx) => {
      const sc = aliasScore(name, alias);
      // Give precedence to better scores OR (same score but higher priority alias)
      if (sc > bestScore || (sc === bestScore && sc > 0 && aliasIdx < bestAliasIdx)) {
        bestScore = sc;
        best = idx;
        bestAliasIdx = aliasIdx;
      }
    });
  });
  return best;
}

/** Build field mapping from column names to canonical fields */
export function buildFieldMap(columnNames: string[]): Map<string, number> {
  const map = new Map<string, number>();

  // Use aliasScore for all matches
  for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = pickFieldIndex(columnNames, aliases);
    if (idx >= 0) {
      // Ensure we don't map multiple canonical fields to the same column
      // (unless we have to, but preferably not)
      let alreadyMapped = false;
      for (const v of map.values()) {
        if (v === idx) { alreadyMapped = true; break; }
      }
      if (!alreadyMapped) {
        map.set(canon, idx);
      }
    }
  }

  return map;
}

/** Get raw field value using the mapping */
export function getMappedValue(
  row: Record<string, unknown>,
  fieldMap: Map<string, number>,
  canonical: string,
  columnNames: string[]
): string {
  const idx = fieldMap.get(canonical);
  if (idx !== undefined && columnNames[idx]) {
    const val = row[columnNames[idx]];
    if (val != null && String(val).trim()) return String(val).trim();
  }
  return '';
}

/** Extract provenance info for a row */
export function extractProvenance(
  row: Record<string, unknown>,
  fieldMap: Map<string, number>,
  columnNames: string[],
  sourceSheet: string
): NormalizedRow['_provenance'] {
  const sourceColumnMap: Record<string, string> = {};
  for (const [canon, idx] of fieldMap.entries()) {
    if (columnNames[idx]) sourceColumnMap[canon] = columnNames[idx];
  }
  return {
    sourceSheet,
    sourceColumnMap,
    rawFields: { ...row },
  };
}

/** Get list of unmapped columns */
export function getUnmappedColumns(
  columnNames: string[],
  fieldMap: Map<string, number>
): string[] {
  const mappedIndices = new Set(fieldMap.values());
  return columnNames.filter((_, i) => !mappedIndices.has(i));
}
