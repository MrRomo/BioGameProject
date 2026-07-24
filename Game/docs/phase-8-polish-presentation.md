# Phase 8 — Audio, Polish & Presentation Mode

**Goal:** turn the working engine into something presentation-ready for a work demo — sound, a clean
intro/outro, and reliable controls in front of an audience.

**Depends on:** [phase-5-transitions-darkzones.md](phase-5-transitions-darkzones.md),
[phase-6-ui-modals.md](phase-6-ui-modals.md), [phase-7-assets-sprites.md](phase-7-assets-sprites.md)

---

## Deliverables
- [ ] Background music with per-zone cross-fade (ties into the Phase 5 transition).
- [ ] SFX for jump, milestone pickup, modal open.
- [ ] Intro title card + end/credits screen.
- [ ] "Presentation mode" niceties (auto-focus, no accidental scroll, restart key).
- [ ] Final asset & QA pass.

---

## 1. Audio manager
- Load tracks listed in `assets.json` / referenced by `zone.music`.
- On zone **enter/exit**, cross-fade the current track to the zone's track over the same `fadeMs` used by
  the sky fade so audio and visuals move together (Option 1 feel).

```js
function crossfadeMusic(scene, toKey, ms) {
  const next = scene.sound.add(toKey, { loop: true, volume: 0 });
  next.play();
  scene.tweens.add({ targets: next, volume: 0.6, duration: ms });
  if (currentTrack) scene.tweens.add({ targets: currentTrack, volume: 0, duration: ms,
                                       onComplete: () => currentTrack.stop() });
  currentTrack = next;
}
```

---

## 2. Intro & outro scenes
- **Title card:** name/role, "Press → to begin". A simple DOM overlay or a lightweight Phaser scene.
- **End screen:** reached when the player passes the final milestone / a `flag` structure — show a summary
  and a "Replay" button (`location.reload()` or reset state).

---

## 3. Presentation-mode niceties
- Auto-focus the canvas so arrow keys work immediately.
- `preventDefault` on arrow/space so the page never scrolls.
- `R` = restart, `Esc` = close any open modal.
- Optional fullscreen toggle (`this.scale.startFullscreen()`).
- Hide the mouse cursor after idle for a cleaner projected look.

---

## Sprite / media Slots — Phase 8

### Audio — `assets/music/` & `assets/sfx/`
| Asset key | Path | Usage | Status |
|-----------|------|-------|--------|
| `music_main` | `assets/music/____.mp3` | default track | ⬜ |
| `music_dark` | `assets/music/____.mp3` | dark-zone track | ⬜ |
| `sfx_jump` | `assets/sfx/____.wav` | jump | ⬜ |
| `sfx_pickup` | `assets/sfx/____.wav` | milestone trigger | ⬜ |
| `sfx_modal` | `assets/sfx/____.wav` | modal open | ⬜ |

### Presentation art
| Slot | Asset key | Path | Usage | Status |
|------|-----------|------|-------|--------|
| Title background | `bg_title` | `assets/images/backgrounds/____.png` | intro card | ⬜ |
| End/credits background | `bg_end` | `assets/images/backgrounds/____.png` | outro | ⬜ |
| Logo | `ui_logo` | `assets/images/ui/____.png` | title/branding | ⬜ |
| Goal flag | `flag` | `assets/sprites/structures/____.png` | end trigger | ⬜ |

---

## Final QA checklist
- [ ] Full run start→finish with no console errors.
- [ ] Every milestone opens its modal; every zone fades correctly.
- [ ] Audio cross-fades align with visual fades.
- [ ] Works at the presentation resolution / projector aspect ratio.
- [ ] Restart works mid-run.
- [ ] All intended Sprite Slots are ✅ (or intentionally left as styled placeholders).
- [ ] Loads over a static host (works offline once cached).
