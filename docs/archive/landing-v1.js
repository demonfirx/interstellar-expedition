import "./styles/main.css";
import {
  createIcons,
  ArrowUpRight,
  Menu,
  X,
  Pause,
  Play,
  Move,
  Maximize,
  Minimize,
  Download,
  Asterisk,
} from "lucide";
import { createCosmos } from "./scene/cosmos.js";
import { createAmbientSound } from "./ui/ambient.js";

const icons = {
  ArrowUpRight,
  Menu,
  X,
  Pause,
  Play,
  Move,
  Maximize,
  Minimize,
  Download,
  Asterisk,
};
const refreshIcons = () => createIcons({ icons });
refreshIcons();
const $ = (s) => document.querySelector(s);
let toastTimeout;
function toast(message) {
  const el = $(".toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove("visible"), 3600);
}
const media = window.matchMedia("(prefers-reduced-motion: reduce)");
let paused = media.matches,
  immersive = false,
  heroScene,
  crewScene,
  selected = "gargantua";
try {
  heroScene = createCosmos($("#space"), { reducedMotion: paused });
  crewScene = createCosmos($("#crew-canvas"), {
    reducedMotion: paused,
    portrait: true,
  });
} catch (error) {
  console.error("3D scene unavailable:", error);
  $(".webgl-message").hidden = false;
  $("#download-model").disabled = true;
  $("#download-model").title = "Model 3D memerlukan WebGL";
}
const ambient = createAmbientSound();
function icon(button, name) {
  button.innerHTML = `<i data-lucide="${name}"></i>`;
  refreshIcons();
}
function updateMotion() {
  document.body.classList.toggle("motion-paused", paused);
  heroScene?.setPaused(paused);
  crewScene?.setPaused(paused);
  $("#motion").setAttribute("aria-pressed", String(paused));
  $("#motion").setAttribute(
    "aria-label",
    paused ? "Lanjutkan animasi" : "Jeda animasi",
  );
  icon($("#motion"), paused ? "play" : "pause");
}
updateMotion();
$("#motion").addEventListener("click", () => {
  paused = !paused;
  updateMotion();
});
media.addEventListener("change", (e) => {
  paused = e.matches;
  updateMotion();
});
async function toggleSound() {
  try {
    const enabled = await ambient.toggle();
    $("#sound").setAttribute("aria-pressed", String(enabled));
    $("#sound").setAttribute(
      "aria-label",
      enabled ? "Matikan suara ambient" : "Aktifkan suara ambient",
    );
    $("#sound-state").textContent = enabled ? "ON" : "OFF";
  } catch {
    toast("Suara belum bisa diputar. Coba browser yang mendukung Web Audio.");
  }
}
$("#sound").addEventListener("click", toggleSound);
function wave() {
  heroScene?.wave();
  crewScene?.wave();
  toast("Halo, penjelajah. Astro melambaikan tangan dari sisi lain semesta!");
}
for (const id of ["#wave", "#crew-wave", "#astro-label"])
  $(id).addEventListener("click", wave);
function setImmersive(value) {
  immersive = value;
  document.body.classList.toggle("immersive-mode", value);
  $("#immersive").setAttribute("aria-pressed", String(value));
  $("#immersive").setAttribute(
    "aria-label",
    value ? "Keluar tampilan imersif" : "Buka tampilan imersif",
  );
  icon($("#immersive"), value ? "minimize" : "maximize");
  heroScene?.setImmersive(value);
  if (value) {
    $("#immersive").focus();
    toast("Seret untuk memutar Astro. Tekan W untuk dadah, Esc untuk kembali.");
  }
}
$("#immersive").addEventListener("click", () => setImmersive(!immersive));
$("#begin").addEventListener("click", () => {
  setImmersive(true);
  heroScene?.wave();
});
document.addEventListener("keydown", (e) => {
  if (
    /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.key === "Escape") {
    if (immersive) setImmersive(false);
    closeMenu();
  }
  if (e.key.toLowerCase() === "w") wave();
  if (e.key.toLowerCase() === "m") toggleSound();
  if (e.key.toLowerCase() === "r") {
    heroScene?.resetCamera();
    crewScene?.resetCamera();
    toast("Kamera kembali ke posisi awal.");
  }
});
const descriptions = {
  gargantua:
    "Cahaya membelok, waktu terasa asing. Dekati cincin Gargantua bersama Astro dan lihat semesta dari sudut yang berbeda.",
  miller:
    "Hamparan air sejauh mata memandang. Dalam dunia fiksi ini, waktu di Miller berjalan jauh lebih lambat daripada waktu di Bumi.",
  edmunds:
    "Bentang bebatuan hangat di bawah langit yang baru. Edmunds menjadi bayangan tentang rumah yang mungkin menunggu di ujung perjalanan.",
};
const names = {
  gargantua: "GARGANTUA",
  miller: "MILLER'S PLANET",
  edmunds: "EDMUNDS' PLANET",
};
document.querySelectorAll("[data-destination]").forEach((button) =>
  button.addEventListener("click", () => {
    selected = button.dataset.destination;
    document.querySelectorAll("[data-destination]").forEach((b) => {
      b.classList.toggle("selected", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    $("#destination-description").textContent = descriptions[selected];
  }),
);
$("#visit-destination").addEventListener("click", () => {
  heroScene?.setDestination(selected);
  $("#location-readout").textContent = names[selected];
  $(".coordinate .muted").textContent =
    selected === "gargantua" ? "GARGANTUA SYSTEM" : names[selected];
  $(".orbit-note div").firstChild.textContent = names[selected];
  document.querySelectorAll("[data-destination] .art-tag").forEach((tag) => {
    const key = tag.closest("[data-destination]").dataset.destination;
    const labels = {
      gargantua: "BEYOND THE EVENT HORIZON",
      miller: "AN OCEAN WITHOUT AN END",
      edmunds: "SOMEWHERE TO BEGIN AGAIN",
    };
    tag.textContent = key === selected ? "CURRENT LOCATION ●" : labels[key];
  });
  document.body.dataset.destination = selected;
  $("#home").scrollIntoView({ behavior: media.matches ? "instant" : "smooth" });
  toast(`Koordinat ditetapkan: ${names[selected]}. Selamat menjelajah.`);
});
const menu = $(".menu-toggle");
function closeMenu() {
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Buka navigasi");
  $("#navigation").classList.remove("open");
  icon(menu, "menu");
}
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Tutup navigasi" : "Buka navigasi");
  $("#navigation").classList.toggle("open", open);
  icon(menu, open ? "x" : "menu");
});
document
  .querySelectorAll("#navigation a")
  .forEach((a) => a.addEventListener("click", closeMenu));
const navObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        document
          .querySelectorAll("#navigation a")
          .forEach((a) =>
            a.classList.toggle(
              "active",
              a.getAttribute("href") === `#${entry.target.id}`,
            ),
          );
      }
  },
  { rootMargin: "-20% 0px -55% 0px" },
);
["#home", "#destinations", "#crew"].forEach((s) => navObserver.observe($(s)));
const started = Date.now();
const clock = setInterval(() => {
  const sec = Math.floor((Date.now() - started) / 1000);
  $("#elapsed").textContent = [
    Math.floor(sec / 3600),
    Math.floor(sec / 60) % 60,
    sec % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) ambient.suspend();
  else ambient.resume().catch(() => {});
});
$("#download-model").addEventListener("click", async () => {
  const button = $("#download-model");
  button.disabled = true;
  try {
    const response = await fetch("/models/astro-rigged.glb");
    if (!response.ok) throw new Error("Model unavailable");
    const url = URL.createObjectURL(await response.blob()),
      a = document.createElement("a");
    a.href = url;
    a.download = "ASTRO_01-rigged.glb";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast("Model Astro, rig, dan dua animasinya sudah diunduh.");
  } catch (error) {
    console.error(error);
    toast("Unduhan model gagal. Coba lagi sebentar.");
  } finally {
    button.disabled = false;
  }
});
window.addEventListener(
  "pagehide",
  () => {
    clearInterval(clock);
    clearTimeout(toastTimeout);
    navObserver.disconnect();
    heroScene?.dispose();
    crewScene?.dispose();
    ambient.dispose();
  },
  { once: true },
);
