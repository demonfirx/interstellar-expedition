import './archive.css';
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play, Plus, RotateCcw, X, createIcons } from 'lucide';

const specimens = [
  {
    key: 'array', name: 'Tidal Array', category: 'Instrumen navigasi',
    story: 'Di dunia Interstellar, instrumen ini membantu awak membaca perubahan gravitasi. Dua gimbal membiarkan inti berputar saat rangka luar mengikuti perubahan arah kapal. Seret model untuk melihat dudukan gimbal dan lampu status di balik rangkanya.',
    notes: [['Material', 'Titanium, perunggu, dan keramik'], ['Bagian bergerak', 'Dua gimbal dan inti keramik']],
  },
  {
    key: 'sailer', name: 'Lumen Sailer', category: 'Kapal ekspedisi',
    story: 'Kapal layar ini membawa ekspedisi melintasi lautan kosmik. Dari dekat, kelihatan lipatan kain layar, tali-temali, dan cahaya kabin di balik kaca. Buka mode pelayaran untuk melihatnya bergerak di atas ombak.',
    notes: [['Material', 'Kayu, kain layar, dan kaca'], ['Rig', 'Layar utama dan layar haluan']],
    voyage: true,
  },
  {
    key: 'horizon', name: 'Event Horizon', category: 'Fenomena kosmik',
    story: 'Cincin terang sudah terlihat dari dek kapal. Di sini, pita cahaya mengalir di sekitar pusat gelap dan memperlihatkan ketebalan cakram saat kamu memutarnya. Visual ini adalah interpretasi artistik dari black hole di kejauhan.',
    notes: [['Visual', 'Cakram akresi dan cincin cahaya'], ['Gerak', 'Pita cahaya berputar dengan laju berbeda']],
    voyage: true,
  },
];

const get = (id) => document.getElementById(id);
const archive = document.querySelector('.archive');
const canvas = get('archive-canvas');
const stage = get('orbit-surface');
const enterButton = get('enter-archive');
const enterText = enterButton.querySelector('.button-text');
const enterHint = get('enter-hint');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tabs = [...document.querySelectorAll('.specimen-tab')];
const dialog = get('artifact-dialog');
const controls = get('view-controls');
const pauseButton = get('pause-view');
const voyageLink = dialog.querySelector('.artifact-voyage');
const icons = { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play, Plus, RotateCcw, X };
const refreshIcons = () => createIcons({ icons });

let current = 0;
let entered = false;
let rendered = false;
let paused = false;
let holdTimer;
let completedHold = false;
let drag;
let scene;

function showDetails() {
  const exhibit = specimens[current];
  get('dialog-title').textContent = exhibit.name;
  get('dialog-category').textContent = exhibit.category;
  get('dialog-story').textContent = exhibit.story;
  const rows = exhibit.notes.map(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    return row;
  });
  get('dialog-notes').replaceChildren(...rows);
  voyageLink.hidden = !exhibit.voyage;
  dialog.showModal();
  applySceneMotion();
}

function syncStage() {
  const active = entered && rendered;
  controls.hidden = !active;
  stage.tabIndex = active ? 0 : -1;
  if (active) stage.removeAttribute('aria-hidden');
  else stage.setAttribute('aria-hidden', 'true');
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', 'Putar objek 3D dengan tombol panah');
}

function enter() {
  if (entered) return;
  entered = true;
  archive.dataset.state = 'open';
  enterText.innerHTML = 'Detail objek <i data-lucide="plus"></i>';
  enterButton.removeAttribute('aria-describedby');
  enterHint.hidden = true;
  scene?.enter();
  syncStage();
  refreshIcons();
}

function select(index) {
  enter();
  const next = (index + specimens.length) % specimens.length;
  if (current === next) return;
  current = next;
  const exhibit = specimens[current];
  archive.dataset.specimen = exhibit.key;
  get('specimen-category').textContent = exhibit.category;
  get('specimen-name').textContent = exhibit.name;
  tabs.forEach((tab, i) => {
    if (i === current) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  });
  scene?.select(current);
}

function cancelHold() {
  clearTimeout(holdTimer);
  enterButton.classList.remove('is-holding');
}

enterButton.addEventListener('pointerdown', (event) => {
  completedHold = false;
  if (entered || !event.isPrimary || event.button !== 0) return;
  enterButton.classList.add('is-holding');
  holdTimer = setTimeout(() => {
    completedHold = true;
    cancelHold();
    enter();
  }, 650);
});
for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
  enterButton.addEventListener(type, cancelHold);
}
enterButton.addEventListener('click', (event) => {
  if (completedHold && event.detail > 0) {
    completedHold = false;
    return;
  }
  if (entered) showDetails();
  else enter();
});
get('show-details').addEventListener('click', showDetails);
dialog.addEventListener('close', applySceneMotion);
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
});
tabs.forEach((tab, index) => tab.addEventListener('click', () => select(index)));
get('previous-specimen').addEventListener('click', () => select(current - 1));
get('next-specimen').addEventListener('click', () => select(current + 1));
get('reset-view').addEventListener('click', () => scene?.reset());

function applySceneMotion() {
  scene?.setMotion({ freeze: paused || dialog.open, reduce: reducedMotion.matches });
}

function syncMotion() {
  pauseButton.hidden = reducedMotion.matches;
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Lanjutkan animasi' : 'Jeda animasi');
  pauseButton.innerHTML = `<i data-lucide="${paused ? 'play' : 'pause'}"></i>`;
  applySceneMotion();
  refreshIcons();
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  syncMotion();
});
reducedMotion.addEventListener('change', syncMotion);

stage.addEventListener('pointerdown', (event) => {
  if (!entered || !rendered || !event.isPrimary || event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', (event) => {
  if (drag?.id !== event.pointerId) return;
  scene?.orbit(event.clientX - drag.x, event.clientY - drag.y);
  drag.x = event.clientX;
  drag.y = event.clientY;
});
stage.addEventListener('lostpointercapture', () => { drag = undefined; });

document.addEventListener('keydown', (event) => {
  if (dialog.open || event.metaKey || event.ctrlKey || event.altKey) return;
  const { key, target } = event;
  if (target === stage) {
    const input = { ArrowLeft: [-22, 0], ArrowRight: [22, 0], ArrowUp: [0, -18], ArrowDown: [0, 18], Home: [0, 0] }[key];
    if (!input) return;
    event.preventDefault();
    if (key === 'Home') scene?.reset();
    else scene?.orbit(...input);
  } else if (key === 'ArrowRight' || key === 'ArrowLeft') {
    event.preventDefault();
    select(current + (key === 'ArrowRight' ? 1 : -1));
    if (target.closest('.specimen-tab')) tabs[current].focus();
  }
});

syncMotion();
syncStage();

import('./scene.js').then(({ createArchiveScene }) => {
  scene = createArchiveScene(canvas, stage, (available) => {
    rendered = available;
    archive.classList.toggle('is-rendered', available);
    syncStage();
  });
  if (entered) scene.enter();
  applySceneMotion();
  scene.select(current);
}).catch((error) => console.warn('Arsip 3D beralih ke tampilan statis.', error));

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) scene?.dispose();
});
