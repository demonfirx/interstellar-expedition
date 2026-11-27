export const ARENA_LIMIT = 22.4;

export const TERRACE_CENTER = { x: 0, z: 40.0, radius: 8.5 };
export const BRIDGE_BOUNDS = { zMin: 24.3, zMax: 40.0, halfWidth: 4.05 };
export const GRACE_POS = { x: 0, z: 40.0 };
export const FOG_GATE_POS = { x: 0, z: 24.4 };

export const PILLARS = [
  { x: 15.6, z: 0, r: 1.55 },
  { x: -15.6, z: 0, r: 1.55 },
  { x: 7.8, z: 13.5, r: 1.55 },
  { x: -7.8, z: 13.5, r: 1.55 },
  { x: 7.8, z: -13.5, r: 1.55 },
  { x: -7.8, z: -13.5, r: 1.55 },
];

export const PLAYER_CONFIG = {
  maxHp: 1000,
  maxFp: 120,
  maxStamina: 140,
  staminaRegen: 36,
  staminaRegenDelay: 0.55,
  moveSpeed: 7.2,
  blockMoveSpeed: 3.4,
  rollSpeed: 14.5,
  rollDuration: 0.44,
  rollIFrameStart: 0.04,
  rollIFrameEnd: 0.34,
  rollStamina: 24,
  lightCost: 18,
  heavyCost: 34,
  flaskCount: 5,
  flaskHeal: 480,
  radius: 0.65,
};

export const BOSS_CONFIG = {
  maxHp: 3200,
  maxPoise: 100,
  phase2Threshold: 0.52,
  stalkSpeedP1: 4.9,
  stalkSpeedP2: 6.4,
  radius: 1.25,
};

export function clampToArena(entity, radius) {
  // Pillar collision resolution
  for (const p of PILLARS) {
    const dx = entity.x - p.x;
    const dz = entity.z - p.z;
    const dist = Math.hypot(dx, dz);
    const minDist = p.r + radius;
    if (dist < minDist && dist > 0.0001) {
      const push = minDist - dist;
      entity.x += (dx / dist) * push;
      entity.z += (dz / dist) * push;
    }
  }
  // Outer circular rim
  const rDist = Math.hypot(entity.x, entity.z);
  const maxR = ARENA_LIMIT - radius;
  if (rDist > maxR && rDist > 0.0001) {
    entity.x = (entity.x / rDist) * maxR;
    entity.z = (entity.z / rDist) * maxR;
  }
}

export function clampToExploreArea(entity, radius) {
  const maxBridgeX = BRIDGE_BOUNDS.halfWidth - radius;
  const minBridgeZ = BRIDGE_BOUNDS.zMin + radius;
  const maxTerraceR = TERRACE_CENTER.radius - radius;

  const dxT = entity.x - TERRACE_CENTER.x;
  const dzT = entity.z - TERRACE_CENTER.z;
  const distT = Math.hypot(dxT, dzT);

  const inTerrace = distT <= maxTerraceR;
  const inBridge =
    Math.abs(entity.x) <= maxBridgeX &&
    entity.z >= minBridgeZ &&
    entity.z <= TERRACE_CENTER.z;

  if (inTerrace || inBridge) return;

  // Project onto the nearest valid point on either the bridge or the circular terrace
  const bx = Math.max(-maxBridgeX, Math.min(maxBridgeX, entity.x));
  const bz = Math.max(minBridgeZ, Math.min(TERRACE_CENTER.z, entity.z));
  const distToBridge = Math.hypot(entity.x - bx, entity.z - bz);

  const safeDistT = distT > 0.0001 ? distT : 1;
  const tx = TERRACE_CENTER.x + (dxT / safeDistT) * maxTerraceR;
  const tz = TERRACE_CENTER.z + (dzT / safeDistT) * maxTerraceR;
  const distToTerrace = Math.hypot(entity.x - tx, entity.z - tz);

  if (distToBridge <= distToTerrace) {
    entity.x = bx;
    entity.z = bz;
  } else {
    entity.x = tx;
    entity.z = tz;
  }
}

