/* ============================================================
   Zustand Store - SOLOMON COMPLIANT
   - Dashboard filters with SOTypeID, DateField selection
   - Global stats (not tied to psData only)
   - QtyShipPCS as primary quantity
   - InvoiceAmt as primary amount (with header-total dedup)
   ============================================================ */

import { create } from 'zustand';
import type {
  NormalizedRow, PSInfo, TODItem, AppSettings, DashboardFilters,
  FileMeta, ToastMessage, Screen,
} from '@/types';
import {
  dbGet, dbSet, persistRawAndMeta, persistSession,
  saveTodState, loadTodState, saveStoreCols, loadStoreCols,
  addHistory, resetSessionId,
} from '@/lib/indexedDB';
import { parseExcelFile } from '@/lib/excelParser';
import { normalizeDateKey } from '@/lib/dateNormalizer';
import { toStr, samePerson, sameStore, norm, safeNonNegInt, safeNum } from '@/lib/fieldNormalizer';
import { immer } from 'zustand/middleware/immer';

interface AppStore {
  // Navigation
  screen: Screen;
  prevScreen: Screen | null;
  setScreen: (s: Screen) => void;
  goBack: () => void;

  // Data
  raw: NormalizedRow[];
  psList: PSInfo[];
  psData: NormalizedRow[];
  teleData: NormalizedRow[];
  selectedPS: string | null;
  selectedDate: string | null;
  storeList: string[];
  storeCols: string[];
  todData: Record<string, TODItem>;
  groups: Record<string, boolean>;

  // Dashboard Filters
  dashboardFilters: DashboardFilters;
  setDashboardFilters: (f: Partial<DashboardFilters>) => void;
  resetDashboardFilters: () => void;

  // UI State
  todBrandFilter: string | null;
  todSearch: string;
  dashFilter: 'all' | 'brand' | 'store' | 'size';
  undoStack: Record<string, TODItem>[];
  redoStack: Record<string, TODItem>[];

  // Settings & Meta
  settings: AppSettings;
  recent: FileMeta[];
  fileMeta: FileMeta | null;

  // Loading & Messages
  loading: boolean;
  loadingText: string;
  loadingPct: number;
  toast: ToastMessage | null;
  setLoading: (on: boolean, text?: string, pct?: number) => void;
  setLoadingPct: (pct: number, text?: string) => void;
  showToast: (message: string, type?: ToastMessage['type'], ms?: number) => void;
  clearToast: () => void;

  // Warnings from import
  importWarnings: string[];
  importStats: { rawCount: number; duplicatesRemoved: number; mappedFields: number; cancelledCount: number } | null;

  // Global Stats
  globalStats: {
    totalPcs: number;
    totalCse: number;
    totalInvoiceAmt: number;
    totalStores: number;
    totalSku: number;
    totalInvoices: number;
    soTypeBreakdown: Record<string, { count: number; pcs: number; amt: number }>;
  };

  // Actions
  init: () => Promise<void>;
  handleFile: (file: File) => Promise<void>;
  selectPS: (name: string) => void;
  selectDate: (date: string) => Promise<void>;
  prepareData: () => Promise<void>;
  buildPSList: (rows: NormalizedRow[]) => Promise<void>;
  buildTODData: () => Promise<void>;
  computeGlobalStats: () => void;
  setTodBrandFilter: (b: string | null) => void;
  setTodSearch: (q: string) => void;
  setDashFilter: (f: 'all' | 'brand' | 'store' | 'size') => void;
  toggleGroup: (key: string) => void;
  collapseAll: () => void;
  expandAll: () => void;
  addStoreColumn: (name?: string) => void;
  changeStore: (idx: number, newStore: string) => void;
  updateStore: (key: string, store: string, val: string) => void;
  updateExtra: (key: string, type: 'add' | 'remove', val: string) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  insertRow: (brand: string, size: string, sku: string, skuCode: string) => void;
  saveSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void;
  clearAllData: () => Promise<void>;
  exportCSV: () => void;
  exportBillCSV: () => void;
  buildBillData: () => Record<string, { sku: string; qty: number }[]>;
  calcRem: (item: TODItem) => number;
  setStoreCols: (cols: string[]) => void;
  persistTOD: () => Promise<void>;

