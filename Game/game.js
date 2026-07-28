// ============================================================
// Life Story Engine — prototype build (Phases 1-7)
// Scene-transition behavior follows Option 1: gradual sky-color
// fade (JS-driven crossfade of CSS custom properties, see applySky()) + fading
// ambient caption + DOM modal.
// ============================================================

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  transparent: true, // lets the CSS sky gradient on <html>/<body> show through the canvas
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 800 }, debug: false }
  },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

// ---------- Module state ----------
let scene;                 // active Phaser scene (set in create)
let player, cursors;
let milestones;            // the whole group — scanned each frame for enter/exit edges
let worldData, assetManifest;
let bgLayers = [];
let isPaused = false;
let settingsOpen = false;  // sound menu is up — halts play without touching isPaused
let currentZoneId = null;
let finished = false;

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});

// ============================================================
// 1. PRELOAD — level data + sprite manifest (Phase 1 / Phase 7)
// ============================================================
function preload() {
  this.load.json('world', 'data/world.json');
  this.load.json('assets', 'data/assets.json');
}

// ============================================================
// 2. CREATE — world, player, camera, milestones, UI (Phase 2-6)
// ============================================================
function create() {
  scene = this;
  worldData = this.cache.json.get('world');
  assetManifest = this.cache.json.get('assets');

  if (!worldData) {
    showLoadError();
    return;
  }
  assetManifest = assetManifest || {};
  scaleWorldData(worldData);
  applySky(worldData.sky);

  // Load any sprites registered in assets.json, then build the world.
  // While a category is empty, buildWorld() falls back to placeholder
  // primitives — see hasAsset() below.
  loadManifestAssets(this, () => buildWorld(this));

  wireDomUI(this);
}

// Scales every world-unit value (positions, sizes, physics) by config.worldScale
// so the whole game gets physically bigger — not just zoomed in — while keeping
// everything relative to each other consistent. Mutates worldData in place, so
// every function below just reads worldData as usual and gets scaled numbers.
function scaleWorldData(data) {
  const s = data.config.worldScale || 1;
  if (s === 1) return;

  data.config.worldWidth *= s;
  data.config.goalX *= s;
  data.config.playerSpeed *= s;
  data.config.jumpVelocity *= s;
  data.config.gravity *= s;
  data.config.playerStart.x *= s;
  data.config.playerStart.y *= s;

  data.scenery.forEach(item => {
    item.x *= s; item.y *= s; item.width *= s; item.height *= s;
  });
  data.milestones.forEach(item => { item.x *= s; item.y *= s; });
  (data.zones || []).forEach(zone => { zone.startX *= s; zone.endX *= s; });
}

// world.json / assets.json fail to load when the page is opened via
// file:// (browsers block XHR to local files under the "null" origin).
// Surface that clearly instead of crashing silently in the console.
function showLoadError() {
  document.getElementById('title-heading').innerText = 'Could not load game data';
  document.getElementById('title-sub').innerText =
    'This page must be served over http(s) — opening index.html directly (file://) blocks the ' +
    'JSON loads. Run a local server from Game/, e.g. "python3 -m http.server", then open ' +
    'http://localhost:<port>/index.html.';
  document.getElementById('start-btn').style.display = 'none';
}

function hasAsset(key) {
  return !!(scene && key && scene.textures.exists(key));
}

const AUDIO_EXT = /\.(mp3|ogg|wav|m4a)$/i;

