# Phase 6 — UI, Modals & HUD

**Goal:** the DOM-based presentation layer that shows an event's story when a milestone is triggered, plus
a lightweight HUD/timeline. Uses **Option 1's DOM modal** (with the `popIn` animation) rather than an
in-canvas modal.

**Depends on:** [phase-4-interactive-events.md](phase-4-interactive-events.md) ·
pairs with [phase-5-transitions-darkzones.md](phase-5-transitions-darkzones.md)

---

## Why the DOM modal (Option 1)
- Rich HTML content: images, formatted text, buttons, future video/audio embeds.
- CSS animation (`popIn`) and easy responsive styling.
- Cleanly separated from canvas — pauses gameplay via the shared `isPaused` flag.

---

## Deliverables
- [x] `openEventModal(data)` populating the DOM modal from an event payload.
- [x] `closeModal()` hiding it and un-pausing (with the anti-double-fire delay).
- [x] `popIn` entrance animation.
- [x] Image carousel: `event.images[]`, each slide with its own caption; Prev/Next arrows + dots
      auto-hide for a single slide. `event.imagePath` (legacy, one image, no caption) still works.
- [ ] Optional HUD: current year/age + progress bar.
- [ ] Optional timeline strip highlighting the current milestone.

---

## 1. Modal open/close + carousel (current implementation)

```js
let carouselSlides = [];
let carouselIndex = 0;

function openEventModal(data) {
  document.getElementById('modal-date').innerText  = data.date  || '';
  document.getElementById('modal-title').innerText = data.title || '';
  document.getElementById('modal-text').innerText  = data.text  || '';

  // Preferred: images[] = [{ path, caption }, ...]. imagePath (single string)
  // still works, as a one-slide gallery with no caption.
  carouselSlides = (data.images && data.images.length)
    ? data.images
    : (data.imagePath ? [{ path: data.imagePath, caption: data.imageCaption || '' }] : []);
  carouselIndex = 0;
  renderCarousel();

  document.getElementById('ui-layer').classList.remove('hidden'); // triggers popIn
}

function renderCarousel() {
  const wrap = document.getElementById('modal-carousel');
  if (carouselSlides.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const slide = carouselSlides[carouselIndex];
  document.getElementById('carousel-img').src = slide.path;

  const caption = document.getElementById('carousel-caption');
  caption.innerText = slide.caption || '';
  caption.style.display = slide.caption ? 'block' : 'none';

  const multi = carouselSlides.length > 1;              // nav is pointless with one slide
  document.getElementById('carousel-prev').style.display = multi ? 'flex' : 'none';
  document.getElementById('carousel-next').style.display = multi ? 'flex' : 'none';
  // ...dots rebuilt the same way, one per slide, click-to-jump — see game.js.
}

function carouselStep(delta) {
  if (carouselSlides.length < 2) return;
  carouselIndex = (carouselIndex + delta + carouselSlides.length) % carouselSlides.length;
  renderCarousel();
}

function closeModal() {
  document.getElementById('ui-layer').classList.add('hidden');
  setTimeout(() => { isPaused = false; }, 100); // avoid instant re-trigger
}
```

Wire buttons once in `create()`:
```js
document.getElementById('continue-btn').addEventListener('click', closeModal);
document.getElementById('close-btn').addEventListener('click', closeModal);
document.getElementById('carousel-prev').addEventListener('click', () => carouselStep(-1));
document.getElementById('carousel-next').addEventListener('click', () => carouselStep(1));
```

Left/Right arrow keys also step the carousel, but only while the modal is open — see `wireCarousel()`
in game.js. They're the player's movement keys the rest of the time.

---

## 2. Modal styling (Option 1 `popIn`)

```css
#ui-layer { position: absolute; inset: 0; background: rgba(0,0,0,0.7);
            z-index: 10; display: flex; justify-content: center; align-items: center; }
#ui-layer.hidden { display: none; }
.modal { background: #fff; padding: 30px; border-radius: 12px; max-width: 500px;
         width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
         position: relative; animation: popIn 0.3s ease-out; }
@keyframes popIn { 0% { transform: scale(0.8); opacity: 0; }
                   100% { transform: scale(1); opacity: 1; } }
```

---

## 3. Optional HUD & timeline (extensions)
- **HUD:** a fixed DOM strip showing the "current year" derived from the nearest passed milestone.
- **Timeline:** a horizontal strip of dots (one per milestone) with the active one highlighted, matching the
  timeline concept in [README.md](README.md).
- **Video / audio:** the modal's carousel slide could be swapped for a `<video>`/`<audio>` embed when an
  event provides one — not yet implemented, `images[]` (the photo carousel) is done, see above.

---

## Sprite Slots — Phase 6 (UI art — optional)

Most UI is CSS, but these image slots are reserved for a themed look:

| Slot | Asset key | Path | Size | Usage | Status |
|------|-----------|------|------|-------|--------|
| Modal frame | `ui_modal_frame` | `assets/images/ui/____.png` | 9-slice | decorative border | ⬜ |
| Continue button | `ui_btn` | `assets/images/ui/____.png` | 9-slice | button skin | ⬜ |
| Timeline dot | `ui_dot` | `assets/images/ui/____.png` | 16×16 | timeline marker | ⬜ |
| HUD panel | `ui_hud` | `assets/images/ui/____.png` | flexible | year/age badge | ⬜ |

> Create `assets/images/ui/` if you use any of these. Until then the CSS styling from Option 1 is the default.

---

## Acceptance criteria
- [x] Triggering a milestone opens the modal with its date/title/text/image(s).
- [x] The modal animates in with `popIn`.
- [x] "Continue"/close hides it and movement resumes after the short delay.
- [x] Events with no image hide the carousel cleanly.
- [x] Events with 2+ `images[]` show Prev/Next arrows, dots, and per-slide captions; arrows/dots hide
      for a single slide.
- [x] Gameplay is frozen while the modal is open.
