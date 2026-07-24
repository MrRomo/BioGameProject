# Phase 7 — Asset & Sprite Pipeline

**Goal:** replace every placeholder primitive (rectangles, circles, solid sky) with real art — **without
touching game logic**. This phase defines the drop-in system all previous Sprite Slots point to.

**Depends on:** [phase-2-core-engine.md](phase-2-core-engine.md) through
[phase-6-ui-modals.md](phase-6-ui-modals.md)

---

## The core idea: keys, not code

1. Every renderable entity is created through a factory that asks **`hasAsset(key)`**.
2. If the key is registered in `data/assets.json` → the factory builds a **sprite/tileSprite**.
3. If not → it builds the **placeholder primitive** documented in that entity's phase.

So "adding art" = drop a PNG + add one line to `assets.json`. Nothing in the scene logic changes.

---

## 1. `data/assets.json` (the manifest)

```json
{
  "characters": {
    "player_idle": { "path": "assets/sprites/characters/player_idle.png" },
    "player_walk": { "path": "assets/sprites/characters/player_walk.png",
                     "frameWidth": 32, "frameHeight": 48 },
    "player_jump": { "path": "assets/sprites/characters/player_jump.png" }
  },
  "structures": {
    "ground":   { "path": "assets/sprites/structures/ground.png" },
    "platform": { "path": "assets/sprites/structures/platform.png" },
    "wall":     { "path": "assets/sprites/structures/wall.png" },
    "pipe":     { "path": "assets/sprites/structures/pipe.png" }
  },
  "icons": {
    "icon_mushroom": { "path": "assets/sprites/icons/mushroom.png" },
    "icon_star":     { "path": "assets/sprites/icons/star.png" },
    "icon_heart":    { "path": "assets/sprites/icons/heart.png" }
  },
  "backgrounds": {
    "bg_sky":       { "path": "assets/images/backgrounds/sky.png" },
    "bg_clouds":    { "path": "assets/images/backgrounds/clouds.png" },
    "bg_mountains": { "path": "assets/images/backgrounds/mountains.png" },
    "bg_trees":     { "path": "assets/images/backgrounds/trees.png" }
  }
}
```

> **Only listed assets are loaded** — the "unused assets are never loaded" rule from the README.

---

## 2. Preload driven by the manifest

```js
function preload() {
  this.load.json('assets', 'data/assets.json');
  this.load.json('world',  'data/world.json');
  this.load.json('events', 'data/events.json');
}
// after assets.json is available (chained loader or PreloadScene):
Object.values(manifest).forEach(group =>
  Object.entries(group).forEach(([key, def]) => {
    if (def.frameWidth) this.load.spritesheet(key, def.path,
                            { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
    else                this.load.image(key, def.path);
  }));
```

`hasAsset(key)` = `this.textures.exists(key)`.

---

## 3. Animations (walk / idle cycles)

Define once when a spritesheet is present:

```js
if (this.textures.exists('player_walk')) {
  this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('player_walk'),
                      frameRate: 10, repeat: -1 });
}
// in update(): play 'walk' when moving, stop on idle, 'player_jump' texture while airborne.
```

---

## 4. Full Sprite Slot roll-up (fill in the blanks)

This consolidates every slot from Phases 2–6. Set **Status ✅** as each file lands.

### Characters — `assets/sprites/characters/`
| Asset key | File | Size | Frames | Status |
|-----------|------|------|--------|--------|
| `player_idle` | `__________.png` | 32×48 | 1 | ⬜ |
| `player_walk` | `__________.png` | 32×48 | 4–8 | ⬜ |
| `player_jump` | `__________.png` | 32×48 | 1 | ⬜ |
| `npc_*` (opt.) | `__________.png` | 32×48 | 1–N | ⬜ |

### Structures / builds — `assets/sprites/structures/`
| Asset key | File | Size | Status |
|-----------|------|------|--------|
| `ground` | `__________.png` | 32×32 tileable | ⬜ |
| `platform` | `__________.png` | 32×32 tileable | ⬜ |
| `wall` | `__________.png` | 32×32 | ⬜ |
| `pipe` | `__________.png` | 64×96 | ⬜ |
| `flag` | `__________.png` | 32×128 | ⬜ |
| `sign` | `__________.png` | 48×48 | ⬜ |

### Interactive icons — `assets/sprites/icons/`
| Asset key | File | Size | Status |
|-----------|------|------|--------|
| `icon_mushroom` | `__________.png` | 40×40 | ⬜ |
| `icon_star` | `__________.png` | 40×40 | ⬜ |
| `icon_heart` | `__________.png` | 40×40 | ⬜ |
| `icon_trophy` | `__________.png` | 40×40 | ⬜ |
| `icon_coin` | `__________.png` | 32×32 | ⬜ |
| `icon_photo` | `__________.png` | 48×48 | ⬜ |

### Backgrounds — `assets/images/backgrounds/`
| Asset key | File | Size | Parallax | Status |
|-----------|------|------|----------|--------|
| `bg_sky` | `__________.png` | ≥1920×1080 | 0.0 | ⬜ |
| `bg_clouds` | `__________.png` | tileable | 0.2 | ⬜ |
| `bg_mountains` | `__________.png` | tileable | 0.4 | ⬜ |
| `bg_trees` | `__________.png` | tileable | 0.7 | ⬜ |
| `fx_fog` | `__________.png` | tileable/alpha | — | ⬜ |
| `fx_vignette` | `__________.png` | ≥1920×1080/alpha | — | ⬜ |

### Event images — `assets/images/events/`
Referenced per-event by `event.imagePath`; no fixed keys. Recommended ≤ 600 px wide for the modal.

---

## Production notes for the artist
- **Origin:** characters/icons use center origin; structures/backgrounds use top-left (`setOrigin(0,0)`).
- **Transparency:** PNG-24 with alpha for everything except full-bleed sky.
- **Tileable** backgrounds must seamlessly repeat on X.
- **Consistent pixel scale:** pick one (e.g. 32 px base grid) and keep all art on it.
- Placeholder colors to match if you want continuity: player `#1E90FF`, ground `#4CAF50`,
  walls/pipes `#2E7D32`, platform `#8B4513`, mushroom `#FF0000`, star `#FFD700`, heart `#FF69B4`.

---

## Acceptance criteria
- [ ] Any entity with a registered key renders as art; others fall back to placeholders.
- [ ] Removing a key from `assets.json` cleanly reverts to the placeholder.
- [ ] The player animates (walk/idle/jump) when its spritesheet exists.
- [ ] No unregistered asset is loaded.
