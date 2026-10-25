// ============================================================================
// STELLAR VOYAGE — Public Audio Asset & Web Audio Engine
// Loads real public-domain / CC0 / CC-BY space music (.ogg/.mp3) & Kenney
// sci-fi sound effects (landing burn, high-pressure steam hiss, touchdown
// hydraulics, looping ion engine, warp jump, metallic footsteps) through a
// studio-grade Web Audio convolver reverb & dynamics compressor pipeline.
// ============================================================================

let ctx = null;
let masterGain = null;
let compressor = null;
let reverbNode = null;
let reverbSend = null;
let delayNode = null;
let delayFeedback = null;
let musicGain = null;
let sfxGain = null;

let isMuted = false;
let musicPlaying = false;

const sfxBuffers = {};
let sfxLoadingStarted = false;

// 5 Real Public Space Music Tracks (.ogg / .mp3)
const MUSIC_TRACKS = [
  "./assets/audio/music/shadows_and_dust.ogg",
  "./assets/audio/music/space_voyage.mp3",
  "./assets/audio/music/deep_orbit.ogg",
  "./assets/audio/music/launch_belt.ogg",
  "./assets/audio/music/project_utopia.ogg"
];

// 12 Real Public Kenney CC0 Sci-Fi & Landing/Steam SFX (.ogg)
const SFX_FILES = {
  engineLoop: "./assets/audio/sfx/engine_loop.ogg",
  steamHiss: "./assets/audio/sfx/steam_thruster_hiss.ogg",
  steamBurst: "./assets/audio/sfx/steam_vent_burst.ogg",
  landingBoom: "./assets/audio/sfx/landing_boom.ogg",
  touchdownThud: "./assets/audio/sfx/touchdown_thud.ogg",
  warpCharge: "./assets/audio/sfx/warp_charge.ogg",
  warpJump: "./assets/audio/sfx/warp_jump.ogg",
  warpTunnel: "./assets/audio/sfx/warp_tunnel.ogg",
  arriveChime: "./assets/audio/sfx/arrive_chime.ogg",
  stepMetal: "./assets/audio/sfx/step_metal.ogg",
  uiClick: "./assets/audio/sfx/ui_click.ogg",
  switchToggle: "./assets/audio/sfx/switch_toggle.ogg"
};

let currentTrackIndex = 0;
let musicAudioEl = null;
let musicMediaSource = null;

let engineSampleSource = null;
let engineSampleGain = null;
let engineSubOsc = null;
let engineSubGain = null;
let engineFilter = null;
let noiseBuffer = null;

function createImpulseResponse(duration = 3.2, decay = 2.4) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay);
      const early = i < rate * 0.06 ? Math.sin(i * 0.05) * 0.35 : 1.0;
      data[i] = (Math.random() * 2 - 1) * env * early;
    }
  }
  return impulse;
}

function createPinkNoiseBuffer() {
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
    b6 = white * 0.115926;
  }
  return buffer;
}

async function loadAllSfxBuffers() {
  if (sfxLoadingStarted || !ctx) return;
  sfxLoadingStarted = true;

  const entries = Object.entries(SFX_FILES);
  await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const arr = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arr);
        sfxBuffers[key] = decoded;
        if (key === "engineLoop" && !engineSampleSource && engineSampleGain) {
          startEngineLoopBuffer(decoded);
        }
      } catch (e) {}
    })
  );
}

function startEngineLoopBuffer(buffer) {
  if (!ctx || !buffer || engineSampleSource) return;
  try {
    engineSampleSource = ctx.createBufferSource();
    engineSampleSource.buffer = buffer;
    engineSampleSource.loop = true;
    engineSampleSource.playbackRate.value = 0.75;
    engineSampleSource.connect(engineFilter);
    engineSampleSource.start();
  } catch (e) {
    engineSampleSource = null;
  }
}