  // Dashboard helpers
  getFilteredData: () => NormalizedRow[];
  getDistinctSoTypeIds: () => string[];
  getDistinctDates: () => string[];
}

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  subtotals: true,
  darkMode: true,
  fontScale: 1,
  proMode: true,
  teleHidden: false,
  dashboardDateField: 'invoiceDate',
  dashboardSoTypeId: '',
  defaultSoTypeId: 'INVC',
};

const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  dateField: 'invoiceDate',
  soTypeId: '',
  dateFrom: '',
  dateTo: '',
  psName: '',
  store: '',
  brand: '',
  includeCancelled: false,
};

/** Deduplicate invoice amounts to prevent header-total inflation.
 *  
 *  Problem: If an invoice has 5 line items, but the Excel export repeats
 *  the same InvoiceAmt (header total) on every line, summing all 5 lines
 *  gives 5x the actual amount.
 *  
 *  Solution: For each invoice, if multiple rows share the exact same
 *  invoiceAmt but have different SKUs, only count the amount ONCE.
 *  This preserves legitimate line-level amounts where each line has
 *  a different value.
 *  
 *  Returns the deduplicated amount for a single row.
 */
function getDeduplicatedInvoiceAmt(
  row: NormalizedRow,
  allRows: NormalizedRow[]
): number {
  const amt = safeNum(row.invoiceAmt);
  if (amt === 0) return 0;
  if (!row.invoiceNo) return amt; // No invoice number, can't dedup

  // Find all rows for the same invoice
  const sameInvoiceRows = allRows.filter(
    r => r.invoiceNo === row.invoiceNo && !r.cancelled
  );
  if (sameInvoiceRows.length < 2) return amt; // Only one line, no inflation possible

  // Check if ALL lines for this invoice have the exact same amount
  const distinctAmts = new Set(sameInvoiceRows.map(r => safeNum(r.invoiceAmt)));
  const distinctSkus = new Set(sameInvoiceRows.map(r => r.skuCode || r.sku).filter(Boolean));

  // Inflation detection: same amount across multiple different SKUs
  const isHeaderTotalInflation = distinctAmts.size === 1 && distinctSkus.size > 1;

  if (isHeaderTotalInflation) {
    // Only the first row for this invoice gets the amount; others get 0
    // Use SKU as tiebreaker for deterministic ordering
    const firstRow = sameInvoiceRows.sort((a, b) =>
      (a.skuCode || a.sku).localeCompare(b.skuCode || b.sku)
    )[0];
    if (row.id === firstRow.id) {
      return amt; // First row keeps the amount
    }
    return 0; // Other rows get zero (amount already counted once)
  }

  return amt; // Normal line-level amounts, sum all
}