export function createCombatState({ exploreMode = false } = {}) {
  return {
    time: 0,
    status: "playing", // playing | victory | defeat
    exploreMode,
    inCutscene: false,
    events: [],
    projectiles: [],
    stats: {
      damageDealt: 0,
      damageTaken: 0,
      rollsDodged: 0,
      parries: 0,
      flasksUsed: 0,
    },
    player: {
      x: 0,
      z: exploreMode ? 44.2 : 14,
      yaw: Math.PI,
      hp: PLAYER_CONFIG.maxHp,
      maxHp: PLAYER_CONFIG.maxHp,
      effectiveMaxHp: PLAYER_CONFIG.maxHp,
      fp: PLAYER_CONFIG.maxFp,
      maxFp: PLAYER_CONFIG.maxFp,
      stamina: PLAYER_CONFIG.maxStamina,
      maxStamina: PLAYER_CONFIG.maxStamina,
      staminaDelay: 0,
      flasks: PLAYER_CONFIG.flaskCount,
      state: "idle", // idle | roll | light1 | light2 | heavy | block | heal | grace_rest | hit | dead
      stateTime: 0,
      stateDuration: 0,
      comboStep: 0,
      comboWindow: 0,
      hasHitThisSwing: false,
      rollDirX: 0,
      rollDirZ: -1,
      moveSpeed: 0,
      deathBurnTimer: 0,
      deathBurnTick: 0,
      blockStartTime: -10,
    },
    boss: {
      name: "Maerith, the Black Blade",
      x: 0,
      z: -11,
      yaw: 0,
      hp: BOSS_CONFIG.maxHp,
      maxHp: BOSS_CONFIG.maxHp,
      poise: BOSS_CONFIG.maxPoise,
      maxPoise: BOSS_CONFIG.maxPoise,
      poiseRegenDelay: 0,
      phase: 1,
      state: exploreMode ? "dormant" : "stalk", // dormant | stalk | slash_combo | overhead_slam | leap_slam | destined_arc | spin_frenzy | phase_transition | staggered | dead
      stateTime: 0,
      stateDuration: 0,
      cooldown: 1.2,
      hitFlags: [false, false, false],
      targetX: 0,
      targetZ: 14,
      moveSpeed: 0,
      lastAttack: "",
    },
  };
}

export function getNearbyInteraction(state) {
  if (!state.exploreMode || state.status !== "playing") return null;
  const { player } = state;
  const distFog = Math.hypot(player.x - FOG_GATE_POS.x, player.z - FOG_GATE_POS.z);
  if (distFog <= 3.6 && player.z <= 27.8) {
    return { type: "traverse_mist", label: "Traverse the Mist" };
  }
  const distGrace = Math.hypot(player.x - GRACE_POS.x, player.z - GRACE_POS.z);
  if (distGrace <= 3.4) {
    return { type: "rest_grace", label: "Rest at Site of Grace" };
  }
  return null;
}

export function restAtGrace(state) {
  if (!state.exploreMode || state.status !== "playing") return false;
  const { player } = state;
  player.hp = player.maxHp;
  player.effectiveMaxHp = player.maxHp;
  player.stamina = player.maxStamina;
  player.flasks = PLAYER_CONFIG.flaskCount;
  player.deathBurnTimer = 0;
  player.state = "grace_rest";
  player.stateTime = 0;
  player.stateDuration = 1.4;
  player.yaw = angleTo(player.x, player.z, GRACE_POS.x, GRACE_POS.z);
  state.events.push({ type: "grace_rested", x: GRACE_POS.x, z: GRACE_POS.z });
  return true;
}

