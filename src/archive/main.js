const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';

const specimens = [
  {
    key: 'array',
    code: '01',
    name: 'Tidal Array',
    category: 'Instrumen navigasi',
    brief: 'Dua gimbal konsentris menjaga inti keramik tetap selaras saat gravitasi berubah.',
    story:
      'Di dunia Interstellar, instrumen ini membantu awak membaca perubahan gravitasi. Dua gimbal membiarkan inti berputar saat rangka luar mengikuti perubahan arah kapal. Seret model untuk melihat dudukan gimbal, skala vernier, dan lampu status di balik rangkanya.',
    notes: [
      ['Material', 'Titanium, perunggu, baja, dan keramik'],
      ['Bagian bergerak', 'Dua gimbal konsentris, cincin kalibrasi, dan inti keramik'],
      ['Fungsi arsip', 'Pembacaan gradien pasang-surut gravitasi'],
    ],
  },
  {
    key: 'sailer',
    code: '02',
    name: 'Lumen Sailer',
    category: 'Kapal ekspedisi',
    brief: 'Kapal layar low-poly berlayar melintasi lautan kosmik menuju cakrawala peristiwa.',
    story:
      'Kapal layar ini membawa ekspedisi melintasi lautan kosmik. Dari dekat, kelihatan lipatan kain layar, tali-temali, pantulan kaca kabin, dan lentera haluan. Buka mode pelayaran untuk melihatnya melaju perlahan di atas ombak cahaya.',
    notes: [
      ['Material', 'Lambung biru gelap, dek kayu, kain layar, dan kaca kabin'],
      ['Rig', 'Layar utama dan layar haluan beranimasi kain'],
      ['Keterhubungan', 'Tersedia interaktif pada mode Pelayaran'],
    ],
    voyage: true,
  },
  {
    key: 'horizon',
    code: '03',
    name: 'Event Horizon',
    category: 'Fenomena kosmik',
    brief: 'Cakram akresi berpijar dan lengkungan lensa gravitasi mengitari pusat gelap.',
    story:
      'Cincin terang sudah terlihat dari dek kapal. Di sini, pita plasma mengalir dengan laju berbeda mengelilingi bayangan singularitas sementara lengkungan cahaya membelok di atas dan bawah cakram saat sudut pandang diputar.',
    notes: [
      ['Struktur visual', 'Cakram akresi, cincin foton, dan lengkungan lensa gravitasi'],
      ['Dinamika', 'Aliran diferensial dengan pergeseran kecerahan Doppler'],
      ['Catatan', 'Interpretasi artistik dari black hole di kejauhan'],
    ],
    voyage: true,
  },
];

const get = (id) => document.getElementById(id);
const archive = document.querySelector('.archive');
const canvas = get('archive-canvas');
const stage = get('orbit-surface');
const enterButton = get('enter-archive');
const exitButton = get('exit-archive');
const showDetailsButton = get('show-details');
const captionVoyage = get('caption-voyage');
const catalogCurrent = get('catalog-current');
const telemetryYaw = get('telemetry-yaw');
const telemetryPitch = get('telemetry-pitch');
const telemetryZoom = get('telemetry-zoom');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const tabs = [...document.querySelectorAll('.specimen-tab')];
const dialog = get('artifact-dialog');
const controls = get('view-controls');
const pauseButton = get('pause-view');
const voyageLink = dialog.querySelector('.artifact-voyage');

let current = 0;
let entered = false;
let rendered = false;
let paused = false;
let holdTimer;
let completedHold = false;
let drag;
let scene;

function formatSignedDeg(value) {
  const normalized = ((value + 540) % 360) - 180;
  const sign = normalized >= 0 ? '+' : '-';
  return `${sign}${String(Math.abs(normalized)).padStart(3, '0')}°`;
}

function updateTelemetry({ yaw, pitch, zoom }) {
  telemetryYaw.textContent = formatSignedDeg(yaw);
  telemetryPitch.textContent = formatSignedDeg(pitch);
  telemetryZoom.textContent = `${zoom.toFixed(2)}×`;
}

function renderSpecimenCopy(exhibit) {
  archive.dataset.specimen = exhibit.key;
  archive.style.setProperty('--active-index', String(current));
  catalogCurrent.textContent = exhibit.code;
  get('specimen-category').textContent = exhibit.category;
  get('specimen-name').textContent = exhibit.name;
  get('specimen-brief').textContent = exhibit.brief;
  captionVoyage.hidden = !exhibit.voyage;
  tabs.forEach((tab, i) => {
    if (i === current) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  });
}

function showDetails() {
  const exhibit = specimens[current];
  get('dialog-code').textContent = `${exhibit.code} / 0${specimens.length}`;
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
  stage.tabIndex = rendered ? 0 : -1;
  if (rendered) stage.removeAttribute('aria-hidden');
  else stage.setAttribute('aria-hidden', 'true');
}

