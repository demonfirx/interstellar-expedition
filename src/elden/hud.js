export function createHUD() {
  const el = {
    titleScreen: document.getElementById("title-screen"),
    playerHud: document.getElementById("player-hud"),
    quickSlots: document.getElementById("quick-slots"),
    controlsHint: document.getElementById("controls-hint"),
    bossHud: document.getElementById("boss-hud"),
    resultScreen: document.getElementById("result-screen"),
    resultTitle: document.getElementById("result-title"),
    resultSubtitle: document.getElementById("result-subtitle"),
    resultStats: document.getElementById("result-stats"),
    hpFill: document.getElementById("hp-fill"),
    hpDelay: document.getElementById("hp-delay"),
    hpBurnCap: document.getElementById("hp-burn-cap"),
    fpFill: document.getElementById("fp-fill"),
    stamFill: document.getElementById("stam-fill"),
    stamDelay: document.getElementById("stam-delay"),
    statusEffects: document.getElementById("status-effects"),
    flaskCount: document.getElementById("flask-count"),
    bossName: document.getElementById("boss-name"),
    bossDmgNum: document.getElementById("boss-dmg-num"),
    bossHpFill: document.getElementById("boss-hp-fill"),
    bossHpDelay: document.getElementById("boss-hp-delay"),
    bossPoiseFill: document.getElementById("boss-poise-fill"),
    bossDialogue: document.getElementById("boss-dialogue"),
    bossDialogueText: document.getElementById("boss-dialogue-text"),
    zoneBanner: document.getElementById("zone-banner"),
    zoneBannerTitle: document.getElementById("zone-banner-title"),
    zoneBannerSub: document.getElementById("zone-banner-sub"),
    interactPrompt: document.getElementById("interact-prompt"),
    interactLabel: document.getElementById("interact-label"),
    deathBurnOverlay: document.getElementById("death-burn-overlay"),
    hitFlash: document.getElementById("hit-flash"),
    lockReticle: document.getElementById("lock-reticle"),
    letterboxTop: document.getElementById("letterbox-top"),
    letterboxBottom: document.getElementById("letterbox-bottom"),
  };

  let dialogueTimer = 0;
  let bannerTimer = 0;
  let dmgAccum = 0;
  let dmgHideTimer = 0;

  // Cache previous DOM values to avoid unnecessary per-frame style/layout invalidation
  let lastHp = -1;
  let lastCap = -1;
  let lastFp = -1;
  let lastStam = -1;
  let lastFlasks = -1;
  let lastBurn = null;
  let lastBossName = "";
  let lastBossHp = -1;
  let lastBossPoise = -1;
  let lastReticleVis = null;
  let lastReticleX = -1;
  let lastReticleY = -1;
  let lastCutscene = null;

  const EXPLORE_HINTS = `
    <div><kbd>WASD</kbd> Walk &nbsp; <kbd>DRAG</kbd> Look Around &nbsp; <kbd>SCROLL</kbd> Zoom</div>
    <div><kbd>E</kbd> Interact (Grace / Mist) &nbsp; <kbd>SPACE</kbd> Dodge Roll</div>
    <div><kbd>LMB</kbd> / <kbd>J</kbd> Light &nbsp; <kbd>RMB</kbd> / <kbd>K</kbd> Heavy &nbsp; <kbd>SHIFT</kbd> Guard</div>
    <div><kbd>R</kbd> Crimson Flask &nbsp; <kbd>M</kbd> Mute</div>
  `;

  const BOSS_HINTS = `
    <div><kbd>WASD</kbd> Move &nbsp; <kbd>SPACE</kbd> Dodge Roll</div>
    <div><kbd>LMB</kbd> / <kbd>J</kbd> Light Attack &nbsp; <kbd>RMB</kbd> / <kbd>K</kbd> Heavy</div>
    <div><kbd>SHIFT</kbd> Block / Parry &nbsp; <kbd>R</kbd> Crimson Flask</div>
    <div><kbd>Q</kbd> / <kbd>TAB</kbd> Lock-On &nbsp; <kbd>M</kbd> Mute</div>
  `;

  return {
    showExplore() {
      el.titleScreen.classList.add("hidden");
      el.resultScreen.classList.add("hidden");
      el.bossHud.classList.add("hidden");
      el.lockReticle.classList.add("hidden");
      el.playerHud.classList.remove("hidden", "cutscene-hidden");
      el.quickSlots.classList.remove("hidden", "cutscene-hidden");
      el.controlsHint.classList.remove("hidden", "cutscene-hidden");
      el.controlsHint.innerHTML = EXPLORE_HINTS;
      el.letterboxTop.classList.remove("active");
      el.letterboxBottom.classList.remove("active");
    },

    showGameplay() {
      el.titleScreen.classList.add("hidden");
      el.resultScreen.classList.add("hidden");
      el.interactPrompt.classList.add("hidden");
      el.playerHud.classList.remove("hidden", "cutscene-hidden");
      el.quickSlots.classList.remove("hidden", "cutscene-hidden");
      el.controlsHint.classList.remove("hidden", "cutscene-hidden");
      el.controlsHint.innerHTML = BOSS_HINTS;
      el.bossHud.classList.remove("hidden", "cutscene-hidden");
      el.letterboxTop.classList.remove("active");
      el.letterboxBottom.classList.remove("active");
    },

    showZoneBanner(title, subtitle = "", duration = 3.2) {
      el.zoneBannerTitle.textContent = title;
      el.zoneBannerSub.textContent = subtitle;
      el.zoneBannerSub.classList.toggle("hidden", !subtitle);
      el.zoneBanner.classList.remove("hidden");
      bannerTimer = duration;
    },

    setInteractPrompt(interaction) {
      if (interaction) {
        el.interactLabel.textContent = interaction.label;
        el.interactPrompt.classList.remove("hidden");
      } else {
        el.interactPrompt.classList.add("hidden");
      }
    },

    flashHit() {
      el.hitFlash.classList.add("flash");
      setTimeout(() => el.hitFlash.classList.remove("flash"), 140);
    },

    showDialogue(text, duration = 3.4) {
      el.bossDialogueText.textContent = `"${text}"`;
      el.bossDialogue.classList.remove("hidden");
      dialogueTimer = duration;
    },

    showBossDamage(amount) {
      dmgAccum += amount;
      dmgHideTimer = 1.6;
      el.bossDmgNum.textContent = `${dmgAccum}`;
      el.bossDmgNum.classList.remove("hidden");
    },

    showResult(victory, stats, elapsed) {
      el.interactPrompt.classList.add("hidden");
      el.resultScreen.classList.remove("hidden");
      el.resultTitle.className = victory ? "victory" : "defeat";
      el.resultTitle.textContent = victory ? "DEMIGOD FELLED" : "YOU DIED";
      el.resultSubtitle.textContent = victory
        ? "Destined Death has been unbound."
        : "Maerith claims another Tarnished.";
      el.resultStats.innerHTML = `
        <span>TIME ${Math.floor(elapsed)}s</span>
        <span>DAMAGE DEALT ${stats.damageDealt}</span>
        <span>DODGES ${stats.rollsDodged}</span>
        <span>PARRIES ${stats.parries}</span>
      `;
    },

    update(state, dt, reticlePos) {
      const { player, boss } = state;

      const hpPct = Math.round((player.hp / player.maxHp) * 1000) / 10;
      const capPct = Math.round(((player.maxHp - player.effectiveMaxHp) / player.maxHp) * 1000) / 10;
      const fpPct = Math.round((player.fp / player.maxFp) * 1000) / 10;
      const stamPct = Math.round((player.stamina / player.maxStamina) * 1000) / 10;

      if (hpPct !== lastHp) {
        lastHp = hpPct;
        const w = `${hpPct}%`;
        el.hpFill.style.width = w;
        el.hpDelay.style.width = w;
      }
      if (capPct !== lastCap) {
        lastCap = capPct;
        el.hpBurnCap.style.width = `${capPct}%`;
      }
      if (fpPct !== lastFp) {
        lastFp = fpPct;
        el.fpFill.style.width = `${fpPct}%`;
      }
      if (stamPct !== lastStam) {
        lastStam = stamPct;
        const w = `${stamPct}%`;
        el.stamFill.style.width = w;
        el.stamDelay.style.width = w;
      }
      if (player.flasks !== lastFlasks) {
        lastFlasks = player.flasks;
        el.flaskCount.textContent = `${player.flasks}`;
      }

      const burning = player.deathBurnTimer > 0;
      if (burning !== lastBurn) {
        lastBurn = burning;
        el.statusEffects.textContent = burning ? "DESTINED DEATH" : "";
        el.deathBurnOverlay.classList.toggle("active", burning);
      }

      if (!state.exploreMode) {
        if (boss.name !== lastBossName) {
          lastBossName = boss.name;
          el.bossName.textContent = boss.name;
        }
        const bossHpPct = Math.round((boss.hp / boss.maxHp) * 1000) / 10;
        if (bossHpPct !== lastBossHp) {
          lastBossHp = bossHpPct;
          const w = `${bossHpPct}%`;
          el.bossHpFill.style.width = w;
          el.bossHpDelay.style.width = w;
        }
        const poisePct = Math.round((boss.poise / boss.maxPoise) * 1000) / 10;
        if (poisePct !== lastBossPoise) {
          lastBossPoise = poisePct;
          el.bossPoiseFill.style.width = `${poisePct}%`;
        }
      }

      if (dialogueTimer > 0) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0) {
          el.bossDialogue.classList.add("hidden");
        }
      }

      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) {
          el.zoneBanner.classList.add("hidden");
        }
      }

      if (dmgHideTimer > 0) {
        dmgHideTimer -= dt;
        if (dmgHideTimer <= 0) {
          dmgAccum = 0;
          el.bossDmgNum.classList.add("hidden");
        }
      }

      const showReticle = Boolean(!state.exploreMode && reticlePos && reticlePos.visible && !state.inCutscene);
      if (showReticle !== lastReticleVis) {
        lastReticleVis = showReticle;
        el.lockReticle.classList.toggle("hidden", !showReticle);
      }
      if (showReticle) {
        const rx = Math.round(reticlePos.x);
        const ry = Math.round(reticlePos.y);
        if (rx !== lastReticleX || ry !== lastReticleY) {
          lastReticleX = rx;
          lastReticleY = ry;
          el.lockReticle.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
        }
      }

      const inCutscene = Boolean(state.inCutscene);
      if (inCutscene !== lastCutscene) {
        lastCutscene = inCutscene;
        el.letterboxTop.classList.toggle("active", inCutscene);
        el.letterboxBottom.classList.toggle("active", inCutscene);
        el.playerHud.classList.toggle("cutscene-hidden", inCutscene);
        el.quickSlots.classList.toggle("cutscene-hidden", inCutscene);
        el.controlsHint.classList.toggle("cutscene-hidden", inCutscene);
        el.bossHud.classList.toggle("cutscene-hidden", inCutscene);
      }
    },
  };
}
