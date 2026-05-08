/* ============================================================
   Excel Parser - SOLOMON COMPLIANT
   - QtyShipPCS as primary quantity
   - InvoiceAmt as primary amount (no calculation)
   - SO_Date / Invoice_Date separation
   - SOTypeID filtering support
   - Cancelled row exclusion
   - Proper dedup with Invoice_No + LineRef
   ============================================================ */

import JSZip from 'jszip';
import { toStr, norm, pickFirst, isCancelled } from './fieldNormalizer';
import { normalizeDateKey } from './dateNormalizer';
import { buildFieldMap, getUnmappedColumns, safeNonNegInt, safeNum, FIELD_ALIASES, pickFieldIndex } from './fieldNormalizer';
import type { NormalizedRow } from '@/types';

export interface ParseResult {
  rows: NormalizedRow[];
  warnings: string[];
  sourceName: string;
  fieldMap: Map<string, number>;
  unmappedColumns: string[];
  duplicatesRemoved: number;
  rawCount: number;
  cancelledCount: number;
}

/** Parse Excel file and extract rows */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const warnings: string[] = [];
  const buf = await file.arrayBuffer();
  const sourceName = file.name;

  let pivotRows: Record<string, unknown>[] | null = null;
  let sheetRows: Record<string, unknown>[] | null = null;

  // Strategy 1: Try PivotCache XML
  try {
    pivotRows = await parsePivotCache(buf, warnings);
  } catch (e) {
    warnings.push(`PivotCache parse: ${toStr((e as Error).message)}`);
  }

  // Strategy 2: Try regular worksheet
  try {
    sheetRows = await parseWorksheetFallback(buf, warnings);
  } catch (e) {
    warnings.push(`Worksheet parse: ${toStr((e as Error).message)}`);
  }

  // Combine: prefer PivotCache which contains the raw, clean, flat unaggregated data!
  // Worksheets representing Pivot UI will have Grand Totals that double the numbers.
  let rawRows: Record<string, unknown>[] = [];
  if (pivotRows && pivotRows.length > 0) {
    rawRows = pivotRows;
    warnings.push(`✅ ดึงข้อมูล Raw Data จากระบบเบื้องหลัง (PivotCache - ${pivotRows.length} แถว)`);
  } else if (sheetRows && sheetRows.length > 0) {
    rawRows = sheetRows;
    warnings.push(`ใช้ข้อมูลจากตารางปกติ (${sheetRows.length} แถว)`);
  } else {
    throw new Error('ไม่พบข้อมูลที่ใช้งานได้ในไฟล์');
  }

  // Normalize column names and build field map
  const allKeys = new Set<string>();
  rawRows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  const columnNames = [...allKeys];

  const fieldMap = buildFieldMap(columnNames);
  const unmappedColumns = getUnmappedColumns(columnNames, fieldMap);

  if (unmappedColumns.length > 0) {
    warnings.push(`ฟิลด์ที่ไม่ได้แมป: ${unmappedColumns.slice(0, 10).join(', ')}${unmappedColumns.length > 10 ? '...' : ''}`);
  }

  // Log mapped fields for debugging
  const mappedFields: string[] = [];
  for (const [canon, idx] of fieldMap.entries()) {
    mappedFields.push(`${canon}→${columnNames[idx]}`);
  }
  if (mappedFields.length > 0) {
    warnings.push(`ฟิลด์ที่แมป: ${mappedFields.join(', ')}`);
  }

  // Normalize rows
  const normalized = normalizeRows(rawRows, fieldMap, columnNames, sourceName, warnings);
  const rawCount = rawRows.length;

  // Filter out cancelled rows
  const activeRows = normalized.filter(r => !r.cancelled);
  const cancelledCount = normalized.length - activeRows.length;
  if (cancelledCount > 0) {
    warnings.push(`ตัดแถว Cancelled ออก: ${cancelledCount} แถว`);
  }

  // Deduplicate using Invoice_No + LineRef if available, else use safe fallback
  const seen = new Set<string>();
  const deduped: NormalizedRow[] = [];
  let duplicatesRemoved = 0;

  for (const row of activeRows) {
    let key: string;
    if (row.invoiceNo && row.lineRef) {
      // Best: Invoice_No + LineRef
      key = `inv:${row.invoiceNo}|ref:${row.lineRef}`;
    } else if (row.invoiceNo && row.skuCode) {
      // Good: Invoice_No + SKU_Code
      key = `inv:${row.invoiceNo}|sku:${row.skuCode}|pcs:${row.qtyShipPcs}`;
    } else if (row.shipperNo && row.skuCode) {
      // Good: Shipper_No + SKU_Code
      key = `ship:${row.shipperNo}|sku:${row.skuCode}|pcs:${row.qtyShipPcs}`;
    } else {
      // Fallback: composite key (safer than before)
      key = `${norm(row.psName)}|${row.soDate || row.date}|${row.invoiceDate || ''}|${norm(row.store)}|${norm(row.brand)}|${norm(row.sku)}|${row.qtyShipPcs}|${row.invoiceAmt}|${row.soTypeId}`;
    }
    if (seen.has(key)) { duplicatesRemoved++; continue; }
    seen.add(key);
    deduped.push(row);
  }

  return {
    rows: deduped,
    warnings,
    sourceName,
    fieldMap,
    unmappedColumns,
    duplicatesRemoved,
    rawCount,
    cancelledCount,
  };
}

