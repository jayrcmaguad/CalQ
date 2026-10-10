(() => {
  "use strict";

  const THEME_KEY = "calq-display-mode";
  const root = document.documentElement;
  const systemTheme = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

  function getMode() {
    try {
      const mode = localStorage.getItem(THEME_KEY);

      return ["light", "dark", "auto"].includes(mode)
        ? mode
        : "auto";
    } catch (error) {
      return "auto";
    }
  }

  function applyTheme() {
    const mode = getMode();

    const theme =
      mode === "auto"
        ? systemTheme.matches
          ? "dark"
          : "light"
        : mode;

    root.dataset.theme = theme;
    root.dataset.displayMode = mode;
    root.style.colorScheme = theme;

    window.dispatchEvent(
      new CustomEvent("calq-theme-change", {
        detail: { mode, theme }
      })
    );
  }

  function setTheme(mode) {
    if (!["light", "dark", "auto"].includes(mode)) {
      return;
    }

    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (error) {
      console.error(
        "CalQ could not save the theme preference.",
        error
      );
    }

    // Apply immediately in the current app.
    applyTheme();
  }

  // Make the function available to every app's theme selector.
  window.setCalQTheme = setTheme;

  // Apply the saved preference when the page loads.
  applyTheme();

  // Follow system appearance when Auto is selected.
  systemTheme.addEventListener("change", () => {
    if (getMode() === "auto") {
      applyTheme();
    }
  });

  // Synchronize changes from other pages sharing the same storage.
  window.addEventListener("storage", event => {
    if (event.key === THEME_KEY || event.key === null) {
      applyTheme();
    }
  });

  // Allow the current page to refresh its theme when needed.
  window.addEventListener("pageshow", applyTheme);
})();