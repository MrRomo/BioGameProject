# Phase 2 — Core Engine: Camera, Physics & Player

**Goal:** a controllable avatar that walks, jumps, collides with a ground plane, and is followed by a
scrolling camera. This is the minimum "you can move through the world" milestone.

**Depends on:** [phase-1-foundation.md](phase-1-foundation.md)

---

## Deliverables
- [ ] World + camera bounds set from config.
- [ ] A player body with gravity, world-bound collision, and keyboard control.
- [ ] Smooth camera follow.
- [ ] A ground plane the player stands on.
- [ ] **Player rendered as a placeholder rectangle**, wired so a sprite can replace it with no logic change.

---

## 1. Bounds & camera

```js
const worldW = levelData.config.worldWidth; // 4000 in the prototype
this.cameras.main.setBounds(0, 0, worldW, window.innerHeight);
this.physics.world.setBounds(0, 0, worldW, window.innerHeight);

this.cameras.main.startFollow(player, true, 0.08, 0.08);
this.cameras.main.setFollowOffset(0, 100); // keep player above vertical center
```

---

## 2. Player controller

Prototype uses a rectangle with an arcade body. Keep that as the **placeholder**, but structure the code so
`player` is created by a factory that returns either a rectangle (placeholder) or a sprite (final art).

```js
// Placeholder path (Phase 2)
player = this.add.rectangle(100, 300, 32, 48, 0x1E90FF);
this.physics.add.existing(player);
player.body.setBounce(0.1);
player.body.setCollideWorldBounds(true);

// --- SPRITE SWAP (Phase 7): replace the two lines above with ---
// player = this.physics.add.sprite(100, 300, 'player_idle');
// player.body.setCollideWorldBounds(true);
```

### Movement (`update`)
```js
const speed = 300;
if (cursors.left.isDown)       player.body.setVelocityX(-speed);
else if (cursors.right.isDown) player.body.setVelocityX(speed);
else                           player.body.setVelocityX(0);

if ((cursors.up.isDown || cursors.space.isDown) && player.body.touching.down)
  player.body.setVelocityY(-550);
```

> Guard all of `update` with the `isPaused` flag (set by modals in Phase 6) — when paused, force
> `setVelocityX(0)` and return early. This is the prototype's exact behavior.

---

## 3. Ground & collision

```js
const platforms = this.physics.add.staticGroup();
// ground added here for now; Phase 3 moves it into JSON scenery
this.physics.add.collider(player, platforms);
```

---

## Sprite Slots — Phase 2 (Characters / builds)

| Slot | Asset key | Path | Size (px) | Anim frames | Placeholder | Status |
|------|-----------|------|-----------|-------------|-------------|--------|
| Player idle | `player_idle` | `assets/sprites/characters/____.png` | 32×48 | 1 | 🟦 blue rect | ⬜ |
| Player walk | `player_walk` | `assets/sprites/characters/____.png` | 32×48 | 4–8 | 🟦 blue rect | ⬜ |
| Player jump | `player_jump` | `assets/sprites/characters/____.png` | 32×48 | 1 | 🟦 blue rect | ⬜ |
| Ground strip | `ground_tile` | `assets/sprites/structures/____.png` | 32×32 tile | 1 | 🟩 green rect | ⬜ |

**How the swap works:** the factory checks `assets.json` for the key. If present → sprite; else → the
placeholder primitive listed above. See [phase-7-assets-sprites.md](phase-7-assets-sprites.md).

---

## Acceptance criteria
- [ ] Arrow keys move the avatar; Up/Space jumps only when grounded.
- [ ] The camera scrolls smoothly and clamps at world edges.
- [ ] The avatar cannot leave the world bounds.
- [ ] Setting `isPaused = true` freezes movement.
