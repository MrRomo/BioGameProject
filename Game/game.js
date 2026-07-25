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
let worldData, assetManifest;
let bgLayers = [];
let isPaused = false;
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

function loadManifestAssets(sceneRef, onDone) {
  let queued = 0;
  Object.values(assetManifest || {}).forEach(group => {
    if (!group || typeof group !== 'object') return; // skips "_comment"
    Object.entries(group).forEach(([key, def]) => {
      if (!def || !def.path) return;
      queued++;
      if (def.frameWidth && def.frameHeight) {
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

  sceneRef.physics.world.gravity.y = worldData.config.gravity;
  sceneRef.cameras.main.setBounds(0, 0, worldW, window.innerHeight);
  sceneRef.physics.world.setBounds(0, 0, worldW, window.innerHeight);

  buildBackground(sceneRef, worldW);
  const platforms = buildScenery(sceneRef);
  player = buildPlayer(sceneRef);
  const milestones = buildMilestones(sceneRef);

  sceneRef.cameras.main.startFollow(player, true, 0.08, 0.08);
  sceneRef.cameras.main.setFollowOffset(0, 100 * (worldData.config.worldScale || 1));

  sceneRef.physics.add.collider(player, platforms);
  sceneRef.physics.add.overlap(player, milestones, hitMilestone, null, sceneRef);

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

    // The flag is a decorative goal marker (checked by x-position in update()),
    // not a collidable wall — walking "through" it is what reaches The End.
    if (item.type === 'flag') return;

    sceneRef.physics.add.existing(piece, true);
    platforms.add(piece);
  });

  return platforms;
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

    sceneRef.tweens.add({
      targets: obj, y: item.y - 15 * s,
      duration: 1500, ease: 'Sine.inOut',
      yoyo: true, repeat: -1
    });
  });

  return group;
}

function hitMilestone(_player, obj) {
  if (isPaused) return; // anti-rebounce
  isPaused = true;
  player.body.setVelocity(0, 0);
  if (obj.eventData?.consume !== false) obj.destroy();
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

  if (zone) {
    applySky(zone.sky, zone.fadeMs || 800);
    zoneText.innerText = zone.ambientText || '';
    zoneText.classList.remove('hidden');
  } else {
    applySky(worldData.sky, 1000);
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

  const img = document.getElementById('modal-img');
  if (data.imagePath) {
    img.src = data.imagePath;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  document.getElementById('ui-layer').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('ui-layer').classList.add('hidden');
  setTimeout(() => { isPaused = false; }, 100); // avoid instant re-trigger
}

function wireDomUI(sceneRef) {
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('title-card').classList.add('hidden');
    sceneRef.game.canvas.focus();
  });

  document.getElementById('continue-btn').addEventListener('click', () => {
    if (finished) { location.reload(); return; }
    closeModal();
  });
  document.getElementById('close-btn').addEventListener('click', () => {
    if (finished) { location.reload(); return; }
    closeModal();
  });
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

  if (isPaused) {
    player.body.setVelocityX(0);
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
  }

  if (player.anims && hasAsset('player_idle')) {
    if (!grounded) setPlayerState('jump');
    else if (player.body.velocity.x !== 0) setPlayerState('walk');
    else setPlayerState('idle');
  }

  updateZones();
  checkGoal();
}
