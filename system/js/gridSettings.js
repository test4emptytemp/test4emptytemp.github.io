"use strict";

/* ==========================================================
   Asset Grid Settings
   ----------------------------------------------------------
   Replaces the old single hard breakpoint (5 cols -> 2 cols
   at 800px) with a smoothly graduated, container-width-aware
   column/image-size calculation. This fixes the "looks
   terrible when you ctrl +/- zoom" issue, since browser page
   zoom changes the effective CSS width available to each
   grid container, which we now react to continuously via
   ResizeObserver instead of jumping between two fixed states.

   Also exposes window.WS_Grid = { setPerRow(n), reset() } so
   the Settings page can let a user pin a specific number of
   assets per row. The override is persisted in localStorage
   under "assetsPerRow"; a null/absent value means "auto"
   (the responsive default).
   ========================================================== */

const WS_GRID_SELECTORS = [
  "#container",
  "#container-discov",
  "#favorites-container",
  "#dev-build-container",
];

const WS_GRID_KEY = "assetsPerRow";
const WS_GRID_MIN = 1;
const WS_GRID_MAX = 8;
const WS_GRID_DEFAULT_MAX_COLS = 6; // cap for auto/responsive mode
const WS_GRID_GAP = 15;
const WS_GRID_PAD = 20;
const WS_GRID_TARGET_CARD = 220; // desired card width when auto-sizing

function _getOverride() {
  const raw = localStorage.getItem(WS_GRID_KEY);
  if (raw === null || raw === "") return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(WS_GRID_MIN, Math.min(WS_GRID_MAX, n));
}

function _computeAutoColumns(width) {
  const cols = Math.round((width + WS_GRID_GAP) / (WS_GRID_TARGET_CARD + WS_GRID_GAP));
  return Math.max(1, Math.min(WS_GRID_DEFAULT_MAX_COLS, cols));
}

function _applyToContainer(el) {
  if (!el) return;
  const width = el.clientWidth || el.getBoundingClientRect().width;
  if (!width) return;

  const override = _getOverride();
  const cols = override || _computeAutoColumns(width);

  const cardWidth = (width - WS_GRID_PAD * 2 - WS_GRID_GAP * (cols - 1)) / cols;
  const imgSize = Math.max(56, Math.min(260, Math.round(cardWidth * 0.72)));
  const cardSize = Math.max(90, Math.round(cardWidth));

  el.style.setProperty("--assets-per-row", String(cols));
  el.style.setProperty("--asset-img-size", imgSize + "px");
  el.style.setProperty("--asset-card-size", cardSize + "px");
}

function _findContainers() {
  return WS_GRID_SELECTORS
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
}

function applyGridSettings() {
  _findContainers().forEach(_applyToContainer);
}

function _observeContainers() {
  const containers = _findContainers();
  if (!containers.length) return;

  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => applyGridSettings());
    containers.forEach((el) => ro.observe(el));
  }

  // Belt-and-suspenders for browsers/edge-cases where ResizeObserver
  // doesn't fire on a pure page-zoom change.
  window.addEventListener("resize", applyGridSettings);

  applyGridSettings();
}

/* ── public API for the Settings page ─────────────────────── */
window.WS_Grid = {
  getOverride: _getOverride,
  setPerRow(n) {
    const clamped = Math.max(WS_GRID_MIN, Math.min(WS_GRID_MAX, parseInt(n, 10) || WS_GRID_MIN));
    localStorage.setItem(WS_GRID_KEY, String(clamped));
    applyGridSettings();
    return clamped;
  },
  reset() {
    localStorage.removeItem(WS_GRID_KEY);
    applyGridSettings();
  },
  refresh: applyGridSettings,
};

/* ── init ──────────────────────────────────────────────────── */
function _init() {
  _observeContainers();

  // The asset grid is populated asynchronously (fetch + render), so
  // containers may not exist yet, or may still be empty (clientWidth
  // can be 0 before content lays out). Re-apply a few times shortly
  // after load to catch that, on top of the ResizeObserver.
  let tries = 0;
  const retry = setInterval(() => {
    applyGridSettings();
    if (++tries >= 10) clearInterval(retry);
  }, 300);

  /* ── Settings page wiring ── */
  const perRowInput  = document.getElementById("assetsPerRowInput");
  const perRowValue  = document.getElementById("assetsPerRowValue");
  const resetBtn     = document.getElementById("assetsPerRowReset");
  if (!perRowInput && !resetBtn) return;

  const current = _getOverride();
  if (perRowInput) {
    perRowInput.value = current || perRowInput.value || 5;
    if (perRowValue) {
      perRowValue.textContent = current ? String(current) : "Auto (default)";
    }
    perRowInput.addEventListener("input", () => {
      const val = window.WS_Grid.setPerRow(perRowInput.value);
      if (perRowValue) perRowValue.textContent = String(val);
      applyGridSettings();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      window.WS_Grid.reset();
      if (perRowInput) perRowInput.value = 5;
      if (perRowValue) perRowValue.textContent = "Auto (default)";
      if (typeof showToast === "function") showToast("Assets-per-row reset to default.");
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", _init);
} else {
  _init();
}