function loadManifestAssets(sceneRef, onDone) {
  let queued = 0;
  Object.values(assetManifest || {}).forEach(group => {
    if (!group || typeof group !== 'object') return; // skips "_comment"
    Object.entries(group).forEach(([key, def]) => {
      if (!def || !def.path) return;
      queued++;
      // Audio is detected by file extension rather than by category name, so a
      // sound dropped into any group still loads as a sound.
      if (AUDIO_EXT.test(def.path)) {
        sceneRef.load.audio(key, def.path);
      } else if (def.frameWidth && def.frameHeight) {
        sceneRef.load.spritesheet(key, def.path,
          { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
      } else {
        sceneRef.load.image(key, def.path);
      }
    });
  });

  if (queued === 0) { onDone(); return; }
  sceneRef.load.once('complete', onDone);
  sceneRef.load.start();
}

function buildWorld(sceneRef) {
  const worldW = worldData.config.worldWidth;

  SoundManager.init(sceneRef);
  sceneRef.physics.world.gravity.y = worldData.config.gravity;
  sceneRef.cameras.main.setBounds(0, 0, worldW, window.innerHeight);
  sceneRef.physics.world.setBounds(0, 0, worldW, window.innerHeight);

  buildBackground(sceneRef, worldW);
  const platforms = buildScenery(sceneRef);
  player = buildPlayer(sceneRef);
  milestones = buildMilestones(sceneRef);

  sceneRef.cameras.main.startFollow(player, true, 0.08, 0.08);
  sceneRef.cameras.main.setFollowOffset(0, 100 * (worldData.config.worldScale || 1));

  sceneRef.physics.add.collider(player, platforms, trackSurface);
  // Milestones get no physics.add.overlap: that callback fires every frame the
  // bodies touch, with no notion of leaving again. updateMilestones() derives
  // the enter/exit edges itself instead.

  cursors = sceneRef.input.keyboard.createCursorKeys();

  // Keep arrow/space from scrolling the page during the demo.
  sceneRef.input.keyboard.addCapture([
    Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT,
    Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN,
    Phaser.Input.Keyboard.KeyCodes.SPACE
  ]);
}

// ============================================================
// 3. WORLD & SCENERY (Phase 3) — sprite/placeholder swap via hasAsset()
// ============================================================
function buildBackground(sceneRef, worldW) {
  // Sky itself is the CSS gradient behind the transparent canvas (see applySky()).
  // These are just the parallax art layers drawn on top of it, when registered.
  const s = worldData.config.worldScale || 1;
  const horizonY = getHorizonY();

  worldData.background.forEach((layer, i) => {
    if (!hasAsset(layer.key)) return; // no art yet: stays on the CSS sky alone
    let img;

    if (layer.anchor === 'horizon') {
      // Skyline strip (mountains, trees): one row only, bottom edge on the horizon.
      // The band's height is derived FROM the same tileScale used to render each
      // tile, so the tile height and the band height are always identical —
      // there's no way for a second, partial row to appear underneath.
      // layer.scale (optional, world.json) tunes how zoomed-in/detailed the art
      // looks; it's independent from worldScale, which just keeps the whole level
      // consistently sized.
      const texH = sceneRef.textures.get(layer.key).getSourceImage().height;
      const tileScale = s * (layer.scale || 1);
      const bandH = texH * tileScale;
      img = sceneRef.add.tileSprite(0, (horizonY + layer.yOffset) - bandH, worldW, bandH, layer.key).setOrigin(0, 0);
      img.tileScaleX = tileScale;
      img.tileScaleY = tileScale;
    } else {
      // Full-viewport layer (clouds): tiles to fill the whole sky area.
      img = sceneRef.add.tileSprite(0, 0, worldW, window.innerHeight, layer.key).setOrigin(0, 0);
    }

    img.setScrollFactor(layer.parallax);
    img.setDepth(-90 + i);
    bgLayers.push(img);
  });
}

// Horizon = top of the ground strip; horizon-anchored parallax bands rest their
// bottom edge here. scaleWorldData() has already run, so ground.y is scaled.
function getHorizonY() {
  const ground = worldData.scenery.find(item => item.type === 'ground');
  return (ground ? ground.y : window.innerHeight) + (window.innerHeight * 0.005);
}

const SCENERY_PLACEHOLDER_COLOR = {
  ground: 0x4CAF50,   // grass green
  platform: 0x8B4513, // brown
  wall: 0x2E7D32,     // dark green
  pipe: 0x2E7D32,     // dark green
  flag: 0xFFD700      // gold
};

function buildScenery(sceneRef) {
  const platforms = sceneRef.physics.add.staticGroup();

  worldData.scenery.forEach(item => {
    let piece;
    if (hasAsset(item.type)) {
      piece = sceneRef.add.tileSprite(item.x, item.y, item.width, item.height, item.type).setOrigin(0, 0);
    } else {
      const color = SCENERY_PLACEHOLDER_COLOR[item.type] ?? 0x8B4513;
      piece = sceneRef.add.rectangle(
        item.x + item.width / 2, item.y + item.height / 2, item.width, item.height, color);
    }

    // Remembered so the collider below can tell the footstep sound which
    // material the player is actually standing on.
    piece.sceneryType = item.type;

    // The flag is a decorative goal marker (checked by x-position in update()),
    // not a collidable wall — walking "through" it is what reaches The End.
    if (item.type === 'flag') return;

    sceneRef.physics.add.existing(piece, true);
    platforms.add(piece);
  });

  return platforms;
}

// Collider callback: fires for every contact, including bumping sideways into a
// wall — and only a contact *underneath* the player says anything about what
// they're walking on.
//
// The obvious guard, touching.down, does not work here: scenery is made of
// STATIC bodies, and Arcade reports those through blocked.down instead (the same
// distinction isGrounded() documents above). Standing still on the ground it is
// blocked.down that stays true, so a touching.down check silently never fires.
// But blocked.down alone is no good either — it is true from the ground while
// the player pushes sideways into a wall, which would flip the footsteps to
// stone. So compare geometry: the piece counts only if the player's feet are
// resting on its top edge.
const SURFACE_FOOT_TOLERANCE = 8;

function trackSurface(_player, piece) {
  if (!piece.body) return;
  const feet = player.body.bottom;
  if (Math.abs(feet - piece.body.top) > SURFACE_FOOT_TOLERANCE) return;
  SoundManager.setSurface(piece.sceneryType);
}

// ============================================================
// 4. PLAYER (Phase 2) — sprite/placeholder swap
// ============================================================
const PLAYER_STATE_KEY = { idle: 'player_idle', walk: 'player_walk', jump: 'player_jump' };

// Walk cycle assembled from the single-pose PNGs — the idle pose doubles as the
// passing frame between the two strides. Phaser accepts animation frames from
// different textures, so this needs no sprite sheet.
const PLAYER_WALK_CYCLE = ['player_idle', 'player_walk', 'player_idle', 'player_walk2'];
const PLAYER_WALK_FPS = 8;

let playerState = null;   // 'idle' | 'walk' | 'jump' — so we only touch the sprite on a real change
let lastGroundedAt = 0;
const COYOTE_MS = 100;

function buildPlayer(sceneRef) {
  const start = worldData.config.playerStart;
  const s = worldData.config.worldScale || 1;
  let p;

  if (hasAsset('player_idle')) {
    p = sceneRef.physics.add.sprite(start.x, start.y, 'player_idle');
    p.setScale(s * 0.1);
    warnOnMixedFrameSizes(sceneRef);
    registerPlayerAnims(sceneRef);
  } else {
    p = sceneRef.add.rectangle(start.x, start.y, 32 * s, 48 * s, 0x1E90FF);
    sceneRef.physics.add.existing(p);
  }

  // No bounce: even a small one keeps re-launching the player off the ground for
  // a frame at a time, which makes the "am I standing?" check below flicker.
  p.body.setBounce(0);
  p.body.setCollideWorldBounds(true);
  return p;
}

// Every player pose has to share one frame size. Phaser derives the physics
// body's position from the sprite's displayOrigin — half the *frame* size — so a
// pose that is a few px taller silently shoves the body down into the ground, and
// once that overlap passes Arcade's OVERLAP_BIAS the engine stops separating it
// and the player sinks through the floor. Pad the PNGs to a common canvas
// (feet on the bottom edge) rather than trying to fix it in code.
function warnOnMixedFrameSizes(sceneRef) {
  const sizes = playerTextureKeys()
    .map(key => sceneRef.textures.getFrame(key))
    .map(f => `${f.realWidth}x${f.realHeight}`);

  if (new Set(sizes).size > 1) {
    console.warn('[player] pose frames differ in size:',
      playerTextureKeys().map((k, i) => `${k} ${sizes[i]}`).join(', '),
      '— pad them to one canvas or the player will fall through the ground.');
  }
}

function playerTextureKeys() {
  const keys = Object.values(PLAYER_STATE_KEY).concat(PLAYER_WALK_CYCLE);
  return keys.filter((key, i) => hasAsset(key) && keys.indexOf(key) === i);
}

// A single-pose PNG stays a plain texture (setPlayerState just swaps it in). Only
// a real strip — frameWidth/frameHeight in assets.json, more than one frame —
// becomes an animation, so dropping in proper sheets later needs no code change.
// frameTotal counts the __BASE frame, hence the > 2.
function registerPlayerAnims(sceneRef) {
  Object.values(PLAYER_STATE_KEY).forEach(key => {
    if (!hasAsset(key) || sceneRef.textures.get(key).frameTotal <= 2) return;
    sceneRef.anims.create({
      key,
      frames: sceneRef.anims.generateFrameNumbers(key),
      frameRate: 10,
      repeat: -1
    });
  });

  // Otherwise build the walk cycle out of whichever single poses exist. It is
  // registered under the walk *texture* key, which is what setPlayerState()
  // already looks up — a real walk sheet above wins and this leaves it alone.
  const walkKey = PLAYER_STATE_KEY.walk;
  const frames = PLAYER_WALK_CYCLE.filter(hasAsset).map(key => ({ key }));

  if (!sceneRef.anims.exists(walkKey) && frames.length > 1) {
    sceneRef.anims.create({ key: walkKey, frames, frameRate: PLAYER_WALK_FPS, repeat: -1 });
  }
}

// touching.down is only set on frames where the body actually moved down into a
// platform — it means "I hit something this frame", not "I'm standing on it". The
// world bounds set blocked.down instead. Combine both, and remember the last
// contact briefly so a single contact-free frame doesn't read as airborne.
function isGrounded() {
  const b = player.body;
  if (b.blocked.down || b.touching.down) {
    lastGroundedAt = scene.time.now;
    return true;
  }
  return scene.time.now - lastGroundedAt < COYOTE_MS;
}

function setPlayerState(state) {
  if (state === playerState) return;
  const key = PLAYER_STATE_KEY[state];
  if (!hasAsset(key)) return;
  playerState = state;

  if (scene.anims.exists(key)) {
    player.play(key, true);
  } else {
    player.anims.stop();
    player.setTexture(key);
  }
}

// ============================================================
// 5. INTERACTIVE MILESTONES & EVENTS (Phase 4)
// ============================================================
const ICON_PLACEHOLDER_COLOR = {
  mushroom: 0xff0000,
  star: 0xffd700,
  heart: 0xff69b4,
  trophy: 0xffa500,
  coin: 0xffd700
};

function buildMilestones(sceneRef) {
  const group = sceneRef.physics.add.group({ allowGravity: false, immovable: true });
  const s = worldData.config.worldScale || 1;

  worldData.milestones.forEach(item => {
    let obj;
    const key = 'icon_' + item.icon;
    if (hasAsset(key)) {
      obj = sceneRef.add.sprite(item.x, item.y, key);
      obj.setScale(s);
    } else {
      const color = ICON_PLACEHOLDER_COLOR[item.icon] ?? 0xff0000;
      obj = sceneRef.add.circle(item.x, item.y, 20 * s, color);
    }

    group.add(obj); // physics body auto-enabled with group defaults above
    obj.eventData = item.event;
    obj.playerInside = false; // enter/exit edge state, see updateMilestones()
    obj.visited = false;

    sceneRef.tweens.add({
      targets: obj, y: item.y - 15 * s,
      duration: 1500, ease: 'Sine.inOut',
      yoyo: true, repeat: -1
    });
  });

  return group;
}

// Milestones stay in the world once triggered — they're landmarks of the story,
// not pickups to collect — and their story stays re-readable: walking back into
// one opens its modal again. That's what makes the edge-triggering essential.
// The modal opens on the frame the player *enters* an icon and that icon can't
// open again until they have walked back out, so closing the modal while still
// standing on the icon leaves it closed instead of instantly reopening it.
function updateMilestones() {
  milestones.getChildren().forEach(obj => {
    const inside = overlapsPlayer(obj);
    if (inside && !obj.playerInside) enterMilestone(obj);
    obj.playerInside = inside;
  });
}

// Plain AABB against the same Arcade bodies the old physics.add.overlap() used,
// so the trigger area itself is unchanged.
function overlapsPlayer(obj) {
  const a = player.body, b = obj.body;
  if (!a || !b) return false;
  return a.right > b.x && a.x < b.right && a.bottom > b.y && a.y < b.bottom;
}

const VISITED_ALPHA = 0.45;

// No isPaused/settingsOpen guard here: update() returns early in both states,
// so updateMilestones() — and therefore this — only ever runs during play.
function enterMilestone(obj) {
  // Every fresh entry reopens the modal — a milestone the player walks back to
  // tells its story again. `consume` survives from the pickup-style version but
  // is now purely cosmetic: `true` (the default) dims the icon once its story
  // has been read, marking it as visited without ever locking it; `false` keeps
  // it at full brightness. Neither value stops the modal from reopening.
  if (!obj.visited && obj.eventData?.consume !== false) obj.setAlpha(VISITED_ALPHA);
  obj.visited = true;

  isPaused = true;
  player.body.setVelocity(0, 0);
  SoundManager.playSfx(SoundManager.SFX.bonus);
  SoundManager.duckForModal();
  openEventModal(obj.eventData);
}

// ============================================================
// 6. SCENE TRANSITIONS & DARK ZONES (Phase 5 — Option 1 style)
// ============================================================
function updateZones() {
  const px = player.x;
  const zone = worldData.zones.find(z => px >= z.startX && px <= z.endX);
  const zoneText = document.getElementById('zone-text');
  const zoneId = zone ? zone.id : null;

  if (zoneId === currentZoneId) return; // no change since last frame
  currentZoneId = zoneId;

  // Music crossfades on the same clock as the sky so the two land together.
  // A zone naming a track that has no file just leaves the current one playing.
  if (zone) {
    applySky(zone.sky, zone.fadeMs || 800);
    SoundManager.crossfadeMusic(zone.music, zone.fadeMs || 800);
    zoneText.innerText = zone.ambientText || '';
    zoneText.classList.remove('hidden');
  } else {
    applySky(worldData.sky, 1000);
    SoundManager.crossfadeMusic(null, 1000);
    zoneText.classList.add('hidden');
  }
}

// Crossfades the sky by writing interpolated colors into the CSS gradient
// custom properties on <html>, frame by frame. Plain custom properties can't
// be animated by a CSS `transition` (the browser has no defined interpolation
// for them), so the fade itself has to happen here in JS — same idea as the
// original Phaser fadeSky() tween, just retargeted at the CSS vars instead of
// a Phaser rectangle's fillColor.
let currentSky = null;
let skyAnimGen = 0;

function applySky(sky, fadeMs) {
  if (!sky) return;
  const target = {
    top: sky.top || (currentSky && currentSky.top),
    mid: sky.mid || (currentSky && currentSky.mid),
    bottom: sky.bottom || (currentSky && currentSky.bottom)
  };

  if (!currentSky || !fadeMs) {
    currentSky = target;
    writeSkyVars(target);
    return;
  }

  const from = currentSky;
  currentSky = target;
  const myGen = ++skyAnimGen;
  const start = performance.now();

  function tick(now) {
    if (myGen !== skyAnimGen) return; // superseded by a newer zone change
    const t = Math.min(1, (now - start) / fadeMs);
    const eased = t * t * (3 - 2 * t); // smoothstep, for a soft crossfade
    writeSkyVars({
      top: lerpColor(from.top, target.top, eased),
      mid: lerpColor(from.mid, target.mid, eased),
      bottom: lerpColor(from.bottom, target.bottom, eased)
    });
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function writeSkyVars(sky) {
  const root = document.documentElement.style;
  root.setProperty('--sky-top', sky.top);
  root.setProperty('--sky-mid', sky.mid);
  root.setProperty('--sky-bottom', sky.bottom);
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// ============================================================
// 7. UI / DOM MODAL (Phase 6 — Option 1 style, popIn animation)
// ============================================================
function openEventModal(data) {
  document.getElementById('modal-date').innerText = data.date || '';
  document.getElementById('modal-title').innerText = data.title || '';
  document.getElementById('modal-text').innerText = data.text || '';

  // Preferred: event.images = [{ path, caption }, ...] — one modal, several
  // captioned slides. event.imagePath (single string, Phase 4 schema) still
  // works and is treated as a one-slide gallery, so existing world.json
  // entries don't need migrating.
  carouselSlides = (data.images && data.images.length)
    ? data.images
    : (data.imagePath ? [{ path: data.imagePath, caption: data.imageCaption || '' }] : []);
  carouselIndex = 0;
  renderCarousel();

  document.getElementById('ui-layer').classList.remove('hidden');
}

// ---------- Image carousel (Phase 6 extension) ----------
let carouselSlides = [];
let carouselIndex = 0;

function renderCarousel() {
  const wrap = document.getElementById('modal-carousel');
  if (carouselSlides.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';

  const slide = carouselSlides[carouselIndex];
  const img = document.getElementById('carousel-img');
  img.src = slide.path;
  img.alt = slide.caption || 'Life event';

  const caption = document.getElementById('carousel-caption');
  caption.innerText = slide.caption || '';
  caption.style.display = slide.caption ? 'block' : 'none';

  // Nav controls are pointless with a single slide, so they hide together.
  const multi = carouselSlides.length > 1;
  document.getElementById('carousel-prev').style.display = multi ? 'flex' : 'none';
  document.getElementById('carousel-next').style.display = multi ? 'flex' : 'none';

  const dots = document.getElementById('carousel-dots');
  dots.style.display = multi ? 'flex' : 'none';
  dots.innerHTML = '';
  if (multi) {
    carouselSlides.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'carousel-dot' + (i === carouselIndex ? ' active' : '');
      dot.addEventListener('click', () => { carouselIndex = i; renderCarousel(); });
      dots.appendChild(dot);
    });
  }
}

function carouselStep(delta) {
  if (carouselSlides.length < 2) return;
  carouselIndex = (carouselIndex + delta + carouselSlides.length) % carouselSlides.length;
  renderCarousel();
}

function closeModal() {
  document.getElementById('ui-layer').classList.add('hidden');
  SoundManager.unduckAfterModal();

  // Focus goes back to the canvas so the arrow keys drive the player again
  // instead of the (now hidden) button that was just clicked — a still-focused
  // button would otherwise also swallow the next Enter press.
  if (scene) scene.game.canvas.focus();

  // Resumes immediately: the old 100ms delay existed only to stop the milestone
  // the player is standing on from firing again, which updateMilestones()'
  // enter/exit tracking now rules out outright.
  isPaused = false;
}

// Shared by the Continue/close buttons and the Enter key below — "The End"
// modal repurposes the same button as Restart instead of Continue.
function continueOrRestart() {
  if (finished) { location.reload(); return; }
  closeModal();
}

function wireDomUI(sceneRef) {
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('title-card').classList.add('hidden');
    // This click is the user gesture browsers require before WebAudio will make
    // any sound at all, so the whole soundtrack has to start from right here.
    SoundManager.startGame();
    sceneRef.game.canvas.focus();
  });

  document.getElementById('continue-btn').addEventListener('click', continueOrRestart);
  document.getElementById('close-btn').addEventListener('click', continueOrRestart);

  // Enter closes the event modal (or restarts, at "The End") without reaching
  // for the mouse. Guarded on the modal actually being open, and skipped while
  // the sound settings layer is up so it doesn't fire through that instead.
  // e.repeat is ignored so holding the key can't run the close (or a reload)
  // over and over; preventDefault stops the browser from *also* activating a
  // still-focused button with the same press.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.repeat) return;
    if (settingsOpen) return;
    if (document.getElementById('ui-layer').classList.contains('hidden')) return;
    e.preventDefault();
    continueOrRestart();
  });

  wireCarousel();
  wireSoundMenu();
}

