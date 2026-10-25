/**
 * Stellar Voyage — UI / Menu / HUD / Cutscene Overlay Controller
 */
import Audio from "./audio.js";

export const UI = (() => {
  const menu = document.getElementById("menu");
  const credits = document.getElementById("credits");
  const hud = document.getElementById("hud");
  const warpOverlay = document.getElementById("warp-overlay");
  const warpText = document.getElementById("warp-text");
  const warpSubtext = document.getElementById("warp-subtext");
  const hudInteract = document.getElementById("hud-interact");

  const callbacks = {};

  const show = (el) => { if (el) el.classList.remove("hidden"); };
  const hide = (el) => { if (el) el.classList.add("hidden"); };

  const showMenu = () => { show(menu); hide(hud); hide(credits); hide(warpOverlay); };
  const hideMenu = () => { hide(menu); };
  const showCredits = () => { show(credits); hide(menu); hide(hud); hide(warpOverlay); };
  const hideCredits = () => hide(credits);
  const showHUD = () => { show(hud); hide(menu); hide(credits); hide(warpOverlay); };
  const hideHUD = () => hide(hud);

  const showWarp = (label = "ENGAGING WARP DRIVE", sublabel = "QUANTUM FOLD TELEMETRY ONLINE") => {
    if (warpText) warpText.textContent = label;
    if (warpSubtext) warpSubtext.textContent = sublabel;
    show(warpOverlay);
    hide(hud);
    hide(menu);
    hide(credits);
  };
  const setWarpSubtext = (sublabel) => {
    if (warpSubtext) warpSubtext.textContent = sublabel;
  };
  const hideWarp = () => {
    hide(warpOverlay);
    show(hud);
  };

  const setInteractPrompt = (text = null) => {
    if (!hudInteract) return;
    if (text) {
      hudInteract.textContent = text;
      show(hudInteract);
    } else {
      hide(hudInteract);
    }
  };

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      Audio.start();
      Audio.sfx.click();
      if (callbacks[key]) callbacks[key]();
    });
  };

  bind("btn-start", "start");
  bind("btn-continue", "continue");
  bind("btn-load", "load");
  bind("btn-credits", "credits");
  bind("btn-back-menu", "back");

  bind("hud-btn-warp", "hudWarp");
  bind("hud-btn-land", "hudLand");
  bind("hud-btn-ship-walk", "hudShipWalk");
  bind("hud-btn-foot", "hudFoot");
  bind("hud-btn-cam", "hudCam");
  bind("hud-btn-menu", "hudMenu");

  const updateSaveState = (hasSave) => {
    const c = document.getElementById("btn-continue");
    const l = document.getElementById("btn-load");
    if (c) { c.disabled = !hasSave; c.style.opacity = hasSave ? "1" : "0.45"; }
    if (l) { l.disabled = !hasSave; l.style.opacity = hasSave ? "1" : "0.45"; }
  };

  const setWarpMeter = (pct) => {
    const fill = document.getElementById("warp-meter-fill");
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
  };
  const setWarpStatus = (txt) => {
    const el = document.getElementById("warp-status");
    if (el) el.textContent = txt;
  };
  const setSpeed = (v) => {
    const el = document.getElementById("hud-speed");
    if (el) el.textContent = Math.round(v).toLocaleString();
  };
  const setCam = (txt) => {
    const el = document.getElementById("hud-cam");
    if (el) el.textContent = txt;
  };
  const setFlightState = (txt) => {
    const el = document.getElementById("hud-flight-state");
    if (el) el.textContent = txt;
  };
  const setSystem = (txt) => {
    const el = document.getElementById("hud-system");
    if (el) el.textContent = txt;
  };
  const setBiome = (txt) => {
    const el = document.getElementById("hud-biome");
    if (el) el.textContent = txt;
  };
  const setHelp = (html) => {
    const el = document.getElementById("hud-help");
    if (el) el.innerHTML = html;
  };

  return {
    on: (k, fn) => { callbacks[k] = fn; },
    showMenu, hideMenu, showCredits, hideCredits, showHUD, hideHUD,
    showWarp, setWarpSubtext, hideWarp, setInteractPrompt, updateSaveState,
    setWarpMeter, setWarpStatus, setSpeed, setCam, setFlightState, setSystem, setBiome, setHelp
  };
})();
