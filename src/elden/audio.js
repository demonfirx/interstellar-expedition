export function createAudioEngine() {
  let ctx = null;
  let muted = false;
  let droneGain = null;

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function startAmbient() {
    const c = ensureContext();
    if (!c || droneGain) return;

    droneGain = c.createGain();
    droneGain.gain.value = muted ? 0 : 0.08;
    droneGain.connect(c.destination);

    // Dark gothic choral drone (D1 + A1 + F2)
    [73.42, 110.0, 174.61].forEach((freq, i) => {
      const osc = c.createOscillator();
      const filter = c.createBiquadFilter();
      osc.type = i === 0 ? "sawtooth" : "triangle";
      osc.frequency.value = freq;
      filter.type = "lowpass";
      filter.frequency.value = 260;
      osc.connect(filter);
      filter.connect(droneGain);
      osc.start();
    });
  }

  function playTone(freq, endFreq, duration, type = "sawtooth", volume = 0.14) {
    if (muted) return;
    const c = ensureContext();
    if (!c) return;

    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  return {
    startAmbient,
    toggleMute() {
      muted = !muted;
      if (droneGain) droneGain.gain.value = muted ? 0 : 0.08;
      return muted;
    },
    playSwing(heavy) {
      playTone(heavy ? 180 : 260, 65, heavy ? 0.24 : 0.15, "triangle", 0.12);
    },
    playHit(critical = false) {
      playTone(critical ? 420 : 210, 48, critical ? 0.32 : 0.18, "sawtooth", 0.18);
    },
    playParry() {
      playTone(980, 520, 0.28, "sine", 0.2);
      playTone(1480, 880, 0.22, "triangle", 0.12);
    },
    playBlock() {
      playTone(320, 140, 0.14, "square", 0.12);
    },
    playRoll() {
      playTone(140, 70, 0.16, "sine", 0.08);
    },
    playHeal() {
      playTone(440, 660, 0.35, "sine", 0.12);
    },
    playShockwave() {
      playTone(95, 28, 0.48, "sawtooth", 0.22);
    },
    playPhase2() {
      playTone(110, 42, 1.1, "sawtooth", 0.24);
      playTone(220, 165, 0.9, "triangle", 0.16);
    },
    playVictory() {
      playTone(293.66, 440, 0.8, "triangle", 0.16);
      setTimeout(() => playTone(587.33, 587.33, 1.2, "sine", 0.14), 220);
    },
    playDefeat() {
      playTone(146.83, 65, 1.2, "sawtooth", 0.18);
    },
    playGraceChime() {
      playTone(587.33, 587.33, 0.9, "sine", 0.11);
      setTimeout(() => playTone(880.0, 880.0, 1.1, "sine", 0.09), 140);
      setTimeout(() => playTone(1174.66, 1174.66, 1.3, "triangle", 0.07), 290);
    },
    playMistTraverse() {
      playTone(196.0, 92.0, 0.95, "triangle", 0.16);
      setTimeout(() => playTone(392.0, 293.66, 0.85, "sine", 0.1), 120);
    },
  };
}
