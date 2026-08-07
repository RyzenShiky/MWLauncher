// network.js — connectivity + latency
// navigator.onLine only reflects the local network interface, not real
// internet reachability, so we back it up with a periodic lightweight
// health-check request, plus a continuous live ping to the currently
// selected game server (auto-scan, no manual "Cek Ping" required).

const HEALTH_CHECK_INTERVAL_MS = 20000;
const HEALTH_CHECK_TIMEOUT_MS = 4000;
const SERVER_PING_INTERVAL_MS = 8000;
const SERVER_PING_TIMEOUT_MS = 4000;

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

export function createNetworkMonitor({ onChange, onServerPing } = {}) {
  let state = {
    browserOnline: navigator.onLine,
    realOnline: navigator.onLine,
    latencyMs: null,
    checking: false,
  };
  let intervalHandle = null;

  // Live server-ping state (active game URL)
  let serverUrl = null;
  let serverPingHandle = null;
  let serverPingInFlight = false;
  let serverGeneration = 0; // bumps on every setServerTarget to drop stale results

  function emit() {
    if (onChange) onChange({ ...state });
  }

  function emitServerPing(payload) {
    if (onServerPing) onServerPing(payload);
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

  // Measure latency to a specific game server's origin — separate from the
  // generic internet health check, since a reachable internet connection
  // doesn't guarantee the chosen game server itself is up.
  async function pingTarget(url) {
    try {
      const parsed = new URL(url);
      const result = await pingOnce(parsed.origin + "/", SERVER_PING_TIMEOUT_MS);
      return result.ok ? result.ms : null;
    } catch (err) {
      return null; // invalid URL — treat as unreachable, don't throw
    }
  }

  async function runServerPing(isManual = false) {
    if (!serverUrl) return;
    if (serverPingInFlight && !isManual) return;

    const gen = serverGeneration;
    const target = serverUrl;
    serverPingInFlight = true;

    if (isManual || gen === serverGeneration) {
      emitServerPing({ checking: true, ms: null, url: target });
    }

    const ms = await pingTarget(target);
    serverPingInFlight = false;

    // Drop result if the user switched servers while this ping was in flight
    if (gen !== serverGeneration || target !== serverUrl) return;

    emitServerPing({ checking: false, ms, url: target });
  }

  function clearServerInterval() {
    if (serverPingHandle) {
      clearInterval(serverPingHandle);
      serverPingHandle = null;
    }
  }

  /**
   * Start (or retarget) continuous live ping for a game server URL.
   * Pass null/empty to stop monitoring.
   */
  function setServerTarget(url) {
    serverGeneration += 1;
    clearServerInterval();
    serverPingInFlight = false;

    const trimmed = (url || "").trim();
    if (!trimmed) {
      serverUrl = null;
      emitServerPing({ checking: false, ms: null, url: null });
      return;
    }

    serverUrl = trimmed;
    // Immediate scan, then keep scanning in the background
    runServerPing(true);
    serverPingHandle = setInterval(() => runServerPing(false), SERVER_PING_INTERVAL_MS);
  }

  /** One-shot refresh of the current server target (e.g. manual button). */
  function refreshServerPing() {
    return runServerPing(true);
  }

  function start() {
    window.addEventListener("online", () => {
      runHealthCheck();
      if (serverUrl) runServerPing(true);
    });
    window.addEventListener("offline", () => {
      runHealthCheck();
      if (serverUrl) {
        emitServerPing({ checking: false, ms: null, url: serverUrl });
      }
    });
    runHealthCheck();
    intervalHandle = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);
  }

  function stop() {
    window.removeEventListener("online", runHealthCheck);
    window.removeEventListener("offline", runHealthCheck);
    if (intervalHandle) clearInterval(intervalHandle);
    clearServerInterval();
  }

  return {
    start,
    stop,
    pingTarget,
    refresh: runHealthCheck,
    setServerTarget,
    refreshServerPing,
  };
}
