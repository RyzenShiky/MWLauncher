// accounts.js — player identity, backed by Firebase Authentication.
//
// This used to be a purely local "multi-profile" list (just names typed in
// by hand). It's now a thin session layer over Firebase: "Login dengan
// Google" or "Masuk sebagai Tamu" (anonymous auth) both produce a real
// Firebase user, and onAuthStateChanged is what keeps that session alive
// across reloads — Firebase itself persists the credential, this module
// just re-subscribes to it on boot. The only thing still kept in
// localStorage here is a per-uid skin image, since Firebase Auth doesn't
// have anywhere to put a custom Minecraft skin texture.

import { storage } from "./storage.js";
import {
  signInWithGoogle,
  signInAsGuest,
  signOutUser,
  watchAuthState,
  firebaseIsConfigured,
} from "./firebase-auth.js";

const SKIN_KEY_PREFIX = "m_launcher_skin_";

export function createAccountStore({ onChange } = {}) {
  let session = null; // null = signed out
  let unsubscribe = null;

  function emit() {
    if (onChange) onChange(getSession());
  }

  function getSession() {
    if (!session) return null;
    return {
      ...session,
      name: session.isAnonymous ? "Tamu" : session.displayName || session.email || "Pengguna",
      skinDataUrl: storage.get(SKIN_KEY_PREFIX + session.uid) || null,
    };
  }

  async function init() {
    if (!firebaseIsConfigured()) return; // no config yet — stay signed-out, silently
    unsubscribe = await watchAuthState((user) => {
      session = user;
      emit();
    });
  }

  async function loginGoogle() {
    session = await signInWithGoogle();
    emit();
    return getSession();
  }

  async function loginGuest() {
    session = await signInAsGuest();
    emit();
    return getSession();
  }

  async function logout() {
    await signOutUser();
    session = null;
    emit();
  }

  function updateSkin(skinDataUrl) {
    if (!session) return;
    storage.set(SKIN_KEY_PREFIX + session.uid, skinDataUrl);
    emit();
  }

  function destroy() {
    if (unsubscribe) unsubscribe();
  }

  return { init, loginGoogle, loginGuest, logout, updateSkin, getSession, destroy };
}
