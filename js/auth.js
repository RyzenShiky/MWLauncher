// auth.js — admin panel gate
// Fixes two original bugs by keeping ONE source of truth for which panel is
// visible ("closed" | "password" | "settings") instead of reading two DOM
// elements' inline styles and assuming they're always in sync. The password
// input/error are also explicitly reset on every open, not just on success.

const DEFAULT_ADMIN_PASS = "pontianak67";

export function createAuthController({ els, onUnlocked }) {
  let view = "closed";

  function render() {
    els.passwordPrompt.style.display = view === "password" ? "block" : "none";
    els.settingsSection.style.display = view === "settings" ? "block" : "none";

    if (view === "password") {
      els.adminPasswordInput.value = "";
      els.passwordError.style.display = "none";
      els.adminPasswordInput.focus();
    }
  }

  function toggle() {
    view = view === "closed" ? "password" : "closed";
    render();
  }

  function verify() {
    const entered = els.adminPasswordInput.value;
    if (entered === DEFAULT_ADMIN_PASS) {
      view = "settings";
      render();
      if (onUnlocked) onUnlocked();
    } else {
      els.passwordError.style.display = "block";
      els.adminPasswordInput.select();
    }
  }

  function closeAll() {
    view = "closed";
    render();
  }

  els.btnBukaSetting.addEventListener("click", toggle);
  els.btnSubmitPassword.addEventListener("click", verify);
  els.adminPasswordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") verify();
  });

  return { closeAll, toggle, getView: () => view };
}
