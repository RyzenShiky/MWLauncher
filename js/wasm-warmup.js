// wasm-warmup.js — best-effort "warm the connection" step.
//
// Honest scope note: a real WASM module warm-up (pre-fetch + pre-compile of
// the game's actual .wasm binary) would need to know that game's specific
// asset URLs/build, which differ per server/version and aren't exposed by
// this launcher. What we *can* do generically for any target URL is set up
// the network path early — DNS resolution + TLS handshake — via
// <link rel="preconnect">, so that when the user does hit "Masuk Ke Game"
// the browser doesn't pay that round-trip cost on the critical path. If a
// target server exposes a predictable WASM asset path in the future, a
// real `fetch(..., {priority:"low"})` prefetch can be dropped in here.

let warmedOrigin = null;
let preconnectLink = null;

export function warmUpTarget(url) {
  let origin;
  try {
    origin = new URL(url).origin;
  } catch (err) {
    return;
  }
  if (origin === warmedOrigin) return; // already warmed for this target

  if (preconnectLink) preconnectLink.remove();
  preconnectLink = document.createElement("link");
  preconnectLink.rel = "preconnect";
  preconnectLink.href = origin;
  preconnectLink.crossOrigin = "anonymous";
  document.head.appendChild(preconnectLink);
  warmedOrigin = origin;
}