function wireCarousel() {
  document.getElementById('carousel-prev').addEventListener('click', () => carouselStep(-1));
  document.getElementById('carousel-next').addEventListener('click', () => carouselStep(1));

  // Left/Right only steps the carousel while the event modal is actually open —
  // otherwise these are the player's movement keys.
  document.addEventListener('keydown', e => {
    if (document.getElementById('ui-layer').classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') carouselStep(-1);
    else if (e.key === 'ArrowRight') carouselStep(1);
  });
}

// ---------- Sound settings menu (Phase 8) ----------
function wireSoundMenu() {
  const layer = document.getElementById('settings-layer');
  const musicSlider = document.getElementById('music-vol');
  const sfxSlider = document.getElementById('sfx-vol');

  // Seed the sliders from whatever was persisted on a previous run.
  const saved = SoundManager.getVolumes();
  musicSlider.value = Math.round(saved.music * 100);
  sfxSlider.value = Math.round(saved.sfx * 100);

  musicSlider.addEventListener('input', () => SoundManager.setMusicVolume(musicSlider.value / 100));
  sfxSlider.addEventListener('input', () => SoundManager.setSfxVolume(sfxSlider.value / 100));

  document.getElementById('settings-btn').addEventListener('click', () => setSoundMenu(true));
  document.getElementById('settings-close').addEventListener('click', () => setSoundMenu(false));
  document.getElementById('settings-done').addEventListener('click', () => setSoundMenu(false));

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    setSoundMenu(!settingsOpen);
  });

  function setSoundMenu(open) {
    settingsOpen = open;
    layer.classList.toggle('hidden', !open);
    // The player is frozen while the menu is up (see update()), so cut the
    // footsteps too — otherwise the walk loop keeps running under the modal.
    if (open) SoundManager.setWalking(false);
    else scene.game.canvas.focus();
  }
}