export function startBossEncounter(state) {
  if (!state.exploreMode) return false;
  state.exploreMode = false;
  state.time = 0;
  state.projectiles.length = 0;
  state.player.x = 0;
  state.player.z = 16.5;
  state.player.yaw = Math.PI;
  state.player.state = "idle";
  state.player.stateTime = 0;
  state.player.stateDuration = 0;
  state.player.stamina = state.player.maxStamina;
  state.boss.state = "stalk";
  state.boss.stateTime = 0;
  state.boss.cooldown = 1.45;
  state.events.push({ type: "mist_traversed", x: 0, z: 23.6 });
  return true;
}

function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}

export function isPlayerInvulnerable(player, state = null) {
  if (player.state === "dead") return true;
  if (state && state.inCutscene) return true;
  if (player.state === "roll") {
    return (
      player.stateTime >= PLAYER_CONFIG.rollIFrameStart &&
      player.stateTime <= PLAYER_CONFIG.rollIFrameEnd
    );
  }
  return false;
}

export function isPlayerBladeActive(player) {
  if (player.stateDuration <= 0) return false;
  const p = player.stateTime / player.stateDuration;
  if (player.state === "light1" || player.state === "light2") {
    return p >= 0.24 && p <= 0.78;
  }
  if (player.state === "heavy") {
    return p >= 0.44 && p <= 0.84;
  }
  return false;
}

export function isBossBladeActive(boss) {
  if (boss.stateDuration <= 0) return false;
  const p = boss.stateTime / boss.stateDuration;
  if (boss.state === "slash_combo") return p >= 0.3 && p <= 0.92;
  if (boss.state === "overhead_slam") return p >= 0.42 && p <= 0.76;
  if (boss.state === "leap_slam") return p >= 0.45 && p <= 0.82;
  if (boss.state === "destined_arc") return p >= 0.38 && p <= 0.78;
  if (boss.state === "spin_frenzy") return p >= 0.14 && p <= 0.92;
  return false;
}

export function applyDamageToPlayer(state, rawDamage, isDestinedDeath = false) {
  const { player, boss } = state;
  if (player.state === "dead") return false;

  if (isPlayerInvulnerable(player, state)) {
    if (!state.inCutscene) {
      state.stats.rollsDodged += 1;
      state.events.push({ type: "perfect_dodge", x: player.x, z: player.z });
    }
    return false;
  }

  let finalDamage = rawDamage;

  // Check Block / Perfect Guard (Parry)
  if (player.state === "block") {
    const guardAge = state.time - player.blockStartTime;
    if (guardAge <= 0.22 && !isDestinedDeath) {
      // Perfect guard! Negate damage & deal boss poise damage
      state.stats.parries += 1;
      boss.poise = Math.max(0, boss.poise - 28);
      boss.poiseRegenDelay = 4.0;
      state.events.push({ type: "parry", x: player.x, z: player.z });
      return false;
    }
    const stamCost = Math.min(player.stamina, rawDamage * 0.22);
    player.stamina = Math.max(0, player.stamina - stamCost);
    player.staminaDelay = PLAYER_CONFIG.staminaRegenDelay;
    finalDamage = Math.round(rawDamage * (isDestinedDeath ? 0.35 : 0.22));
    state.events.push({ type: "block_hit", x: player.x, z: player.z, damage: finalDamage });
  } else {
    player.state = "hit";
    player.stateTime = 0;
    player.stateDuration = 0.28;
    state.events.push({
      type: "player_hit",
      x: player.x,
      z: player.z,
      damage: finalDamage,
      destinedDeath: isDestinedDeath,
    });
  }

  player.hp = Math.max(0, player.hp - finalDamage);
  state.stats.damageTaken += finalDamage;

  // Destined Death debuff: temporary max HP reduction + HP burn
  if (isDestinedDeath) {
    player.deathBurnTimer = 4.5;
    player.effectiveMaxHp = Math.max(
      Math.round(player.maxHp * 0.72),
      player.effectiveMaxHp - Math.round(player.maxHp * 0.08)
    );
    if (player.hp > player.effectiveMaxHp) {
      player.hp = player.effectiveMaxHp;
    }
  }

  if (player.hp <= 0) {
    player.state = "dead";
    player.stateTime = 0;
    state.status = "defeat";
    state.events.push({ type: "player_death" });
  }
  return true;
}

