import { storage } from "./storage.js";
import { createNetworkMonitor } from "./network.js";
import { createBookmarkStore } from "./bookmarks.js";
import { createAccountStore } from "./accounts.js";
import { mountSkinPreview, loadSkinFile } from "./skin.js";
import { uiSound } from "./audio.js";
import { buildLaunchUrl } from "./versions.js";
import { renderNewsfeed } from "./newsfeed.js";
import { warmUpTarget } from "./wasm-warmup.js";

document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const statusInternetEl = $("status-internet");
  const statusPingPillEl = $("status-ping-pill");
  const statusMemoriEl = $("status-memori");
  const statusServerPingEl = $("status-server-ping");
  const btnPingServer = $("btn-ping-server");

  const skinPreviewEl = $("skin-preview");
  const skinDropzone = $("skin-dropzone");
  const skinFileInput = $("skin-file-input");

  const firebaseStatusEl = $("firebase-status");
  const firebaseLoginButtons = $("firebase-login-buttons");
  const btnFirebaseGoogle = $("btn-firebase-google");
  const btnFirebaseGuest = $("btn-firebase-guest");
  const btnFirebaseLogout = $("btn-firebase-logout");
  const firebaseWarningEl = $("firebase-warning");
  const usernameInput = $("username-input");

  const fullscreenToggle = $("fullscreen-toggle");
  const soundToggle = $("sound-toggle");

  const btnBukaSetting = $("btn-buka-setting");
  const passwordPrompt = $("password-prompt");
  const adminPasswordInput = $("admin-password");
  const passwordError = $("password-error");
  const btnSubmitPassword = $("btn-submit-password");
  const settingsSection = $("settings-section");

  const bookmarkSelect = $("bookmark-select");
  const bookmarkNameInput = $("bookmark-name");
  const urlUjianInput = $("url-ujian");
  const bookmarkFeedback = $("bookmark-feedback");
  const btnSimpan = $("btn-simpan");
  const btnTambahBookmark = $("btn-tambah-bookmark");
  const btnHapusBookmark = $("btn-hapus-bookmark");
  const ramSlider = $("ram-slider");
  const ramSliderValue = $("ram-slider-value");

  const modpackDropzone = $("modpack-dropzone");
  const modpackFileInput = $("modpack-file-input");
  const modpackListEl = $("modpack-list");

  const activityListEl = $("activity-list");
  const btnClearLog = $("btn-clear-log");

  const newsfeedEl = $("newsfeed");
  const storageWarning = $("storage-warning");
  const updateBanner = $("update-banner");
  const btnReloadUpdate = $("btn-reload-update");

  const btnMasuk = $("btn-masuk");
  const bottomBarServerSelect = $("bottom-bar-server-select");
  const bottomBarPlaySub = $("bottom-bar-play-sub");
  const bottomBarUsername = $("bottom-bar-username");
  const bottomBarPing = $("bottom-bar-ping");

  // ---------- STORAGE FALLBACK NOTICE ----------
  if (storage.isFallback()) storageWarning.style.display = "flex";

  // ---------- SOUND PREFERENCE ----------
  const SOUND_KEY = "m_launcher_sound";
  soundToggle.checked = storage.get(SOUND_KEY) !== "0";
  uiSound.setEnabled(soundToggle.checked);
  soundToggle.addEventListener("change", () => {
    uiSound.setEnabled(soundToggle.checked);
    storage.set(SOUND_KEY, soundToggle.checked ? "1" : "0");
  });

  // Any .btn click gets a light UI click sound, consistent with the rest
  // of the interface, without wiring it individually on every button.
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", () => uiSound.click());
  });

  // ---------- CONNECTIVITY ----------
  const netMonitor = createNetworkMonitor({
    onChange: ({ browserOnline, realOnline, latencyMs, checking }) => {
      if (checking) {
        statusInternetEl.textContent = "Memeriksa...";
        statusInternetEl.className = "status-value status-internet";
        return;
      }
      if (!browserOnline) {
        statusInternetEl.textContent = "Terputus";
        statusInternetEl.className = "status-value status-internet disconnected";
        statusPingPillEl.textContent = "Internet";
        return;
      }
      if (realOnline) {
        statusInternetEl.textContent = "Terhubung";
        statusInternetEl.className = "status-value status-internet connected";
        statusPingPillEl.textContent = latencyMs !== null ? `${latencyMs} ms` : "Internet";
      } else {
        statusInternetEl.textContent = "Terbatas";
        statusInternetEl.className = "status-value status-internet disconnected";
        statusPingPillEl.textContent = "Tanpa akses internet nyata";
      }
    },
  });
  netMonitor.start();

  async function pingActiveServer() {
    const active = bookmarkStore.getActive();
    statusServerPingEl.textContent = "Mengecek...";
    bottomBarPing.textContent = "...";
    const ms = await netMonitor.pingTarget(active.url);
    const text = ms !== null ? `${ms} ms` : "Tidak terjangkau";
    statusServerPingEl.textContent = text;
    bottomBarPing.textContent = text;
  }
  btnPingServer.addEventListener("click", pingActiveServer);

  // ---------- DEVICE MEMORY ----------
  function updateMemoryStatus() {
    if ("deviceMemory" in navigator) {
      statusMemoriEl.textContent = `~${navigator.deviceMemory} GB RAM`;
    } else if (performance && performance.memory) {
      const usedHeap = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(0);
      statusMemoriEl.textContent = `${usedHeap} MB Terpakai`;
    } else {
      statusMemoriEl.textContent = "Normal";
    }
  }
  updateMemoryStatus();

  // ---------- RAM SLIDER ----------
  // Pre-fills from navigator.deviceMemory as a sane default, capped to the
  // slider's 1-8 GB range; the user can still override it per server.
  if ("deviceMemory" in navigator) {
    ramSlider.value = Math.max(1, Math.min(8, Math.round(navigator.deviceMemory / 2) || 2));
  }
  function renderRamValue() {
    ramSliderValue.textContent = `${ramSlider.value} GB`;
  }
  ramSlider.addEventListener("input", renderRamValue);
  renderRamValue();

  // ---------- BOOKMARKS (multi-server + version profiles) ----------
  const bookmarkStore = createBookmarkStore({
    onExternalChange: () => {
      // Another browser tab changed the server list — reflect it here too.
      renderBookmarkOptions();
    },
  });

  function renderBookmarkOptions() {
    const active = bookmarkStore.getActive();
    const bookmarks = bookmarkStore.list();

    [bookmarkSelect, bottomBarServerSelect].forEach((select) => {
      select.innerHTML = "";
      bookmarks.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = b.name;
        if (b.id === active.id) opt.selected = true;
        select.appendChild(opt);
      });
    });

    urlUjianInput.value = active.url;
    bookmarkNameInput.value = active.name;
    ramSlider.value = active.ramGb || 2;
    renderRamValue();

    bottomBarPlaySub.textContent = active.name;
    statusServerPingEl.textContent = "\u2014";
    bottomBarPing.textContent = "\u2014";

    warmUpTarget(active.url);
  }
  renderBookmarkOptions();

  function handleServerSwitch(id) {
    bookmarkStore.setActive(id);
    renderBookmarkOptions();
  }
  bookmarkSelect.addEventListener("change", () => handleServerSwitch(bookmarkSelect.value));
  bottomBarServerSelect.addEventListener("change", () => handleServerSwitch(bottomBarServerSelect.value));

  function showBookmarkFeedback(message, isError = false) {
    bookmarkFeedback.textContent = message;
    bookmarkFeedback.style.color = isError ? "var(--danger)" : "#86efac";
    bookmarkFeedback.style.display = "block";
  }

  btnSimpan.addEventListener("click", () => {
    const active = bookmarkStore.getActive();
    const result = bookmarkStore.update(active.id, {
      name: bookmarkNameInput.value,
      url: urlUjianInput.value,
      ramGb: Number(ramSlider.value),
    });
    if (!result.ok) return showBookmarkFeedback(result.error, true);
    renderBookmarkOptions();
    showBookmarkFeedback("Server berhasil diperbarui.");
    logActivity("config", `Server "${result.bookmark.name}" diperbarui.`);
  });

  btnTambahBookmark.addEventListener("click", () => {
    const result = bookmarkStore.add({
      name: bookmarkNameInput.value || "Server Baru",
      url: urlUjianInput.value,
      ramGb: Number(ramSlider.value),
    });
    if (!result.ok) return showBookmarkFeedback(result.error, true);
    renderBookmarkOptions();
    showBookmarkFeedback(`Server "${result.bookmark.name}" ditambahkan.`);
    logActivity("config", `Server baru ditambahkan: "${result.bookmark.name}".`);
  });

  btnHapusBookmark.addEventListener("click", () => {
    const active = bookmarkStore.getActive();
    const result = bookmarkStore.remove(active.id);
    if (!result.ok) return showBookmarkFeedback(result.error, true);
    renderBookmarkOptions();
    showBookmarkFeedback("Server dihapus.");
    logActivity("config", `Server "${active.name}" dihapus.`);
  });

  // ---------- AKUN CLOUD (FIREBASE: Google / Tamu) ----------
  const accountStore = createAccountStore({
    onChange: (session) => renderFirebaseSession(session),
  });

  function renderFirebaseSession(session) {
    if (!session) {
      firebaseStatusEl.innerHTML = "Belum login.";
      firebaseLoginButtons.style.display = "flex";
      btnFirebaseLogout.style.display = "none";
      bottomBarUsername.textContent = usernameInput.value.trim() || "Tamu";
      return;
    }

    const avatar = session.photoURL ? `<img src="${session.photoURL}" alt="" />` : "";
    const label = session.isAnonymous ? "Tamu (sesi anonim)" : session.name;
    firebaseStatusEl.innerHTML = `${avatar}<span>Masuk sebagai <strong>${label}</strong></span>`;
    firebaseLoginButtons.style.display = "none";
    btnFirebaseLogout.style.display = "flex";

    // Only auto-fill the display name if the user hasn't typed a custom
    // one already, so switching accounts doesn't clobber a manual override.
    if (!usernameInput.dataset.manualEdit) {
      usernameInput.value = session.isAnonymous ? "" : session.name;
    }
    bottomBarUsername.textContent = usernameInput.value.trim() || label;

    if (session.skinDataUrl) {
      const img = new Image();
      img.onload = () => skinPreview.update(img);
      img.src = session.skinDataUrl;
    }
  }
  let firebaseWarningShown = false;

  accountStore.init().catch(() => {
    /* Firebase not configured yet — panel just stays in signed-out state */
  });
  renderFirebaseSession(null);

  function showFirebaseError(err) {
    firebaseWarningEl.textContent = err.message || "Gagal login. Coba lagi.";
    firebaseWarningEl.style.display = "block";
    firebaseWarningShown = true;
  }

  btnFirebaseGoogle.addEventListener("click", async () => {
    firebaseWarningEl.style.display = "none";
    try {
      const session = await accountStore.loginGoogle();
      logActivity("admin", `Login Google berhasil: ${session.name}.`);
    } catch (err) {
      showFirebaseError(err);
    }
  });

  btnFirebaseGuest.addEventListener("click", async () => {
    firebaseWarningEl.style.display = "none";
    try {
      await accountStore.loginGuest();
      logActivity("admin", "Masuk sebagai Tamu (anonim).");
    } catch (err) {
      showFirebaseError(err);
    }
  });

  btnFirebaseLogout.addEventListener("click", async () => {
    try {
      await accountStore.logout();
      logActivity("admin", "Keluar dari akun.");
    } catch (err) {
      showFirebaseError(err);
    }
  });

  usernameInput.addEventListener("input", () => {
    usernameInput.dataset.manualEdit = "1";
    bottomBarUsername.textContent = usernameInput.value.trim() || "Tamu";
  });

  // ---------- SKIN PREVIEW ----------
  const skinPreview = mountSkinPreview(skinPreviewEl, null);

  async function handleSkinFile(file) {
    try {
      const img = await loadSkinFile(file);
      skinPreview.update(img);
      const session = accountStore.getSession();
      if (session) {
        accountStore.updateSkin(img.src);
        logActivity("config", `Skin untuk "${session.name}" diperbarui.`);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  skinDropzone.addEventListener("click", () => skinFileInput.click());
  skinFileInput.addEventListener("change", () => {
    if (skinFileInput.files[0]) handleSkinFile(skinFileInput.files[0]);
  });
  ["dragover", "dragenter"].forEach((evt) =>
    skinDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      skinDropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    skinDropzone.addEventListener(evt, () => skinDropzone.classList.remove("dragover"))
  );
  skinDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleSkinFile(file);
  });

  // ---------- MODPACK / RESOURCE PACK DROPZONE ----------
  const MODPACK_META_KEY = "m_launcher_modpacks_v1";
  const MODPACK_EXTENSIONS = /\.(zip|jar|epk)$/i;

  function loadModpackMeta() {
    return storage.getJSON(MODPACK_META_KEY, []);
  }
  function saveModpackMeta(list) {
    storage.setJSON(MODPACK_META_KEY, list);
  }
  function formatSize(bytes) {
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  function renderModpackList() {
    const meta = loadModpackMeta();
    modpackListEl.innerHTML = "";
    if (!storage.blobs.available()) {
      modpackListEl.innerHTML = `<li>IndexedDB tidak tersedia di browser ini.</li>`;
      return;
    }
    if (!meta.length) {
      modpackListEl.innerHTML = `<li>Belum ada modpack/resource pack diunggah.</li>`;
      return;
    }
    meta.forEach((m) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${m.name} (${formatSize(m.size)})`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = "Hapus";
      removeBtn.addEventListener("click", async () => {
        await storage.blobs.delete(m.id);
        saveModpackMeta(loadModpackMeta().filter((x) => x.id !== m.id));
        renderModpackList();
        logActivity("config", `Modpack "${m.name}" dihapus.`);
      });
      li.appendChild(label);
      li.appendChild(removeBtn);
      modpackListEl.appendChild(li);
    });
  }
  renderModpackList();

  async function addModpackFile(file) {
    if (!MODPACK_EXTENSIONS.test(file.name)) {
      alert("Format tidak didukung. Gunakan .zip, .jar, atau .epk.");
      return;
    }
    const id = "mp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await storage.blobs.put(id, file);
    const meta = loadModpackMeta();
    meta.push({ id, name: file.name, size: file.size, addedAt: Date.now() });
    saveModpackMeta(meta);
    renderModpackList();
    logActivity("config", `Modpack "${file.name}" ditambahkan ke penyimpanan lokal.`);
  }

  modpackDropzone.addEventListener("click", () => modpackFileInput.click());
  modpackFileInput.addEventListener("change", () => {
    Array.from(modpackFileInput.files).forEach(addModpackFile);
  });
  ["dragover", "dragenter"].forEach((evt) =>
    modpackDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      modpackDropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    modpackDropzone.addEventListener(evt, () => modpackDropzone.classList.remove("dragover"))
  );
  modpackDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(addModpackFile);
  });

  // ---------- FULLSCREEN / KIOSK MODE ----------
  const FULLSCREEN_KEY = "m_launcher_fullscreen";
  fullscreenToggle.checked = storage.get(FULLSCREEN_KEY) === "1";
  fullscreenToggle.addEventListener("change", () => {
    storage.set(FULLSCREEN_KEY, fullscreenToggle.checked ? "1" : "0");
  });
  async function tryEnterFullscreen() {
    if (!fullscreenToggle.checked) return;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      /* denied/unsupported — non-critical, ignore */
    }
  }

  // ---------- NEWSFEED ----------
  renderNewsfeed(newsfeedEl);

  // ---------- ACTIVITY LOG (lazy-loaded with the admin panel) ----------
  let logModulePromise = null;
  function getLogModule() {
    if (!logModulePromise) logModulePromise = import("./log.js");
    return logModulePromise;
  }
  // No-ops until the admin panel has been opened at least once — this is
  // the tradeoff for not downloading log.js on initial page load.
  async function logActivity(type, message) {
    if (!logModulePromise) return;
    const { activityLog } = await getLogModule();
    activityLog.add(type, message);
    renderActivityLog();
  }
  async function renderActivityLog() {
    const { activityLog } = await getLogModule();
    const entries = activityLog.list();
    activityListEl.innerHTML = "";
    if (!entries.length) {
      activityListEl.innerHTML = `<li class="activity-empty">Belum ada aktivitas.</li>`;
      return;
    }
    entries.forEach((entry) => {
      const li = document.createElement("li");
      const time = new Date(entry.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
      li.innerHTML = `<span class="activity-time">${time}</span><span class="activity-msg">${entry.message}</span>`;
      activityListEl.appendChild(li);
    });
  }
  btnClearLog.addEventListener("click", async () => {
    const { activityLog } = await getLogModule();
    activityLog.clear();
    renderActivityLog();
  });

  // ---------- ADMIN PANEL (lazy-loaded auth.js on first open) ----------
  let authController = null;
  btnBukaSetting.addEventListener(
    "click",
    async () => {
      const [{ createAuthController }] = await Promise.all([import("./auth.js"), getLogModule()]);
      authController = createAuthController({
        els: { btnBukaSetting, passwordPrompt, adminPasswordInput, passwordError, btnSubmitPassword, settingsSection },
        onUnlocked: () => {
          uiSound.success();
          logActivity("admin", "Login admin berhasil.");
          renderBookmarkOptions();
        },
      });
      // This first click happened before auth.js's own listener existed —
      // replay it now so the password prompt actually opens.
      authController.toggle();
      renderActivityLog();
    },
    { once: true }
  );

  // ---------- MASUK KE GAME ----------
  btnMasuk.addEventListener("click", async () => {
    if (!navigator.onLine) {
      alert("Koneksi internet terputus! Harap hubungkan perangkat ke jaringan terlebih dahulu.");
      return;
    }
    const active = bookmarkStore.getActive();
    const username = usernameInput.value.trim();
    const targetUrl = buildLaunchUrl(active, { username, ramGb: Number(ramSlider.value) });

    logActivity("session", `Masuk ke server "${active.name}"${username ? ` sebagai ${username}` : ""}.`);
    uiSound.success();
    await tryEnterFullscreen();
    window.location.href = targetUrl;
  });

  // ---------- SERVICE WORKER (PWA / offline app shell + update banner) ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                updateBanner.style.display = "flex";
              }
            });
          });
        })
        .catch(() => {
          /* offline support is a progressive enhancement — ignore failures */
        });

      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    });
  }
  btnReloadUpdate.addEventListener("click", async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  });
});
