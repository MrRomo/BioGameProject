# Phase 3 — World & Data System

**Goal:** stop hardcoding the level. The whole environment — ground, platforms, walls, pipes, and the
parallax backdrop — is built at runtime from `data/world.json`. This is the "separate content from code"
principle in action.

**Depends on:** [phase-2-core-engine.md](phase-2-core-engine.md)

---

## Deliverables
- [ ] `data/world.json` loaded in `preload`.
- [ ] Scenery (ground / platform / wall / pipe) generated from the `scenery` array.
- [ ] A layered **parallax background** with configurable scroll factors.
- [ ] Every scenery piece and background layer exposed as a **Sprite Slot**.

---

## 1. World schema

Extends the prototype's `level_data.json`:

```json
{
  "config": { "worldWidth": 4000, "gravity": 800, "playerStart": [100, 300] },
  "background": [
    { "key": "bg_sky",       "parallax": 0.0, "tileX": false },
    { "key": "bg_clouds",    "parallax": 0.2, "tileX": true  },
    { "key": "bg_mountains", "parallax": 0.4, "tileX": true  },
    { "key": "bg_trees",     "parallax": 0.7, "tileX": true  }
  ],
  "scenery": [
    { "type": "ground",   "x": 0,    "y": 550, "width": 4000, "height": 50 },
    { "type": "platform", "x": 600,  "y": 450, "width": 200,  "height": 20 },
    { "type": "platform", "x": 900,  "y": 350, "width": 200,  "height": 20 },
    { "type": "wall",     "x": 1400, "y": 450, "width": 50,   "height": 100 },
    { "type": "pipe",     "x": 1800, "y": 470, "width": 64,   "height": 96 }
  ]
}
```

---

## 2. Scenery factory

Prototype logic (colored rectangles as placeholders), extended to prefer a sprite/tileSprite when the key
exists:

```js
levelData.scenery.forEach(item => {
  let piece;
  if (hasAsset(item.type)) {                 // Phase 7 hook
    piece = this.add.tileSprite(item.x, item.y, item.width, item.height, item.type)
                .setOrigin(0, 0);
  } else {                                    // placeholder primitive
    let color = 0x8B4513;                     // brown default
    if (item.type === 'ground')               color = 0x4CAF50; // grass green
    if (item.type === 'wall' || item.type === 'pipe') color = 0x2E7D32; // dark green
    piece = this.add.rectangle(item.x + item.width/2, item.y + item.height/2,
                               item.width, item.height, color);
  }
  this.physics.add.existing(piece, true);
  platforms.add(piece);
});
```

---

## 3. Parallax background

Replace the prototype's single sky rectangle with layered `tileSprite`s that scroll at different rates.
Keep the **sky-blue rectangle as the fallback** so the game still renders before art arrives.

```js
levelData.background.forEach(layer => {
  if (!hasAsset(layer.key)) return;          // fallback: solid sky rect stays
  const img = this.add.tileSprite(0, 0, worldW, window.innerHeight, layer.key).setOrigin(0, 0);
  img.setScrollFactor(layer.parallax);       // 0 = fixed sky, 1 = moves with world
  img.setDepth(-10 + layer.parallax);        // farther layers behind
});
```

> The **dark-zone color fade in Phase 5 tints this backdrop** — keep a reference to the base sky layer
> (`backgroundRect`) so the transition can interpolate its color.

---

## Sprite Slots — Phase 3 (Structures / builds + Backgrounds)

### Structures / builds
| Slot | Asset key | Path | Size (px) | Placeholder | Status |
|------|-----------|------|-----------|-------------|--------|
| Ground | `ground` | `assets/sprites/structures/____.png` | 32×32 tileable | 🟩 green rect | ⬜ |
| Platform | `platform` | `assets/sprites/structures/____.png` | 32×32 tileable | 🟫 brown rect | ⬜ |
| Wall / block | `wall` | `assets/sprites/structures/____.png` | 32×32 | 🟩 dark rect | ⬜ |
| Pipe | `pipe` | `assets/sprites/structures/____.png` | 64×96 | 🟩 dark rect | ⬜ |

### Backgrounds (parallax)
| Slot | Asset key | Path | Size | Parallax | Placeholder | Status |
|------|-----------|------|------|----------|-------------|--------|
| Sky | `bg_sky` | `assets/images/backgrounds/____.png` | ≥1920×1080 | 0.0 | `#87CEEB` fill | ⬜ |
| Clouds | `bg_clouds` | `assets/images/backgrounds/____.png` | tileable | 0.2 | none | ⬜ |
| Mountains | `bg_mountains` | `assets/images/backgrounds/____.png` | tileable | 0.4 | none | ⬜ |
| Trees | `bg_trees` | `assets/images/backgrounds/____.png` | tileable | 0.7 | none | ⬜ |

---

## Acceptance criteria
- [ ] Editing `world.json` changes the level with no code edits.
- [ ] Placeholders render for any scenery type without art.
- [ ] Background layers scroll at different speeds (once art is present).
- [ ] The base sky reference is available for Phase 5's tint.
