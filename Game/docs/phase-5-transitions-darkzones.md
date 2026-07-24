# Phase 5 — Scene Transitions & Dark Zones ⭐

**Goal:** the signature feel of the game — as the player crosses into a defined region, the world
**smoothly fades** into a different mood and an ambient caption appears. This uses **Option 1's transition
style** (chosen as the reference), not Option 2's hard cut.

**Depends on:** [phase-4-interactive-events.md](phase-4-interactive-events.md)

---

## Why Option 1 (the chosen approach)

| | **Option 1 — chosen** | Option 2 |
|---|---|---|
| Zone change | **Color interpolated over 1000 ms** via `tweens.addCounter` | Hard multiply-blend rectangle |
| Feedback | **Ambient caption fades in** (`#zone-text`, CSS `opacity 0.5s`) | none |
| Modal | **DOM overlay with `popIn` animation** | in-canvas container, hard show |
| Feel | cinematic, gradual | instant, flat |

Option 1's gradual color fade + caption is the mood we standardize on for **all** transitions (dark zones,
and later time-of-day / chapter shifts).

---

## Deliverables
- [ ] `zones` array in `world.json` driving region detection.
- [ ] Enter/exit detection by player X against `startX`/`endX` (prototype method).
- [ ] Smooth **sky-color interpolation** on enter and exit (1000 ms tweens).
- [ ] **Ambient caption** fade in/out via the `#zone-text` DOM element.
- [ ] Generalized as a reusable `TransitionManager` so new zone themes are data-only.

---

## 1. Zone schema

```json
{
  "zones": [
    {
      "id": "pandemic",
      "startX": 1500, "endX": 2500,
      "theme": "dark",
      "skyColor": "#222222",
      "ambientText": "2020 — The pandemic and remote work",
      "fadeMs": 1000,
      "music": "assets/music/somber.mp3"
    }
  ]
}
```

`skyColor` makes the fade target data-driven (prototype hardcoded `#222222`). Default base sky = `#87CEEB`.

---

## 2. Transition logic (from Option 1's `update`)

Track the current zone; only run a fade when it **changes**.

```js
let inDarkZone = false;
const BASE_SKY = '#87CEEB';

// inside update():
const px = player.x;
const currentZone = levelData.zones.find(z => px >= z.startX && px <= z.endX);
const zoneText = document.getElementById('zone-text');

// ENTER
if (currentZone && currentZone.theme === 'dark' && !inDarkZone) {
  inDarkZone = true;
  fadeSky(this, BASE_SKY, currentZone.skyColor || '#222222', currentZone.fadeMs || 1000);
  zoneText.innerText = currentZone.ambientText;
  zoneText.classList.remove('hidden');   // CSS opacity 0.5s -> fades in
}
// EXIT
else if (!currentZone && inDarkZone) {
  inDarkZone = false;
  fadeSky(this, '#222222', BASE_SKY, 1000);
  zoneText.classList.add('hidden');      // fades out
}
```

### The reusable fade helper
Extracted from the prototype's inline `tweens.addCounter` so both enter and exit share it:

```js
function fadeSky(scene, fromHex, toHex, duration) {
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
```

> `backgroundRect` is the base sky reference kept from [phase-3-world-data.md](phase-3-world-data.md).
> When parallax art is present, tint the sky layer (or overlay a fading dark rectangle) instead of the fill.

---

## 3. Ambient caption CSS (from Option 1)

```css
#zone-text {
  position: absolute; top: 40px; width: 100%; text-align: center;
  z-index: 5; font-size: 32px; color: #fff; font-weight: bold;
  text-shadow: 3px 3px 6px rgba(0,0,0,0.8);
  letter-spacing: 2px; transition: opacity 0.5s;
}
#zone-text.hidden { opacity: 0; pointer-events: none; }
```

---

## 4. Optional dark-zone extras (data-flagged)
Enable per zone via extra JSON fields — each is a placeholder hook:
- `fog: true` — a slow-scrolling semi-transparent `tileSprite` overlay (**Sprite Slot below**).
- `rain: true` — a Phaser particle emitter.
- `desaturate: true` — a camera post-pipeline / tint toward gray.
- `music` — cross-fade handled by the Audio Manager (Phase 8).

---

## Sprite Slots — Phase 5 (Backgrounds / overlays)

| Slot | Asset key | Path | Size | Usage | Placeholder | Status |
|------|-----------|------|------|-------|-------------|--------|
| Fog overlay | `fx_fog` | `assets/images/backgrounds/____.png` | tileable, alpha | dark-zone fog | none | ⬜ |
| Rain particle | `fx_raindrop` | `assets/sprites/icons/____.png` | 4×16 | rain emitter | 1px line | ⬜ |
| Dark vignette | `fx_vignette` | `assets/images/backgrounds/____.png` | ≥1920×1080, alpha | edge darkening | none | ⬜ |
| Alt sky (dusk) | `bg_sky_dusk` | `assets/images/backgrounds/____.png` | ≥1920×1080 | tinted target | fill color | ⬜ |

---

## Acceptance criteria
- [ ] Crossing into a zone fades the sky over ~1 s (no snap).
- [ ] The ambient caption fades in on enter, out on exit.
- [ ] Leaving the zone fades everything back to the base sky.
- [ ] Adding a new zone (with its own `skyColor`/`ambientText`) needs no code change.
- [ ] The fade helper is shared by enter and exit paths.
