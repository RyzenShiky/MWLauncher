// firebase-config.js — this project's Firebase config.
//
// Note: these values are public client identifiers, not secrets — Firebase
// enforces access control via Authentication providers + Security Rules
// and the "Authorized domains" allowlist, not by hiding this object. It's
// normal and expected for this to ship in client-side code.
//
// Reminder: in Firebase Console → Authentication → Sign-in method, make
// sure "Google" and "Anonymous" are both enabled, and under Authentication
// → Settings → Authorized domains, add the domain this launcher is hosted
// on (e.g. xcceliteplayer-code.github.io) — otherwise sign-in fails with
// an "auth/unauthorized-domain" error.

export const firebaseConfig = {
  apiKey: "AIzaSyB2-_8rvA7QEyVAObbYY5-vsRd8eLojoRs",
  authDomain: "mlauncher-auth.firebaseapp.com",
  projectId: "mlauncher-auth",
  storageBucket: "mlauncher-auth.firebasestorage.app",
  messagingSenderId: "652068898522",
  appId: "1:652068898522:web:7fbdf55afb2940fbbf87e3",
  measurementId: "G-NSE6FE8B8D",
};
