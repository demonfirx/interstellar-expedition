import "./styles/main.css";
import {
  createIcons,
  Pause,
  Play,
  VolumeX,
  Volume2,
  Maximize,
  Minimize,
} from "lucide";
import { createCosmos } from "./scene/cosmos.js";
import { createAmbientSound } from "./ui/ambient.js";

const icons = { Pause, Play, VolumeX, Volume2, Maximize, Minimize };
const refreshIcons = () => createIcons({ icons });
const motion = document.querySelector("#motion"),
  sound = document.querySelector("#sound"),
  full = document.querySelector("#fullscreen");
const media = matchMedia("(prefers-reduced-motion: reduce)");
let paused = media.matches,
  scene;
try {
  scene = createCosmos(document.querySelector("#space"), {
    reducedMotion: paused,
  });
} catch (error) {
  console.error("3D scene unavailable:", error);
  motion.disabled = true;
}
const ambient = createAmbientSound();
function setIcon(button, name) {
  button.innerHTML = `<i data-lucide="${name}"></i>`;
  refreshIcons();
}
function setPaused(value) {
  paused = value;
  scene?.setPaused(value);
  motion.setAttribute("aria-pressed", String(value));
  motion.setAttribute(
    "aria-label",
    value ? "Lanjutkan animasi" : "Jeda animasi",
  );
  setIcon(motion, value ? "play" : "pause");
}
setPaused(paused);
motion.addEventListener("click", () => setPaused(!paused));
media.addEventListener("change", (e) => setPaused(e.matches));
async function toggleSound() {
  try {
    const enabled = await ambient.toggle();
    sound.setAttribute("aria-pressed", String(enabled));
    sound.setAttribute(
      "aria-label",
      enabled ? "Matikan suara ambient" : "Aktifkan suara ambient",
    );
    setIcon(sound, enabled ? "volume-2" : "volume-x");
  } catch (error) {
    console.warn("Ambient audio unavailable:", error);
  }
}
sound.addEventListener("click", toggleSound);
full.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* Native fullscreen may be unavailable inside an embedded preview. */
  }
});
document.addEventListener("fullscreenchange", () => {
  const enabled = !!document.fullscreenElement;
  full.setAttribute("aria-pressed", String(enabled));
  full.setAttribute(
    "aria-label",
    enabled ? "Keluar layar penuh" : "Layar penuh",
  );
  setIcon(full, enabled ? "minimize" : "maximize");
});
document.addEventListener("keydown", (e) => {
  if (
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)
  )
    return;
  if (e.key.toLowerCase() === "m") toggleSound();
  if (e.key.toLowerCase() === "r") scene?.resetCamera();
  if (e.code === "Space" && e.target.tagName !== "BUTTON") {
    e.preventDefault();
    setPaused(!paused);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) ambient.suspend();
  else ambient.resume().catch(() => {});
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    scene?.dispose();
    ambient.dispose();
  }
});
refreshIcons();
