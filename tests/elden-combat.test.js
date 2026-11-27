import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA_LIMIT,
  PILLARS,
  PLAYER_CONFIG,
  BOSS_CONFIG,
  GRACE_POS,
  FOG_GATE_POS,
  clampToArena,
  clampToExploreArea,
  createCombatState,
  getNearbyInteraction,
  restAtGrace,
  startBossEncounter,
  isPlayerInvulnerable,
  isPlayerBladeActive,
  isBossBladeActive,
  applyDamageToPlayer,
  applyDamageToBoss,
  stepCombat,
} from "../src/elden/combat.js";

test("player dodge roll grants i-frames and negates incoming boss damage", () => {
  const state = createCombatState();
  stepCombat(state, { moveX: 1, moveZ: 0, roll: true, lockedOn: true }, 0.016);
  assert.equal(state.player.state, "roll");

  // Advance into i-frame window
  stepCombat(state, { moveX: 0, moveZ: 0, lockedOn: true }, 0.1);
  assert.equal(isPlayerInvulnerable(state.player, state), true);

  const hpBefore = state.player.hp;
  const hit = applyDamageToPlayer(state, 250, true);
  assert.equal(hit, false);
  assert.equal(state.player.hp, hpBefore);
  assert.equal(state.stats.rollsDodged, 1);
});

test("Destined Death hit reduces effectiveMaxHp and applies burn debuff", () => {
  const state = createCombatState();
  const hit = applyDamageToPlayer(state, 180, true);
  assert.equal(hit, true);
  assert.equal(state.player.hp, PLAYER_CONFIG.maxHp - 180);
  assert.ok(state.player.effectiveMaxHp < PLAYER_CONFIG.maxHp);
  assert.ok(state.player.deathBurnTimer > 0);
});

test("Maerith Phase 2 cutscene locks player input, grants invulnerability, and restores control", () => {
  const state = createCombatState();
  applyDamageToBoss(state, 1600, 20);
  assert.equal(state.boss.phase, 2);
  assert.equal(state.boss.name, "Maerith, Blade of Destined Death");
  assert.equal(state.boss.state, "phase_transition");
  assert.equal(state.inCutscene, true);
  assert.equal(isPlayerInvulnerable(state.player, state), true);

  // Player cannot take damage or initiate attacks during cutscene
  const hpBefore = state.player.hp;
  assert.equal(applyDamageToPlayer(state, 300, true), false);
  assert.equal(state.player.hp, hpBefore);

  // Advance past burst point (0.57 * 2.8s ≈ 1.6s) and verify burst event
  let burstFired = false;
  for (let i = 0; i < 70; i++) {
    stepCombat(state, { moveX: 1, moveZ: 0, lightAttack: true, lockedOn: true }, 0.05);
    if (state.events.some((e) => e.type === "phase2_burst")) {
      burstFired = true;
    }
  }
  assert.equal(burstFired, true);
  assert.equal(state.inCutscene, false);
  assert.equal(state.boss.state, "stalk");
});

test("blade active helpers toggle strictly during attack windows", () => {
  const state = createCombatState();
  assert.equal(isPlayerBladeActive(state.player), false);
  assert.equal(isBossBladeActive(state.boss), false);

  stepCombat(state, { moveX: 0, moveZ: 0, lightAttack: true, lockedOn: true }, 0.016);
  stepCombat(state, { moveX: 0, moveZ: 0, lockedOn: true }, 0.16);
  assert.equal(isPlayerBladeActive(state.player), true);

  state.boss.state = "slash_combo";
  state.boss.stateDuration = 1.5;
  state.boss.stateTime = 0.75;
  assert.equal(isBossBladeActive(state.boss), true);
});

test("defeating Maerith sets victory state and arena clamps entities outside pillars", () => {
  const state = createCombatState();
  const entity = { x: PILLARS[0].x + 0.1, z: PILLARS[0].z, r: 0.65 };
  clampToArena(entity, 0.65);
  const distFromPillar = Math.hypot(entity.x - PILLARS[0].x, entity.z - PILLARS[0].z);
  assert.ok(distFromPillar >= PILLARS[0].r + 0.65 - 0.01);

  const far = { x: 99, z: 0 };
  clampToArena(far, 0.65);
  assert.ok(Math.hypot(far.x, far.z) <= ARENA_LIMIT - 0.65 + 0.01);

  applyDamageToBoss(state, BOSS_CONFIG.maxHp + 500, 0);
  assert.equal(state.boss.hp, 0);
  assert.equal(state.status, "victory");
});

test("explore mode keeps Maerith dormant, supports Site of Grace rest, and traverses mist into boss fight", () => {
  const state = createCombatState({ exploreMode: true });
  assert.equal(state.exploreMode, true);
  assert.equal(state.boss.state, "dormant");

  // Boss stays dormant while player walks around the Site of Grace terrace
  const bossZBefore = state.boss.z;
  for (let i = 0; i < 20; i++) {
    stepCombat(state, { moveX: 0, moveZ: -1, lockedOn: false }, 0.05);
  }
  assert.equal(state.boss.state, "dormant");
  assert.equal(state.boss.z, bossZBefore);
  assert.ok(state.player.z < 44.2);

  // Move right beside Site of Grace & rest
  state.player.x = GRACE_POS.x + 1.2;
  state.player.z = GRACE_POS.z;
  state.player.hp = 400;
  state.player.flasks = 1;
  assert.equal(getNearbyInteraction(state)?.type, "rest_grace");
  assert.equal(restAtGrace(state), true);
  assert.equal(state.player.hp, PLAYER_CONFIG.maxHp);
  assert.equal(state.player.flasks, PLAYER_CONFIG.flaskCount);

  // Bridge bounds clamp stray positions cleanly without falling into the abyss
  const offBridge = { x: 10, z: 27 };
  clampToExploreArea(offBridge, PLAYER_CONFIG.radius);
  assert.ok(Math.abs(offBridge.x) <= 4.1);

  // Walk to Golden Mist Gate & traverse into boss battle
  state.player.x = FOG_GATE_POS.x;
  state.player.z = FOG_GATE_POS.z + 1.1;
  assert.equal(getNearbyInteraction(state)?.type, "traverse_mist");
  assert.equal(startBossEncounter(state), true);
  assert.equal(state.exploreMode, false);
  assert.equal(state.boss.state, "stalk");
  assert.ok(state.player.z < 20);
});