// ============================================================
// 8. GOAL / END OF STORY (Phase 8, minimal)
// ============================================================
function checkGoal() {
  if (finished || isPaused) return;
  const goalX = worldData.config.goalX;
  if (!goalX || player.x < goalX) return;

  finished = true;
  isPaused = true;
  player.body.setVelocity(0, 0);
  SoundManager.playSfx(SoundManager.SFX.bonus);
  SoundManager.duckForModal();
  document.getElementById('continue-btn').innerText = 'Restart';
  openEventModal({
    date: '',
    title: 'The End',
    text: "Thanks for walking through my story. Click Restart to play again.",
    imagePath: ''
  });
}

// ============================================================
// 9. UPDATE LOOP (Phase 2)
// ============================================================
function update() {
  if (!worldData || !player || !player.body) return;

  if (isPaused || settingsOpen) {
    player.body.setVelocityX(0);
    SoundManager.setWalking(false);
    return;
  }

  const speed = worldData.config.playerSpeed || 300;
  const jumpVelocity = worldData.config.jumpVelocity || -550;
  let grounded = isGrounded();

  if (cursors.left.isDown) {
    player.body.setVelocityX(-speed);
    if (player.setFlipX) player.setFlipX(true);
  } else if (cursors.right.isDown) {
    player.body.setVelocityX(speed);
    if (player.setFlipX) player.setFlipX(false);
  } else {
    player.body.setVelocityX(0);
  }

  if ((cursors.up.isDown || cursors.space.isDown) && grounded) {
    player.body.setVelocityY(jumpVelocity);
    lastGroundedAt = 0; // spend the coyote window so one press is one jump
    grounded = false;   // switch to the jump pose on this frame, not the next

    // ...and clear the contact flags, or the coyote reset above is wasted.
    // update() runs BEFORE the physics step, so blocked/touching still describe
    // the previous step: on the very next frame isGrounded() short-circuits on
    // them and returns true even though we are already rising, and the jump
    // fires a second time ~one frame later. That doubled the impulse (a higher
    // jump than jumpVelocity asks for) long before there was a sound on it.
    player.body.blocked.down = false;
    player.body.touching.down = false;

    SoundManager.playSfx(SoundManager.SFX.jump);
  }

  if (player.anims && hasAsset('player_idle')) {
    if (!grounded) setPlayerState('jump');
    else if (player.body.velocity.x !== 0) setPlayerState('walk');
    else setPlayerState('idle');
  }

  // Same condition as the walk pose above, minus the sprite requirement — the
  // footsteps should sound even while the player is still a placeholder rect.
  SoundManager.setWalking(grounded && player.body.velocity.x !== 0);

  updateMilestones();
  updateZones();
  checkGoal();
}
