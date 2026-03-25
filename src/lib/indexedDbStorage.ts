/**
 * IndexedDB-based storage for large binary data (photos, signatures).
 * localStorage has a ~5 MB quota which is too small for base64 images.
 * IndexedDB can store hundreds of MB, making it ideal for offline persistence.
 */

const DB_NAME = 'estateturn_photos';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a single key-value pair */
export async function idbPut(key: string, value: string | null): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (value === null || value === undefined) {
      store.delete(key);
    } else {
      store.put(value, key);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('[IDB] put failed:', e);
  }
}

/** Get a single value by key */
export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch (e) {
    console.warn('[IDB] get failed:', e);
    return null;
  }
}

/** Get multiple values by keys */
export async function idbGetMany(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  if (keys.length === 0) return result;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const promises = keys.map(key => new Promise<void>((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => { result[key] = req.result ?? null; resolve(); };
      req.onerror = () => { result[key] = null; resolve(); };
    }));
    await Promise.all(promises);
    db.close();
  } catch (e) {
    console.warn('[IDB] getMany failed:', e);
  }
  return result;
}

/** Save multiple key-value pairs in a single transaction */
export async function idbPutMany(entries: [string, string | null][]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [key, value] of entries) {
      if (value === null || value === undefined) {
        store.delete(key);
      } else {
        store.put(value, key);
      }
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('[IDB] putMany failed:', e);
  }
}

/** Clear all stored blobs */
export async function idbClearAll(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('[IDB] clear failed:', e);
  }
}