function playBuffer(key, { volume = 0.5, rate = 1.0, detune = 0, reverb = false, loop = false, duration = 0 } = {}) {
  if (!ctx || isMuted) return null;
  const buf = sfxBuffers[key];
  if (!buf) return null;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    if (detune) src.detune.value = detune;
    src.loop = loop;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    src.connect(gain);
    gain.connect(sfxGain);
    if (reverb && reverbSend) {
      gain.connect(reverbSend);
    }

    src.start();
    if (duration > 0) {
      gain.gain.setValueAtTime(volume, ctx.currentTime + Math.max(0.05, duration - 0.15));
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.stop(ctx.currentTime + duration + 0.02);
    }
    return {
      src,
      gain,
      stop: () => {
        try {
          gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
          src.stop(ctx.currentTime + 0.12);
        } catch (e) {}
      }
    };
  } catch (e) {
    return null;
  }
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    loadAllSfxBuffers();
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  ctx = new AudioCtx();

  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.2;

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.85;

  musicGain = ctx.createGain();
  musicGain.gain.value = 0.52;

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.85;

  reverbNode = ctx.createConvolver();
  reverbNode.buffer = createImpulseResponse(3.4, 2.3);
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.42;

  delayNode = ctx.createDelay(2.0);
  delayNode.delayTime.value = 0.42;
  delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.28;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 2200;

  delayNode.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(delayNode);

  musicGain.connect(compressor);
  musicGain.connect(reverbSend);

  sfxGain.connect(compressor);

  reverbSend.connect(reverbNode);
  reverbNode.connect(compressor);
  delayFilter.connect(compressor);

  compressor.connect(masterGain);
  masterGain.connect(ctx.destination);

  noiseBuffer = createPinkNoiseBuffer();

  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 180;
  engineFilter.Q.value = 2.0;

  engineSampleGain = ctx.createGain();
  engineSampleGain.gain.value = 0.001;

  engineSubOsc = ctx.createOscillator();
  engineSubOsc.type = "sawtooth";
  engineSubOsc.frequency.value = 42;

  engineSubGain = ctx.createGain();
  engineSubGain.gain.value = 0.001;

  engineSubOsc.connect(engineSubGain);
  engineSubGain.connect(engineFilter);
  engineFilter.connect(engineSampleGain);
  engineSampleGain.connect(sfxGain);

  engineSubOsc.start();

  musicAudioEl = new Audio();
  musicAudioEl.crossOrigin = "anonymous";
  musicAudioEl.preload = "auto";
  musicAudioEl.loop = false;
  musicAudioEl.src = MUSIC_TRACKS[currentTrackIndex];

  musicAudioEl.addEventListener("ended", () => {
    currentTrackIndex = (currentTrackIndex + 1) % MUSIC_TRACKS.length;
    musicAudioEl.src = MUSIC_TRACKS[currentTrackIndex];
    if (musicPlaying && !isMuted) {
      musicAudioEl.play().catch(() => {});
    }
  });

  try {
    musicMediaSource = ctx.createMediaElementSource(musicAudioEl);
    musicMediaSource.connect(musicGain);
  } catch (e) {}

  loadAllSfxBuffers();
}

export function startMusic(trackIdx = null) {
  initAudio();
  if (ctx && ctx.state === "suspended") ctx.resume();

  if (trackIdx !== null && trackIdx >= 0) {
    const nextIdx = trackIdx % MUSIC_TRACKS.length;
    if (nextIdx !== currentTrackIndex && musicAudioEl) {
      currentTrackIndex = nextIdx;
      musicAudioEl.src = MUSIC_TRACKS[currentTrackIndex];
    }
  }

  musicPlaying = true;
  if (ctx && musicGain && !isMuted) {
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setTargetAtTime(0.52, now, 0.4);
  }

  if (musicAudioEl && !isMuted) {
    musicAudioEl.volume = 0.85;
    musicAudioEl.play().catch(() => {});
  }
}

export function stopMusic() {
  musicPlaying = false;
  if (ctx && musicGain) {
    musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);
  }
  if (musicAudioEl) {
    try {
      musicAudioEl.pause();
    } catch (e) {}
  }
}

export function toggleMute() {
  initAudio();
  isMuted = !isMuted;
  masterGain.gain.setTargetAtTime(isMuted ? 0.0001 : 0.85, ctx.currentTime, 0.08);
  if (musicAudioEl) {
    if (isMuted) {
      musicAudioEl.pause();
    } else if (musicPlaying) {
      musicAudioEl.play().catch(() => {});
    }
  }
  return isMuted;
}

