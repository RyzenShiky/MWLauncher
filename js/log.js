// log.js — lightweight local activity history (sessions + admin changes)
//
// Storage format is intentionally compact: each entry is a 3-element array
// [type, epochMsBase36, message] instead of a verbose JSON object with long
// key names and an ISO date string. This roughly halves the bytes per entry
// compared to the original {type, message, at} shape, keeping the launcher
// well under a meaningful slice of the localStorage quota even with a full
// history. Entries older than 7 days are dropped automatically on every
// read/write so the log can't grow unbounded over time.

import { storage } from "./storage.js";

const STORE_KEY = "m_launcher_activity_v2";
const LEGACY_KEY = "m_launcher_activity_v1";
const MAX_ENTRIES = 60;
const MAX_MESSAGE_LEN = 140;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function encodeEntry(type, message, atMs) {
  return [type, atMs.toString(36), String(message).slice(0, MAX_MESSAGE_LEN)];
}

function decodeEntry(raw) {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const [type, tBase36, message] = raw;
  const atMs = parseInt(tBase36, 36);
  if (!Number.isFinite(atMs)) return null;
  return { type, at: atMs, message };
}

function migrateLegacyIfNeeded() {
  const v2raw = storage.getJSON(STORE_KEY, null);
  if (Array.isArray(v2raw)) return v2raw;

  const legacy = storage.getJSON(LEGACY_KEY, []);
  if (Array.isArray(legacy) && legacy.length) {
    const migrated = legacy
      .map((e) => {
        const atMs = Date.parse(e.at) || Date.now();
        return encodeEntry(e.type, e.message, atMs);
      })
      .slice(0, MAX_ENTRIES);
    storage.setJSON(STORE_KEY, migrated);
    return migrated;
  }
  return [];
}

function loadRaw() {
  return migrateLegacyIfNeeded();
}

function loadDecoded() {
  const raw = loadRaw();
  const cutoff = Date.now() - MAX_AGE_MS;
  return raw
    .map(decodeEntry)
    .filter((e) => e && e.at >= cutoff)
    .slice(0, MAX_ENTRIES);
}

function saveDecoded(entries) {
  const encoded = entries
    .slice(0, MAX_ENTRIES)
    .map((e) => encodeEntry(e.type, e.message, e.at));
  storage.setJSON(STORE_KEY, encoded);
}

export const activityLog = {
  add(type, message) {
    const entries = loadDecoded();
    entries.unshift({ type, message, at: Date.now() });
    saveDecoded(entries);
    return entries;
  },
  list() {
    // list() returns entries with an `.at` epoch-ms number; callers format
    // it for display (e.g. new Date(entry.at).toLocaleString(...)).
    return loadDecoded();
  },
  clear() {
    saveDecoded([]);
  },
};
