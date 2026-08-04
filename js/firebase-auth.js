// firebase-auth.js — thin wrapper around Firebase Authentication.
//
// The Firebase SDK is only fetched from Google's CDN when this module is
// first imported (main.js does that lazily, on first interaction with the
// "Akun Cloud" panel) — the app shell itself stays installable/offline via
// the service worker, and only this genuinely-online feature reaches out
// to the network.

import { firebaseConfig } from "./firebase-config.js";

const SDK_VERSION = "12.17.0";
const CDN_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let bootPromise = null;

export function firebaseIsConfigured() {
  return Boolean(firebaseConfig.apiKey) && !firebaseConfig.apiKey.startsWith("PASTE_");
}

async function boot() {
  if (!firebaseIsConfigured()) {
    throw new Error(
      "Firebase belum dikonfigurasi. Isi js/firebase-config.js dengan config project Firebase kamu."
    );
  }
  if (!bootPromise) {
    bootPromise = (async () => {
      const { initializeApp } = await import(`${CDN_BASE}/firebase-app.js`);
      const authModule = await import(`${CDN_BASE}/firebase-auth.js`);
      const app = initializeApp(firebaseConfig);
      const auth = authModule.getAuth(app);

      // Analytics is optional and non-critical (blocked by many ad/privacy
      // blockers) — never let it break authentication if it fails to load.
      if (firebaseConfig.measurementId) {
        import(`${CDN_BASE}/firebase-analytics.js`)
          .then(({ getAnalytics }) => getAnalytics(app))
          .catch(() => {});
      }

      return { app, auth, authModule };
    })();
  }
  return bootPromise;
}

function toSessionUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || null,
    email: user.email || null,
    photoURL: user.photoURL || null,
    isAnonymous: user.isAnonymous,
  };
}

export async function signInWithGoogle() {
  const { auth, authModule } = await boot();
  const provider = new authModule.GoogleAuthProvider();
  const result = await authModule.signInWithPopup(auth, provider);
  return toSessionUser(result.user);
}

export async function signInAsGuest() {
  const { auth, authModule } = await boot();
  const result = await authModule.signInAnonymously(auth);
  return toSessionUser(result.user);
}

export async function signOutUser() {
  const { auth, authModule } = await boot();
  await authModule.signOut(auth);
}

/**
 * Subscribes to auth-state changes so login status survives a page reload
 * (Firebase persists the session in IndexedDB itself and replays it here).
 * Returns an unsubscribe function.
 */
export async function watchAuthState(callback) {
  const { auth, authModule } = await boot();
  return authModule.onAuthStateChanged(auth, (user) => callback(toSessionUser(user)));
}
