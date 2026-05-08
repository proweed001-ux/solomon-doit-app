/* ============================================================
   IndexedDB Persistence Layer
   - Separate stores: raw_data, normalized_data, session, history, settings
   - localStorage fallback for unsupported environments
   - Session isolation with sessionId
   ============================================================ */

const DB_NAME = 'aya_doit_pro_v1';
const DB_VERSION = 1;

interface DBSchema {
  raw_data: { key: string; value: NormalizedRow[] };
  normalized_data: { key: string; value: NormalizedRow[] };
  session: { key: string; value: SessionSnapshot };
  history: { key: string; value: HistoryEntry[] };
  settings: { key: string; value: AppSettings };
  tod_state: { key: string; value: Record<string, TODStateSnap> };
  store_cols: { key: string; value: string[] };
  meta: { key: string; value: FileMeta };
  recent: { key: string; value: FileMeta[] };
}

interface SessionSnapshot {
  sessionId: string;
  ts: string;
  selectedPS: string | null;
  selectedDate: string | null;
  storeCols: string[];
  groups: Record<string, boolean>;
  fileMeta: FileMeta | null;
}

interface TODStateSnap {
  add: number;
  remove: number;
  stores: Record<string, number>;
  ts: string;
  custom?: boolean;
  sku?: string;
  skuCode?: string;
  brand?: string;
  size?: string;
}

import type { NormalizedRow, HistoryEntry, AppSettings, FileMeta } from '@/types';

let dbInstance: IDBDatabase | null = null;
let sessionId: string = '';

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getSessionId(): string {
  if (!sessionId) sessionId = generateSessionId();
  return sessionId;
}

export function resetSessionId(): void {
  sessionId = generateSessionId();
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) { resolve(dbInstance); return; }
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB not supported')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const stores = ['raw_data', 'normalized_data', 'session', 'history', 'settings', 'tod_state', 'store_cols', 'meta', 'recent'];
      stores.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); });
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

async function withStore<T>(
  storeName: keyof DBSchema,
  mode: 'readonly' | 'readwrite',
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName as string, mode);
      const store = tx.objectStore(storeName as string);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB operation failed'));
    });
  } catch {
    throw new Error('IDB unavailable');
  }
}

/* ---- localStorage fallback helpers ---- */
function lsKey(store: string, key: string): string { return `doit_${store}_${key}`; }
function lsGet<T>(store: string, key: string): T | undefined {
  try { const raw = localStorage.getItem(lsKey(store, key)); return raw ? JSON.parse(raw) : undefined; }
  catch { return undefined; }
}
function lsSet(store: string, key: string, value: unknown): void {
  try { localStorage.setItem(lsKey(store, key), JSON.stringify(value)); } catch { /* quota */ }
}
function lsDel(store: string, key: string): void {
  try { localStorage.removeItem(lsKey(store, key)); } catch { /* */ }
}

/* ---- Public API ---- */
export async function dbGet<T>(storeName: keyof DBSchema, key: string): Promise<T | undefined> {
  try { return await withStore(storeName, 'readonly', (s) => s.get(key)) as T | undefined; }
  catch { return lsGet<T>(storeName as string, key); }
}

export async function dbSet<T>(storeName: keyof DBSchema, key: string, value: T): Promise<void> {
  try { await withStore(storeName, 'readwrite', (s) => s.put(value, key)); }
  catch { lsSet(storeName as string, key, value); }
}

export async function dbDel(storeName: keyof DBSchema, key: string): Promise<void> {
  try { await withStore(storeName, 'readwrite', (s) => s.delete(key)); }
  catch { lsDel(storeName as string, key); }
}

export async function dbClear(): Promise<void> {
  const stores: (keyof DBSchema)[] = ['raw_data', 'normalized_data', 'session', 'history', 'settings', 'tod_state', 'store_cols', 'meta', 'recent'];
  for (const s of stores) { try { await withStore(s, 'readwrite', (st) => st.clear()); } catch { /* */ } }
  // Also clear localStorage fallback
  try {
    Object.keys(localStorage).forEach((k) => { if (k.startsWith('doit_')) localStorage.removeItem(k); });
  } catch { /* ignore */ }
}

export async function persistRawAndMeta(
  raw: NormalizedRow[],
  meta: FileMeta | null,
  recent: FileMeta[],
  settings: AppSettings
): Promise<void> {
  await dbSet('raw_data', 'current', raw);
  if (meta) await dbSet('meta', 'current', meta);
  await dbSet('recent', 'list', recent);
  await dbSet('settings', 'current', settings);
}

export async function persistSession(
  selectedPS: string | null,
  selectedDate: string | null,
  storeCols: string[],
  groups: Record<string, boolean>,
  fileMeta: FileMeta | null
): Promise<void> {
  const snap: SessionSnapshot = {
    sessionId: getSessionId(),
    ts: new Date().toISOString(),
    selectedPS,
    selectedDate,
    storeCols,
    groups,
    fileMeta,
  };
  await dbSet('session', 'current', snap);
  await dbSet('session', 'crash_recovery', snap);
}

export async function loadCrashSession(): Promise<SessionSnapshot | undefined> {
  return dbGet<SessionSnapshot>('session', 'crash_recovery');
}

export async function clearCrashSession(): Promise<void> {
  await dbDel('session', 'crash_recovery');
}

export async function saveTodState(
  ps: string,
  date: string,
  todData: Record<string, { add: number; remove: number; stores: Record<string, number>; custom?: boolean; sku: string; skuCode: string; brand: string; size: string }>
): Promise<void> {
  const snap: Record<string, TODStateSnap> = {};
  for (const [k, v] of Object.entries(todData)) {
    snap[k] = { 
      add: v.add || 0, 
      remove: v.remove || 0, 
      stores: { ...v.stores }, 
      ts: new Date().toISOString(),
      custom: v.custom,
      sku: v.sku,
      skuCode: v.skuCode,
      brand: v.brand,
      size: v.size
    };
  }
  await dbSet('tod_state', `${ps}_${date}`, snap);
}

export async function loadTodState(
  ps: string,
  date: string
): Promise<Record<string, TODStateSnap> | undefined> {
  return dbGet<Record<string, TODStateSnap>>('tod_state', `${ps}_${date}`);
}

export async function saveStoreCols(ps: string, date: string, cols: string[]): Promise<void> {
  await dbSet('store_cols', `${ps}_${date}`, cols);
}

export async function loadStoreCols(ps: string, date: string): Promise<string[] | undefined> {
  return dbGet<string[]>('store_cols', `${ps}_${date}`);
}

export async function addHistory(action: string, details: string): Promise<void> {
  try {
    const hist = (await dbGet<HistoryEntry[]>('history', 'entries')) || [];
    hist.unshift({ ts: new Date().toISOString(), action, details });
    if (hist.length > 120) hist.pop();
    await dbSet('history', 'entries', hist);
  } catch { /* silent */ }
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  return (await dbGet<HistoryEntry[]>('history', 'entries')) || [];
}

export async function clearHistory(): Promise<void> {
  await dbDel('history', 'entries');
}
