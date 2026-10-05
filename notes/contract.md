# Engine contract details (fills the gaps in PLAN.md section 7)

Agreed between the main session, the site-builder and the engine-builder (2026-10-05). PLAN.md still wins on any conflict.

## Stroke
`{ x0, x1, y, height, slope, snapped, seed }` in page pixels.
- `slope` is dy/dx (the line is `y = a + slope * x`; positive = runs downhill to the right).
- `y` is the vertical centre of the band of print at the x-midpoint `(x0 + x1) / 2`.
- `height` is the band height, measured across the line (the text height; the highlighter draws 1.15 times this).
- Raw (un-snapped) strokes mean exactly the same.
- Snapped strokes may carry one extra field, `base` (where the baseline is, measured down from `y`). The underline uses it. Strokes built by hand do not need it.

## Page
`{ width, height, image, lines, warning }`.
- `image` is a canvas in the browser (an ImageData only where there is no canvas, e.g. Node).
- `lines[i]` is `{ top, bottom, slope, x0, x1 }` plus `a`, `height`, `base`, `words: [[x0, x1], ...]` (extras).
  `top`/`bottom` are the band measured straight up and down at the middle of the line.
- `UL.page.rawStroke(page, points)` gives the un-snapped stroke (used while the finger is moving).

## Editor view
`UL.card.drawEditor(canvas, page, strokes, liveStroke, opts?)`
- Scales the whole page to fill the canvas's CURRENT width/height (never resizes the canvas) and clears first.
- `liveStroke`: null/undefined = none; any Stroke-shaped object (also a blend between raw and snapped while it animates);
  an array of points `[{x, y}]`; or a Stroke-shaped object with an optional `points: [{x, y}]` array (page px).
- `opts`: `{ mark, colour, progress }`.

## Card and preview
- `UL.card.create(page, strokes, settings)` awaits `document.fonts.load('600 40px "Caveat"')` (it never waits longer than 2.5 s).
  The site must load `fonts/caveat-600.woff2` with `@font-face { font-family: "Caveat"; font-weight: 600 }`.
- Settings keys: `mark, colour, finish, fade, title, page, note`. `card.update(partial)` gets only the changed keys.
  `card.setStrokes(array)` may be called before `update`.
- `UL.card.startPreview(canvas, card, format)` sizes the canvas itself from its CSS box times `devicePixelRatio` (capped at 2);
  the canvas needs no width/height attributes. Pauses when the tab is hidden or the canvas is off screen.
- `card.drawFrame(ctx, t, format, scale)` is the only drawing function (preview, still, video).

## Export and share
- `UL.export.makeVideo(card, { onProgress, signal })`: `onProgress` gets a number 0..1.
- `UL.export.makeImage(card)` is a 1080x1080 JPEG (quality 0.92) of the card at `t = UL.END`.
- `UL.export.fileName(settings, ext)`: `underline-<title-slug>-p<page>.<ext>`, else `underline-<title-slug>.<ext>`, else `underline-<YYYY-MM-DD>.<ext>`.
- `UL.share.share` resolves to `"shared" | "cancelled" | "failed"`; `UL.share.save` to `"saved" | "shared" | "cancelled" | "failed"` (as Day 3).

## Sample
`UL.sample.load()` resolves to `{ page, strokes, settings }`; `settings` is `{ finish: "torn", title: "Jane Eyre", page: "252" }`
(also `UL.sample.settings`). `strokes` holds one Stroke on "I am no bird; and no net ensnares me".

## Errors
Engine functions reject with `Error` objects carrying `{ code, title, detail }`:
`not-image`, `heic`, `unreadable`, `no-lines` (a warning on the page only), `video-unsupported`, `cancelled`, `export-failed`.
