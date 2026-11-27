import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createFarumEnvironment } from "./materials.js";
import { buildArena } from "./arena.js";
import { loadEldenCharacters } from "./models.js";
import {
  PILLARS,
  createCombatState,
  getNearbyInteraction,
  restAtGrace,
  startBossEncounter,
  stepCombat,
  isPlayerBladeActive,
  isBossBladeActive,
} from "./combat.js";
import { createVFXManager, createBladeTrail } from "./vfx.js";
import { createAudioEngine } from "./audio.js";
import { createHUD } from "./hud.js";

export function bootElden() {
const canvas = document.getElementById("game-canvas");
const loadingWrap = document.getElementById("loading-progress");
const loadingFill = document.getElementById("loading-fill");
const loadingLabel = document.getElementById("loading-label");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.15, 240);

// Pre-register character lights at Frame 0 so adding models later never triggers a scene shader recompile
const playerLight = new THREE.PointLight(0xffb84d, 0, 8.5);
const bossLight = new THREE.PointLight(0xff1e2d, 0, 15);
scene.add(playerLight, bossLight);

// Kick off binary GLB fetches immediately so network I/O overlaps arena compilation
const charactersPromise = loadEldenCharacters(
  (pct, label) => {
    if (loadingFill) loadingFill.style.width = `${Math.round(pct * 100)}%`;
    if (loadingLabel) loadingLabel.textContent = `${label.toUpperCase()} · ${Math.round(pct * 100)}%`;
  },
  { playerLight, bossLight }
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

let envRT = null;
try {
  envRT = createFarumEnvironment(renderer);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.98;
} catch (err) {
  console.warn("[Elden] Farum IBL fallback:", err);
}

let composer = null;
let bloomPass = null;
let postReady = false;
function initPostEffects() {
  if (postReady) return;
  postReady = true;
  if (renderer.extensions.has("EXT_color_buffer_float")) {
    try {
      const target = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: 2,
      });
      composer = new EffectComposer(renderer, target);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.52, 0.42, 0.92);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch {
      composer = bloomPass = null;
    }
    if (composer) {
      bloomEnabled = true;
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
    }
  }
}

const arena = buildArena(scene);
const vfx = createVFXManager(scene);
const playerTrail = createBladeTrail(scene, {
  color: 0xffc864,
  coreColor: 0xfff8dc,
  maxSamples: 15,
  crimsonDark: false,
});
const bossTrail = createBladeTrail(scene, {
  color: 0xff1e2d,
  coreColor: 0xffb36b,
  maxSamples: 18,
  crimsonDark: true,
});
const audio = createAudioEngine();
const hud = createHUD();

let playerModel = null;
let bossModel = null;
let assetsReady = false;

let combat = createCombatState({ exploreMode: true });
let started = false;
let lockedOn = true;
let shakeIntensity = 0;
let hitStopTimer = 0;
let resultShown = false;
let fovKick = 0;

// Free-orbit exploration camera state
let exploreCamYaw = Math.PI; // Facing -Z (north toward Site of Grace, Bridge, and Maerith)
let exploreCamPitch = 0.24;
let exploreCamDist = 6.6;
let dragActive = false;
let dragMoved = false;
let dragButton = 0;
let dragStartX = 0;
let dragStartY = 0;
let lastMouseX = 0;
let lastMouseY = 0;

const btnStart = document.getElementById("btn-start");
const btnDirectBoss = document.getElementById("btn-direct-boss");
const btnRetry = document.getElementById("btn-retry");
const btnRetryBoss = document.getElementById("btn-retry-boss");
const interactPromptBtn = document.getElementById("interact-prompt");

if (btnStart) {
  btnStart.disabled = true;
  btnStart.textContent = "FORGING ARENA...";
}
if (btnDirectBoss) btnDirectBoss.disabled = true;

let dprCap = 1.5;