export const useAppStore = create<AppStore>()(immer((set, get) => ({
  // Navigation
  screen: 'upload',
  prevScreen: null,
  setScreen: (s) => set((state) => { state.prevScreen = state.screen; state.screen = s; }),
  goBack: () => {
    const backMap: Record<Screen, Screen> = {
      'upload': 'upload',
      'ps-select': 'upload',
      'date-select': 'ps-select',
      'hub': 'date-select',
      'tod': 'hub',
      'dashboard': 'hub',
      'distribution': 'hub',
      'bill': 'hub',
      'pivot': 'hub',
      'settings': 'upload',
      'history': 'hub',
    };
    set((state) => { state.screen = (backMap as Record<string, Screen>)[state.screen as string] || 'upload'; });
  },

  // Data
  raw: [],
  psList: [],
  psData: [],
  teleData: [],
  selectedPS: null,
  selectedDate: null,
  storeList: [],
  storeCols: [],
  todData: {},
  groups: {},

  // Dashboard Filters
  dashboardFilters: { ...DEFAULT_DASHBOARD_FILTERS },
  setDashboardFilters: (f) => set((state) => {
    state.dashboardFilters = { ...state.dashboardFilters, ...f };
  }),
  resetDashboardFilters: () => set((state) => {
    state.dashboardFilters = { ...DEFAULT_DASHBOARD_FILTERS };
  }),

  // UI State
  todBrandFilter: null,
  todSearch: '',
  dashFilter: 'all',
  undoStack: [],
  redoStack: [],

  // Settings & Meta
  settings: { ...DEFAULT_SETTINGS },
  recent: [],
  fileMeta: null,

  // Loading & Messages
  loading: false,
  loadingText: '',
  loadingPct: 0,
  toast: null,
  setLoading: (on, text = '', pct = 0) => set((state) => {
    state.loading = on;
    state.loadingText = text;
    state.loadingPct = pct;
  }),
  setLoadingPct: (pct, text) => set((state) => {
    state.loadingPct = pct;
    if (text) state.loadingText = text;
  }),
  showToast: (message, type = 'info', ms = 2200) => set((state) => {
    state.toast = { message, type, ms };
  }),
  clearToast: () => set((state) => { state.toast = null; }),

  // Warnings
  importWarnings: [],
  importStats: null,

  // Global Stats
  globalStats: {
    totalPcs: 0, totalCse: 0, totalInvoiceAmt: 0,
    totalStores: 0, totalSku: 0, totalInvoices: 0,
    soTypeBreakdown: {},
  },

  // ---- Actions ----

  init: async () => {
    try {
      const savedSettings = await dbGet<AppSettings>('settings', 'current');
      if (savedSettings) {
        set((state) => { state.settings = { ...DEFAULT_SETTINGS, ...savedSettings }; });
      }

      const savedRecent = await dbGet<FileMeta[]>('recent', 'list');
      if (savedRecent) {
        set((state) => { state.recent = savedRecent; });
      }

      const savedRaw = await dbGet<NormalizedRow[]>('raw_data', 'current');
      const savedMeta = await dbGet<FileMeta>('meta', 'current');

      if (savedRaw && savedRaw.length > 0) {
        set((state) => {
          state.raw = savedRaw;
          state.fileMeta = savedMeta || null;
        });
        const store = get();
        await store.buildPSList(savedRaw);
        store.computeGlobalStats();
        // Skip upload screen if data already exists
        set((state) => { state.screen = 'ps-select'; });
      }

      await addHistory('เปิดแอป', 'AYA DOIT Pro - Solomon Edition');
    } catch (e) {
      console.warn('Init error:', e);
    }
  },

  handleFile: async (file) => {
    const store = get();
    store.setLoading(true, 'ตรวจสอบไฟล์...', 5);

    try {
      store.setLoadingPct(15, 'อ่านโครงสร้างไฟล์...');
      const result = await parseExcelFile(file);

      store.setLoadingPct(60, 'บันทึกข้อมูล...');

      resetSessionId();

      set((state) => {
        state.raw = result.rows;
        state.importWarnings = result.warnings;
        state.importStats = {
          rawCount: result.rawCount,
          duplicatesRemoved: result.duplicatesRemoved,
          mappedFields: result.fieldMap.size,
          cancelledCount: result.cancelledCount,
        };
        state.fileMeta = {
          name: file.name,
          date: new Date().toLocaleDateString('th-TH'),
          size: file.size,
          rows: result.rows.length,
          ts: Date.now(),
          source: file.name,
        };
        state.selectedPS = null;
        state.selectedDate = null;
        state.storeCols = [];
        state.todData = {};
        state.groups = {};
        state.undoStack = [];
        state.redoStack = [];
      });

      const recentEntry: FileMeta = {
        name: file.name,
        date: new Date().toLocaleDateString('th-TH'),
        size: file.size,
        rows: result.rows.length,
        ts: Date.now(),
        source: file.name,
      };

      set((state) => {
        state.recent = [recentEntry, ...state.recent.filter((r: FileMeta) => r.name !== file.name)].slice(0, 5);
      });

      await persistRawAndMeta(get().raw, get().fileMeta, get().recent, get().settings);
      await store.buildPSList(result.rows);
      store.computeGlobalStats();

      store.setLoadingPct(100, 'เสร็จสิ้น');
      setTimeout(() => store.setLoading(false), 400);

      store.showToast(`โหลดสำเร็จ ${result.rows.length.toLocaleString('th-TH')} รายการ`, 'ok');
      await addHistory('โหลดไฟล์', `${file.name} — ${result.rows.length} แถว (Cancelled: ${result.cancelledCount})`);

      set((state) => { state.screen = 'ps-select'; });

    } catch (e) {
      store.setLoading(false);
      const msg = e instanceof Error ? e.message : String(e);
      store.showToast(`เกิดข้อผิดพลาด: ${msg}`, 'err', 5000);
      console.error('handleFile error:', e);
    }
  },

  buildPSList: async (rows: NormalizedRow[]) => {
    const map = new Map<string, PSInfo>();
    for (const r of rows) {
      const rawName = toStr(r.psName || r.psCode || 'ไม่ระบุ');
      const key = rawName;
      if (!map.has(key)) {
        map.set(key, { name: rawName, code: toStr(r.psCode || ''), orders: 0, stores: new Set() });
      }
      const item = map.get(key)!;
      item.orders += 1;
      if (r.store) item.stores.add(r.store);
    }
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'));
    set((state) => { state.psList = list; });
  },

  selectPS: (name) => {
    set((state) => { state.selectedPS = name; });
    get().setScreen('date-select');
  },

  selectDate: async (date) => {
    const normDate = normalizeDateKey(date);
    set((state) => { state.selectedDate = normDate; });
    await get().prepareData();
    get().setScreen('hub');
  },

  prepareData: async () => {
    const state = get();
    const ps = state.selectedPS;
    const dt = state.selectedDate;
    if (!ps || !dt) return;

    const allRows = state.raw;
    // Filter by date using the configured date field
    const dateField = state.settings.dashboardDateField;
    const filtered = allRows.filter(r =>
      samePerson(r.psName || r.psCode || '', ps) &&
      normalizeDateKey(r[dateField as keyof NormalizedRow] as string || r.date) === dt
    );

    // Separate tele data
    const tele = filtered.filter(r => toStr(r.teleName) && toStr(r.soTypeId) !== 'RFC');
    const psData = filtered.filter(r => !toStr(r.teleName) || toStr(r.soTypeId) === 'RFC');

    // Build store list
    const stores = [...new Set(psData.map(r => toStr(r.store || r.storeRaw || r._rawStore)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'th'));

    set((state) => {
      state.psData = psData;
      state.teleData = tele;
      state.storeList = stores.length ? stores : ['ร้าน 1', 'ร้าน 2', 'ร้าน 3'];
    });

    const savedCols = await loadStoreCols(ps, dt);
    if (savedCols && savedCols.length > 0) {
      set((state) => { state.storeCols = savedCols; });
    } else {
      const defaultCols = stores.slice(0, Math.min(3, stores.length));
      set((state) => { state.storeCols = defaultCols.length ? defaultCols : ['ร้าน 1', 'ร้าน 2', 'ร้าน 3']; });
    }

    await get().buildTODData();
    await persistSession(ps, dt, get().storeCols, get().groups, get().fileMeta);
  },

  buildTODData: async () => {
    const state = get();
    const tod: Record<string, TODItem> = {};

    const CHUNK = 500;
    const rows = state.psData;

    // Precompute deduplicated amounts for all rows to prevent
    // header-total inflation in TOD aggregation
    const dedupedAmts = new Map<string, number>();
    for (const r of rows) {
      dedupedAmts.set(r.id, getDeduplicatedInvoiceAmt(r, rows));
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const key = `${toStr(r.brand || 'อื่นๆ')}||${toStr(r.size || 'อื่นๆ')}||${toStr(r.sku || '—')}`;

      if (!tod[key]) {
        tod[key] = {
          brand: toStr(r.brand || 'อื่นๆ'),
          size: toStr(r.size || 'อื่นๆ'),
          sku: toStr(r.sku || '—'),
          skuCode: toStr(r.skuCode || ''),
          totalPcs: 0,
          totalCse: 0,
          totalInvoiceAmt: 0,
          detailAmt: null,
          soTypeIds: [],
          invoiceNos: [],
          stores: {},
          add: 0,
          remove: 0,
          custom: false,
        };
      }

      // Use QtyShipPCS as primary
      tod[key].totalPcs += safeNonNegInt(r.qtyShipPcs);
      // Cases separate
      tod[key].totalCse += safeNonNegInt(r.qtyShipCse);
      // InvoiceAmt with HEADER-TOTAL DEDUP - use precomputed deduplicated amount
      tod[key].totalInvoiceAmt += dedupedAmts.get(r.id) ?? safeNum(r.invoiceAmt);
      // Detail row amount: use row-level amt only, never InvoiceAmt fallback
      const rawFields = (r as any)?._provenance?.rawFields as Record<string, unknown> | undefined;
      const detailAmtRaw = rawFields ? (rawFields.amt ?? rawFields.Amt) : undefined;
      if (detailAmtRaw != null && String(detailAmtRaw).trim() !== '') {
        const detailAmt = safeNum(detailAmtRaw);
        if (tod[key].detailAmt == null) tod[key].detailAmt = 0;
        tod[key].detailAmt += detailAmt;
      }
      // Track SOTypeID
      if (r.soTypeId && !tod[key].soTypeIds.includes(r.soTypeId)) {
        tod[key].soTypeIds.push(r.soTypeId);
      }
      // Track Invoice_No
      if (r.invoiceNo && !tod[key].invoiceNos.includes(r.invoiceNo)) {
        tod[key].invoiceNos.push(r.invoiceNo);
      }

      if (i % CHUNK === 0 && i > 0) {
        await new Promise<void>(r => requestAnimationFrame(() => r()));
      }
    }

    // Merge saved state
    const saved = await loadTodState(state.selectedPS || '', state.selectedDate || '');
    if (saved) {
      for (const [k, s] of Object.entries(saved)) {
        if (!tod[k]) {
          if (s.custom) {
            tod[k] = {
              brand: s.brand || 'อื่นๆ',
              size: s.size || 'อื่นๆ',
              sku: s.sku || '—',
              skuCode: s.skuCode || '',
              totalPcs: 0,
              totalCse: 0,
              totalInvoiceAmt: 0,
              detailAmt: null,
              soTypeIds: [],
              invoiceNos: [],
              stores: {},
              add: 0,
              remove: 0,
              custom: true,
            };
          } else {
            continue;
          }
        }
        tod[k].add = safeNonNegInt(s.add);
        tod[k].remove = safeNonNegInt(s.remove);
        tod[k].stores = s.stores && typeof s.stores === 'object' ? { ...s.stores } : {};
      }
    }

    set((state) => {
      state.todData = tod;
      state.undoStack = [];
      state.redoStack = [];
    });
  },

  computeGlobalStats: () => {
    const raw = get().raw;
    if (!raw.length) {
      set((state) => {
        state.globalStats = {
          totalPcs: 0, totalCse: 0, totalInvoiceAmt: 0,
          totalStores: 0, totalSku: 0, totalInvoices: 0,
          soTypeBreakdown: {},
        };
      });
      return;
    }

    let totalPcs = 0;
    let totalCse = 0;
    let totalInvoiceAmt = 0;
    const stores = new Set<string>();
    const skus = new Set<string>();
    const invoices = new Set<string>();
    const soTypeBreakdown: Record<string, { count: number; pcs: number; amt: number }> = {};

    // Precompute deduplicated amounts to prevent header-total inflation
    const dedupedAmts = new Map<string, number>();
    for (const r of raw) {
      dedupedAmts.set(r.id, getDeduplicatedInvoiceAmt(r, raw));
    }

    for (const r of raw) {
      if (r.cancelled) continue;
      totalPcs += safeNonNegInt(r.qtyShipPcs);
      totalCse += safeNonNegInt(r.qtyShipCse);
      // Use deduplicated amount to prevent header-total inflation
      totalInvoiceAmt += dedupedAmts.get(r.id) ?? safeNum(r.invoiceAmt);
      if (r.store) stores.add(r.store);
      if (r.sku) skus.add(r.sku);
      if (r.invoiceNo) invoices.add(r.invoiceNo);

      const stid = r.soTypeId || 'UNKNOWN';
      if (!soTypeBreakdown[stid]) {
        soTypeBreakdown[stid] = { count: 0, pcs: 0, amt: 0 };
      }
      soTypeBreakdown[stid].count += 1;
      soTypeBreakdown[stid].pcs += safeNonNegInt(r.qtyShipPcs);
      // Use deduplicated amount in breakdown too
      soTypeBreakdown[stid].amt += dedupedAmts.get(r.id) ?? safeNum(r.invoiceAmt);
    }

    set((state) => {
      state.globalStats = {
        totalPcs,
        totalCse,
        totalInvoiceAmt,
        totalStores: stores.size,
        totalSku: skus.size,
        totalInvoices: invoices.size,
        soTypeBreakdown,
      };
    });
  },

  // Dashboard helpers
  getFilteredData: () => {
    const { raw, dashboardFilters } = get();
    return raw.filter(r => {
      if (r.cancelled && !dashboardFilters.includeCancelled) return false;
      if (dashboardFilters.soTypeId && r.soTypeId !== dashboardFilters.soTypeId) return false;
      if (dashboardFilters.psName && !samePerson(r.psName, dashboardFilters.psName)) return false;
      if (dashboardFilters.store && !sameStore(r.store, dashboardFilters.store)) return false;
      if (dashboardFilters.brand && norm(r.brand) !== norm(dashboardFilters.brand)) return false;
      const dateField = dashboardFilters.dateField;
      const rowDate = (r[dateField as keyof NormalizedRow] as string) || r.date;
      if (dashboardFilters.dateFrom && rowDate < dashboardFilters.dateFrom) return false;
      if (dashboardFilters.dateTo && rowDate > dashboardFilters.dateTo) return false;
      return true;
    });
  },

  getDistinctSoTypeIds: () => {
    const ids = new Set(get().raw.map(r => r.soTypeId).filter(Boolean));
    return [...ids].sort();
  },

  getDistinctDates: () => {
    const df = get().dashboardFilters.dateField;
    const dates = new Set(get().raw.map(r => (r[df as keyof NormalizedRow] as string) || r.date).filter(Boolean));
    return [...dates].sort();
  },

  setTodBrandFilter: (b) => set((state) => { state.todBrandFilter = b; }),
  setTodSearch: (q) => set((state) => { state.todSearch = q; }),
  setDashFilter: (f) => set((state) => { state.dashFilter = f; }),

  toggleGroup: (key) => set((state) => { state.groups[key] = !state.groups[key]; }),

  collapseAll: () => {
    const groups: Record<string, boolean> = {};
    const data = get().todData;
    for (const k of Object.keys(data)) {
      const row = data[k];
      groups[`b:${row.brand}`] = true;
      groups[`s:${row.brand}||${row.size}`] = true;
    }
    set((state) => { state.groups = groups; });
  },

  expandAll: () => set((state) => { state.groups = {}; }),

  addStoreColumn: (name) => {
    const state = get();
    let next = name?.trim();
    if (!next) {
      const avail = state.storeList.filter(s => !state.storeCols.includes(s));
      next = avail.sort((a, b) => b.length - a.length)[0] || '';
    }
    if (!next) {
      next = toStr(prompt('เพิ่มชื่อร้านค้า:', '') || '');
      if (!next) { get().showToast('ยังไม่ได้กรอกชื่อร้าน', 'info'); return; }
    }
    if (state.storeCols.includes(next)) {
      get().showToast('ร้านนี้มีอยู่แล้วในตาราง', 'info');
      return;
    }
    set((state) => { state.storeCols.push(next); });
    get().persistTOD();
  },

  changeStore: (idx, newStore) => {
    const state = get();
    const trimmed = toStr(newStore).trim();
    if (!trimmed) return;
    const dup = state.storeCols.some((s, i) => i !== idx && s === trimmed);
    if (dup) { get().showToast('ร้านนี้ถูกใช้งานแล้ว', 'warn'); return; }
    set((state) => { state.storeCols[idx] = trimmed; });
    get().persistTOD();
  },

  setStoreCols: (cols) => {
    set((state) => { state.storeCols = cols; });
    get().persistTOD();
  },

  updateStore: (key, store, val) => {
    const state = get();
    const row = state.todData[key];
    if (!row) return;
    get().pushUndo();
    set((state) => {
      state.todData[key].stores = { ...state.todData[key].stores, [store]: safeNonNegInt(val) };
    });
    get().persistTOD();
  },

  updateExtra: (key, type, val) => {
    const state = get();
    const row = state.todData[key];
    if (!row) return;
    get().pushUndo();
    set((state) => {
      state.todData[key][type] = safeNonNegInt(val);
    });
    get().persistTOD();
  },

  pushUndo: () => {
    set((state) => {
      state.undoStack.push(JSON.parse(JSON.stringify(state.todData)));
      if (state.undoStack.length > 50) state.undoStack.shift();
      state.redoStack = [];
    });
  },

  undo: () => {
    const state = get();
    if (!state.undoStack.length) { get().showToast('ไม่มีการกระทำที่ยกเลิกได้', 'info'); return; }
    const prev = state.undoStack[state.undoStack.length - 1];
    set((state) => {
      state.redoStack.push(JSON.parse(JSON.stringify(state.todData)));
      state.todData = JSON.parse(JSON.stringify(prev));
      state.undoStack.pop();
    });
    get().persistTOD();
    get().showToast('ยกเลิกการกระทำ ✓', 'ok');
  },

  redo: () => {
    const state = get();
    if (!state.redoStack.length) { get().showToast('ไม่มีการกระทำที่ทำซ้ำได้', 'info'); return; }
    const next = state.redoStack[state.redoStack.length - 1];
    set((state) => {
      state.undoStack.push(JSON.parse(JSON.stringify(state.todData)));
      state.todData = JSON.parse(JSON.stringify(next));
      state.redoStack.pop();
    });
    get().persistTOD();
    get().showToast('ทำซ้ำการกระทำ ✓', 'ok');
  },

  insertRow: (brand, size, sku, skuCode) => {
    const key = `${brand || 'อื่นๆ'}||${size || 'อื่นๆ'}||${sku}`;
    if (get().todData[key]) { get().showToast('มีสินค้านี้อยู่แล้ว', 'info'); return; }
    get().pushUndo();
    set((state) => {
      state.todData[key] = {
        brand: brand || 'อื่นๆ',
        size: size || 'อื่นๆ',
        sku,
        skuCode: skuCode || '',
        totalPcs: 0,
        totalCse: 0,
        totalInvoiceAmt: 0,
        detailAmt: null,
        soTypeIds: [],
        invoiceNos: [],
        stores: {},
        add: 0,
        remove: 0,
        custom: true,
      };
    });
    get().persistTOD();
  },

  persistTOD: async () => {
    const state = get();
    if (!state.selectedPS || !state.selectedDate) return;
    if (state.settings.autoSave === false) return;

    const snap: Record<string, any> = {};
    for (const [k, v] of Object.entries(state.todData)) {
      snap[k] = { 
        add: v.add, 
        remove: v.remove, 
        stores: { ...v.stores },
        custom: v.custom,
        sku: v.sku,
        skuCode: v.skuCode,
        brand: v.brand,
        size: v.size
      };
    }
    await saveTodState(state.selectedPS, state.selectedDate, snap);
    await saveStoreCols(state.selectedPS, state.selectedDate, state.storeCols);
    await persistSession(state.selectedPS, state.selectedDate, state.storeCols, state.groups, state.fileMeta);
  },

  calcRem: (item) => {
    const storeSum = Object.values(item.stores || {}).reduce((s, v) => s + safeNonNegInt(v), 0);
    return safeNonNegInt(item.totalPcs) - storeSum + safeNonNegInt(item.add) - safeNonNegInt(item.remove);
  },

  saveSettings: async () => {
    await dbSet('settings', 'current', get().settings);
  },

  updateSetting: (k, v) => {
    set((state) => { state.settings[k] = v; });
    get().saveSettings();
  },

  clearAllData: async () => {
    const { dbClear } = await import('@/lib/indexedDB');
    await dbClear();
    set((state) => {
      state.raw = [];
      state.psList = [];
      state.psData = [];
      state.teleData = [];
      state.selectedPS = null;
      state.selectedDate = null;
      state.storeList = [];
      state.storeCols = [];
      state.todData = {};
      state.groups = {};
      state.undoStack = [];
      state.redoStack = [];
      state.recent = [];
      state.fileMeta = null;
      state.screen = 'upload';
      state.globalStats = {
        totalPcs: 0, totalCse: 0, totalInvoiceAmt: 0,
        totalStores: 0, totalSku: 0, totalInvoices: 0,
        soTypeBreakdown: {},
      };
    });
    get().showToast('ล้างข้อมูลทั้งหมดแล้ว', 'ok');
  },

  exportCSV: () => {
    const state = get();
    const cols = state.storeCols;
    const rows: (string | number)[][] = [['Brand', 'ขนาด', 'สินค้า', 'รหัส', 'ชิ้น (PCS)', 'ลัง (CSE)', 'ยอดเงิน detail row', ...cols, 'ของเพิ่ม', 'ดึงออก', 'คงเหลือ']];

    Object.values(state.todData).forEach(drow => {
      const storeVals = cols.map(s => safeNonNegInt(drow.stores?.[s]));
      const rem = get().calcRem(drow);
      rows.push([
        drow.brand, drow.size, drow.sku, drow.skuCode,
        drow.totalPcs, drow.totalCse, (drow.detailAmt ?? ''),
        ...storeVals, drow.add || 0, drow.remove || 0, rem
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${toStr(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ถอดของ_${state.selectedPS}_${state.selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    get().showToast('ดาวน์โหลด CSV แล้ว ✓', 'ok');
  },

  exportBillCSV: () => {
    const state = get();
    const map = get().buildBillData();
    const rows: (string | number)[][] = [['ร้านค้า', 'สินค้า', 'จำนวนชิ้น']];
    Object.entries(map).forEach(([store, items]) => { items.forEach(i => rows.push([store, i.sku, i.qty])); });
    const csv = rows.map(r => r.map(v => `"${toStr(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `บิล_${state.selectedPS}_${state.selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    get().showToast('ดาวน์โหลด CSV แล้ว ✓', 'ok');
  },

  buildBillData: () => {
    const state = get();
    const map: Record<string, { sku: string; qty: number }[]> = {};
    for (const store of state.storeCols) {
      map[store] = [];
      for (const drow of Object.values(state.todData)) {
        const q = safeNonNegInt(drow.stores?.[store]);
        if (q > 0) map[store].push({ sku: drow.sku, qty: q });
      }
    }
    return map;
  },
})));
