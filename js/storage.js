// storage.js — layered persistence:
//   1) localStorage (fast, synchronous, small values)
//   2) IndexedDB (async, survives many "Incognito blocks localStorage"
//      cases better than plain localStorage, also used for large binary
//      data like modpack/resource-pack files)
//   3) in-memory Map (last resort, lost on reload — user is warned in UI)
//   4) Firebase Realtime Database (cloud saves under players/{uid}/saves/default)

import { getFirebaseServices } from "./firebase-auth.js";

const DB_NAME = "mlauncher_db";
const DB_VERSION = 1;
const KV_STORE = "kv";
const BLOB_STORE = "blobs";

const memoryFallback = new Map();
let usingFallback = false;
let dbPromise = null;

function probeLocalStorage() {
  try {
    const testKey = "__m_launcher_probe__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch (err) {
    return false;
  }
}

const hasLocalStorage = probeLocalStorage();
if (!hasLocalStorage) usingFallback = true;

function openDb() {
  if (dbPromise) return dbPromise;
  if (!("indexedDB" in window)) {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
        if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); // IndexedDB blocked/unavailable — degrade quietly
    } catch (err) {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(store, key) {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch (err) {
      resolve(undefined);
    }
  });
}

async function idbSet(store, key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

async function idbDelete(store, key) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

async function idbListKeys(store) {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (err) {
      resolve([]);
    }
  });
}

// On boot, if localStorage is blocked, try to warm the in-memory fallback
// from whatever we previously mirrored into IndexedDB, so settings survive
// a reload even in strict Incognito modes that still allow IndexedDB.
async function restoreFromIndexedDbIfNeeded() {
  if (!usingFallback) return;
  const keys = await idbListKeys(KV_STORE);
  for (const key of keys) {
    const value = await idbGet(KV_STORE, key);
    if (value !== undefined) memoryFallback.set(key, value);
  }
}
const restoreReady = restoreFromIndexedDbIfNeeded();

export const storage = {
  isFallback() {
    return usingFallback;
  },

  // Resolves once the best-effort IndexedDB restore attempt has finished.
  ready() {
    return restoreReady;
  },

  get(key) {
    if (!usingFallback) {
      try {
        return window.localStorage.getItem(key);
      } catch (err) {
        usingFallback = true;
      }
    }
    return memoryFallback.has(key) ? memoryFallback.get(key) : null;
  },

  set(key, value) {
    if (!usingFallback) {
      try {
        window.localStorage.setItem(key, value);
        return true;
      } catch (err) {
        usingFallback = true;
      }
    }
    memoryFallback.set(key, value);
    // Fire-and-forget mirror to IndexedDB so it survives a reload even
    // though localStorage itself is unavailable this session.
    idbSet(KV_STORE, key, value);
    return false; // false = not guaranteed durable via localStorage
  },

  remove(key) {
    if (!usingFallback) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) {
        usingFallback = true;
      }
    }
    memoryFallback.delete(key);
    idbDelete(KV_STORE, key);
  },

  getJSON(key, fallbackValue) {
    const raw = storage.get(key);
    if (!raw) return fallbackValue;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return fallbackValue;
    }
  },

  setJSON(key, value) {
    return storage.set(key, JSON.stringify(value));
  },

  // --- Raw blob storage (modpacks / resource packs) ---
  blobs: {
    put(key, blob) {
      return idbSet(BLOB_STORE, key, blob);
    },
    get(key) {
      return idbGet(BLOB_STORE, key);
    },
    delete(key) {
      return idbDelete(BLOB_STORE, key);
    },
    list() {
      return idbListKeys(BLOB_STORE);
    },
    available() {
      return "indexedDB" in window;
    },
  },
};

// ---------------------------------------------------------------------------
// Firebase Realtime Database — cloud player saves
// Path: players/{uid}/saves/default
// ---------------------------------------------------------------------------

/**
 * Simpan data pemain ke Realtime Database.
 * @param {string} uid - Firebase Auth UID
 * @param {object} saveData - Objek data yang akan disimpan
 */
export async function savePlayerData(uid, saveData) {
  if (!uid) throw new Error("savePlayerData: uid diperlukan");
  const { db, dbModule } = await getFirebaseServices();
  const { ref, set } = dbModule;
  await set(ref(db, `players/${uid}/saves/default`), saveData);
}

/**
 * Muat data pemain dari Realtime Database.
 * @param {string} uid - Firebase Auth UID
 * @returns {object|null} Data save, atau null jika belum ada
 */
export async function loadPlayerData(uid) {
  if (!uid) throw new Error("loadPlayerData: uid diperlukan");
  const { db, dbModule } = await getFirebaseServices();
  const { ref, get, child } = dbModule;
  const snapshot = await get(child(ref(db), `players/${uid}/saves/default`));
  return snapshot.exists() ? snapshot.val() : null;
}
