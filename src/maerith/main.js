const PLAY_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';

const PHASE_COPY = {
  1: {
    badge: 'FASE I',
    epithet: 'The Black Blade · Farum Azula',
    description:
      'Penjaga Crumbling Farum Azula bersenjata bilah obsidian Destined Death. Putar model 3D, nyalakan Fase II untuk melihat gerhana merah, atau masuk langsung ke arena duel.',
  },
  2: {
    badge: 'FASE II',
    epithet: 'Blade of Destined Death · Gerhana Merah',
    description:
      'Di bawah 52% HP, Maerith melepaskan segel Destined Death — langit Farum Azula memerah, bilah hitam berkobar penuh, dan setiap tebasan menggerogoti batas HP maksimum.',
  },
};

const get = (id) => document.getElementById(id);
const root = document.querySelector('.maerith');
const canvas = get('maerith-canvas');
const orbitSurface = get('maerith-orbit');
const headerPhase = get('header-phase');
const epithetEl = get('maerith-epithet');
const descriptionEl = get('maerith-description');
const teleYaw = get('tele-yaw');
const telePitch = get('tele-pitch');
const teleZoom = get('tele-zoom');
const loaderBox = get('rig-loader');
const loaderLabel = get('rig-loader-label');
const loaderPct = get('rig-loader-pct');
const loaderFill = get('rig-loader-fill');
const pauseBtn = get('maerith-pause');
const resetBtn = get('maerith-reset');
const codexBtn = get('open-codex');
const codexDialog = get('codex-dialog');
const phaseTabs = [...document.querySelectorAll('.phase-tab')];
const stanceBtns = [...document.querySelectorAll('.stance-btn')];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

let phase = 1;
let paused = false;
let drag = null;
let stage = null;

function formatSignedDeg(value) {
  const normalized = ((value + 540) % 360) - 180;
  const sign = normalized >= 0 ? '+' : '-';
  return `${sign}${String(Math.abs(normalized)).padStart(3, '0')}°`;
}

function setPhase(nextPhase) {
  phase = nextPhase;
  root.dataset.phase = String(phase);
  root.style.setProperty('--phase-index', String(phase - 1));
  const copy = PHASE_COPY[phase];
  headerPhase.textContent = copy.badge;
  epithetEl.textContent = copy.epithet;
  descriptionEl.textContent = copy.description;
  phaseTabs.forEach((tab) => {
    const active = Number(tab.dataset.phase) === phase;
    if (active) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  });
  stage?.setPhase(phase === 2);
}

function setStance(stance) {
  root.dataset.stance = stance;
  stanceBtns.forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.stance === stance));
  });
  stage?.setStance(stance);
}

function syncMotion() {
  pauseBtn.hidden = reducedMotion.matches;
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.setAttribute('aria-label', paused ? 'Lanjutkan animasi' : 'Jeda animasi');
  pauseBtn.innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  stage?.setMotion({ freeze: paused || codexDialog.open, reduce: reducedMotion.matches });
}

phaseTabs.forEach((tab) => {
  tab.addEventListener('click', () => setPhase(Number(tab.dataset.phase)));
});

stanceBtns.forEach((btn) => {
  btn.addEventListener('click', () => setStance(btn.dataset.stance));
});

resetBtn.addEventListener('click', () => stage?.reset());
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  syncMotion();
});
reducedMotion.addEventListener('change', syncMotion);

codexBtn.addEventListener('click', () => {
  codexDialog.showModal();
  stage?.setMotion({ freeze: true, reduce: reducedMotion.matches });
});

codexDialog.addEventListener('close', () => {
  stage?.setMotion({ freeze: paused, reduce: reducedMotion.matches });
});

codexDialog.addEventListener('click', (event) => {
  if (event.target === codexDialog) {
    const box = codexDialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    ) {
      codexDialog.close();
    }
  }
});

// Direct 360° drag orbit & clamped scroll zoom
orbitSurface.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  orbitSurface.setPointerCapture(event.pointerId);
});

orbitSurface.addEventListener('pointermove', (event) => {
  if (drag?.id !== event.pointerId) return;
  stage?.orbit(event.clientX - drag.x, event.clientY - drag.y);
  drag.x = event.clientX;
  drag.y = event.clientY;
});

orbitSurface.addEventListener('lostpointercapture', () => {
  drag = null;
});

orbitSurface.addEventListener(
  'wheel',
  (event) => {
    if (codexDialog.open) return;
    event.preventDefault();
    stage?.zoom(event.deltaY);
  },
  { passive: false },
);

window.addEventListener(
  'pointermove',
  (event) => {
    if (!finePointer.matches || reducedMotion.matches || codexDialog.open) return;
    const nx = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    const ny = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
    stage?.setPointer(nx, ny);
  },
  { passive: true },
);

window.addEventListener('pointerleave', () => {
  stage?.setPointer(0, 0);
});

document.addEventListener('keydown', (event) => {
  if (codexDialog.open || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target === orbitSurface) {
    const move = {
      ArrowLeft: [-26, 0],
      ArrowRight: [26, 0],
      ArrowUp: [0, -18],
      ArrowDown: [0, 18],
    }[event.key];
    if (move) {
      event.preventDefault();
      stage?.orbit(...move);
    } else if (event.key === 'Home') {
      event.preventDefault();
      stage?.reset();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      stage?.zoom(-220);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      stage?.zoom(220);
    }
  }
});

// Fetch 3D stage chunk immediately in parallel, but wait strictly until after Frame 1 paints (LCP < 1s)
const stageModulePromise = import('./stage.js');
requestAnimationFrame(() => {
  setTimeout(() => {
    stageModulePromise
      .then(({ createMaerithStage }) => {
        stage = createMaerithStage(canvas, orbitSurface, {
          onProgress(pct, label) {
            const percent = Math.round(pct * 100);
            loaderLabel.textContent = label;
            loaderPct.textContent = `${percent}%`;
            loaderFill.style.width = `${Math.max(4, percent)}%`;
          },
          onReady() {
            loaderBox.classList.add('is-ready');
          },
          onTelemetry({ yaw, pitch, zoom }) {
            teleYaw.textContent = formatSignedDeg(yaw);
            telePitch.textContent = formatSignedDeg(pitch);
            teleZoom.textContent = `${zoom.toFixed(2)}×`;
          },
        });
        stage.setPhase(phase === 2);
        syncMotion();
      })
      .catch((error) => {
        console.error('Stage 3D Maerith gagal diinisialisasi:', error);
        loaderLabel.textContent = 'WebGL tidak tersedia pada browser ini';
      });
  }, 0);
});

window.addEventListener('pagehide', (event) => {
  if (!event.persisted) stage?.dispose();
});