/** Parse PivotCache XML from .xlsx */
async function parsePivotCache(buf: ArrayBuffer, warnings: string[]): Promise<Record<string, unknown>[] | null> {
  const zip = await JSZip.loadAsync(buf);
  const defs = Object.keys(zip.files).filter(p => /xl\/pivotCache\/pivotCacheDefinition\d+\.xml$/i.test(p)).sort();
  const recs = Object.keys(zip.files).filter(p => /xl\/pivotCache\/pivotCacheRecords\d+\.xml$/i.test(p)).sort();

  if (!defs.length || !recs.length) return null;

  const defFile = defs[0];
  const recMatch = defFile.match(/pivotCacheDefinition(\d+)\.xml$/i);
  const recFile = recMatch ? `xl/pivotCache/pivotCacheRecords${recMatch[1]}.xml` : recs[0];

  const defXml = await zip.file(defFile)?.async('string');
  const recXml = await zip.file(recFile)?.async('string');

  if (!defXml || !recXml) return null;

  const parser = new DOMParser();
  const defDoc = parser.parseFromString(defXml, 'application/xml');
  const recDoc = parser.parseFromString(recXml, 'application/xml');

  if (defDoc.querySelector('parsererror') || recDoc.querySelector('parsererror')) {
    warnings.push('XML parser error in PivotCache');
    return null;
  }

  // Extract field names and shared items
  const names: string[] = [];
  const origNames: string[] = [];
  const shared: string[][] = [];

  defDoc.querySelectorAll('cacheField').forEach((cf) => {
    const n = toStr(cf.getAttribute('name'));
    names.push(n);
    origNames.push(n);
    const items: string[] = [];
    const sharedItems = cf.querySelector('sharedItems');
    if (sharedItems) {
      sharedItems.querySelectorAll('*').forEach((node) => {
        const v = toStr(node.getAttribute('v') ?? node.textContent ?? '');
        items.push(v);
      });
    }
    shared.push(items);
  });

  if (!names.length) return null;

  // Use imported FIELD_ALIASES for consistency
  const map: Record<string, number> = {};
  for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
    const bestIdx = pickFieldIndex(names, aliases);
    if (bestIdx >= 0) map[canon] = bestIdx;
  }

  // Convert cell to value using shared items
  const cellsToValue = (fieldIdx: number, node: Element | null): string => {
    if (!node) return '';
    const tag = node.tagName.toLowerCase();
    const v = toStr(node.getAttribute('v') ?? node.textContent ?? '');
    if (tag === 'x') {
      const ref = Number.parseInt(v, 10);
      return shared[fieldIdx]?.[ref] ?? '';
    }
    return v;
  };

  const rows: Record<string, unknown>[] = [];
  recDoc.querySelectorAll('r').forEach((r) => {
    const cells = Array.from(r.children || []);
    if (!cells.length) return;
    const row: Record<string, unknown> = {};
    for (const [canon, idx] of Object.entries(map)) {
      const val = cellsToValue(idx, cells[idx]);
      row[canon] = val;
      const orig = origNames[idx];
      if (orig) row[toStr(orig)] = val;
    }
    // Extra heuristics - Solomon field fallbacks
    if (!row.psName) row.psName = row['Salesperson_Name'] || row['Seller_Name'] || row['SO_SellerID'] || row.salesperson || row.seller || row.user || row.psCode || '';
    if (!row.psCode) row.psCode = row['SO_SellerID'] || row['Salesperson_ID'] || row.salespersonid || row.sellerid || '';

    // Date fallbacks
    if (!row.soDate) row.soDate = row['SO_Date'] || row['soDate'] || row.soDate || row['OrderDate'] || '';
    if (!row.invoiceDate) row.invoiceDate = row['Invoice_Date'] || row['InvcDate'] || row['invoiceDate'] || '';
    if (!row.date) row.date = row['Invoice_Date'] || row['SO_Date'] || row['DocDate'] || '';

    // Document fallbacks
    if (!row.soTypeId) row.soTypeId = row['SOTypeID'] || row['DocType'] || row['Type'] || '';
    if (!row.invoiceNo) row.invoiceNo = row['Invoice_No'] || row['InvoiceNo'] || row['InvcNbr'] || '';
    if (!row.shipperNo) row.shipperNo = row['Shipper_No'] || row['ShipperNo'] || row['ShipNbr'] || '';
    if (!row.lineRef) row.lineRef = row['LineRef'] || row['Line_Ref'] || row['SOLine'] || '';
    if (row.cancelled === undefined) row.cancelled = row['Cancelled'] || row['CANCELED'] || row['Status'] || '0';

    if (!row.store) row.store = row['c_Name'] || row['Customer_Name'] || row.customerName || row.customer || row.shop || '';
    if (!row.storeId) row.storeId = row['CustID'] || row.customerId || row.custId || '';
    if (!row.brand) row.brand = row['Brand_desc'] || row['Brand'] || row.brandDesc || row.groupBrand || '';
    if (!row.size) row.size = row['TAS_SizeGroup'] || row['SizeGroup'] || row.sizeGroup || '';
    if (!row.sku) row.sku = row['SKU_Desc'] || row.skuDesc || row.itemName || row.productName || '';
    if (!row.skuCode) row.skuCode = row['SKU_Code'] || row.itemCode || row.productCode || '';

    // We let normalizeRows handle amount and quantity fallbacks,
    // so we don't overwrite the mapped values here.
    rows.push(row);
  });

  return rows.length ? rows : null;
}