function updateResize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
  }
  arena.setPixelRatio(dpr);
  vfx.setPixelRatio(dpr);
}
updateResize();
window.addEventListener("resize", updateResize);

charactersPromise
  .then((models) => {
    playerModel = models.playerModel;
    bossModel = models.bossModel;
    scene.add(playerModel.root);
    scene.add(bossModel.root);
    assetsReady = true;

    playerModel.root.position.set(combat.player.x, 0, combat.player.z);
    playerModel.root.rotation.y = combat.player.yaw;
    bossModel.root.position.set(combat.boss.x, 0, combat.boss.z);
    bossModel.root.rotation.y = combat.boss.yaw;

    if (loadingWrap) loadingWrap.classList.add("hidden");
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = "EXPLORE FARUM AZULA";
    }
    if (btnDirectBoss) btnDirectBoss.disabled = false;

    const launchMode = new URLSearchParams(window.location.search).get("mode");
    if (launchMode === "boss") {
      startBossDirect();
    } else if (launchMode === "explore") {
      startExplore();
    }
  })
  .catch((err) => {
    console.error("[Elden] Failed to load 3D character models:", err);
    if (loadingLabel) loadingLabel.textContent = "FAILED TO LOAD 3D MODELS — CHECK CONSOLE";
  });

const keys = new Set();
const queued = {
  roll: false,
  lightAttack: false,
  heavyAttack: false,
  heal: false,
};

function triggerNearbyInteraction() {
  if (!started || !combat.exploreMode) return;
  const near = getNearbyInteraction(combat);
  if (!near) return;

  if (near.type === "rest_grace") {
    if (restAtGrace(combat)) {
      audio.playGraceChime();
      vfx.spawnShockwave(0, 40.0, 5.2, false);
      vfx.spawnSparks(0, 1.3, 40.0, 0xffd27a, 34);
      hud.showZoneBanner("SITE OF GRACE RESTORED", "HP & Crimson Flasks replenished", 2.8);
    }
  } else if (near.type === "traverse_mist") {
    if (startBossEncounter(combat)) {
      lockedOn = true;
      audio.playMistTraverse();
      vfx.spawnShockwave(0, 23.6, 7.0, false);
      vfx.spawnSparks(0, 2.2, 23.6, 0xffd27a, 38);
      arena.setFogWallOpacity(0.45);
      hud.showGameplay();
      hud.showDialogue("Tarnished... Why wouldst thou covet Destined Death?", 3.8);
      // Place camera cleanly behind the player entering the coliseum
      camera.position.set(0.9, 3.8, 22.8);
    }
  }
}

