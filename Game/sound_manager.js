// ============================================================
// Sound Manager (Phase 8) — the single owner of every sound.
//
// Plain script, one global (window.SoundManager) — index.html loads this
// BEFORE game.js, and neither file is a module, so there is no import here.
//
// Design rules that game.js relies on:
//   * Every entry point no-ops when its key isn't loaded (see hasSound). The
//     game must run identically with the audio files deleted — same contract
//     as hasAsset()/placeholder primitives on the sprite side.
//   * Volumes are two numbers, music and sfx, each 0..1. A sound's final
//     volume is always <category volume> * <its own base volume>, so the
//     sliders stay authoritative and nothing bypasses them.
//   * Settings survive the Restart button, which does a location.reload() —
//     hence localStorage rather than module state.
// ============================================================

window.SoundManager = (function () {
  'use strict';

  // ---------- Keys (match data/assets.json) ----------
  const MUSIC_MAIN = 'music_game';
  const SFX = {
    start: 'sfx_start',
    bonus: 'sfx_bonus',
    walkGrass: 'sfx_walk_grass',
    walkStone: 'sfx_walk_stone',
    jump: 'sfx_jump'
  };

  // Which footstep recording each scenery type walks on. Anything not listed
  // (including a brand-new scenery type added to world.json) falls back to
  // grass, so unknown ground never goes silent.
  const SURFACE_SFX = {
    ground: SFX.walkGrass,
    platform: SFX.walkStone,
    wall: SFX.walkStone,
    pipe: SFX.walkStone
  };
  const DEFAULT_SURFACE = 'ground';

  // Footsteps play as a looping sound rather than one-shots fired on a timer.
  // The two recordings are very different lengths (grass 0.47s, stone 1.78s),
  // so any fixed step interval would fit one and fight the other — looping lets
  // each file keep the cadence it was recorded with. If a file turns out to be
  // a single footstep instead of a walk cycle, that's the thing to revisit here.
  const FOOTSTEP_MODE = 'loop';

  // Base (pre-slider) levels. Music sits under the effects on purpose.
  const BASE_VOLUME = { music: 0.6, footstep: 1.0, sfx: 1.0 };

  const MUSIC_FADE_IN_MS = 800;
  const MODAL_DUCK_MS = 400;
  const STORAGE_KEY = 'bio_game_audio';

  // ---------- State ----------
  let scene = null;
  let musicVolume = 0.7;
  let sfxVolume = 0.8;

  let music = null;          // the Phaser sound object for the current track
  let musicKey = null;
  let ducked = false;        // music paused because a modal is open

  let footstep = null;       // looping walk sound, or null when not walking
  let walking = false;
  let surface = DEFAULT_SURFACE;

  // ============================================================
  // Setup
  // ============================================================
  // init() only captures the scene, and it lands late — buildWorld() runs after
  // the manifest's second load pass finishes. Saved volumes are read at module
  // construction instead (bottom of this file) so wireDomUI() can seed the
  // settings sliders from them well before any scene exists.
  function init(sceneRef) {
    scene = sceneRef;
  }

  // Audio lives in scene.cache.audio, NOT scene.textures — game.js's hasAsset()
  // would always answer false for a sound key.
  function hasSound(key) {
    return !!(scene && key && scene.cache.audio.exists(key));
  }

  // ============================================================
  // Persistence — survives the Restart button's location.reload()
  // ============================================================
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (typeof saved.music === 'number') musicVolume = clamp01(saved.music);
      if (typeof saved.sfx === 'number') sfxVolume = clamp01(saved.sfx);
    } catch (err) {
      // Private-mode / disabled storage: just keep the defaults.
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ music: musicVolume, sfx: sfxVolume }));
    } catch (err) { /* non-fatal */ }
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, Number(v) || 0));
  }

  // ============================================================
  // Music
  // ============================================================
  // Called from the Begin ▶ handler. That click is also the user gesture the
  // browser requires before WebAudio will produce sound at all, so the unlock
  // has to happen here and nowhere earlier.
  function startGame() {
    if (!scene) return;
    if (scene.sound.locked) scene.sound.unlock();

    playSfx(SFX.start);
    playMusic(MUSIC_MAIN, MUSIC_FADE_IN_MS);
  }

  function playMusic(key, fadeMs) {
    if (!hasSound(key) || musicKey === key) return;

    stopMusic();
    musicKey = key;
    music = scene.sound.add(key, { loop: true, volume: 0 });
    music.play();
    fadeTo(music, musicTargetVolume(), fadeMs || 0);
  }

  function stopMusic() {
    if (!music) return;
    music.stop();
    music.destroy();
    music = null;
    musicKey = null;
    ducked = false;
  }

  // Zone-driven track swap (phase-8 spec: share the sky fade's fadeMs so audio
  // and visuals move together). Today world.json's zones all name "music_dark",
  // which has no file — hasSound() makes that a silent no-op, and dropping the
  // track in + registering it in assets.json is enough to switch this on.
  function crossfadeMusic(key, ms) {
    const target = key || MUSIC_MAIN;
    if (!hasSound(target) || musicKey === target) return;

    const previous = music;
    const duration = ms || MUSIC_FADE_IN_MS;

    musicKey = target;
    music = scene.sound.add(target, { loop: true, volume: 0 });
    music.play();
    if (ducked) music.pause(); // a modal is open — don't start audible under it
    else fadeTo(music, musicTargetVolume(), duration);

    if (previous) {
      fadeTo(previous, 0, duration, () => { previous.stop(); previous.destroy(); });
    }
  }

  // A milestone modal opened: fade the music down, then pause it so it resumes
  // from the same point rather than restarting when the player hits Continue.
  function duckForModal() {
    setWalking(false);
    if (!music || ducked) return;
    ducked = true;
    fadeTo(music, 0, MODAL_DUCK_MS, () => { if (ducked && music) music.pause(); });
  }

  function unduckAfterModal() {
    if (!music || !ducked) return;
    ducked = false;
    if (music.isPaused) music.resume();
    fadeTo(music, musicTargetVolume(), MODAL_DUCK_MS);
  }

  function musicTargetVolume() {
    return musicVolume * BASE_VOLUME.music;
  }

  // Phaser can tween a sound's `volume` like any other property. Generation
  // counter isn't needed — killTweensOf drops any fade still running on this
  // sound, so the newest fade always wins.
  function fadeTo(sound, volume, ms, onComplete) {
    if (!sound || !scene) return;
    scene.tweens.killTweensOf(sound);

    if (!ms) {
      sound.setVolume(volume);
      if (onComplete) onComplete();
      return;
    }
    scene.tweens.add({ targets: sound, volume, duration: ms, onComplete });
  }

  // ============================================================
  // Sound effects
  // ============================================================
  function playSfx(key) {
    if (!hasSound(key)) return;
    scene.sound.play(key, { volume: sfxVolume * BASE_VOLUME.sfx });
  }

  // ============================================================
  // Footsteps
  // ============================================================
  // Recorded by the player/platform collider in game.js. Swapping surface while
  // already walking restarts the loop on the new material immediately.
  function setSurface(type) {
    const next = type || DEFAULT_SURFACE;
    if (next === surface) return;
    surface = next;

    if (walking) {
      stopFootstep();
      startFootstep();
    }
  }

  // Called every frame from update(); returns early unless the walking state
  // actually flipped, same dedupe idea as setPlayerState().
  function setWalking(isWalking) {
    if (isWalking === walking) return;
    walking = isWalking;
    if (isWalking) startFootstep();
    else stopFootstep();
  }

  function startFootstep() {
    const key = SURFACE_SFX[surface] || SFX.walkGrass;
    if (!hasSound(key)) return;

    footstep = scene.sound.add(key, {
      loop: FOOTSTEP_MODE === 'loop',
      volume: sfxVolume * BASE_VOLUME.footstep
    });
    footstep.play();
  }

  function stopFootstep() {
    if (!footstep) return;
    footstep.stop();
    footstep.destroy();
    footstep = null;
  }

  // ============================================================
  // Volume controls (settings modal)
  // ============================================================
  function setMusicVolume(v) {
    musicVolume = clamp01(v);
    // While ducked the music is silent by design — the new level applies when
    // the modal closes and unduckAfterModal() fades back to the target.
    if (music && !ducked) fadeTo(music, musicTargetVolume(), 0);
    saveSettings();
  }

  function setSfxVolume(v) {
    sfxVolume = clamp01(v);
    if (footstep) footstep.setVolume(sfxVolume * BASE_VOLUME.footstep);
    saveSettings();
  }

  function getVolumes() {
    return { music: musicVolume, sfx: sfxVolume };
  }

  loadSettings();

  return {
    init, hasSound,
    startGame, playMusic, stopMusic, crossfadeMusic,
    duckForModal, unduckAfterModal,
    playSfx, SFX,
    setSurface, setWalking,
    setMusicVolume, setSfxVolume, getVolumes
  };
})();
