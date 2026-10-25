/**
 * Stellar Voyage — Full Visor & Flight HUD / Menu / Settings (with Controls Tab) / Sleep / Cutscene Controller
 */
import Audio from "./audio.js?v=8";

export const UI = (() => {
  const menu = document.getElementById("menu");
  const settings = document.getElementById("settings");
  const credits = document.getElementById("credits");
  const hud = document.getElementById("hud");
  const warpOverlay = document.getElementById("warp-overlay");
  const warpText = document.getElementById("warp-text");
  const warpSubtext = document.getElementById("warp-subtext");
  const hudInteract = document.getElementById("hud-interact");
  const underwaterOverlay = document.getElementById("underwater-overlay");
  const sleepOverlay = document.getElementById("sleep-overlay");
  const sleepTitle = document.getElementById("sleep-title");
  const sleepSubtext = document.getElementById("sleep-subtext");
  const sleepProgressFill = document.getElementById("sleep-progress-fill");

  const tabBtnGeneral = document.getElementById("tab-btn-general");
  const tabBtnControls = document.getElementById("tab-btn-controls");
  const panelGeneral = document.getElementById("settings-panel-general");
  const panelControls = document.getElementById("settings-panel-controls");
  const btnToggleMute = document.getElementById("btn-toggle-mute");

  const callbacks = {};

  const show = (el) => {
    if (el) el.classList.remove("hidden");
  };
  const hide = (el) => {
    if (el) el.classList.add("hidden");
  };

  const setSettingsTab = (tab = "general") => {
    if (tab === "controls") {
      if (tabBtnControls) tabBtnControls.classList.add("active");
      if (tabBtnGeneral) tabBtnGeneral.classList.remove("active");
      show(panelControls);
      hide(panelGeneral);
    } else {
      if (tabBtnGeneral) tabBtnGeneral.classList.add("active");
      if (tabBtnControls) tabBtnControls.classList.remove("active");
      show(panelGeneral);
      hide(panelControls);
    }
  };

  const showMenu = () => {
    show(menu);
    hide(settings);
    hide(hud);
    hide(credits);
    hide(warpOverlay);
    hide(sleepOverlay);
  };
  const hideMenu = () => {
    hide(menu);
  };
  const showSettings = (defaultTab = "general") => {
    setSettingsTab(defaultTab);
    show(settings);
    hide(menu);
    hide(hud);
    hide(credits);
    hide(warpOverlay);
    hide(sleepOverlay);
  };
  const hideSettings = () => {
    hide(settings);
  };
  const showCredits = () => {
    show(credits);
    hide(settings);
    hide(menu);
    hide(hud);
    hide(warpOverlay);
    hide(sleepOverlay);
  };
  const hideCredits = () => hide(credits);
  const showHUD = () => {
    show(hud);
    hide(settings);
    hide(menu);
    hide(credits);
    hide(warpOverlay);
    hide(sleepOverlay);
  };
  const hideHUD = () => hide(hud);

  const showWarp = (
    label = "ENGAGING WARP DRIVE",
    sublabel = "QUANTUM FOLD TELEMETRY ONLINE"
  ) => {
    if (warpText) warpText.textContent = label;
    if (warpSubtext) warpSubtext.textContent = sublabel;
    show(warpOverlay);
    hide(hud);
    hide(settings);
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

  const showSleep = (title, subtext, progressPct = 0) => {
    if (sleepTitle && title) sleepTitle.textContent = title;
    if (sleepSubtext && subtext) sleepSubtext.textContent = subtext;
    if (sleepProgressFill) {
      sleepProgressFill.style.width = `${Math.max(0, Math.min(100, progressPct))}%`;
    }
    show(sleepOverlay);
  };

  const hideSleep = () => {
    hide(sleepOverlay);
  };

  const setUnderwater = (active) => {
    if (active) show(underwaterOverlay);
    else hide(underwaterOverlay);
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
  bind("btn-planet", "planet");
  bind("btn-settings", "settings");
  bind("btn-credits", "credits");
  bind("btn-back-menu", "back");

  bind("hud-btn-settings", "settings");
  bind("hud-btn-menu", "hudMenu");
  bind("btn-close-settings", "closeSettings");
  bind("btn-settings-hull", "hudHull");
  bind("btn-settings-planet", "planet");

  if (tabBtnGeneral) {
    tabBtnGeneral.addEventListener("click", (e) => {
      e.stopPropagation();
      Audio.start();
      Audio.sfx.click();
      setSettingsTab("general");
    });
  }
  if (tabBtnControls) {
    tabBtnControls.addEventListener("click", (e) => {
      e.stopPropagation();
      Audio.start();
      Audio.sfx.click();
      setSettingsTab("controls");
    });
  }
  if (btnToggleMute) {
    btnToggleMute.addEventListener("click", (e) => {
      e.stopPropagation();
      Audio.start();
      const muted = Audio.toggleMute();
      btnToggleMute.textContent = muted ? "🔇 Sound: OFF" : "🔊 Sound: ON";
    });
  }

  bind("hud-btn-warp", "hudWarp");
  bind("hud-btn-planet", "planet");
  bind("hud-btn-land", "hudLand");
  bind("hud-btn-ship-walk", "hudShipWalk");
  bind("hud-btn-sleep", "hudSleep");
  bind("hud-btn-foot", "hudFoot");
  bind("hud-btn-hull", "hudHull");
  bind("hud-btn-cam", "hudCam");

  const updateSaveState = (hasSave) => {
    const c = document.getElementById("btn-continue");
    const l = document.getElementById("btn-load");
    if (c) {
      c.disabled = !hasSave;
      c.style.opacity = hasSave ? "1" : "0.45";
    }
    if (l) {
      l.disabled = !hasSave;
      l.style.opacity = hasSave ? "1" : "0.45";
    }
  };

  const setWarpMeter = (pct) => {
    const fill = document.getElementById("warp-meter-fill");
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
  };

  const setStamina = (pct) => {
    const fill = document.getElementById("stamina-meter-fill");
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
  };

  const setWarpStatus = (txt) => {
    const el = document.getElementById("warp-status");
    if (el) el.textContent = txt;
  };

  const setSpeed = (v, unit = "km/s") => {
    const el = document.getElementById("hud-speed");
    const uEl = document.getElementById("hud-speed-unit");
    if (el) el.textContent = Math.round(v).toLocaleString();
    if (uEl) uEl.textContent = unit;
  };

  const setAltitude = (altMeters, gForce = 1.0, submerged = false) => {
    const el = document.getElementById("hud-altitude");
    const uEl = document.getElementById("hud-alt-unit");
    if (el) {
      el.textContent =
        Math.abs(altMeters) >= 100
          ? Math.round(altMeters).toLocaleString()
          : altMeters.toFixed(1);
    }
    if (uEl) {
      uEl.textContent = submerged
        ? `m DEPTH • BUOYANT (${gForce.toFixed(2)} G)`
        : `m ASL • ${gForce.toFixed(2)} G`;
    }
  };

  const setHeading = (yawRad) => {
    const el = document.getElementById("hud-heading");
    if (!el) return;
    let deg = Math.round(((-yawRad * 180) / Math.PI) % 360);
    if (deg < 0) deg += 360;
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const dir = dirs[Math.round(deg / 45) % 8];
    el.textContent = `${String(deg).padStart(3, "0")}° ${dir}`;
  };

  const setGravity = (gVal) => {
    const el = document.getElementById("hud-gravity");
    if (el) el.textContent = `${Number(gVal).toFixed(2)} G`;
  };

  const setAtmos = (txt) => {
    const el = document.getElementById("hud-atmos");
    if (el) el.textContent = txt;
  };

  const setSolarTime = (hours) => {
    const el = document.getElementById("hud-solar-time");
    if (!el) return;
    const norm = ((hours % 24) + 24) % 24;
    const hh = Math.floor(norm);
    const mm = Math.floor((norm - hh) * 60);
    el.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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
  const setHelp = () => {};

  return {
    on: (k, fn) => {
      callbacks[k] = fn;
    },
    showMenu,
    hideMenu,
    showSettings,
    hideSettings,
    setSettingsTab,
    showCredits,
    hideCredits,
    showHUD,
    hideHUD,
    showWarp,
    setWarpSubtext,
    hideWarp,
    showSleep,
    hideSleep,
    setUnderwater,
    setInteractPrompt,
    updateSaveState,
    setWarpMeter,
    setStamina,
    setWarpStatus,
    setSpeed,
    setAltitude,
    setHeading,
    setGravity,
    setAtmos,
    setSolarTime,
    setCam,
    setFlightState,
    setSystem,
    setBiome,
    setHelp
  };
})();
