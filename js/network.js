// network.js — connectivity + latency
// navigator.onLine only reflects the local network interface, not real
// internet reachability, so we back it up with a periodic lightweight
// health-check request, plus an on-demand ping to the currently selected
// game server (separate from the generic "is the internet up" check).

const HEALTH_CHECK_INTERVAL_MS = 20000;
const HEALTH_CHECK_TIMEOUT_MS = 4000;

// A tiny, cacheable, cross-origin resource. no-cors mode means we can't read
// the response body/status, but a resolved fetch (vs. a network error/abort)
// is enough signal that the network path is actually alive.
const HEALTH_CHECK_URL = "https://www.gstatic.com/generate_204";

// Runs one timed fetch. Never throws and never leaves a rejected promise
// unhandled — every failure path (network error, timeout/abort, bad URL)
// is normalized into { ok: false, ms: null } so callers can't accidentally
// produce an "Uncaught (in promise)" console warning.
function pingOnce(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  return fetch(url, {
    method: "GET",
    mode: "no-cors",
    cache: "no-store",
    signal: controller.signal,
  })
    .then(() => ({ ok: true, ms: Math.round(performance.now() - start) }))
    .catch(() => ({ ok: false, ms: null })) // covers AbortError + real network errors alike
    .finally(() => clearTimeout(timer));
}

export function createNetworkMonitor({ onChange } = {}) {
  let state = {
    browserOnline: navigator.onLine,
    realOnline: navigator.onLine,
    latencyMs: null,
    checking: false,
  };
  let intervalHandle = null;

  function emit() {
    if (onChange) onChange({ ...state });
  }

  async function runHealthCheck() {
    if (!navigator.onLine) {
      state = { ...state, browserOnline: false, realOnline: false, latencyMs: null, checking: false };
      emit();
      return;
    }
    state = { ...state, checking: true };
    emit();
    const result = await pingOnce(HEALTH_CHECK_URL, HEALTH_CHECK_TIMEOUT_MS);
    state = {
      ...state,
      browserOnline: navigator.onLine,
      realOnline: result.ok,
      latencyMs: result.ms,
      checking: false,
    };
    emit();
  }

  // Measure latency to a specific game server's origin (used for the
  // per-bookmark "ping server ini" button) — separate from the generic
  // internet health check above, since a reachable internet connection
  // doesn't guarantee the chosen game server itself is up.
  async function pingTarget(url) {
    try {
      const parsed = new URL(url);
      const result = await pingOnce(parsed.origin + "/", HEALTH_CHECK_TIMEOUT_MS);
      return result.ok ? result.ms : null;
    } catch (err) {
      return null; // invalid URL — treat as unreachable, don't throw
    }
  }

  function start() {
    window.addEventListener("online", runHealthCheck);
    window.addEventListener("offline", runHealthCheck);
    runHealthCheck();
    intervalHandle = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);
  }

  function stop() {
    window.removeEventListener("online", runHealthCheck);
    window.removeEventListener("offline", runHealthCheck);
    if (intervalHandle) clearInterval(intervalHandle);
  }

  return { start, stop, pingTarget, refresh: runHealthCheck };
}
