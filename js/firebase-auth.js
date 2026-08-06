// firebase-auth.js — thin wrapper around Firebase Authentication.
//
// The Firebase SDK is only fetched from Google's CDN when this module is
// first imported (main.js does that lazily, on first interaction with the
// "Akun Cloud" panel) — the app shell itself stays installable/offline via
// the service worker, and only this genuinely-online feature reaches out
// to the network.
//
// Boot also initializes Realtime Database so storage.js can save/load
// player data under players/{uid}/saves/default without a second app init.

import { firebaseConfig, FIREBASE_CDN_BASE } from "./firebase-config.js";

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
      const { initializeApp, getApps } = await import(`${FIREBASE_CDN_BASE}/firebase-app.js`);
      const authModule = await import(`${FIREBASE_CDN_BASE}/firebase-auth.js`);
      const dbModule = await import(`${FIREBASE_CDN_BASE}/firebase-database.js`);

      // Reuse an already-initialized default app if present (e.g. after HMR).
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = authModule.getAuth(app);
      const db = dbModule.getDatabase(app);

      // Analytics is optional and non-critical (blocked by many ad/privacy
      // blockers) — never let it break authentication if it fails to load.
      if (firebaseConfig.measurementId) {
        import(`${FIREBASE_CDN_BASE}/firebase-analytics.js`)
          .then(({ getAnalytics }) => getAnalytics(app))
          .catch(() => {});
      }

      return { app, auth, authModule, db, dbModule };
    })();
  }
  return bootPromise;
}

/** Shared boot used by storage.js for Realtime Database access. */
export async function getFirebaseServices() {
  return boot();
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

/**
 * Login pemain (anonim) dan kembalikan UID saja.
 * Dipakai saat tombol masuk/mulai di peluncur ditekan.
 */
export async function loginPlayer() {
  const { auth, authModule } = await boot();
  const userCredential = await authModule.signInAnonymously(auth);
  return userCredential.user.uid;
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