export function applyDamageToBoss(state, damage, poiseDamage) {
  const { boss } = state;
  if (boss.state === "dead") return;

  // Riposte bonus if boss is staggered
  const multiplier = boss.state === "staggered" ? 1.65 : 1.0;
  const totalDamage = Math.round(damage * multiplier);
  boss.hp = Math.max(0, boss.hp - totalDamage);
  state.stats.damageDealt += totalDamage;

  state.events.push({
    type: "boss_hit",
    x: boss.x,
    z: boss.z,
    damage: totalDamage,
    critical: boss.state === "staggered",
  });

  if (boss.state !== "staggered" && boss.state !== "phase_transition") {
    boss.poise = Math.max(0, boss.poise - poiseDamage);
    boss.poiseRegenDelay = 5.0;
    if (boss.poise <= 0) {
      boss.state = "staggered";
      boss.stateTime = 0;
      boss.stateDuration = 2.6;
      boss.poise = boss.maxPoise;
      state.events.push({ type: "boss_stagger", x: boss.x, z: boss.z });
    }
  }

  // Trigger Phase 2 transition
  if (
    boss.phase === 1 &&
    boss.hp > 0 &&
    boss.hp <= boss.maxHp * BOSS_CONFIG.phase2Threshold
  ) {
    boss.phase = 2;
    boss.name = "Maerith, Blade of Destined Death";
    boss.state = "phase_transition";
    boss.stateTime = 0;
    boss.stateDuration = 2.8;
    boss.hitFlags = [false, false, false];
    state.inCutscene = true;
    state.projectiles.length = 0;
    state.events.push({
      type: "phase2_start",
      x: boss.x,
      z: boss.z,
      dialogue: "O, Death... Become my blade once more.",
    });
  }

  if (boss.hp <= 0) {
    boss.state = "dead";
    boss.stateTime = 0;
    state.status = "victory";
    state.events.push({ type: "boss_death", x: boss.x, z: boss.z });
  }
}

function chooseBossAttack(state) {
  const { boss, player } = state;
  const dist = Math.hypot(player.x - boss.x, player.z - boss.z);
  const p2 = boss.phase === 2;

  let options;
  if (dist > 9.5) {
    options = p2 ? ["leap_slam", "destined_arc", "destined_arc"] : ["leap_slam", "destined_arc"];
  } else if (dist > 5.0) {
    options = p2
      ? ["slash_combo", "leap_slam", "destined_arc", "spin_frenzy"]
      : ["slash_combo", "overhead_slam", "leap_slam"];
  } else {
    options = p2
      ? ["slash_combo", "spin_frenzy", "overhead_slam"]
      : ["slash_combo", "overhead_slam"];
  }

  // Avoid repeating the exact same attack twice in a row when possible
  const filtered = options.filter((o) => o !== boss.lastAttack);
  const pool = filtered.length ? filtered : options;
  const pick = pool[Math.floor(Math.random() * pool.length)];

  boss.lastAttack = pick;
  boss.state = pick;
  boss.stateTime = 0;
  boss.hitFlags = [false, false, false];
  boss.targetX = player.x;
  boss.targetZ = player.z;

  const speedScale = p2 ? 0.88 : 1.0;
  const durations = {
    slash_combo: 1.55 * speedScale,
    overhead_slam: 1.35 * speedScale,
    leap_slam: 1.45 * speedScale,
    destined_arc: 1.25 * speedScale,
    spin_frenzy: 1.65 * speedScale,
  };
  boss.stateDuration = durations[pick];
  state.events.push({ type: "boss_attack_start", attack: pick, x: boss.x, z: boss.z });
}