/** Fallback: parse regular worksheet data */
async function parseWorksheetFallback(buf: ArrayBuffer, _warnings: string[]): Promise<Record<string, unknown>[] | null> {
  const zip = await JSZip.loadAsync(buf);

  const sheetFiles = Object.keys(zip.files).filter(p => /xl\/worksheets\/sheet\d+\.xml$/i.test(p));
  if (!sheetFiles.length) return null;

  // Read shared strings if available
  let sharedStrings: string[] = [];
  try {
    const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string');
    if (ssXml) {
      const parser = new DOMParser();
      const ssDoc = parser.parseFromString(ssXml, 'application/xml');
      ssDoc.querySelectorAll('si').forEach((si) => {
        const t = si.querySelector('t');
        sharedStrings.push(t ? t.textContent || '' : '');
      });
    }
  } catch { /* no shared strings */ }

  // Try to parse the first worksheet
  const sheetXml = await zip.file(sheetFiles[0])?.async('string');
  if (!sheetXml) return null;

  const parser = new DOMParser();
  const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');

  const rows: Record<string, unknown>[] = [];
  const sheetData = sheetDoc.querySelector('sheetData');
  if (!sheetData) return null;

  const getColIndex = (ref: string): number => {
    const match = ref.match(/^[A-Z]+/);
    if (!match) return -1;
    let idx = 0;
    for (let i = 0; i < match[0].length; i++) {
      idx = idx * 26 + (match[0].charCodeAt(i) - 64);
    }
    return idx - 1;
  };

  // First, try to find header row
  let headers: string[] = [];
  const rowElements = Array.from(sheetData.querySelectorAll('row'));

  for (const rowEl of rowElements.slice(0, 10)) {
    const cells = Array.from(rowEl.querySelectorAll('c'));
    const vals: string[] = [];
    cells.forEach((c) => {
      const rAttr = c.getAttribute('r') || '';
      const colIdx = getColIndex(rAttr);
      if (colIdx < 0) return;
      const t = c.getAttribute('t');
      const v = c.querySelector('v')?.textContent || '';
      vals[colIdx] = t === 's' ? (sharedStrings[Number(v)] || '') : v;
    });
    
    // Fill empty arrays gaps with empty string for header calculation
    const continuousVals = Array.from({ length: vals.length }).map((_, i) => vals[i] || '');
    if (continuousVals.filter(Boolean).length > 5) {
      headers = continuousVals;
      break;
    }
  }

  if (!headers.length) return null;

  // Map header indices
  const headerMap = new Map<string, number>();
  headers.forEach((h, i) => headerMap.set(toStr(h), i));

  // Parse data rows
  let dataStarted = false;

  for (const rowEl of rowElements) {
    const cells = Array.from(rowEl.querySelectorAll('c'));
    if (!cells.length) continue;

    const vals: string[] = [];
    cells.forEach((c) => {
      const rAttr = c.getAttribute('r') || '';
      const colIdx = getColIndex(rAttr);
      if (colIdx < 0) return;
      
      const t = c.getAttribute('t');
      const v = c.querySelector('v')?.textContent || '';
      let val = v;
      if (t === 's') val = sharedStrings[Number(v)] || '';
      
      vals[colIdx] = val;
    });

    if (!dataStarted) {
      // Create an array safely handling undefined values for the check
      const safeVals = Array.from({ length: Math.max(vals.length, headers.length) }).map((_, i) => vals[i] || '');
      if (safeVals.some((v, i) => v && toStr(v) === toStr(headers[i]))) continue;
      dataStarted = true;
    }

    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => { if (vals[i] != null) row[toStr(h)] = vals[i]; });
    if (Object.keys(row).length > 0) rows.push(row);
  }

  return rows.length ? rows : null;
}