window.addEventListener("keydown", (e) => {
  const code = e.code;
  keys.add(code);
  if (!started) return;

  if (code === "KeyE") {
    triggerNearbyInteraction();
  } else if (code === "Space") {
    e.preventDefault();
    queued.roll = true;
  } else if (code === "KeyJ") {
    queued.lightAttack = true;
  } else if (code === "KeyK") {
    queued.heavyAttack = true;
  } else if (code === "KeyR") {
    queued.heal = true;
  } else if (code === "KeyQ" || code === "Tab") {
    e.preventDefault();
    if (!combat.exploreMode) lockedOn = !lockedOn;
  } else if (code === "KeyM") {
    audio.toggleMute();
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

// Mouse controls: drag to orbit camera freely in explore mode; crisp clicks attack!
window.addEventListener("mousedown", (e) => {
  if (!started || combat.status !== "playing") return;
  if (e.target.closest("button") || e.target.closest("a")) return;

  if (combat.exploreMode) {
    dragActive = true;
    dragMoved = false;
    dragButton = e.button;
    dragStartX = lastMouseX = e.clientX;
    dragStartY = lastMouseY = e.clientY;
    return;
  }

  if (e.button === 0) queued.lightAttack = true;
  if (e.button === 2) queued.heavyAttack = true;
});

window.addEventListener("mousemove", (e) => {
  if (!dragActive || !combat.exploreMode) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 6) {
    dragMoved = true;
  }
  exploreCamYaw -= dx * 0.0065;
  exploreCamPitch = THREE.MathUtils.clamp(exploreCamPitch + dy * 0.0045, 0.04, 0.72);
});

window.addEventListener("mouseup", () => {
  if (!dragActive) return;
  const wasClick = !dragMoved;
  const btn = dragButton;
  dragActive = false;
  if (wasClick && started && combat.status === "playing") {
    if (btn === 0) queued.lightAttack = true;
    if (btn === 2) queued.heavyAttack = true;
  }
});

window.addEventListener(
  "wheel",
  (e) => {
    if (!started || !combat.exploreMode) return;
    exploreCamDist = THREE.MathUtils.clamp(exploreCamDist + e.deltaY * 0.005, 4.4, 12.0);
  },
  { passive: true }
);

window.addEventListener("contextmenu", (e) => e.preventDefault());

function startExplore() {
  if (!assetsReady) return;
  combat = createCombatState({ exploreMode: true });
  vfx.clear();
  playerTrail.clear();
  bossTrail.clear();
  started = true;
  lockedOn = false;
  resultShown = false;
  shakeIntensity = 0;
  hitStopTimer = 0;
  fovKick = 0;
  exploreCamYaw = Math.PI;
  exploreCamPitch = 0.22;
  exploreCamDist = 6.4;
  arena.setFogWallOpacity(1.0);
  audio.startAmbient();
  hud.showExplore();
  hud.showZoneBanner("CRUMBLING FARUM AZULA", "Beside the Great Bridge", 3.6);
  // Snap camera behind player on the terrace looking north toward Site of Grace & Golden Mist
  camera.position.set(0, 3.3, 50.4);
  camera.lookAt(0, 1.8, 38.0);
}

function startBossDirect() {
  if (!assetsReady) return;
  combat = createCombatState({ exploreMode: false });
  vfx.clear();
  playerTrail.clear();
  bossTrail.clear();
  started = true;
  lockedOn = true;
  resultShown = false;
  shakeIntensity = 0;
  hitStopTimer = 0;
  fovKick = 0;
  arena.setFogWallOpacity(0.45);
  audio.startAmbient();
  hud.showGameplay();
  hud.showDialogue("Tarnished... Why wouldst thou covet Destined Death?", 3.8);
}

btnStart?.addEventListener("click", startExplore);
btnDirectBoss?.addEventListener("click", startBossDirect);
btnRetry?.addEventListener("click", startExplore);
btnRetryBoss?.addEventListener("click", startBossDirect);
interactPromptBtn?.addEventListener("click", triggerNearbyInteraction);

function handleCombatEvents(events) {
  for (const ev of events) {
    switch (ev.type) {
      case "player_swing":
        audio.playSwing(ev.heavy);
        if (ev.heavy) fovKick = Math.max(fovKick, 2.2);
        break;
      case "player_roll":
        audio.playRoll();
        break;
      case "player_healed":
        audio.playHeal();
        vfx.spawnSparks(ev.x, 1.25, ev.z, 0xffaa33, 22);
        break;
      case "boss_hit":
        audio.playHit(ev.critical);
        hud.showBossDamage(ev.damage);
        vfx.spawnSparks(ev.x, 2.1, ev.z, ev.critical ? 0xffdd66 : 0xff3b30, ev.critical ? 30 : 16);
        shakeIntensity = Math.max(shakeIntensity, ev.critical ? 0.5 : 0.16);
        if (ev.critical) {
          hitStopTimer = 0.048;
          fovKick = Math.max(fovKick, 4.0);
        }
        break;
      case "boss_stagger":
        audio.playParry();
        vfx.spawnShockwave(ev.x, ev.z, 5.2, false);
        hud.showDialogue("Argh...!", 1.6);
        shakeIntensity = Math.max(shakeIntensity, 0.36);
        hitStopTimer = 0.05;
        fovKick = Math.max(fovKick, 3.6);
        break;
      case "phase2_start":
        audio.playPhase2();
        hud.showDialogue(ev.dialogue, 4.0);
        shakeIntensity = 0.28;
        break;
      case "phase2_burst":
        audio.playShockwave();
        vfx.spawnPhase2Pillar(ev.x, ev.z);
        shakeIntensity = 0.85;
        fovKick = 6.5;
        break;
      case "shockwave":
        audio.playShockwave();
        vfx.spawnShockwave(ev.x, ev.z, ev.radius, ev.crimson);
        shakeIntensity = Math.max(shakeIntensity, 0.44);
        break;
      case "player_hit":
        audio.playHit(false);
        hud.flashHit();
        vfx.spawnSparks(ev.x, 1.2, ev.z, ev.destinedDeath ? 0xff1122 : 0xcc3322, 20);
        shakeIntensity = Math.max(shakeIntensity, 0.4);
        break;
      case "block_hit":
        audio.playBlock();
        vfx.spawnSparks(ev.x, 1.3, ev.z, 0xffd27a, 14);
        shakeIntensity = Math.max(shakeIntensity, 0.2);
        break;
      case "parry":
        audio.playParry();
        vfx.spawnSparks(ev.x, 1.4, ev.z, 0xffee99, 28);
        vfx.spawnShockwave(ev.x, ev.z, 3.8, false);
        shakeIntensity = Math.max(shakeIntensity, 0.34);
        hitStopTimer = 0.052;
        fovKick = Math.max(fovKick, 4.2);
        break;
      case "perfect_dodge":
        vfx.spawnSparks(ev.x, 1.0, ev.z, 0x99ccff, 12);
        break;
      case "projectile_blocked":
        vfx.spawnSparks(ev.x, 1.5, ev.z, 0xff2233, 16);
        break;
      case "boss_death":
        audio.playVictory();
        vfx.spawnShockwave(ev.x, ev.z, 14, false);
        vfx.spawnSparks(ev.x, 2.2, ev.z, 0xffd27a, 48);
        break;
      case "player_death":
        audio.playDefeat();
        break;
    }
  }
}

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const camDir = new THREE.Vector3();
const camRight = new THREE.Vector3();
const bossScreenVec = new THREE.Vector3();
const tmpBase = new THREE.Vector3();
const tmpTip = new THREE.Vector3();
const tmpMid = new THREE.Vector3();

let bloomEnabled = false;
let firstFramePainted = false;
let slowFrames = 0;
let rafId = 0;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  } else if (!rafId) {
    clock.getDelta();
    rafId = requestAnimationFrame(animate);
  }
});