function enter() {
  if (entered) return;
  entered = true;
  archive.dataset.state = 'open';
  scene?.enter();
  syncStage();
}

function exit() {
  if (!entered) return;
  entered = false;
  archive.dataset.state = 'intro';
  scene?.exit();
  syncStage();
}

function select(index, { openArchive = true } = {}) {
  if (openArchive) enter();
  const next = (index + specimens.length) % specimens.length;
  if (current === next) return;
  current = next;
  renderSpecimenCopy(specimens[current]);
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
  enter();
});

exitButton.addEventListener('click', exit);
showDetailsButton.addEventListener('click', showDetails);

dialog.addEventListener('close', applySceneMotion);
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    ) {
      dialog.close();
    }
  }
});

tabs.forEach((tab, index) => tab.addEventListener('click', () => select(index)));
get('previous-specimen').addEventListener('click', () => select(current - 1));
get('next-specimen').addEventListener('click', () => select(current + 1));
get('reset-view').addEventListener('click', () => scene?.reset());
get('zoom-in').addEventListener('click', () => scene?.zoom(-220));
get('zoom-out').addEventListener('click', () => scene?.zoom(220));

function applySceneMotion() {
  scene?.setMotion({ freeze: paused || dialog.open, reduce: reducedMotion.matches });
}

function syncMotion() {
  pauseButton.hidden = reducedMotion.matches;
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? 'Lanjutkan animasi' : 'Jeda animasi');
  pauseButton.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  applySceneMotion();
}

pauseButton.addEventListener('click', () => {
  paused = !paused;
  syncMotion();
});
reducedMotion.addEventListener('change', syncMotion);

// Subtle pointer parallax across the exhibition stage
window.addEventListener(
  'pointermove',
  (event) => {
    if (!finePointer.matches || reducedMotion.matches || dialog.open) return;
    const nx = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    const ny = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
    scene?.setPointer(nx, ny);
  },
  { passive: true },
);

window.addEventListener('pointerleave', () => {
  scene?.setPointer(0, 0);
});

// Direct 3D orbit drag — works immediately from intro or open state
stage.addEventListener('pointerdown', (event) => {
  if (!rendered || !event.isPrimary || event.button !== 0) return;
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    moved: 0,
  };
  stage.setPointerCapture(event.pointerId);
});

stage.addEventListener('pointermove', (event) => {
  if (drag?.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag.moved += Math.hypot(dx, dy);
  if (!entered && drag.moved > 6) enter();
  scene?.orbit(dx, dy);
  drag.x = event.clientX;
  drag.y = event.clientY;
});

stage.addEventListener('lostpointercapture', () => {
  drag = undefined;
});

// Smooth clamped wheel zoom in inspection mode
stage.addEventListener(
  'wheel',
  (event) => {
    if (!entered || !rendered || dialog.open) return;
    event.preventDefault();
    scene?.zoom(event.deltaY);
  },
  { passive: false },
);

document.addEventListener('keydown', (event) => {
  if (dialog.open || event.metaKey || event.ctrlKey || event.altKey) return;
  const { key, target } = event;

  if (key === 'Escape' && entered) {
    event.preventDefault();
    exit();
    return;
  }

  if (target === stage) {
    const orbitInput = {
      ArrowLeft: [-22, 0],
      ArrowRight: [22, 0],
      ArrowUp: [0, -18],
      ArrowDown: [0, 18],
      Home: [0, 0],
    }[key];
    if (orbitInput) {
      event.preventDefault();
      if (!entered) enter();
      if (key === 'Home') scene?.reset();
      else scene?.orbit(...orbitInput);
      return;
    }
    if (key === '+' || key === '=') {
      event.preventDefault();
      if (!entered) enter();
      scene?.zoom(-220);
      return;
    }
    if (key === '-' || key === '_') {
      event.preventDefault();
      if (!entered) enter();
      scene?.zoom(220);
      return;
    }
  } else if (key === 'ArrowRight' || key === 'ArrowLeft') {
    event.preventDefault();
    select(current + (key === 'ArrowRight' ? 1 : -1));
    if (target.closest('.specimen-tab')) tabs[current].focus();
  }
});

renderSpecimenCopy(specimens[current]);
syncMotion();
syncStage();

// Fetch 3D chunk immediately in parallel, but wait strictly until after Frame 1 paints (LCP < 1s)
const sceneModulePromise = import('./scene.js');
requestAnimationFrame(() => {
  setTimeout(() => {
    sceneModulePromise
      .then(({ createArchiveScene }) => {
        scene = createArchiveScene(
          canvas,
          stage,
          (available) => {
            rendered = available;
            archive.classList.toggle('is-rendered', available);
            syncStage();
          },
          updateTelemetry,
        );
        if (entered) scene.enter();
        applySceneMotion();
        scene.select(current);
      })
      .catch((error) => {
        console.warn('Arsip 3D tidak dapat diinisialisasi pada perangkat ini.', error);
      });
  }, 0);
});

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) scene?.dispose();
});
