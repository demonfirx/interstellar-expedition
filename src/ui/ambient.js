/** Locally synthesized ambience. No network audio or autoplay. */
export function createAmbientSound() {
  let context,
    master,
    oscillators = [],
    enabled = false;
  return {
    async toggle() {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error("Audio tidak didukung browser ini.");
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        for (const [i, freq] of [55, 82.4069, 110, 164.8138, 220].entries()) {
          const osc = context.createOscillator(),
            gain = context.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          osc.detune.value = (i % 2 ? 1 : -1) * 3;
          gain.gain.value = i < 2 ? 0.075 : 0.018;
          osc.connect(gain);
          gain.connect(master);
          osc.start();
          oscillators.push(osc);
        }
      }
      await context.resume();
      enabled = !enabled;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(
        enabled ? 0.55 : 0,
        context.currentTime,
        0.35,
      );
      return enabled;
    },
    async suspend() {
      if (context) await context.suspend();
    },
    async resume() {
      if (context && enabled) await context.resume();
    },
    dispose() {
      oscillators.forEach((o) => o.stop());
      context?.close();
    },
  };
}