export function isAudioMuted() {
  return isMuted;
}

export function updateEngineSound(speedRatio, active = true) {
  if (!ctx || !engineSampleGain) return;
  const now = ctx.currentTime;
  if (!active) {
    engineSampleGain.gain.setTargetAtTime(0.0001, now, 0.15);
    return;
  }
  const clamped = Math.max(0, Math.min(1.5, speedRatio));
  const targetGain = 0.05 + clamped * 0.22;
  const targetFilter = 150 + clamped * 1050;

  engineSampleGain.gain.setTargetAtTime(targetGain, now, 0.08);
  engineSubGain.gain.setTargetAtTime(0.22 + clamped * 0.25, now, 0.08);
  engineSubOsc.frequency.setTargetAtTime(38 + clamped * 48, now, 0.08);
  engineFilter.frequency.setTargetAtTime(targetFilter, now, 0.08);

  if (engineSampleSource) {
    engineSampleSource.playbackRate.setTargetAtTime(0.7 + clamped * 0.65, now, 0.08);
  }
}

export function playClick() {
  initAudio();
  if (isMuted) return;
  if (playBuffer("uiClick", { volume: 0.45, rate: 1.05 })) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1100, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.055);
  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.065);
}

export function playSwitch() {
  initAudio();
  if (isMuted) return;
  if (playBuffer("switchToggle", { volume: 0.45, rate: 1.0 })) return;
  playClick();
}

export function playSteamSound(intensity = 0.85, duration = 2.6) {
  initAudio();
  if (isMuted) return;

  playBuffer("steamHiss", {
    volume: Math.min(0.88, 0.5 * intensity),
    rate: 0.82 + Math.random() * 0.22,
    reverb: true
  });
  playBuffer("steamBurst", {
    volume: Math.min(0.78, 0.42 * intensity),
    rate: 0.72 + Math.random() * 0.18,
    reverb: true
  });

  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650, now);
  filter.frequency.exponentialRampToValueAtTime(1600, now + duration * 0.35);
  filter.frequency.exponentialRampToValueAtTime(380, now + duration);
  filter.Q.value = 1.6;

  const gain = ctx.createGain();
  const peak = Math.min(0.42, 0.28 * intensity);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.18);
  gain.gain.setValueAtTime(peak * 0.85, now + duration * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  gain.connect(reverbSend);
  noise.start(now);
  noise.stop(now + duration + 0.05);
}

export function playTouchdownSound() {
  initAudio();
  if (isMuted) return;
  playBuffer("touchdownThud", { volume: 0.78, rate: 0.85, reverb: true });
  playBuffer("landingBoom", { volume: 0.55, rate: 0.75, reverb: true });
  playBuffer("stepMetal", { volume: 0.55, rate: 0.55, reverb: true });
  playSteamSound(1.0, 3.2);
}

export function playLandingGear(deploying = true) {
  initAudio();
  if (isMuted) return;

  playBuffer("stepMetal", { volume: 0.5, rate: deploying ? 0.65 : 0.8, reverb: true });
  playBuffer("steamHiss", { volume: 0.5, rate: deploying ? 0.9 : 1.1, reverb: true });
  if (deploying) {
    playSteamSound(0.75, 2.2);
  }

  const now = ctx.currentTime;
  const servo = ctx.createOscillator();
  const servoGain = ctx.createGain();
  servo.type = "sawtooth";
  servo.frequency.setValueAtTime(deploying ? 185 : 135, now);
  servo.frequency.linearRampToValueAtTime(deploying ? 128 : 195, now + 1.1);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 520;
  filter.Q.value = 3.5;

  servoGain.gain.setValueAtTime(0.001, now);
  servoGain.gain.linearRampToValueAtTime(0.075, now + 0.08);
  servoGain.gain.setValueAtTime(0.075, now + 0.95);
  servoGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

  servo.connect(filter);
  filter.connect(servoGain);
  servoGain.connect(sfxGain);
  servo.start(now);
  servo.stop(now + 1.3);
}

