# Phase 1 — Foundation & Project Setup

**Goal:** a running Phaser 3 canvas that fills the browser, loads from a static server, and boots into an
empty scene. No gameplay yet — just the shell everything else hangs off of.

**Depends on:** [phase-0-overview.md](phase-0-overview.md)

---

## Deliverables
- [ ] `index.html` — page shell with a `#game-container`, the DOM UI layer, and the Phaser CDN script.
- [ ] `style.css` — full-viewport, no-scroll layout.
- [ ] `game.js` — Phaser config + empty `preload/create/update`.
- [ ] Folder skeleton for `assets/`, `data/`, `src/` (see [README.md](README.md)).
- [ ] Runs via a local static server with a sky-blue canvas and no console errors.

---

## 1. HTML shell

Mirror the prototype in `Option1/index.html`: a game container, an **ambient zone-text** banner, and a
**DOM modal layer** (Option 1's transition style lives in the DOM, so reserve it now).

```html
<div id="game-container"></div>

<!-- Ambient banner (fades in on zone entry — Phase 5) -->
<div id="zone-text" class="hidden"></div>

<!-- DOM modal overlay (Phase 6) -->
<div id="ui-layer" class="hidden">
  <div class="modal">
    <span id="close-btn" class="close">&times;</span>
    <span id="modal-date" class="date"></span>
    <h2 id="modal-title"></h2>
    <img id="modal-img" src="" alt="Life event" style="display:none;">
    <p id="modal-text"></p>
    <button id="continue-btn">Continue Journey</button>
  </div>
</div>
```

Load Phaser from CDN for the prototype phase:
`https://cdn.jsdelivr.net/npm/phaser@3.55.2/dist/phaser.js`.

---

## 2. Viewport CSS

Key rules from `Option1/style.css`: `overflow: hidden` on `html/body`, container absolutely positioned at
full size, `#ui-layer` a fixed flex-centered overlay hidden by default, background `#87CEEB`.

---

## 3. Phaser config

```js
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  physics: { default: 'arcade', arcade: { gravity: { y: 800 }, debug: false } },
  scene: { preload, create, update }
};
const game = new Phaser.Game(config);

window.addEventListener('resize', () =>
  game.scale.resize(window.innerWidth, window.innerHeight));
```

> **Note:** the prototype uses the single-scene form. From Phase 2 onward we migrate to named scenes
> (`BootScene → PreloadScene → MainScene → UIScene`).

---

## 4. Folder skeleton

```
Game/
 ├── index.html
 ├── style.css
 ├── game.js
 ├── data/
 │    ├── world.json
 │    ├── events.json
 │    └── assets.json
 ├── assets/
 │    ├── sprites/
 │    │    ├── characters/     ← player & NPC art
 │    │    ├── structures/     ← builds: ground, platforms, pipes, walls, flags
 │    │    └── icons/          ← milestone icons
 │    ├── images/
 │    │    └── backgrounds/    ← parallax layers
 │    ├── music/
 │    └── fonts/
 └── docs/
```

> The three sprite folders (`characters/`, `structures/`, `icons/`) and `images/backgrounds/` are the
> four drop targets referenced by every Sprite Slot table.

---

## Sprite Slots — Phase 1

None yet (no rendering). This phase only **creates the empty folders** the later slots point at.

| Slot | Path to create | Status |
|------|----------------|--------|
| Characters dir | `assets/sprites/characters/` | ⬜ |
| Structures dir | `assets/sprites/structures/` | ⬜ |
| Icons dir | `assets/sprites/icons/` | ⬜ |
| Backgrounds dir | `assets/images/backgrounds/` | ⬜ |

---

## Acceptance criteria
- [ ] `npx serve` (or any static server) opens a full-window sky-blue canvas.
- [ ] Resizing the browser resizes the canvas.
- [ ] `#ui-layer` and `#zone-text` exist in the DOM but are hidden.
- [ ] No console errors.
