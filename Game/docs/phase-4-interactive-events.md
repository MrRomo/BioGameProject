# Phase 4 — Interactive Objects & Event System

**Goal:** milestones (mushroom / star / heart / trophy…) placed from data, floating gently, that trigger a
life-event when the player overlaps them. This is the storytelling core.

**Depends on:** [phase-3-world-data.md](phase-3-world-data.md)

---

## Deliverables
- [ ] Milestones spawned from the `milestones` array with per-item event data attached.
- [ ] Floating tween on each milestone (prototype behavior).
- [ ] `overlap(player, milestones, hitMilestone)` firing the event exactly once.
- [ ] Event payload passed to the UI layer (Phase 6 renders it).
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
        "imagePath": "assets/images/events/first_job.jpg",
        "trigger": "overlap",
        "consume": true,
        "pauseGame": true
      }
    }
  ]
}
```

`icon` selects the sprite/placeholder; `event` is handed verbatim to the modal.

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

  this.tweens.add({ targets: obj, y: item.y - 15, duration: 1500,
                    ease: 'Sine.inOut', yoyo: true, repeat: -1 });
});

this.physics.add.overlap(player, milestones, hitMilestone, null, this);
```

---

## 3. Trigger handler

```js
function hitMilestone(player, obj) {
  if (isPaused) return;                 // anti-rebounce
  isPaused = true;
  player.body.setVelocity(0, 0);
  if (obj.eventData.consume !== false) obj.destroy();
  openEventModal(obj.eventData);        // Phase 6
}
```

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
per-event by `event.imagePath` — no fixed key needed.

---

## Acceptance criteria
- [ ] Milestones appear at their JSON coordinates and bob up/down.
- [ ] Walking into one fires the event **once**.
- [ ] The correct payload reaches the modal function.
- [ ] Adding a milestone in JSON needs no code change.
