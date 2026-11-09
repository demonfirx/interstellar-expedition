/** A sparse drag trail. WAAPI owns the fade; no extra animation loop or timers. */
export function createQuoteDust(host, { reducedMotion = false } = {}) {
  const layer = document.createElement("div");
  layer.className = "quote-dust";
  layer.setAttribute("aria-hidden", "true");
  host.append(layer);
  const particles = new Set();
  let reduced = reducedMotion,
    paused = false,
    hidden = document.hidden,
    disposed = false,
    stroke = null;

  function remove(particle) {
    particles.delete(particle);
    particle.element.remove();
  }
  function clear() {
    for (const particle of particles) {
      particle.animation.cancel();
      remove(particle);
    }
  }
  function syncPlayback() {
    for (const { animation } of particles)
      paused || hidden ? animation.pause() : animation.play();
  }
  return {
    begin(x, y) {
      stroke = { x, y, distance: 0, lastEmission: -Infinity };
    },
    trail(x, y, vx, vy, now) {
      if (!stroke || disposed || reduced || paused || hidden) return;
      stroke.distance += Math.hypot(x - stroke.x, y - stroke.y);
      stroke.x = x;
      stroke.y = y;
      // Both distance and time gates prevent stationary sparkle or event-rate bursts.
      const compact = innerWidth < 600;
      if (
        stroke.distance < 9 ||
        now - stroke.lastEmission < (compact ? 145 : 115)
      )
        return;
      stroke.distance = 0;
      stroke.lastEmission = now;
      if (particles.size >= (compact ? 12 : 18)) return;

      const element = document.createElement("span");
      element.className = "quote-spark";
      const warm = Math.random() < 0.18;
      element.style.setProperty("--dust-core", warm ? "#f1dcce" : "#d1dbff");
      element.style.setProperty(
        "--dust-halo",
        warm ? "#d9ae8f42" : "#929deb52",
      );
      const size = 1.2 + Math.random() * 1.2;
      element.style.width = element.style.height = `${size.toFixed(2)}px`;
      layer.append(element);
      const startX = x + (Math.random() - 0.5) * 5;
      const startY = y + (Math.random() - 0.5) * 5;
      const driftX =
        9 + Math.random() * 17 + Math.max(-7, Math.min(7, vx * 0.035));
      const driftY =
        -15 - Math.random() * 18 + Math.max(-6, Math.min(6, vy * 0.025));
      const transform = (progress, scale) =>
        `translate3d(${(startX + driftX * progress).toFixed(2)}px,${(startY + driftY * progress).toFixed(2)}px,0) scale(${scale})`;
      const animation = element.animate(
        [
          { transform: transform(0, 0.65), opacity: 0, offset: 0 },
          { transform: transform(0.12, 1), opacity: 0.5, offset: 0.12 },
          { transform: transform(0.55, 0.8), opacity: 0.23, offset: 0.55 },
          { transform: transform(1, 0.25), opacity: 0, offset: 1 },
        ],
        {
          duration: 2100 + Math.random() * 700,
          easing: "linear",
          fill: "both",
        },
      );
      const particle = { element, animation };
      particles.add(particle);
      animation.finished.then(
        () => remove(particle),
        () => remove(particle),
      );
    },
    end() {
      stroke = null;
    },
    setPaused(value) {
      paused = value;
      syncPlayback();
    },
    setHidden(value) {
      hidden = value;
      stroke = null;
      syncPlayback();
    },
    setReducedMotion(value) {
      reduced = value;
      if (value) {
        stroke = null;
        clear();
      }
    },
    dispose() {
      disposed = true;
      stroke = null;
      clear();
      layer.remove();
    },
  };
}
