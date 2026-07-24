// ============================================================
// Life Story Engine — prototype build (Phases 1-7)
// Scene-transition behavior follows Option 1: gradual sky-color
// fade (tweens.addCounter) + fading ambient caption + DOM modal.
// ============================================================

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
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
let backgroundRect;        // fallback sky rect, tinted by Phase 5 transitions
let bgLayers = [];
let isPaused = false;
let inDarkZone = false;
let finished = false;

const BASE_SKY = '#87CEEB';

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

  // Load any sprites registered in assets.json, then build the world.
  // While a category is empty, buildWorld() falls back to placeholder
  // primitives — see hasAsset() below.
  loadManifestAssets(this, () => buildWorld(this));

  wireDomUI(this);
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

  sceneRef.cameras.main.setBounds(0, 0, worldW, window.innerHeight);
  sceneRef.physics.world.setBounds(0, 0, worldW, window.innerHeight);

  buildBackground(sceneRef, worldW);
  const platforms = buildScenery(sceneRef);
  player = buildPlayer(sceneRef);
  const milestones = buildMilestones(sceneRef);

  sceneRef.cameras.main.startFollow(player, true, 0.08, 0.08);
  sceneRef.cameras.main.setFollowOffset(0, 100);

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
  // Fallback flat sky — Phase 5 tweens this color for Dark Zones.
  backgroundRect = sceneRef.add.rectangle(0, 0, worldW * 2, window.innerHeight * 2, 0x87CEEB)
    .setOrigin(0, 0);
  backgroundRect.setDepth(-100);

  worldData.background.forEach((layer, i) => {
    if (!hasAsset(layer.key)) return; // no art yet: stays on the flat sky fallback
    const img = sceneRef.add.tileSprite(0, 0, worldW, window.innerHeight, layer.key).setOrigin(0, 0);
    img.setScrollFactor(layer.parallax);
    img.setDepth(-90 + i);
    bgLayers.push(img);
  });
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
function buildPlayer(sceneRef) {
  const start = worldData.config.playerStart;
  let p;

  if (hasAsset('player_idle')) {
    p = sceneRef.physics.add.sprite(start.x, start.y, 'player_idle');
    if (hasAsset('player_walk')) {
      sceneRef.anims.create({
        key: 'walk',
        frames: sceneRef.anims.generateFrameNumbers('player_walk'),
        frameRate: 10,
        repeat: -1
      });
    }
  } else {
    p = sceneRef.add.rectangle(start.x, start.y, 32, 48, 0x1E90FF);
    sceneRef.physics.add.existing(p);
  }

  p.body.setBounce(0.1);
  p.body.setCollideWorldBounds(true);
  return p;
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

  worldData.milestones.forEach(item => {
    let obj;
    const key = 'icon_' + item.icon;
    if (hasAsset(key)) {
      obj = sceneRef.add.sprite(item.x, item.y, key);
    } else {
      const color = ICON_PLACEHOLDER_COLOR[item.icon] ?? 0xff0000;
      obj = sceneRef.add.circle(item.x, item.y, 20, color);
    }

    group.add(obj); // physics body auto-enabled with group defaults above
    obj.eventData = item.event;

    sceneRef.tweens.add({
      targets: obj, y: item.y - 15,
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

  if (zone && zone.theme === 'dark' && !inDarkZone) {
    inDarkZone = true;
    fadeSky(BASE_SKY, zone.skyColor || '#222222', zone.fadeMs || 1000);
    zoneText.innerText = zone.ambientText || '';
    zoneText.classList.remove('hidden');
  } else if (!(zone && zone.theme === 'dark') && inDarkZone) {
    inDarkZone = false;
    fadeSky('#222222', BASE_SKY, 1000);
    zoneText.classList.add('hidden');
  }
}

function fadeSky(fromHex, toHex, duration) {
  scene.tweens.addCounter({
    from: 0, to: 100, duration,
    onUpdate: (tween) => {
      const v = tween.getValue();
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.HexStringToColor(fromHex),
        Phaser.Display.Color.HexStringToColor(toHex),
        100, v);
      backgroundRect.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    }
  });
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

  if (cursors.left.isDown) {
    player.body.setVelocityX(-speed);
    if (player.setFlipX) player.setFlipX(true);
  } else if (cursors.right.isDown) {
    player.body.setVelocityX(speed);
    if (player.setFlipX) player.setFlipX(false);
  } else {
    player.body.setVelocityX(0);
  }

  if ((cursors.up.isDown || cursors.space.isDown) && player.body.touching.down) {
    player.body.setVelocityY(jumpVelocity);
  }

  if (player.anims && hasAsset('player_walk')) {
    if (player.body.touching.down && player.body.velocity.x !== 0) {
      player.play('walk', true);
    } else if (player.body.touching.down) {
      player.anims.stop();
      if (hasAsset('player_idle')) player.setTexture('player_idle');
    } else if (hasAsset('player_jump')) {
      player.anims.stop();
      player.setTexture('player_jump');
    }
  }

  updateZones();
  checkGoal();
}
