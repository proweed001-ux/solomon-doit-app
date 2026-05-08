/* ============================================================
   AYA DOIT Pro - TypeScript Type Definitions
   - Solomon Field Mapping Compliant
   ============================================================ */

export interface RawRow {
  [key: string]: unknown;
}

export interface NormalizedRow {
  // Unique ID
  id: string;

  // Salesperson
  psName: string;
  psCode: string;

  // Dates
  date: string;           // normalized YYYY-MM-DD (the active date being used)
  soDate: string;         // SO_Date - order date
  invoiceDate: string;    // Invoice_Date - invoice date
  dateRaw: string;        // original date string
  _rawDate: string;

  // Document
  soTypeId: string;       // SOTypeID: SO, INVC, RFC, CMP, DM
  invoiceNo: string;      // Invoice_No
  shipperNo: string;      // Shipper_No
  lineRef: string;        // LineRef
  cancelled: boolean;     // Cancelled = 1 means cancelled

  // Store / Customer
  store: string;
  storeRaw: string;
  _rawStore: string;
  storeId: string;        // CustID
  storeClass: string;

  // Product
  brand: string;
  size: string;
  sku: string;
  skuCode: string;        // SKU_Code

  // Quantities (strict separation)
  qtyShipPcs: number;     // QtyShipPCS - primary unit (pieces)
  qtyShipCse: number;     // QtyShipCSE - cases (separate)
  qtyOrder: number;       // QtyOrder - ordered quantity

  // Amounts
  invoiceAmt: number;     // InvoiceAmt - PRIMARY sales amount
  invoiceAmtWithTax: number; // InvoiceAmt with tax

  // Telesale
  teleName: string;
  teleId: string;

  // Metadata
  sourceName: string;
  _provenance: {
    sourceSheet: string;
    sourceColumnMap: Record<string, string>;
    rawFields: Record<string, unknown>;
  };
}

export interface PSInfo {
  name: string;
  code: string;
  orders: number;
  stores: Set<string>;
}

export interface TODItem {
  brand: string;
  size: string;
  sku: string;
  skuCode: string;
  totalPcs: number;       // Sum of QtyShipPCS
  totalCse: number;       // Sum of QtyShipCSE (separate)
  totalInvoiceAmt: number; // Sum of InvoiceAmt (summary/reference)
  detailAmt: number | null; // Sum of row.amt only for detail rows; blank if missing
  soTypeIds: string[];    // List of SOTypeIDs
  invoiceNos: string[];   // List of Invoice_No (distinct)
  stores: Record<string, number>;
  add: number;
  remove: number;
  custom: boolean;
}

export interface DashboardFilters {
  dateField: 'soDate' | 'invoiceDate';
  soTypeId: string;       // '' = all, 'INVC', 'SO', 'RFC', 'CMP', 'DM'
  dateFrom: string;
  dateTo: string;
  psName: string;
  store: string;
  brand: string;
  includeCancelled: boolean;
}

export interface SessionData {
  todData: Record<string, TODItem>;
  storeCols: string[];
  groups: Record<string, boolean>;
  selectedPS: string | null;
  selectedDate: string | null;
}

export interface AppSettings {
  autoSave: boolean;
  subtotals: boolean;
  darkMode: boolean;
  fontScale: number;
  proMode: boolean;
  teleHidden: boolean;
  dashboardDateField: 'soDate' | 'invoiceDate';
  dashboardSoTypeId: string;
  defaultSoTypeId: string;
}

export interface FileMeta {
  name: string;
  date: string;
  size: number;
  rows: number;
  ts: number;
  source: string;
}

export interface HistoryEntry {
  ts: string;
  action: string;
  details: string;
}

export interface AppState {
  // Navigation
  screen: string;
  prevScreen: string | null;

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

  // Loading
  loading: boolean;
  loadingText: string;
  loadingPct: number;

  // Messages
  toast: ToastMessage | null;
}

export interface ToastMessage {
  message: string;
  type: 'info' | 'ok' | 'warn' | 'err';
  ms: number;
}

export type Screen =
  | 'upload'
  | 'ps-select'
  | 'date-select'
  | 'hub'
  | 'tod'
  | 'dashboard'
  | 'distribution'
  | 'bill'
  | 'pivot'
  | 'settings'
  | 'history';
