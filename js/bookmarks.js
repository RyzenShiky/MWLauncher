// bookmarks.js — multi-server preset URL management
import { storage } from "./storage.js";

const STORE_KEY = "m_launcher_bookmarks_v3";

const DEFAULT_URL = "https://ryzenshiky.github.io/Minecraft-Web/";
const DEFAULT_BOOKMARKS = [
  { id: "default", name: "Minecraft Web (Default)", url: DEFAULT_URL, ramGb: 2 },
];

// Old defaults that should be rewritten to DEFAULT_URL on load
const LEGACY_DEFAULT_URLS = [
  "https://eaglercraft.com",
  "http://eaglercraft.com",
  "https://eaglercraft.com/",
  "http://eaglercraft.com/",
];

function makeId() {
  return "b_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeUrl(rawUrl) {
  let url = (rawUrl || "").trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
    return url;
  } catch (err) {
    return null;
  }
}

function isLegacyDefaultUrl(url) {
  if (!url) return false;
  const normalized = url.trim().replace(/\/+$/, "").toLowerCase();
  return LEGACY_DEFAULT_URLS.some(
    (legacy) => legacy.replace(/\/+$/, "").toLowerCase() === normalized
  );
}

function rewriteLegacyDefaultUrls(state) {
  if (!state || !Array.isArray(state.bookmarks)) return state;
  let changed = false;
  for (const b of state.bookmarks) {
    if (isLegacyDefaultUrl(b.url)) {
      b.url = DEFAULT_URL;
      if (!b.name || /eaglercraft/i.test(b.name) || b.name === "Server Tersimpan") {
        b.name = "Minecraft Web (Default)";
      }
      changed = true;
    }
  }
  if (changed) storage.setJSON(STORE_KEY, state);
  return state;
}

function migrateLegacyIfNeeded() {
  // v3 already present — rewrite old eaglercraft defaults if any
  const v3 = storage.getJSON(STORE_KEY, null);
  if (v3 && Array.isArray(v3.bookmarks) && v3.bookmarks.length) {
    return rewriteLegacyDefaultUrls(v3);
  }

  // Try v2 (had installType/version fields, now dropped) or v1
  const older = storage.getJSON("m_launcher_bookmarks_v2", null) || storage.getJSON("m_launcher_bookmarks_v1", null);
  if (older && Array.isArray(older.bookmarks) && older.bookmarks.length) {
    const bookmarks = older.bookmarks.map((b) => ({
      id: b.id,
      name: b.name,
      url: isLegacyDefaultUrl(b.url) ? DEFAULT_URL : b.url,
      ramGb: b.ramGb || 2,
    }));
    // Rename default-looking entries that still say Eaglercraft
    for (const b of bookmarks) {
      if (b.url === DEFAULT_URL && (!b.name || /eaglercraft/i.test(b.name))) {
        b.name = "Minecraft Web (Default)";
      }
    }
    const state = { bookmarks, activeId: older.activeId || bookmarks[0].id };
    storage.setJSON(STORE_KEY, state);
    return state;
  }

  // Original single-URL key from the very first version of the launcher
  const legacyUrl = storage.get("m_launcher_url");
  const bookmarks = legacyUrl
    ? [
        {
          id: "default",
          name: isLegacyDefaultUrl(legacyUrl) ? "Minecraft Web (Default)" : "Server Tersimpan",
          url: isLegacyDefaultUrl(legacyUrl) ? DEFAULT_URL : legacyUrl,
          ramGb: 2,
        },
      ]
    : DEFAULT_BOOKMARKS.slice();

  const state = { bookmarks, activeId: bookmarks[0].id };
  storage.setJSON(STORE_KEY, state);
  return state;
}

export function createBookmarkStore({ onExternalChange } = {}) {
  let state = migrateLegacyIfNeeded();

  function persist() {
    storage.setJSON(STORE_KEY, state);
  }

  // --- Cross-tab live sync ---
  // The native 'storage' event fires in *other* tabs/windows whenever
  // localStorage changes in this origin (it never fires in the tab that
  // made the change), so this is exactly the right hook to catch "I added
  // a server in tab A, tab B should see it too" without polling.
  function handleStorageEvent(event) {
    if (event.key !== STORE_KEY) return;
    if (!event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      if (incoming && Array.isArray(incoming.bookmarks)) {
        state = rewriteLegacyDefaultUrls(incoming);
        if (onExternalChange) onExternalChange(list(), getActive());
      }
    } catch (err) {
      // Ignore malformed writes from other tabs/extensions
    }
  }
  window.addEventListener("storage", handleStorageEvent);

  function list() {
    return state.bookmarks.slice();
  }

  function getActive() {
    return state.bookmarks.find((b) => b.id === state.activeId) || state.bookmarks[0];
  }

  function setActive(id) {
    if (state.bookmarks.some((b) => b.id === id)) {
      state.activeId = id;
      persist();
      return true;
    }
    return false;
  }

  function add(fields) {
    const url = normalizeUrl(fields.url);
    if (!url) return { ok: false, error: "URL tidak valid." };
    const bookmark = {
      id: makeId(),
      name: (fields.name || "").trim() || url,
      url,
      ramGb: fields.ramGb || 2,
    };
    state.bookmarks.push(bookmark);
    state.activeId = bookmark.id;
    persist();
    return { ok: true, bookmark };
  }

  function update(id, fields = {}) {
    const bookmark = state.bookmarks.find((b) => b.id === id);
    if (!bookmark) return { ok: false, error: "Server tidak ditemukan." };
    if (fields.url !== undefined) {
      const normalized = normalizeUrl(fields.url);
      if (!normalized) return { ok: false, error: "URL tidak valid." };
      bookmark.url = normalized;
    }
    if (fields.name !== undefined && fields.name.trim()) bookmark.name = fields.name.trim();
    if (fields.ramGb !== undefined) bookmark.ramGb = fields.ramGb;
    persist();
    return { ok: true, bookmark };
  }

  function remove(id) {
    if (state.bookmarks.length <= 1) {
      return { ok: false, error: "Minimal harus ada satu server tersimpan." };
    }
    state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
    if (state.activeId === id) state.activeId = state.bookmarks[0].id;
    persist();
    return { ok: true };
  }

  function destroy() {
    window.removeEventListener("storage", handleStorageEvent);
  }

  return { list, getActive, setActive, add, update, remove, normalizeUrl, destroy };
}