export function playFootstep(metallic = false) {
  initAudio();
  if (isMuted) return;

  if (metallic && playBuffer("stepMetal", { volume: 0.34, rate: 0.92 + Math.random() * 0.18 })) {
    return;
  }

  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = metallic ? "bandpass" : "lowpass";
  filter.frequency.value = metallic ? 640 + Math.random() * 180 : 320 + Math.random() * 120;
  filter.Q.value = metallic ? 4.5 : 1.2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(metallic ? 0.14 : 0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + (metallic ? 0.09 : 0.11));

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  noise.start(now);
  noise.stop(now + 0.12);
}

export function startWarpChargeSfx() {
  initAudio();
  if (isMuted) return { stop: () => {} };

  const bufHandle = playBuffer("warpCharge", { volume: 0.42, rate: 0.85, reverb: true, loop: true });
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(720, now + 2.4);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(240, now);
  filter.frequency.exponentialRampToValueAtTime(1800, now + 2.4);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 1.8);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  gain.connect(reverbSend);
  osc.start(now);

  return {
    stop: () => {
      if (bufHandle) bufHandle.stop();
      try {
        gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
        osc.stop(ctx.currentTime + 0.15);
      } catch (e) {}
    }
  };
}

export function playWarpBoom() {
  initAudio();
  if (isMuted) return;

  playBuffer("warpJump", { volume: 0.82, rate: 0.9, reverb: true });
  playBuffer("warpTunnel", { volume: 0.72, rate: 0.85, reverb: true });
  playBuffer("landingBoom", { volume: 0.65, rate: 0.75, reverb: true });

  const now = ctx.currentTime;
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(130, now);
  sub.frequency.exponentialRampToValueAtTime(24, now + 2.8);
  subGain.gain.setValueAtTime(0.55, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
  sub.connect(subGain);
  subGain.connect(sfxGain);
  sub.start(now);
  sub.stop(now + 3.1);
}

export function playWarpArrival() {
  initAudio();
  if (isMuted) return;

  playBuffer("arriveChime", { volume: 0.68, rate: 0.95, reverb: true });
  playBuffer("touchdownThud", { volume: 0.55, rate: 1.05, reverb: true });

  const now = ctx.currentTime;
  [220, 329.63, 440, 659.25].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + i * 0.05);
    gain.gain.setValueAtTime(0.001, now + i * 0.05);
    gain.gain.linearRampToValueAtTime(0.11, now + i * 0.05 + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.2);
    osc.connect(gain);
    gain.connect(sfxGain);
    gain.connect(reverbSend);
    osc.start(now + i * 0.05);
    osc.stop(now + 2.3);
  });
}

export function playSleepSound() {
  initAudio();
  if (isMuted) return;

  playBuffer("arriveChime", { volume: 0.48, rate: 0.72, reverb: true });

  const now = ctx.currentTime;
  // Warm dreamy major-9th lullaby pad chord
  [174.61, 220.0, 261.63, 329.63, 392.0].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.12);
    gain.gain.setValueAtTime(0.0005, now + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.085, now + i * 0.12 + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.4);
    osc.connect(gain);
    gain.connect(sfxGain);
    gain.connect(reverbSend);
    osc.start(now + i * 0.12);
    osc.stop(now + 3.5);
  });
}

export function playSplashSound(intensity = 0.75) {
  initAudio();
  if (isMuted) return;

  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(420, now);
  filter.frequency.exponentialRampToValueAtTime(980, now + 0.14);
  filter.frequency.exponentialRampToValueAtTime(240, now + 0.55);
  filter.Q.value = 2.2;

  const gain = ctx.createGain();
  const peak = Math.min(0.45, 0.28 * intensity);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  gain.connect(reverbSend);
  noise.start(now);
  noise.stop(now + 0.62);
}

const AudioEngine = {
  start: initAudio,
  startMusic,
  stopMusic,
  toggleMute,
  isAudioMuted,
  updateEngineHum: updateEngineSound,
  sfx: {
    click: playClick,
    switch: playSwitch,
    hydraulics: () => playLandingGear(true),
    steam: playSteamSound,
    touchdown: playTouchdownSound,
    warpCharge: startWarpChargeSfx,
    warpEngage: playWarpBoom,
    arrive: playWarpArrival,
    footstep: playFootstep,
    sleep: playSleepSound,
    splash: playSplashSound
  }
};

export default AudioEngine;
