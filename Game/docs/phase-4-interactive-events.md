# Phase 4 — Interactive Objects & Event System

**Goal:** milestones (mushroom / star / heart / trophy…) placed from data, floating gently, that trigger a
life-event when the player overlaps them. This is the storytelling core.

**Depends on:** [phase-3-world-data.md](phase-3-world-data.md)

---

## Deliverables
- [x] Milestones spawned from the `milestones` array with per-item event data attached.
- [x] Floating tween on each milestone (prototype behavior).
- [x] Enter/exit edge detection firing the event exactly once per entry; milestones are never destroyed
      and re-entering one replays its story.
- [x] Event payload passed to the UI layer (Phase 6 renders it).
- [ ] Each milestone icon exposed as a **Sprite Slot**.

---

## 1. Milestone / event schema

Extends the prototype's `milestones[].modalData`:

```json
{
  "milestones": [
    {
      "x": 700, "y": 400, "icon": "mushroom",
      "event": {
        "id": "first-job",
        "date": "January 2018",
        "title": "My first job",
        "text": "Where my professional adventure began...",
        "images": [
          { "path": "assets/images/events/first_job_1.jpg", "caption": "First day at the office" },
          { "path": "assets/images/events/first_job_2.jpg", "caption": "The team, six months in" }
        ],
        "trigger": "overlap",
        "consume": true,
        "pauseGame": true
      }
    }
  ]
}
```

`icon` selects the sprite/placeholder; `event` is handed verbatim to the modal. `images[]` (each with its
own `caption`) drives the modal's carousel — see [phase-6-ui-modals.md](phase-6-ui-modals.md). The older
single-string `imagePath` still works as a one-slide gallery for events that don't need one.

---

## 2. Spawn + float (from prototype)

```js
const milestones = this.physics.add.group({ allowGravity: false, immovable: true });

levelData.milestones.forEach(item => {
  let obj;
  if (hasAsset('icon_' + item.icon)) {                 // Phase 7 hook
    obj = this.add.sprite(item.x, item.y, 'icon_' + item.icon);
  } else {                                              // placeholder circle
    let color = 0xff0000;                               // mushroom red
    if (item.icon === 'star')  color = 0xffd700;        // star yellow
    if (item.icon === 'heart') color = 0xff69b4;        // heart pink
    obj = this.add.circle(item.x, item.y, 20, color);
  }
  milestones.add(obj);
  obj.eventData = item.event;                           // attach payload
  obj.playerInside = false;                             // enter/exit edge state
  obj.visited = false;

  this.tweens.add({ targets: obj, y: item.y - 15, duration: 1500,
                    ease: 'Sine.inOut', yoyo: true, repeat: -1 });
});
```

Note there is **no** `physics.add.overlap(...)` for milestones — see below for why.

---

## 3. Trigger handler — enter/exit edges

Milestones are landmarks, not pickups: they are **never destroyed**, so they stay visible on the map after
their story has been told, and walking back into one **reopens its modal**. Re-readable stories are exactly
what rules out `physics.add.overlap()`, whose callback fires every frame the bodies touch with no notion of
leaving again — closing the modal while still standing on an icon would reopen it instantly, forever. The
overlap is derived in `update()` instead, so an "enter" is a real edge:

```js
function updateMilestones() {
  milestones.getChildren().forEach(obj => {
    const inside = overlapsPlayer(obj);                  // plain AABB on the bodies
    if (inside && !obj.playerInside) enterMilestone(obj);
    obj.playerInside = inside;                           // ...must exit before firing again
  });
}

function enterMilestone(obj) {
  if (!obj.visited && obj.eventData?.consume !== false) obj.setAlpha(0.45);  // dimmed = already read
  obj.visited = true;
  isPaused = true;
  player.body.setVelocity(0, 0);
  openEventModal(obj.eventData);         // Phase 6
}
```

`consume` survives from the pickup-style version but is now **purely cosmetic** — nothing stops a modal
from reopening:

| `consume` | Behavior |
|-----------|----------|
| `true` (default) | Dims the icon to `0.45` alpha once its story has been read, marking it visited. Still replays on every re-entry. |
| `false` | Never dims — stays at full brightness. Replays on every re-entry. |

> `openEventModal` is the seam into Phase 6. In the prototype it directly writes to the DOM; keep that,
> but route through one function so the UI can evolve independently.

---

## Sprite Slots — Phase 4 (Interactive icons)

| Slot | Asset key | Path | Size (px) | Placeholder | Status |
|------|-----------|------|-----------|-------------|--------|
| Mushroom | `icon_mushroom` | `assets/sprites/icons/____.png` | 40×40 | 🔴 red circle | ⬜ |
| Star | `icon_star` | `assets/sprites/icons/____.png` | 40×40 | 🟡 yellow circle | ⬜ |
| Heart | `icon_heart` | `assets/sprites/icons/____.png` | 40×40 | 🩷 pink circle | ⬜ |
| Trophy | `icon_trophy` | `assets/sprites/icons/____.png` | 40×40 | 🟠 orange circle | ⬜ |
| Coin | `icon_coin` | `assets/sprites/icons/____.png` | 32×32 | 🟡 circle | ⬜ |
| Photo frame | `icon_photo` | `assets/sprites/icons/____.png` | 48×48 | ⬜ white square | ⬜ |

**Event images** (shown inside the modal, not on the map) live in `assets/images/events/` and are referenced
per-event by `event.images[]` (or the older single `event.imagePath`) — no fixed key needed.

---

## Acceptance criteria
- [x] Milestones appear at their JSON coordinates and bob up/down.
- [x] Walking into one fires the event **once per entry**.
- [x] The milestone stays visible after firing (dimmed when `consume: true`), never disappears.
- [x] Closing the modal while still standing on the icon does **not** reopen it — the player has to walk
      out and back in.
- [x] Walking back into an already-read milestone **does** reopen its modal.
- [x] The correct payload reaches the modal function.
- [x] Adding a milestone in JSON needs no code change.
