(() => {
  "use strict";

  const THEME_KEY = "calq-display-mode";
  const root = document.documentElement;
  const menu = document.getElementById("sideMenu");
  const menuToggle = document.getElementById("menuToggle");
  const backdrop = document.getElementById("menuBackdrop");
  const modeButtons = [...document.querySelectorAll("[data-mode]")];
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  function readMode() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return ["light", "dark", "auto"].includes(saved) ? saved : "auto";
    } catch {
      return "auto";
    }
  }

  function applyMode(mode, persist = true) {
    const resolved = mode === "auto"
      ? (systemTheme.matches ? "dark" : "light")
      : mode;

    root.dataset.theme = resolved;
    root.dataset.displayMode = mode;

    modeButtons.forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const themeColor = resolved === "dark" ? "#171717" : "#f4f4f4";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch {
        /* Storage may be unavailable for some file:// launchers. */
      }
    }
  }

  function openMenu() {
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    backdrop.hidden = true;
    document.body.style.overflow = "";
  }

  function setupDisclosure(buttonId, contentId) {
    const button = document.getElementById(buttonId);
    const content = document.getElementById(contentId);

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      content.hidden = expanded;
    });
  }

  menuToggle.addEventListener("click", () => {
    menu.classList.contains("is-open") ? closeMenu() : openMenu();
  });

  backdrop.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => applyMode(button.dataset.mode));
  });

  systemTheme.addEventListener?.("change", () => {
    if (readMode() === "auto") applyMode("auto", false);
  });

  setupDisclosure("settingsToggle", "settingsContent");

  // Settings starts collapsed. About is always visible.
  applyMode(readMode(), false);
})();