function animate() {
  if (document.hidden) {
    rafId = 0;
    return;
  }
  rafId = requestAnimationFrame(animate);
  const rawDt = clock.getDelta();
  const dt = Math.min(0.05, rawDt);
  const elapsed = clock.elapsedTime;

  if (assetsReady && rawDt > 0.042) slowFrames += 1;
  else slowFrames = Math.max(0, slowFrames - 2);
  if (slowFrames >= 8) {
    slowFrames = 0;
    if (bloomEnabled) {
      bloomEnabled = false;
    } else if (dprCap > 1.0) {
      dprCap = 1.0;
      updateResize();
    }
  }

  if (started && assetsReady) {
    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - dt);
    } else {
      let forward = 0;
      let right = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) forward += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) forward -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) right += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) right -= 1;

      camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      camRight.set(-camDir.z, 0, camDir.x);

      const moveX = camDir.x * forward + camRight.x * right;
      const moveZ = camDir.z * forward + camRight.z * right;

      stepCombat(
        combat,
        {
          moveX,
          moveZ,
          roll: queued.roll,
          lightAttack: queued.lightAttack,
          heavyAttack: queued.heavyAttack,
          heal: queued.heal,
          block: keys.has("ShiftLeft") || keys.has("ShiftRight"),
          lockedOn: !combat.exploreMode && lockedOn,
        },
        dt
      );

      queued.roll = false;
      queued.lightAttack = false;
      queued.heavyAttack = false;
      queued.heal = false;

      handleCombatEvents(combat.events);

      if (combat.exploreMode) {
        hud.setInteractPrompt(getNearbyInteraction(combat));
      } else {
        hud.setInteractPrompt(null);
      }

      if (combat.status !== "playing" && !resultShown) {
        resultShown = true;
        setTimeout(() => {
          hud.showResult(combat.status === "victory", combat.stats, combat.time);
        }, 900);
      }
    }
  }

  const { player, boss } = combat;

  if (playerModel && bossModel) {
    playerModel.root.position.set(player.x, 0, player.z);
    playerModel.root.rotation.y = player.yaw;
    const pProg = player.stateDuration > 0 ? Math.min(1, player.stateTime / player.stateDuration) : 0;
    playerModel.animate(
      started ? player.state : "idle",
      pProg,
      elapsed,
      started ? player.moveSpeed : 0,
      hitStopTimer > 0 ? 0 : dt,
      player.stateDuration || 0.5
    );
    playerModel.root.updateMatrixWorld(true);

    bossModel.root.position.set(boss.x, 0, boss.z);
    bossModel.root.rotation.y = boss.yaw;
    const bProg = boss.stateDuration > 0 ? Math.min(1, boss.stateTime / boss.stateDuration) : 0;
    bossModel.animate(
      started ? boss.state : "idle",
      bProg,
      elapsed,
      boss.phase === 2,
      started ? boss.moveSpeed : 0,
      hitStopTimer > 0 ? 0 : dt,
      boss.stateDuration || 1.4
    );
    bossModel.root.updateMatrixWorld(true);

    // Dynamic 3D GLSL ribbon blade trails + continuous organic blade ember sparks!
    playerModel.bladeBase.getWorldPosition(tmpBase);
    playerModel.bladeTip.getWorldPosition(tmpTip);
    playerLight.position.lerpVectors(tmpBase, tmpTip, 0.5);
    playerTrail.update(started && isPlayerBladeActive(player), tmpBase, tmpTip, dt);
    if (started && player.state !== "dead" && Math.random() < dt * (isPlayerBladeActive(player) ? 34 : 8)) {
      tmpMid.lerpVectors(tmpBase, tmpTip, Math.random());
      vfx.spawnSparks(tmpMid.x, tmpMid.y, tmpMid.z, 0xffcc66, 1);
    }

    bossModel.bladeBase.getWorldPosition(tmpBase);
    bossModel.bladeTip.getWorldPosition(tmpTip);
    bossLight.position.lerpVectors(tmpBase, tmpTip, 0.5);
    bossTrail.update(started && !combat.exploreMode && isBossBladeActive(boss), tmpBase, tmpTip, dt);
    if (boss.state !== "dead" && Math.random() < dt * (boss.phase === 2 ? 26 : 12)) {
      tmpMid.lerpVectors(tmpBase, tmpTip, Math.random());
      vfx.spawnSparks(tmpMid.x, tmpMid.y, tmpMid.z, 0xff1e2d, 1);
    }
  }

  arena.update(dt, elapsed, boss.phase === 2);
  vfx.update(dt, combat.projectiles);

  if (fovKick > 0.01) {
    fovKick = Math.max(0, fovKick - dt * 14);
    camera.fov = 50 + fovKick;
    camera.updateProjectionMatrix();
  } else if (camera.fov !== 50) {
    camera.fov = 50;
    camera.updateProjectionMatrix();
  }

  // Camera modes: Title Pan | Free-Orbit Explore | Phase 2 Cutscene | Boss Combat
  if (!started) {
    const orbitAng = elapsed * 0.14 + 0.28;
    camera.position.set(
      boss.x + Math.sin(orbitAng) * 6.2,
      2.65,
      boss.z + Math.cos(orbitAng) * 6.2
    );
    camera.lookAt(boss.x, 2.05, boss.z);
  } else if (combat.exploreMode) {
    const horiz = Math.cos(exploreCamPitch) * exploreCamDist;
    const vert = Math.sin(exploreCamPitch) * exploreCamDist;
    camDesired.set(
      player.x - Math.sin(exploreCamYaw) * horiz,
      1.65 + vert,
      player.z - Math.cos(exploreCamYaw) * horiz
    );
    camTarget.set(player.x, 1.55, player.z);
    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 10.5));
    camera.lookAt(camTarget);
  } else if (combat.inCutscene) {
    const bProg = boss.stateDuration > 0 ? Math.min(1, boss.stateTime / boss.stateDuration) : 0;
    const cutAngle = boss.yaw + 0.38 + bProg * 0.62;
    const cutRadius = 9.0 - Math.sin(bProg * Math.PI) * 1.8;
    camDesired.set(
      boss.x + Math.sin(cutAngle) * cutRadius,
      2.3 + bProg * 1.1,
      boss.z + Math.cos(cutAngle) * cutRadius
    );
    camTarget.set(boss.x, 2.75, boss.z);
    camera.position.lerp(camDesired, Math.min(1, dt * 4.5));
    if (shakeIntensity > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity;
      shakeIntensity = Math.max(0, shakeIntensity - dt * 1.6);
    }
    camera.lookAt(camTarget);
  } else {
    if (lockedOn && boss.state !== "dead") {
      const toBossX = boss.x - player.x;
      const toBossZ = boss.z - player.z;
      const dist = Math.hypot(toBossX, toBossZ) || 1;
      const nx = toBossX / dist;
      const nz = toBossZ / dist;

      const sideX = -nz;
      const sideZ = nx;
      camDesired.set(
        player.x - nx * 7.2 + sideX * 1.1,
        3.65,
        player.z - nz * 7.2 + sideZ * 1.1
      );
      camTarget.set(
        player.x + nx * Math.min(dist * 0.58, 6.4),
        2.1,
        player.z + nz * Math.min(dist * 0.58, 6.4)
      );
    } else {
      camDesired.set(
        player.x - Math.sin(player.yaw) * 7.4,
        3.8,
        player.z - Math.cos(player.yaw) * 7.4
      );
      camTarget.set(player.x, 1.85, player.z);
    }

    for (const p of PILLARS) {
      const dx = camDesired.x - p.x;
      const dz = camDesired.z - p.z;
      const d = Math.hypot(dx, dz);
      const minClear = p.r + 1.85;
      if (d < minClear && d > 0.001) {
        const push = minClear - d;
        camDesired.x += (dx / d) * push;
        camDesired.z += (dz / d) * push;
      }
    }

    camera.position.lerp(camDesired, 1 - Math.exp(-dt * 9.0));
    if (shakeIntensity > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity;
      shakeIntensity = Math.max(0, shakeIntensity - dt * 1.8);
    }
    camera.lookAt(camTarget);
  }

  let reticlePos = null;
  if (started && !combat.exploreMode && lockedOn && !combat.inCutscene && boss.state !== "dead") {
    bossScreenVec.set(boss.x, 2.35, boss.z);
    bossScreenVec.project(camera);
    if (bossScreenVec.z < 1) {
      reticlePos = {
        visible: true,
        x: (bossScreenVec.x * 0.5 + 0.5) * window.innerWidth,
        y: (-bossScreenVec.y * 0.5 + 0.5) * window.innerHeight,
      };
    }
  }

  if (started) {
    hud.update(combat, dt, reticlePos);
  }

  if (bloomEnabled && composer) {
    composer.render(dt);
  } else {
    renderer.render(scene, camera);
  }

  if (!firstFramePainted) {
    firstFramePainted = true;
    setTimeout(initPostEffects, 0);
  }
}

animate();
}
