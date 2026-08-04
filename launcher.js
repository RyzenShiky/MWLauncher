document.addEventListener("DOMContentLoaded", () => {
  // --- KONFIGURASI CONSTANT ---
  const DEFAULT_ADMIN_PASS = "pontianak67"; 
  const DEFAULT_GAME_URL = "https://ryzenshiky.github.io/Minecraft-Web/"; // URL Default Game

  // --- ELEMEN DOM ---
  const statusInternetEl = document.getElementById("status-internet");
  const statusMemoriEl = document.getElementById("status-memori");

  const btnMasuk = document.getElementById("btn-masuk");
  const btnBukaSetting = document.getElementById("btn-buka-setting");

  const passwordPrompt = document.getElementById("password-prompt");
  const adminPasswordInput = document.getElementById("admin-password");
  const passwordError = document.getElementById("password-error");
  const btnSubmitPassword = document.getElementById("btn-submit-password");

  const settingsSection = document.getElementById("settings-section");
  const urlUjianInput = document.getElementById("url-ujian");
  const btnSimpan = document.getElementById("btn-simpan");

  // --- 1. DETEKSI STATUS KONEKSI & MEMORI ---
  
  // Cek Status Internet
  function updateOnlineStatus() {
    if (navigator.onLine) {
      statusInternetEl.textContent = "Terhubung";
      statusInternetEl.className = "status-value status-internet connected";
    } else {
      statusInternetEl.textContent = "Terputus";
      statusInternetEl.className = "status-value status-internet disconnected";
    }
  }

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();

  // Cek RAM / Memori Perangkat
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

  // --- 2. MANAJEMEN URL GAME (LOCAL STORAGE) ---
  
  function loadGameUrl() {
    const savedUrl = localStorage.getItem("m_launcher_url");
    return savedUrl || DEFAULT_GAME_URL;
  }

  // Load URL ke input settings
  if (urlUjianInput) {
    urlUjianInput.value = loadGameUrl();
  }

  // Simpan URL Baru
  btnSimpan.addEventListener("click", () => {
    let newUrl = urlUjianInput.value.trim();

    if (!newUrl) {
      alert("Alamat URL tidak boleh kosong!");
      return;
    }

    // Auto-fix URL jika lupa menulis http/https
    if (!/^https?:\/\//i.test(newUrl)) {
      newUrl = "https://" + newUrl;
      urlUjianInput.value = newUrl;
    }

    localStorage.setItem("m_launcher_url", newUrl);
    alert("URL Game berhasil disimpan!");
    
    // Sembunyikan panel pengaturan setelah disimpan
    settingsSection.style.display = "none";
  });

  // --- 3. LOGIKA MASUK KE GAME ---
  
  btnMasuk.addEventListener("click", () => {
    if (!navigator.onLine) {
      alert("Koneksi internet terputus! Harap hubungkan perangkat ke jaringan terlebih dahulu.");
      return;
    }

    const gameUrl = loadGameUrl();
    window.location.href = gameUrl;
  });

  // --- 4. LOGIKA PANEL ADMIN & PASSWORD ---

  btnBukaSetting.addEventListener("click", () => {
    if (passwordPrompt.style.display === "none" && settingsSection.style.display === "none") {
      passwordPrompt.style.display = "block";
      adminPasswordInput.value = "";
      adminPasswordInput.focus();
      passwordError.style.display = "none";
    } else {
      passwordPrompt.style.display = "none";
      settingsSection.style.display = "none";
    }
  });

  function verifyPassword() {
    const enteredPassword = adminPasswordInput.value;

    if (enteredPassword === DEFAULT_ADMIN_PASS) {
      passwordError.style.display = "none";
      passwordPrompt.style.display = "none";
      settingsSection.style.display = "block";
    } else {
      passwordError.style.display = "block";
      adminPasswordInput.select();
    }
  }

  btnSubmitPassword.addEventListener("click", verifyPassword);

  adminPasswordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      verifyPassword();
    }
  });
});
