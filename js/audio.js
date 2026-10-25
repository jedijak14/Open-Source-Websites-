/**
 * Stellar Voyage — Studio-Grade Procedural Web Audio Engine
 * Features algorithmic Convolver Reverb, Stereo Delay, Dynamics Compressor,
 * multi-voice detuned analog synth pads, bassline, arpeggiator, synthesized drums,
 * continuous thruster/reactor hum, hydraulic landing gear SFX, and footsteps.
 */

const Audio = (() => {
  let ctx = null;
  let started = false;
  let masterGain = null;
  let compressor = null;
  let musicGain = null;
  let sfxGain = null;
  let reverbNode = null;
  let delayNode = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let musicLoopId = null;

  const createImpulseResponse = (duration = 2.2, decay = 2.4) => {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  };

  const createNoiseBuffer = (duration = 1.0) => {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  };

  let noiseBuf = null;

  const ensure = () => {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ctx = new Ctx();
    }
    if (!compressor) {
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;

      masterGain = ctx.createGain();
      masterGain.gain.value = 0.72;
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      // Lush Hall Reverb
      reverbNode = ctx.createConvolver();
      reverbNode.buffer = createImpulseResponse(2.3, 2.5);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.34;
      reverbNode.connect(reverbGain);
      reverbGain.connect(compressor);

      // Stereo Echo Delay
      delayNode = ctx.createDelay(1.0);
      delayNode.delayTime.value = 0.35;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.32;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 2400;
      delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delayNode);
      delayFilter.connect(reverbNode);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.38;
      musicGain.connect(compressor);
      musicGain.connect(reverbNode);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.65;
      sfxGain.connect(compressor);
      sfxGain.connect(reverbNode);

      noiseBuf = createNoiseBuffer(2.0);

      // Continuous ship reactor / thruster drone
      engineOsc = ctx.createOscillator();
      engineOsc.type = "sawtooth";
      engineOsc.frequency.value = 48;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 120;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0001;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(compressor);
      engineOsc.start();
    }
    return true;
  };

  const start = () => {
    if (!ensure()) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    started = true;
  };

  const t = () => (ctx ? ctx.currentTime : 0);

  // Rich filtered dual-oscillator synth voice
  const playSynthVoice = (freq, dur, when, vel = 0.08, type1 = "sawtooth", type2 = "triangle", cutoff = 1800, detuneCents = 8) => {
    if (!ctx || !musicGain) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = type1;
    osc2.type = type2;
    osc1.frequency.setValueAtTime(freq, when);
    osc2.frequency.setValueAtTime(freq, when);
    osc1.detune.setValueAtTime(-detuneCents, when);
    osc2.detune.setValueAtTime(detuneCents, when);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff * 0.4, when);
    filter.frequency.exponentialRampToValueAtTime(cutoff, when + Math.min(0.25, dur * 0.3));
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.3, when + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + Math.min(0.08, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0005, when + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(g);
    g.connect(musicGain);
    if (dur < 0.6 && delayNode) {
      g.connect(delayNode);
    }

    osc1.start(when);
    osc2.start(when);
    osc1.stop(when + dur + 0.03);
    osc2.stop(when + dur + 0.03);
  };

  // Synthesized Kick & Hi-Hat
  const playKick = (when, vel = 0.14) => {
    if (!ctx || !musicGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(125, when);
    osc.frequency.exponentialRampToValueAtTime(34, when + 0.14);
    g.gain.setValueAtTime(vel, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    osc.connect(g);
    g.connect(compressor);
    osc.start(when);
    osc.stop(when + 0.26);
  };

  const playHat = (when, vel = 0.03) => {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(6500, when);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, when);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 0.06);
    src.connect(hp);
    hp.connect(g);
    g.connect(musicGain);
    src.start(when);
    src.stop(when + 0.07);
  };

  // ---------- Interstellar / Synthwave Dynamic Score ----------
  let barIndex = 0;

  const startMusic = () => {
    start();
    if (!ctx || !musicGain) return;
    musicGain.gain.setTargetAtTime(0.38, t(), 0.25);
    if (musicLoopId) return;

    // Epic sci-fi chord progression: Am9 -> Fmaj7 -> Cmaj7 -> G6 -> Dm9 -> Em7
    const chords = [
      { root: 110.0, notes: [220.0, 261.63, 329.63, 493.88] },   // Am9
      { root: 87.31, notes: [174.61, 220.0, 261.63, 329.63] },   // Fmaj7
      { root: 130.81, notes: [261.63, 329.63, 392.0, 493.88] },  // Cmaj7
      { root: 98.0, notes: [196.0, 246.94, 293.66, 329.63] },    // G6
      { root: 73.42, notes: [146.83, 174.61, 220.0, 329.63] },   // Dm9
      { root: 82.41, notes: [164.81, 196.0, 246.94, 293.66] }    // Em7
    ];

    const stepDuration = 0.22; // 16th note
    const barDuration = stepDuration * 8; // 1.76s per bar

    const scheduleBar = () => {
      if (!started || !ctx) {
        musicLoopId = null;
        return;
      }
      const now = t() + 0.03;
      const chord = chords[barIndex % chords.length];

      // 1. Lush analog pad chord swelling across the bar
      chord.notes.forEach((f, idx) => {
        playSynthVoice(f, barDuration * 1.05, now + idx * 0.03, 0.026, "sawtooth", "triangle", 1500, 11);
      });

      // 2. Deep pulsing synth bass + drums + crystalline arpeggio across 8 eighth/sixteenth steps
      for (let s = 0; s < 8; s++) {
        const st = now + s * stepDuration;
        // Rolling bass
        const bassFreq = s % 2 === 0 ? chord.root : chord.root * 0.5;
        playSynthVoice(bassFreq, stepDuration * 0.85, st, 0.052, "sawtooth", "sine", 520, 4);

        // Kick on 0 and 4, soft hat on off-beats
        if (s === 0 || s === 4) playKick(st, 0.11);
        if (s % 2 === 1) playHat(st, 0.022);

        // Shimmering space arpeggiator
        const arpNote = chord.notes[(s + barIndex) % chord.notes.length] * (s >= 4 ? 2 : 1);
        playSynthVoice(arpNote, stepDuration * 0.9, st, 0.032, "triangle", "sine", 3200, 6);
      }

      barIndex++;
      musicLoopId = setTimeout(scheduleBar, barDuration * 1000);
    };

    scheduleBar();
  };

  const stopMusic = () => {
    if (musicLoopId) {
      clearTimeout(musicLoopId);
      musicLoopId = null;
    }
    if (ctx && musicGain) {
      musicGain.gain.setTargetAtTime(0.0001, t(), 0.25);
    }
  };

  const setMusicVolume = (v) => {
    if (ctx && musicGain) {
      musicGain.gain.setTargetAtTime(Math.max(0.0001, v), t(), 0.2);
    }
  };

  const updateEngineHum = (thrust = 0, active = true) => {
    if (!started || !ctx || !engineGain) return;
    const now = t();
    if (!active) {
      engineGain.gain.setTargetAtTime(0.0001, now, 0.15);
      return;
    }
    const targetFreq = 46 + thrust * 95;
    const targetCutoff = 110 + thrust * 680;
    const targetGain = 0.018 + thrust * 0.065;
    engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
    engineFilter.frequency.setTargetAtTime(targetCutoff, now, 0.1);
    engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
  };

  // ---------- High-Impact Sci-Fi SFX ----------
  const sfx = {
    click: () => {
      if (!started || !ctx) return;
      const now = t();
      playSynthVoice(1046.5, 0.07, now, 0.09, "triangle", "sine", 4000, 3);
      playSynthVoice(1567.98, 0.09, now + 0.03, 0.07, "sine", "triangle", 4500, 3);
    },
    switch: () => {
      if (!started || !ctx) return;
      const now = t();
      playSynthVoice(520, 0.06, now, 0.1, "square", "triangle", 2200, 2);
      playSynthVoice(880, 0.08, now + 0.04, 0.09, "triangle", "sine", 3000, 2);
    },
    footstep: (onMetal = false) => {
      if (!started || !ctx || !noiseBuf) return;
      const now = t();
      if (onMetal) {
        // Metallic ship deck boot step
        playKick(now, 0.07);
        playSynthVoice(240 + Math.random() * 40, 0.06, now, 0.04, "triangle", "square", 1100, 15);
      } else {
        // Planetary soil crunch
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(900 + Math.random() * 300, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        src.connect(bp);
        bp.connect(g);
        g.connect(sfxGain);
        src.start(now);
        src.stop(now + 0.1);
      }
    },
    hydraulics: () => {
      if (!started || !ctx || !noiseBuf) return;
      const now = t();
      // Pneumatic hiss + mechanical servo sweep
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1600, now);
      bp.frequency.linearRampToValueAtTime(600, now + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      src.connect(bp);
      bp.connect(g);
      g.connect(sfxGain);
      src.start(now);
      src.stop(now + 1.0);

      // Servo motor whine
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(310, now + 0.45);
      osc.frequency.linearRampToValueAtTime(140, now + 0.9);
      og.gain.setValueAtTime(0.045, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(og);
      og.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.98);
    },
    warpCharge: () => {
      if (!started || !ctx) return null;
      const now = t();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc1.type = "sawtooth";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(85, now);
      osc1.frequency.exponentialRampToValueAtTime(920, now + 2.2);
      osc2.frequency.setValueAtTime(170, now);
      osc2.frequency.exponentialRampToValueAtTime(1840, now + 2.2);
      g.gain.setValueAtTime(0.04, now);
      g.gain.linearRampToValueAtTime(0.14, now + 2.0);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
      osc1.connect(g);
      osc2.connect(g);
      g.connect(sfxGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.65);
      osc2.stop(now + 2.65);
      return {
        stop: () => {
          try { osc1.stop(); osc2.stop(); } catch (e) {}
        }
      };
    },
    warpEngage: () => {
      if (!started || !ctx) return;
      const now = t();
      // Massive quantum fold sub-drop + hyperspace chord
      playKick(now, 0.28);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.85);
      osc.frequency.exponentialRampToValueAtTime(55, now + 4.4);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 4.5);
      osc.connect(g);
      g.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 4.55);

      [220, 329.63, 440, 554.37, 659.25].forEach((f, idx) => {
        playSynthVoice(f, 3.8, now + 0.15 + idx * 0.12, 0.065, "sawtooth", "triangle", 3500, 12);
      });
    },
    cutsceneBoom: () => {
      if (!started || !ctx) return;
      const now = t();
      playKick(now, 0.24);
      [110, 164.81, 220, 329.63].forEach((f, i) => {
        playSynthVoice(f, 2.2, now + i * 0.06, 0.06, "sawtooth", "triangle", 2200, 10);
      });
    },
    land: () => {
      if (!started || !ctx) return;
      const now = t();
      playKick(now, 0.22);
      playKick(now + 0.18, 0.16);
      sfx.hydraulics();
    },
    arrive: () => {
      if (!started || !ctx) return;
      const now = t();
      [261.63, 329.63, 392.0, 493.88, 587.33, 783.99].forEach((f, i) => {
        playSynthVoice(f, 1.1, now + i * 0.09, 0.075, "triangle", "sine", 3800, 8);
      });
    }
  };

  return { start, startMusic, stopMusic, setMusicVolume, updateEngineHum, sfx };
})();

export default Audio;
