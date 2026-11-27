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

      const hpPct = (player.hp / player.maxHp) * 100;
      const capPct = ((player.maxHp - player.effectiveMaxHp) / player.maxHp) * 100;
      const fpPct = (player.fp / player.maxFp) * 100;
      const stamPct = (player.stamina / player.maxStamina) * 100;

      el.hpFill.style.width = `${hpPct}%`;
      el.hpDelay.style.width = `${hpPct}%`;
      el.hpBurnCap.style.width = `${capPct}%`;
      el.fpFill.style.width = `${fpPct}%`;
      el.stamFill.style.width = `${stamPct}%`;
      el.stamDelay.style.width = `${stamPct}%`;
      el.flaskCount.textContent = `${player.flasks}`;

      if (player.deathBurnTimer > 0) {
        el.statusEffects.textContent = "DESTINED DEATH";
        el.deathBurnOverlay.classList.add("active");
      } else {
        el.statusEffects.textContent = "";
        el.deathBurnOverlay.classList.remove("active");
      }

      if (!state.exploreMode) {
        el.bossName.textContent = boss.name;
        const bossHpPct = (boss.hp / boss.maxHp) * 100;
        el.bossHpFill.style.width = `${bossHpPct}%`;
        el.bossHpDelay.style.width = `${bossHpPct}%`;
        el.bossPoiseFill.style.width = `${(boss.poise / boss.maxPoise) * 100}%`;
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

      if (!state.exploreMode && reticlePos && reticlePos.visible && !state.inCutscene) {
        el.lockReticle.classList.remove("hidden");
        el.lockReticle.style.left = `${reticlePos.x}px`;
        el.lockReticle.style.top = `${reticlePos.y}px`;
      } else {
        el.lockReticle.classList.add("hidden");
      }

      const inCutscene = Boolean(state.inCutscene);
      el.letterboxTop.classList.toggle("active", inCutscene);
      el.letterboxBottom.classList.toggle("active", inCutscene);
      el.playerHud.classList.toggle("cutscene-hidden", inCutscene);
      el.quickSlots.classList.toggle("cutscene-hidden", inCutscene);
      el.controlsHint.classList.toggle("cutscene-hidden", inCutscene);
      el.bossHud.classList.toggle("cutscene-hidden", inCutscene);
    },
  };
}