export function stepCombat(state, input, dt) {
  state.events = [];
  if (state.status !== "playing") {
    state.player.stateTime += dt;
    state.boss.stateTime += dt;
    return;
  }

  state.time += dt;
  const { player, boss } = state;

  // --- Destined Death DoT on player ---
  if (player.deathBurnTimer > 0) {
    player.deathBurnTimer = Math.max(0, player.deathBurnTimer - dt);
    player.deathBurnTick += dt;
    if (player.deathBurnTick >= 0.45) {
      player.deathBurnTick = 0;
      const burnDmg = 14;
      player.hp = Math.max(1, player.hp - burnDmg);
      state.stats.damageTaken += burnDmg;
    }
    if (player.deathBurnTimer === 0) {
      player.effectiveMaxHp = player.maxHp;
    }
  }

  // --- Stamina regeneration ---
  if (player.staminaDelay > 0) {
    player.staminaDelay = Math.max(0, player.staminaDelay - dt);
  } else if (player.state === "idle" || player.state === "block") {
    const rate = player.state === "block" ? PLAYER_CONFIG.staminaRegen * 0.35 : PLAYER_CONFIG.staminaRegen;
    player.stamina = Math.min(player.maxStamina, player.stamina + rate * dt);
  }

  if (player.comboWindow > 0) {
    player.comboWindow = Math.max(0, player.comboWindow - dt);
  }

  // --- Player Actions & State Machine ---
  const effectiveInput = state.inCutscene
    ? { moveX: 0, moveZ: 0, roll: false, lightAttack: false, heavyAttack: false, heal: false, block: false, lockedOn: true }
    : input;
  const canAct = !state.inCutscene && (player.state === "idle" || player.state === "block");

  // Trigger Roll
  if (effectiveInput.roll && canAct && player.stamina >= PLAYER_CONFIG.rollStamina) {
    player.stamina -= PLAYER_CONFIG.rollStamina;
    player.staminaDelay = PLAYER_CONFIG.staminaRegenDelay;
    player.state = "roll";
    player.stateTime = 0;
    player.stateDuration = PLAYER_CONFIG.rollDuration;
    if (Math.hypot(effectiveInput.moveX, effectiveInput.moveZ) > 0.1) {
      const len = Math.hypot(effectiveInput.moveX, effectiveInput.moveZ);
      player.rollDirX = effectiveInput.moveX / len;
      player.rollDirZ = effectiveInput.moveZ / len;
      player.yaw = Math.atan2(player.rollDirX, player.rollDirZ);
    } else {
      player.rollDirX = Math.sin(player.yaw);
      player.rollDirZ = Math.cos(player.yaw);
    }
    state.events.push({ type: "player_roll", x: player.x, z: player.z });
  }
  // Trigger Flask Heal
  else if (effectiveInput.heal && canAct && player.flasks > 0 && player.hp < player.effectiveMaxHp) {
    player.flasks -= 1;
    state.stats.flasksUsed += 1;
    player.state = "heal";
    player.stateTime = 0;
    player.stateDuration = 0.78;
    player.hasHitThisSwing = false;
    state.events.push({ type: "player_heal_start", x: player.x, z: player.z });
  }
  // Trigger Light Attack
  else if (effectiveInput.lightAttack && canAct && player.stamina >= PLAYER_CONFIG.lightCost) {
    player.stamina -= PLAYER_CONFIG.lightCost;
    player.staminaDelay = PLAYER_CONFIG.staminaRegenDelay;
    const isSecond = player.comboWindow > 0 && player.comboStep === 1;
    player.comboStep = isSecond ? 2 : 1;
    player.state = isSecond ? "light2" : "light1";
    player.stateTime = 0;
    player.stateDuration = isSecond ? 0.48 : 0.44;
    player.hasHitThisSwing = false;
      if (!state.exploreMode && effectiveInput.lockedOn) {
        player.yaw = angleTo(player.x, player.z, boss.x, boss.z);
      }
      state.events.push({ type: "player_swing", heavy: false, x: player.x, z: player.z });
  }
  // Trigger Heavy Attack
  else if (effectiveInput.heavyAttack && canAct && player.stamina >= PLAYER_CONFIG.heavyCost) {
    player.stamina -= PLAYER_CONFIG.heavyCost;
    player.staminaDelay = PLAYER_CONFIG.staminaRegenDelay;
    player.state = "heavy";
    player.stateTime = 0;
    player.stateDuration = 0.78;
    player.hasHitThisSwing = false;
    if (!state.exploreMode && effectiveInput.lockedOn) {
      player.yaw = angleTo(player.x, player.z, boss.x, boss.z);
    }
    state.events.push({ type: "player_swing", heavy: true, x: player.x, z: player.z });
  }

  // Update active player state
  player.moveSpeed = 0;
  if (player.state === "idle" || player.state === "block") {
    if (effectiveInput.block && player.stamina > 4) {
      if (player.state !== "block") {
        player.blockStartTime = state.time;
      }
      player.state = "block";
    } else {
      player.state = "idle";
    }

    const moveLen = Math.hypot(effectiveInput.moveX, effectiveInput.moveZ);
    if (moveLen > 0.05) {
      const nx = effectiveInput.moveX / moveLen;
      const nz = effectiveInput.moveZ / moveLen;
      const spd = player.state === "block" ? PLAYER_CONFIG.blockMoveSpeed : PLAYER_CONFIG.moveSpeed;
      player.x += nx * spd * dt;
      player.z += nz * spd * dt;
      player.moveSpeed = spd;
      if (!state.exploreMode && effectiveInput.lockedOn) {
        player.yaw = lerpAngle(player.yaw, angleTo(player.x, player.z, boss.x, boss.z), dt * 14);
      } else {
        player.yaw = lerpAngle(player.yaw, Math.atan2(nx, nz), dt * 12);
      }
    } else if (!state.exploreMode && effectiveInput.lockedOn) {
      player.yaw = lerpAngle(player.yaw, angleTo(player.x, player.z, boss.x, boss.z), dt * 10);
    }
  } else {
    player.stateTime += dt;
    const progress = player.stateDuration > 0 ? player.stateTime / player.stateDuration : 1;

    if (player.state === "roll") {
      player.x += player.rollDirX * PLAYER_CONFIG.rollSpeed * dt;
      player.z += player.rollDirZ * PLAYER_CONFIG.rollSpeed * dt;
    } else if (player.state === "heal") {
      if (!player.hasHitThisSwing && progress >= 0.45) {
        player.hasHitThisSwing = true;
        player.hp = Math.min(player.effectiveMaxHp, player.hp + PLAYER_CONFIG.flaskHeal);
        state.events.push({ type: "player_healed", x: player.x, z: player.z });
      }
    } else if (player.state === "light1" || player.state === "light2" || player.state === "heavy") {
      // Forward lunge during swing
      if (progress < 0.35) {
        const lunge = player.state === "heavy" ? 3.8 : 2.6;
        player.x += Math.sin(player.yaw) * lunge * dt;
        player.z += Math.cos(player.yaw) * lunge * dt;
      }

      const hitStart = player.state === "heavy" ? 0.48 : 0.34;
      const hitEnd = player.state === "heavy" ? 0.72 : 0.65;
      if (!state.exploreMode && !player.hasHitThisSwing && progress >= hitStart && progress <= hitEnd) {
        const reach = player.state === "heavy" ? 3.9 : 3.4;
        const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
        if (dist <= reach + BOSS_CONFIG.radius) {
          const toBoss = angleTo(player.x, player.z, boss.x, boss.z);
          let angDiff = Math.abs(((toBoss - player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI);
          if (angDiff > Math.PI) angDiff = Math.PI * 2 - angDiff;
          if (angDiff < 1.35) {
            player.hasHitThisSwing = true;
            const dmg = player.state === "heavy" ? 290 : player.state === "light2" ? 165 : 140;
            const poiseDmg = player.state === "heavy" ? 36 : 15;
            applyDamageToBoss(state, dmg, poiseDmg);
          }
        }
      }
    }

    if (player.stateTime >= player.stateDuration) {
      if (player.state === "light1") {
        player.comboWindow = 0.55;
      }
      player.state = "idle";
      player.stateTime = 0;
    }
  }

  if (state.exploreMode) {
    clampToExploreArea(player, PLAYER_CONFIG.radius);
    boss.moveSpeed = 0;
    boss.stateTime += dt;
    return;
  }

  clampToArena(player, PLAYER_CONFIG.radius);

  // --- Boss AI & Attacks ---
  if (boss.poiseRegenDelay > 0) {
    boss.poiseRegenDelay = Math.max(0, boss.poiseRegenDelay - dt);
  } else if (boss.poise < boss.maxPoise && boss.state !== "staggered") {
    boss.poise = Math.min(boss.maxPoise, boss.poise + 12 * dt);
  }

  boss.moveSpeed = 0;
  const distToPlayer = Math.hypot(player.x - boss.x, player.z - boss.z);
  const angleToPlayer = angleTo(boss.x, boss.z, player.x, player.z);
  const p2 = boss.phase === 2;

  if (boss.state === "stalk") {
    boss.cooldown = Math.max(0, boss.cooldown - dt);
    boss.yaw = lerpAngle(boss.yaw, angleToPlayer, dt * 6.5);

    if (distToPlayer > 3.6) {
      const spd = p2 ? BOSS_CONFIG.stalkSpeedP2 : BOSS_CONFIG.stalkSpeedP1;
      boss.x += Math.sin(boss.yaw) * spd * dt;
      boss.z += Math.cos(boss.yaw) * spd * dt;
      boss.moveSpeed = spd;
    }

    if (boss.cooldown <= 0 && distToPlayer < 18) {
      chooseBossAttack(state);
    }
  } else {
    boss.stateTime += dt;
    const progress = boss.stateDuration > 0 ? boss.stateTime / boss.stateDuration : 1;

    if (boss.state === "phase_transition") {
      state.inCutscene = true;
      if (!boss.hitFlags[0] && progress >= 0.57) {
        boss.hitFlags[0] = true;
        state.events.push({ type: "phase2_burst", x: boss.x, z: boss.z });
      }
    } else if (boss.state === "slash_combo") {
      if (progress < 0.35) {
        boss.yaw = lerpAngle(boss.yaw, angleToPlayer, dt * 8);
      }
      // First slash
      if (!boss.hitFlags[0] && progress >= 0.42 && progress <= 0.56) {
        boss.x += Math.sin(boss.yaw) * 6 * dt;
        boss.z += Math.cos(boss.yaw) * 6 * dt;
        if (distToPlayer <= 5.2) {
          boss.hitFlags[0] = true;
          applyDamageToPlayer(state, p2 ? 210 : 165, p2);
        }
      }
      // Second reverse slash
      if (!boss.hitFlags[1] && progress >= 0.72 && progress <= 0.88) {
        boss.x += Math.sin(boss.yaw) * 7 * dt;
        boss.z += Math.cos(boss.yaw) * 7 * dt;
        if (distToPlayer <= 5.4) {
          boss.hitFlags[1] = true;
          applyDamageToPlayer(state, p2 ? 245 : 190, p2);
        }
      }
    } else if (boss.state === "overhead_slam") {
      if (progress < 0.45) {
        boss.yaw = lerpAngle(boss.yaw, angleToPlayer, dt * 7);
      }
      if (!boss.hitFlags[0] && progress >= 0.55) {
        boss.hitFlags[0] = true;
        const slamX = boss.x + Math.sin(boss.yaw) * 2.6;
        const slamZ = boss.z + Math.cos(boss.yaw) * 2.6;
        state.events.push({ type: "shockwave", x: slamX, z: slamZ, radius: 5.5, crimson: p2 });
        if (Math.hypot(player.x - slamX, player.z - slamZ) <= 4.8) {
          applyDamageToPlayer(state, p2 ? 290 : 230, p2);
        }
      }
    } else if (boss.state === "leap_slam") {
      if (progress < 0.65) {
        boss.yaw = lerpAngle(boss.yaw, angleTo(boss.x, boss.z, boss.targetX, boss.targetZ), dt * 10);
        const dx = boss.targetX - boss.x;
        const dz = boss.targetZ - boss.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.2) {
          const leapSpd = Math.min(20, d * 2.4);
          boss.x += (dx / d) * leapSpd * dt;
          boss.z += (dz / d) * leapSpd * dt;
        }
      } else if (!boss.hitFlags[0]) {
        boss.hitFlags[0] = true;
        state.events.push({ type: "shockwave", x: boss.x, z: boss.z, radius: 6.5, crimson: true });
        if (distToPlayer <= 5.5) {
          applyDamageToPlayer(state, p2 ? 310 : 250, true);
        }
      }
    } else if (boss.state === "destined_arc") {
      if (progress < 0.42) {
        boss.yaw = lerpAngle(boss.yaw, angleToPlayer, dt * 9);
      }
      if (!boss.hitFlags[0] && progress >= 0.48) {
        boss.hitFlags[0] = true;
        const count = p2 ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const spread = count === 3 ? (i - 1) * 0.24 : 0;
          const dir = boss.yaw + spread;
          state.projectiles.push({
            id: `${state.time}_${i}`,
            x: boss.x + Math.sin(dir) * 2.0,
            z: boss.z + Math.cos(dir) * 2.0,
            vx: Math.sin(dir) * (p2 ? 24 : 19),
            vz: Math.cos(dir) * (p2 ? 24 : 19),
            yaw: dir,
            life: 2.2,
            radius: 1.3,
            damage: p2 ? 225 : 175,
          });
        }
        state.events.push({ type: "destined_arc_fired", x: boss.x, z: boss.z });
      }
    } else if (boss.state === "spin_frenzy") {
      boss.yaw = lerpAngle(boss.yaw, angleToPlayer, dt * 4);
      boss.x += Math.sin(angleToPlayer) * 6.5 * dt;
      boss.z += Math.cos(angleToPlayer) * 6.5 * dt;
      const tickIdx = progress < 0.35 ? 0 : progress < 0.65 ? 1 : 2;
      if (!boss.hitFlags[tickIdx] && progress > 0.18) {
        if (distToPlayer <= 5.4) {
          boss.hitFlags[tickIdx] = true;
          applyDamageToPlayer(state, 165, true);
        }
      }
    }

    if (boss.stateTime >= boss.stateDuration) {
      if (boss.state === "phase_transition") {
        state.inCutscene = false;
      }
      boss.state = "stalk";
      boss.stateTime = 0;
      boss.cooldown = p2 ? 0.55 + Math.random() * 0.45 : 0.9 + Math.random() * 0.65;
    }
  }

  clampToArena(boss, BOSS_CONFIG.radius);

  // --- Update Destined Death Projectiles ---
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.x += proj.vx * dt;
    proj.z += proj.vz * dt;
    proj.life -= dt;

    // Hit pillar?
    let blocked = false;
    for (const p of PILLARS) {
      if (Math.hypot(proj.x - p.x, proj.z - p.z) < p.r + 0.6) {
        blocked = true;
        state.events.push({ type: "projectile_blocked", x: proj.x, z: proj.z });
        break;
      }
    }
    if (blocked || proj.life <= 0 || Math.hypot(proj.x, proj.z) > ARENA_LIMIT + 4) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Hit player?
    if (Math.hypot(proj.x - player.x, proj.z - player.z) < proj.radius + PLAYER_CONFIG.radius) {
      applyDamageToPlayer(state, proj.damage, true);
      state.projectiles.splice(i, 1);
    }
  }
}
