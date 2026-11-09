import { stepWordSpring } from "./quote-physics.js";
import { createQuoteCycle } from "./quote-cycle.js";
import { createQuoteDust } from "./quote-dust.js";

export const QUOTES = [
  "Small steps still carry you beyond the familiar.",
  "Be brave enough to begin again.",
  "Let your courage travel farther than your doubt.",
  "You can move forward before you feel ready.",
  "The next chapter begins with one small step.",
  "There is room for you beyond what you know.",
];

/** Ambient motion uses the scene clock; drag springs run only while words are moving. */
export function createQuotePlayground(
  section,
  { reducedMotion = false, onAutoPlayChange = () => {} } = {},
) {
  const wordsElement = section.querySelector(".quote-words"),
    readable = section.querySelector(".quote-readable"),
    driftElement = section.querySelector(".quote-drift");
  const nextButton = section.querySelector('[data-quote-action="next"]'),
    scatterButton = section.querySelector('[data-quote-action="scatter"]'),
    resetButton = section.querySelector('[data-quote-action="reset"]'),
    autoButton = section.querySelector('[data-quote-action="auto"]');
  const cycle = createQuoteCycle();
  const dust = createQuoteDust(section.parentElement, { reducedMotion });
  let words = [],
    index = 0,
    paused = reducedMotion,
    reduced = reducedMotion,
    drag = null,
    frame = 0,
    last = 0,
    disposed = false,
    autoEnabled = true,
    hovered = false,
    focused = false,
    transition = null,
    transitionAutomatic = false,
    generation = 0,
    previousWallTime = null,
    lastLightTime = -Infinity;
  function cancelTransition() {
    generation++;
    transition?.cancel();
    transition = null;
    transitionAutomatic = false;
  }
  function interact() {
    cycle.restart();
    cancelTransition();
  }
  function paint(word) {
    word.element.style.transform = `translate3d(${word.x.toFixed(2)}px,${word.y.toFixed(2)}px,0) rotate(${Math.max(-6, Math.min(6, word.x * 0.025 + word.vx * 0.008)).toFixed(2)}deg)`;
  }
  function schedule() {
    if (!frame && !disposed && !paused && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  function tick(now) {
    frame = 0;
    if (disposed || paused || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    let moving = false;
    for (const word of words) {
      if (word === drag?.word) {
        moving = true;
        continue;
      }
      if (
        Math.abs(word.x) +
          Math.abs(word.y) +
          Math.abs(word.vx) +
          Math.abs(word.vy) >
        0.08
      ) {
        stepWordSpring(word, dt);
        paint(word);
        moving = true;
      } else if (word.x || word.y) {
        word.x = word.y = word.vx = word.vy = 0;
        paint(word);
      }
    }
    if (moving) frame = requestAnimationFrame(tick);
  }
  function release() {
    if (!drag) return;
    dust.end();
    cycle.restart();
    const pointer = drag.pointer;
    drag.word.element.classList.remove("is-dragging");
    drag = null;
    if (wordsElement.hasPointerCapture(pointer))
      wordsElement.releasePointerCapture(pointer);
    if (reduced) reset();
    else schedule();
  }
  function reset() {
    dust.end();
    if (drag) {
      const pointer = drag.pointer;
      drag.word.element.classList.remove("is-dragging");
      drag = null;
      if (wordsElement.hasPointerCapture(pointer))
        wordsElement.releasePointerCapture(pointer);
    }
    for (const word of words) {
      word.x = word.y = word.vx = word.vy = 0;
      paint(word);
    }
  }
  function render(automatic = false) {
    reset();
    for (const word of words)
      word.element.getAnimations().forEach((a) => a.cancel());
    wordsElement.replaceChildren();
    readable.setAttribute("aria-live", automatic ? "off" : "polite");
    readable.textContent = QUOTES[index];
    words = QUOTES[index].split(" ").map((text, i) => {
      const element = document.createElement("span");
      element.className = "quote-word";
      element.textContent = text;
      element.dataset.word = String(i);
      element.setAttribute("aria-hidden", "true");
      wordsElement.append(element, document.createTextNode(" "));
      return { element, x: 0, y: 0, vx: 0, vy: 0 };
    });
  }
  function next(automatic = false) {
    cycle.restart();
    const opacity = getComputedStyle(wordsElement).opacity;
    cancelTransition();
    if (reduced || paused) {
      index = (index + 1) % QUOTES.length;
      render(automatic);
      return;
    }
    const token = generation;
    transitionAutomatic = automatic;
    transition = wordsElement.animate(
      [
        { opacity, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-5px)" },
      ],
      { duration: 350, easing: "ease-in-out", fill: "forwards" },
    );
    transition.finished
      .then(() => {
        if (disposed || token !== generation) return;
        index = (index + 1) % QUOTES.length;
        render(automatic);
        transition.cancel();
        transition = wordsElement.animate(
          [
            { opacity: 0, transform: "translateY(7px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 700, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" },
        );
        if (paused || document.hidden) transition.pause();
        transition.finished
          .then(() => {
            if (token !== generation) return;
            transition.cancel();
            transition = null;
            transitionAutomatic = false;
          })
          .catch(() => {});
      })
      .catch(() => {});
  }
  function manualNext() {
    next(false);
  }
  function scatter() {
    interact();
    release();
    if (reduced) {
      wordsElement.animate([{ opacity: 0.65 }, { opacity: 1 }], {
        duration: 100,
      });
      return;
    }
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      word.x = Math.sin(i * 2.4 + 1) * (22 + (i % 3) * 9);
      word.y = Math.cos(i * 1.7) * 24;
      word.vx = Math.cos(i * 2) * 25;
      word.vy = Math.sin(i * 3) * 22;
      paint(word);
    }
    schedule();
  }
  function down(event) {
    const element = event.target.closest(".quote-word");
    if (!element || event.button !== 0) return;
    interact();
    const word = words[Number(element.dataset.word)],
      rect = element.getBoundingClientRect();
    word.element.getAnimations().forEach((a) => a.finish());
    word.vx = word.vy = 0;
    drag = {
      word,
      pointer: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: word.x,
      y: word.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      left: rect.left - word.x,
      top: rect.top - word.y,
      width: rect.width,
      height: rect.height,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
    };
    dust.begin(event.clientX, event.clientY);
    word.element.classList.add("is-dragging");
    wordsElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function move(event) {
    if (!drag || event.pointerId !== drag.pointer) return;
    const now = performance.now(),
      dt = Math.max(0.008, (now - drag.lastTime) / 1000),
      word = drag.word;
    const limit = innerWidth < 600 ? 95 : 150;
    word.x = Math.max(
      Math.max(-limit, 10 - drag.left),
      Math.min(
        Math.min(limit, innerWidth - drag.left - drag.width - 10),
        drag.x + event.clientX - drag.startX,
      ),
    );
    word.y = Math.max(
      Math.max(-limit, 10 - drag.top),
      Math.min(
        Math.min(limit, innerHeight - drag.top - drag.height - 10),
        drag.y + event.clientY - drag.startY,
      ),
    );
    word.vx = Math.max(-320, Math.min(320, (event.clientX - drag.lastX) / dt));
    word.vy = Math.max(-320, Math.min(320, (event.clientY - drag.lastY) / dt));
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    paint(word);
    dust.trail(
      drag.left + word.x + drag.grabX,
      drag.top + word.y + drag.grabY,
      word.vx,
      word.vy,
      now,
    );
  }
  function keydown(event) {
    if (event.key === "Enter" || event.code === "Space") {
      event.preventDefault();
      scatter();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      resetWords();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      manualNext();
    }
  }
  function resetWords() {
    interact();
    reset();
  }
  function updateAutoButton() {
    const enabled = autoEnabled && !reduced;
    autoButton.disabled = reduced;
    autoButton.setAttribute("aria-pressed", String(enabled));
    autoButton.setAttribute(
      "aria-label",
      reduced
        ? "Automatic quotes paused for reduced motion"
        : enabled
          ? "Pause automatic quotes"
          : "Resume automatic quotes",
    );
    autoButton.title = enabled
      ? "Pause automatic quotes"
      : "Resume automatic quotes";
    autoButton.innerHTML = `<i data-lucide="${enabled ? "pause" : "play"}"></i>`;
    onAutoPlayChange();
  }
  function toggleAuto() {
    interact();
    autoEnabled = !autoEnabled;
    updateAutoButton();
  }
  function enter(event) {
    if (event.pointerType === "touch") return;
    hovered = true;
    if (transitionAutomatic) cancelTransition();
    cycle.restart();
  }
  function leave() {
    hovered = false;
    cycle.restart();
  }
  function focusin() {
    focused = true;
    if (transitionAutomatic) cancelTransition();
    cycle.restart();
  }
  function focusout(event) {
    focused = section.contains(event.relatedTarget);
    cycle.restart();
  }
  function visibility() {
    dust.setHidden(document.hidden);
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      transition?.pause();
    } else {
      previousWallTime = null;
      if (!paused) transition?.play();
      schedule();
    }
  }
  wordsElement.addEventListener("pointerdown", down);
  wordsElement.addEventListener("pointermove", move);
  wordsElement.addEventListener("pointerup", release);
  wordsElement.addEventListener("pointercancel", release);
  wordsElement.addEventListener("lostpointercapture", release);
  wordsElement.addEventListener("keydown", keydown);
  nextButton.addEventListener("click", manualNext);
  scatterButton.addEventListener("click", scatter);
  resetButton.addEventListener("click", resetWords);
  autoButton.addEventListener("click", toggleAuto);
  section.addEventListener("pointerenter", enter);
  section.addEventListener("pointerleave", leave);
  section.addEventListener("focusin", focusin);
  section.addEventListener("focusout", focusout);
  document.addEventListener("visibilitychange", visibility);
  render();
  updateAutoButton();
  return {
    updateAtmosphere(time, approach, blackHoleScreen) {
      dust.setAttractor(blackHoleScreen);
      const now = performance.now();
      const dt =
        previousWallTime === null
          ? 0
          : Math.max(0, (now - previousWallTime) / 1000);
      previousWallTime = now;
      if (disposed || paused || document.hidden || reduced) return;
      // Separate parent drift preserves each word's drag transform and pointer capture.
      driftElement.style.transform = `translate3d(${(Math.sin(time * 0.19) * 3).toFixed(2)}px,${(Math.sin(time * 0.27) * 6).toFixed(2)}px,0) rotate(${(Math.sin(time * 0.15) * 0.25).toFixed(3)}deg)`;
      // Small text-only paint area. The same scene phase and approach envelope light the craft.
      if (time - lastLightTime >= 1 / 15) {
        const gain = approach?.envelope ?? 0;
        section.style.setProperty(
          "--quote-light-position",
          `${(50 + 44 * Math.sin(time * 0.2 + 0.8)).toFixed(2)}%`,
        );
        section.style.setProperty(
          "--quote-blue-glow",
          (0.12 + 0.07 * Math.sin(time * 0.2 + 0.8) + gain * 0.06).toFixed(3),
        );
        section.style.setProperty(
          "--quote-warm-glow",
          (0.06 + 0.025 * Math.sin(time * 0.2 + 1.4) + gain * 0.025).toFixed(3),
        );
        lastLightTime = time;
      }
      const settling = words.some(
        (w) =>
          Math.abs(w.x) + Math.abs(w.y) + Math.abs(w.vx) + Math.abs(w.vy) >
          0.08,
      );
      if (
        cycle.advance(
          dt,
          !autoEnabled ||
            hovered ||
            focused ||
            !!drag ||
            !!transition ||
            settling,
        )
      )
        next(true);
    },
    setPaused(value) {
      paused = value;
      dust.setPaused(value);
      previousWallTime = null;
      if (value) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
      if (transition)
        value || document.hidden ? transition.pause() : transition.play();
      for (const word of words)
        for (const animation of word.element.getAnimations())
          value ? animation.pause() : animation.play();
    },
    setReducedMotion(value) {
      reduced = value;
      dust.setReducedMotion(value);
      if (value) {
        cancelTransition();
        reset();
        driftElement.style.transform = "none";
      }
      updateAutoButton();
    },
    dispose() {
      disposed = true;
      dust.dispose();
      cancelTransition();
      cancelAnimationFrame(frame);
      wordsElement.removeEventListener("pointerdown", down);
      wordsElement.removeEventListener("pointermove", move);
      wordsElement.removeEventListener("pointerup", release);
      wordsElement.removeEventListener("pointercancel", release);
      wordsElement.removeEventListener("lostpointercapture", release);
      wordsElement.removeEventListener("keydown", keydown);
      nextButton.removeEventListener("click", manualNext);
      scatterButton.removeEventListener("click", scatter);
      resetButton.removeEventListener("click", resetWords);
      autoButton.removeEventListener("click", toggleAuto);
      section.removeEventListener("pointerenter", enter);
      section.removeEventListener("pointerleave", leave);
      section.removeEventListener("focusin", focusin);
      section.removeEventListener("focusout", focusout);
      document.removeEventListener("visibilitychange", visibility);
      for (const word of words)
        word.element.getAnimations().forEach((a) => a.cancel());
    },
  };
}