/** Normalize raw rows to NormalizedRow format - SOLOMON COMPLIANT */
function normalizeRows(
  rows: Record<string, unknown>[],
  fieldMap: Map<string, number>,
  columnNames: string[],
  sourceName: string,
  warnings: string[]
): NormalizedRow[] {
  const out: NormalizedRow[] = [];
  const dropped: string[] = [];

  const getVal = (r: Record<string, unknown>, canon: string): string => {
    const idx = fieldMap.get(canon);
    if (idx !== undefined && columnNames[idx]) {
      const v = r[columnNames[idx]];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    const direct = r[canon];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    return '';
  };

  // Track if we found key fields
  let hasQtyShipPcs = false;
  let hasInvoiceAmt = false;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // --- Dates (strict separation) ---
    const rawSoDate = pickFirst(
      r.soDate, r.SO_Date, r['SO_Date'], r.sodate, r.orderDate,
      getVal(r, 'soDate')
    );

    const rawInvoiceDate = pickFirst(
      r.invoiceDate, r.Invoice_Date, r['Invoice_Date'], r.invcdate,
      r.invDate, r.invoiceDate,
      getVal(r, 'invoiceDate')
    );

    // Default "active date" uses Invoice_Date for sales, SO_Date for orders
    const rawDate = rawInvoiceDate || rawSoDate || pickFirst(
      r.date, r.Date, r.DocDate, r.docDate,
      getVal(r, 'date'), getVal(r, 'invoiceDate'), getVal(r, 'soDate')
    );

    // --- Document fields ---
    const soTypeId = toStr(r.soTypeId || r.SOTypeID || r['SOTypeID'] || r.DocType || r['DocType'] || r.type || getVal(r, 'soTypeId'));
    const invoiceNo = toStr(r.invoiceNo || r.Invoice_No || r['Invoice_No'] || r.InvoiceNo || r.invcnbr || getVal(r, 'invoiceNo'));
    const shipperNo = toStr(r.shipperNo || r.Shipper_No || r['Shipper_No'] || r.ShipperNo || getVal(r, 'shipperNo'));
    const lineRef = toStr(r.lineRef || r.LineRef || r['LineRef'] || r.Line_Ref || r.SOLine || getVal(r, 'lineRef'));
    const cancelled = isCancelled(r.cancelled || r.Cancelled || r.CANCELLED || r.void || getVal(r, 'cancelled'));

    // --- Store ---
    const rawStore = pickFirst(
      r.store, r.c_Name, r['c_Name'], r.Customer_Name, r.customerName,
      r.customer, r.shop, r.storeName, getVal(r, 'store')
    ) || 'ไม่ระบุ';

    // --- Salesperson ---
    const psName = pickFirst(
      r.psName, r.Salesperson_Name, r['Salesperson_Name'], r.Seller_Name,
      r.salesperson, r.seller, r.user, getVal(r, 'psName')
    ) || 'ไม่ระบุ';

    // --- Quantities: STRICT QtyShipPCS priority ---
    let qtyPcs = 0;
    const directPcs = r.qtyShipPcs ?? r.QtyShipPCS ?? r['QtyShipPCS'] ?? r.ShipQtyPCS ?? r.shipQtyPCS;
    if (directPcs != null && String(directPcs).trim()) {
      qtyPcs = safeNonNegInt(directPcs);
      hasQtyShipPcs = true;
    } else {
      // Fallback: only if QtyShipPCS truly doesn't exist
      const fallbackQty = r.qty ?? r.QtyShip ?? r['QtyShip'] ?? r.ShipQty ?? r.quantity;
      if (fallbackQty != null && String(fallbackQty).trim()) {
        qtyPcs = safeNonNegInt(fallbackQty);
      }
    }

    // Cases - completely separate
    const cseVal = r.qtyShipCse ?? r.QtyShipCSE ?? r['QtyShipCSE'] ?? r.ShipQtyCSE;
    const qtyCse = cseVal != null ? safeNonNegInt(cseVal) : 0;

    // Order quantity - for reference only
    const orderVal = r.qtyOrder ?? r.QtyOrder ?? r['QtyOrder'];
    const qtyOrd = orderVal != null ? safeNonNegInt(orderVal) : 0;

    // --- Amounts: strictly use InvoiceAmt / amt / invoiceamtwithout_tax as requested ---
    // Prioritize line-level amount candidates (amt, invoiceamtwithout_tax) over InvoiceAmt
    // to prevent assigning the whole bill's amount to every SKU.
    let invAmt = 0;
    const directAmt = pickFirst(
      r.amt, r.Amt, r.invoiceamtwithout_tax, r['InvcAmtWithout_Tax'],
      r.InvoiceAmt, r.invoiceAmt, r['InvoiceAmt'], r.InvcAmt,
      getVal(r, 'invoiceAmt')
    );
    if (directAmt != null && String(directAmt).trim()) {
      invAmt = safeNum(directAmt);
      hasInvoiceAmt = true;
    }

    const invAmtWithTax = 0; // "ห้ามใช้ amtVat / invoiceamtwith_tax" - we won't record it if not needed, or just 0.

    // --- Normalize dates ---
    const soDateNorm = normalizeDateKey(rawSoDate);
    const invoiceDateNorm = normalizeDateKey(rawInvoiceDate);
    const dateNorm = normalizeDateKey(rawDate) || invoiceDateNorm || soDateNorm;

    const row: NormalizedRow = {
      id: `${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      psName,
      psCode: toStr(r.psCode || r.psid || r.salespersonid || r.sellerid || r.SalespersonID || r.SO_SellerID || getVal(r, 'psCode')),

      // Dates
      date: dateNorm,
      soDate: soDateNorm,
      invoiceDate: invoiceDateNorm,
      dateRaw: toStr(rawDate),
      _rawDate: toStr(rawDate),

      // Document
      soTypeId,
      invoiceNo,
      shipperNo,
      lineRef,
      cancelled,

      // Store
      store: toStr(rawStore),
      storeRaw: toStr(rawStore),
      _rawStore: toStr(rawStore),
      storeId: toStr(r.storeId || r.customerId || r.custId || r.CustID || getVal(r, 'storeId')),
      storeClass: toStr(r.storeClass || r.class || r.customerClass || r.segment || r.InvClassID || getVal(r, 'storeClass')),

      // Product
      brand: toStr(r.brand || r.Brand || r.brandDesc || r.Brand_desc || r.groupBrand || r.GroupBrand || r.TAS_Brand || getVal(r, 'brand') || 'อื่นๆ'),
      size: toStr(r.size || r.TAS_SizeGroup || r.SizeGroup || r.sizeGroup || r.SKU_Size || getVal(r, 'size') || 'อื่นๆ'),
      sku: toStr(r.sku || r.SKU_Desc || r.skuDesc || r.itemName || r.productName || r.TAS_ENName || r.TAS_THName || getVal(r, 'sku') || '—'),
      skuCode: toStr(r.skuCode || r.SKU_Code || r.itemCode || r.productCode || r.barcode || getVal(r, 'skuCode')),

      // Quantities (strict separation)
      qtyShipPcs: qtyPcs,
      qtyShipCse: qtyCse,
      qtyOrder: qtyOrd,

      // Amounts
      invoiceAmt: invAmt,
      invoiceAmtWithTax: invAmtWithTax,

      // Telesale
      teleName: toStr(r.teleName || r.TelesaleName || r.Telesale_Name || ''),
      teleId: toStr(r.teleId || r.TelesaleId || r.Telesale_ID || ''),

      sourceName: toStr(sourceName),
      _provenance: {
        sourceSheet: 'pivotCache',
        sourceColumnMap: Object.fromEntries(fieldMap.entries()) as unknown as Record<string, string>,
        rawFields: { ...r },
      },
    };

    // Validate minimum viable row
    if (!row.sku && !row.store && !row.brand) {
      dropped.push(`Row ${i}: no sku/store/brand`);
      continue;
    }

    out.push(row);
  }

  if (dropped.length > 0) {
    warnings.push(`แถวที่ถูกตัดออก: ${dropped.length} แถว (ไม่มีข้อมูลสินค้า/ร้านค้า/แบรนด์)`);
  }
  if (hasQtyShipPcs) {
    warnings.push('✓ พบฟิลด์ QtyShipPCS - ใช้เป็นจำนวนชิ้นหลัก');
  } else {
    warnings.push('⚠ ไม่พบ QtyShipPCS - fallback ไปใช้ QtyShip');
  }
  if (hasInvoiceAmt) {
    warnings.push('✓ พบฟิลด์ InvoiceAmt - ใช้เป็นยอดเงินหลัก');
  } else {
    warnings.push('⚠ ไม่พบ InvoiceAmt - fallback ไปใช้ Amount');
  }

  return out;
}
