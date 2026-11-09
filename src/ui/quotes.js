import { stepWordSpring } from "./quote-physics.js";

export const QUOTES = [
  "Small steps still carry you beyond the familiar.",
  "Be brave enough to begin again.",
  "Let your courage travel farther than your doubt.",
  "You can move forward before you feel ready.",
  "The next chapter begins with one small step.",
  "There is room for you beyond what you know.",
];

/** Original quotes, draggable words, and a quiet spring home. No animation runs while idle. */
export function createQuotePlayground(section, { reducedMotion = false } = {}) {
  const wordsElement = section.querySelector(".quote-words"),
    readable = section.querySelector(".quote-readable");
  const nextButton = section.querySelector('[data-quote-action="next"]'),
    scatterButton = section.querySelector('[data-quote-action="scatter"]'),
    resetButton = section.querySelector('[data-quote-action="reset"]');
  let words = [],
    index = 0,
    paused = reducedMotion,
    reduced = reducedMotion,
    drag = null,
    frame = 0,
    last = 0,
    disposed = false;
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
    const pointer = drag.pointer;
    drag.word.element.classList.remove("is-dragging");
    drag = null;
    if (wordsElement.hasPointerCapture(pointer))
      wordsElement.releasePointerCapture(pointer);
    if (reduced) reset();
    else schedule();
  }
  function reset() {
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
  function render() {
    reset();
    for (const word of words)
      word.element.getAnimations().forEach((a) => a.cancel());
    wordsElement.replaceChildren();
    readable.textContent = QUOTES[index];
    words = QUOTES[index].split(" ").map((text, i) => {
      const element = document.createElement("span");
      element.className = "quote-word";
      element.textContent = text;
      element.dataset.word = String(i);
      element.setAttribute("aria-hidden", "true");
      wordsElement.append(element, document.createTextNode(" "));
      if (!reduced && !paused)
        element.animate([{ opacity: 0.25 }, { opacity: 1 }], {
          duration: 450,
          delay: i * 32,
          easing: "cubic-bezier(.16,1,.3,1)",
          fill: "backwards",
        });
      return { element, x: 0, y: 0, vx: 0, vy: 0 };
    });
  }
  function next() {
    index = (index + 1) % QUOTES.length;
    render();
  }
  function scatter() {
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
    };
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
  }
  function keydown(event) {
    if (event.key === "Enter" || event.code === "Space") {
      event.preventDefault();
      scatter();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      reset();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else schedule();
  }
  wordsElement.addEventListener("pointerdown", down);
  wordsElement.addEventListener("pointermove", move);
  wordsElement.addEventListener("pointerup", release);
  wordsElement.addEventListener("pointercancel", release);
  wordsElement.addEventListener("lostpointercapture", release);
  wordsElement.addEventListener("keydown", keydown);
  nextButton.addEventListener("click", next);
  scatterButton.addEventListener("click", scatter);
  resetButton.addEventListener("click", reset);
  document.addEventListener("visibilitychange", visibility);
  render();
  return {
    setPaused(value) {
      paused = value;
      if (value) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
      for (const word of words)
        for (const animation of word.element.getAnimations())
          value ? animation.pause() : animation.play();
    },
    setReducedMotion(value) {
      reduced = value;
      if (value) reset();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      wordsElement.removeEventListener("pointerdown", down);
      wordsElement.removeEventListener("pointermove", move);
      wordsElement.removeEventListener("pointerup", release);
      wordsElement.removeEventListener("pointercancel", release);
      wordsElement.removeEventListener("lostpointercapture", release);
      wordsElement.removeEventListener("keydown", keydown);
      nextButton.removeEventListener("click", next);
      scatterButton.removeEventListener("click", scatter);
      resetButton.removeEventListener("click", reset);
      document.removeEventListener("visibilitychange", visibility);
      for (const word of words)
        word.element.getAnimations().forEach((a) => a.cancel());
    },
  };
}
