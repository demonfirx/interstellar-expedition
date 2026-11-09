/** Sparse drag dust makes a small orbital curl, then drifts toward the black hole. */
export function createQuoteDust(host, { reducedMotion = false } = {}) {
  const layer = document.createElement("div");
  layer.className = "quote-dust";
  layer.setAttribute("aria-hidden", "true");
  host.append(layer);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("quote-dust-trails");
  svg.setAttribute("aria-hidden", "true");
  layer.append(svg);
  const particles = new Set();
  const trails = new Set();
  let reduced = reducedMotion,
    paused = false,
    hidden = document.hidden,
    disposed = false,
    stroke = null,
    strokeId = 0,
    emissionId = 0;
  const attractor = { x: innerWidth * 0.66, y: innerHeight * 0.56 };

  function remove(particle) {
    removeTrail(particle);
    particles.delete(particle);
    particle.element.remove();
  }
  function removeTrail(particle) {
    const trail = particle.trail;
    if (!trail) return;
    particle.trail = null;
    trails.delete(trail);
    trail.animation.cancel();
    trail.path.remove();
  }
  function clear() {
    for (const particle of particles) {
      particle.animation.cancel();
      remove(particle);
    }
  }
  function syncPlayback() {
    for (const particle of particles)
      for (const animation of [particle.animation, particle.trail?.animation])
        if (animation) paused || hidden ? animation.pause() : animation.play();
  }
  function createTrail(particle, points, duration) {
    const compact = innerWidth < 600;
    if (
      !particle.trailCandidate ||
      points[0].opacity < 0.08 ||
      trails.size >= (compact ? 2 : 3)
    )
      return;
    let length = 0;
    const distances = points.map((point, i) => {
      if (i)
        length += Math.hypot(
          point.x - points[i - 1].x,
          point.y - points[i - 1].y,
        );
      return length;
    });
    if (length < 4) return;
    const tail = Math.min(compact ? 6 : 8, length * 0.38);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("quote-dust-trail");
    path.setAttribute(
      "d",
      points
        .map(
          (point, i) =>
            `${i ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
        )
        .join(" "),
    );
    path.setAttribute(
      "stroke",
      particle.element.style.getPropertyValue("--dust-core"),
    );
    path.setAttribute("stroke-width", compact ? "0.5" : "0.6");
    path.style.strokeDasharray = `${tail}px ${length + tail}px`;
    svg.append(path);
    const animation = path.animate(
      points.map((point, i) => ({
        strokeDashoffset: `${tail - distances[i]}px`,
        opacity:
          point.opacity *
          0.32 *
          Math.sin((Math.min(1, point.offset / 0.18) * Math.PI) / 2),
        offset: point.offset,
      })),
      { duration, easing: "linear", fill: "both" },
    );
    const trail = { path, animation };
    particle.trail = trail;
    trails.add(trail);
    const finish = () => {
      if (particle.trail === trail) removeTrail(particle);
    };
    animation.finished.then(finish, finish);
    if (paused || hidden) animation.pause();
  }
  function watch(particle, animation) {
    particle.animation = animation;
    const finish = () => {
      // A canceled drift must not remove the replacement attraction animation.
      if (particle.animation === animation) remove(particle);
    };
    animation.finished.then(finish, finish);
  }
  function opacityAt(progress) {
    if (progress <= 0.12) return (progress / 0.12) * 0.5;
    if (progress <= 0.55) return 0.5 - ((progress - 0.12) / 0.43) * 0.27;
    return Math.max(0, ((1 - progress) / 0.45) * 0.23);
  }
  function scaleAt(progress) {
    if (progress <= 0.12) return 0.65 + (progress / 0.12) * 0.35;
    if (progress <= 0.55) return 1 - ((progress - 0.12) / 0.43) * 0.2;
    return 0.8 - ((progress - 0.55) / 0.45) * 0.55;
  }
  function attract(particle) {
    const elapsed = Number(particle.animation.currentTime) || 0;
    const remaining = particle.duration - elapsed;
    if (remaining <= 100) return;
    const progress = Math.min(1, elapsed / particle.duration);
    const x = particle.startX + particle.driftX * progress;
    const y = particle.startY + particle.driftY * progress;
    const dx = attractor.x - x,
      dy = attractor.y - y,
      distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    const duration = Math.min(2200, remaining);
    const reach = Math.min(distance * 0.09, 48, 8 + (duration / 1000) * 13);
    const tangentX = particle.driftX * (duration / particle.duration);
    const tangentY = particle.driftY * (duration / particle.duration);
    const opacity = opacityAt(progress),
      scale = scaleAt(progress);
    const keyframes = [],
      points = [];
    for (let i = 0; i <= 24; i++) {
      const s = i / 24;
      // Preserve the incoming tangent. A small, tapered curl leads into the inward pull.
      const coast = s - s * s * 0.5;
      const orbitTime = Math.min(1, s / 0.72);
      const angle =
        orbitTime * orbitTime * (3 - 2 * orbitTime) * Math.PI * 1.35;
      const envelope = Math.pow(Math.sin(Math.PI * orbitTime), 2);
      const curlSide = particle.orbitRadius * Math.sin(angle) * envelope;
      const curlIn =
        particle.orbitRadius * (1 - Math.cos(angle)) * envelope * 0.4;
      const pull = Math.max(0, (s - 0.22) / 0.78);
      const inward = reach * pull * pull + curlIn;
      const px =
        x +
        tangentX * coast +
        (dx / distance) * inward -
        (dy / distance) * curlSide;
      const py =
        y +
        tangentY * coast +
        (dy / distance) * inward +
        (dx / distance) * curlSide;
      const fade = opacity * Math.pow(1 - s, 1.35);
      points.push({ x: px, y: py, offset: s, opacity: fade });
      keyframes.push({
        transform: `translate3d(${px.toFixed(2)}px,${py.toFixed(2)}px,0) scale(${(scale * (1 - 0.75 * s)).toFixed(4)})`,
        opacity: fade,
        offset: s,
      });
    }
    particle.animation.cancel();
    const animation = particle.element.animate(keyframes, {
      duration,
      easing: "linear",
      fill: "both",
    });
    particle.element.dataset.phase = "attracted";
    watch(particle, animation);
    createTrail(particle, points, duration);
    if (paused || hidden) animation.pause();
  }
  return {
    begin(x, y) {
      stroke = { id: ++strokeId, x, y, distance: 0, lastEmission: -Infinity };
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
      const duration = 2100 + Math.random() * 700;
      element.dataset.phase = "drifting";
      const animation = element.animate(
        [
          { transform: transform(0, 0.65), opacity: 0, offset: 0 },
          { transform: transform(0.12, 1), opacity: 0.5, offset: 0.12 },
          { transform: transform(0.55, 0.8), opacity: 0.23, offset: 0.55 },
          { transform: transform(1, 0.25), opacity: 0, offset: 1 },
        ],
        {
          duration,
          easing: "linear",
          fill: "both",
        },
      );
      const particle = {
        element,
        animation,
        startX,
        startY,
        driftX,
        driftY,
        duration,
        strokeId: stroke.id,
        orbitRadius: compact ? 4 + Math.random() * 3 : 6 + Math.random() * 4,
        trailCandidate: ++emissionId % 2 === 0,
      };
      particles.add(particle);
      watch(particle, animation);
    },
    end() {
      if (!stroke) return;
      const released = stroke.id;
      stroke = null;
      if (disposed || reduced) return;
      for (const particle of particles)
        if (particle.strokeId === released) attract(particle);
    },
    setAttractor(point) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
        return;
      attractor.x = point.x;
      attractor.y = point.y;
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
