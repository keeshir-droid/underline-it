# PLAN.md: Underline (Day 4)

> **Highlight the line you love, without ruining your book.**
> Photograph a page, swipe over the line on your phone screen. A real-looking highlighter stroke sweeps across it and you get a keepsake card or story video. Free, no account, no AI, nothing uploaded.

This is the single planning file for the project. A build session opened in this folder (`underline/`) should need only this file, the root `../CLAUDE.md` (loaded automatically), and the agents in `.claude/agents/`.

**Status (2026-10-05):** planned, nothing built. The folder holds only this file, `HANDOFF.md` and the agents. Build in a separate session, starting from `HANDOFF.md`.

**Decisions made by Rishi (2026-10-05):**
- Address `underline-it.vercel.app`; repo and Vercel project `underline-it`. The folder stays `underline/`.
- Default finish: **Torn page**, used for first-time visitors and the landing demo.
- Sample line: Jane Eyre.
- "Copy the words" happens only if there's time (M5).
- Footer siblings: Handwriting → Font and Doodle Alive (`doodle-alive.vercel.app`).

---

## 1. Why this, and for whom

**Audience:**
- Young (teens to 20s) readers who are expressive and non-technical, and read mostly **print** books (about 80% of book purchases by 13–24-year-olds are print).
- Not developers, not content creators.

**The problem, in their words:**
- **"I love this line, but I won't write in my book."** About half of readers refuse to mark their books (Goodreads threads; r/books "do you write in your books" threads).
- **"I photograph pages, but I don't know where the photo goes."** A heavy reader Rishi interviewed copies lines into a notebook by hand for exactly this reason. Page photos get lost in the camera roll with no label, and you can't remember which book they came from.
- **Interest in lines is huge:** r/books "favorite opening line" got 13.5k upvotes and 6.4k comments, and "favorite line from favorite book" got about 950.

**What exists:**
- 12+ quote apps: Highlighted, Bookmory, Readgraphy, QOTD, Readwise and others.
- They all turn the page into typed text inside an app library, usually behind a paywall.
- **Nobody keeps your real page with an animated highlighter, then hands you a self-labelled image you own.**

**Honest risks from the research:**
- It's a crowded category, and quote apps rarely go viral.
- There's no proof people send a line to one specific person, so most sharing will probably be stories.
- The whole idea stands or falls on the highlighter looking **real** on camera. That's milestone M1's go/no-go.

## 2. The bar

- **The stroke looks like a real marker on real paper.** Slightly uneven edges, a bit of texture, ink pooling where it starts and stops, the words staying crisp underneath. If it looks like a flat yellow rectangle, we haven't shipped.
- **Fast.** The photo appears ready to swipe in under about 1 s. The highlight follows your finger with no lag. The image saves instantly, and the video takes about 5 s at most.
- **Few taps.** Snap → swipe → Save takes 3 taps after the photo. Everything else is optional.
- **You own the result.** It works fully without the site remembering anything. The image is labelled, named well, and lives in your Photos.
- **Pretty enough to screenshot**, both the site's screens and every output.

---

## 3. The user flow, from the reel to the next person

### Step 0: the reel (where they come from)
- **What the viewer sees:**
  - a real book and a line someone loves
  - a thumb hesitating with a pen ("I can't write in this")
  - the phone camera on the page instead
  - a finger swipes across the screen and **a highlighter stroke sweeps across the line**
  - the page fades, and a torn-page card with washi tape lands in the camera roll
- **Caption hook:** *"highlight your books without ruining them"*.
- **Getting there:** the site address is on screen at the end and in the bio/link sticker: `underline-it.vercel.app` (confirmed free on 2026-10-05; `underline.vercel.app` is taken). It has to be short enough to type from memory.
- **Their thought:** "I have a book right here." The reel is the ad, and the output in the reel is also the ad.

### Step 1: landing (first 3 seconds)
- They open the link on their phone (usually inside Instagram's in-app browser).
- **What they see:**
  - one line, *"Highlight the line you love, without ruining your book."*
  - a sample card animating in the default Torn page finish: a public-domain page (Jane Eyre) with a yellow highlight sweeping across *"I am no bird; and no net ensnares me"*
  - one big button, **Snap a page**, a small *Choose a photo* link, and a tiny trust line, *"Free. No account. Your photo stays on your phone."*
- **No book handy?** A **Try it on a sample** link drops them into the editor with the Jane Eyre page.

### Step 2: snap
- The phone camera opens. This is a file input with camera capture; a site can't open the camera without a tap.
- They photograph the page as people really do: a bit crooked, room light, thumb in the corner.
- Photos from the gallery work too. HEIC pictures that can't be read get a friendly message.

### Step 3: the page appears (about 1 s)
- The page comes back warmer and brighter: the yellow lamp cast becomes soft warm paper and harsh shadows lift. It's **not** flattened or retyped; it still looks like *their* book.
- Without anyone noticing, the site has also found every line of print on the page.
- A hint floats over it: **"Swipe across the line you love."** with a small animated finger.

### Step 4: swipe (the magic moment)
- They drag a finger across the line on the screen. The stroke **follows the finger live**, then **snaps** to the line of print under it: it straightens to the line's slope, matches the line's height, and trims to where the words start and end.
- **More lines:** a longer passage? Swipe the next line. Each swipe adds a stroke.
- **Undo:** one tap removes the last stroke. **Clear** removes all of them.
- **No line found** (a blank area, or a picture): the stroke stays where the finger went, at a sensible height. It never fails silently.

### Step 5: make it theirs (all optional, one tap each)
The preview updates instantly as they choose.
- **Mark:** Highlighter · Pen underline
- **Colour:** Yellow · Pink · Green · Blue
- **Finish:**
  - **Clean:** warm paper, soft shadow, rounded card
  - **Polaroid:** white instant-photo frame, a slight tilt, the title written in Caveat on the bottom strip
  - **Film:** grain, warm fade, light leak, orange date stamp like a disposable camera
  - **Torn page:** a torn paper edge, a strip of washi tape, on a soft linen background
- **Focus:** "Fade the rest". On by default: the rest of the page dims so the line glows. Can be turned off.
- **Label:** book title, page number and a short note (optional, max about 60 characters). The date is filled in automatically.

### Step 6: keep it and send it
Two outputs, two big buttons:
- **Save image** is the main button. A square 1080×1080 card. On iPhone it opens the share sheet, where **Save Image** puts it in Photos. On Android it downloads straight to the gallery or Downloads.
- **Share story** makes the 5 s 1080×1920 video:
  - 0–0.6 s: the page settles in
  - 0.6–2.2 s: the highlight sweeps across each line in order
  - 2.2–3.0 s: the rest fades and the view pushes gently toward the line
  - then a hold, with the label appearing
  - "Making your video…" is shown while the preview plays. Then the share sheet opens (Instagram, WhatsApp, Messages, Save Video). If the phone can't share files, the button becomes **Save video** with a one-line tip.
- Every output carries a small *made with underline-it.vercel.app* mark.

### Step 7: where it lives afterwards (the answer to "where does the photo go?")
- **The image is the record.** Printed on every card is a small label, for example *"Jane Eyre · p. 252 · 5 Oct 2026 · underline"*. Wherever the picture travels, it says what it is.
- **Phones can find it.** iPhone Photos and Google Photos both search the text inside pictures, so searching **"underline"** or the book title finds every saved line. The done screen says so.
- **Clear file names:** `underline-jane-eyre-p252.jpg` (or `underline-2026-10-05.jpg` without a title). Helpful in Android's Downloads and in the Files app.
- **One-time tip** (dismissible, remembered on the device): *"Keep them together: make an album called Lines in Photos and drop these in."* A website can't create albums or folders itself; browsers don't allow it.
- **The site keeps nothing.** No account, no server, no gallery on the site. If someone clears their browser, nothing is lost, because everything is already in their Photos.
- Optional (M5): **Copy the words**, so the line lands as text in Notes (see §6.6).

### Step 8: the next person (the growth loop)
- A friend sees the story or the DM: a real book page with a glowing highlighted line, on a torn-page card with washi tape, with *made with underline-it.vercel.app* in the corner.
- **Their thought:** "I want that for my book." They type the address and land on Step 1. Same magic and same loop.

### Returning visit
- They open the site from a bookmark or typed address, and it remembers their last finish, mark and colour (on the device only).
- **Snap a page** → swipe → Save takes about 10 seconds.

---

## 4. Scope for today

### In
- Photo intake: camera, gallery, paste on desktop, HEIC message.
- Light cleanup: warm white balance, brighten, lift shadows, gentle vignette.
- Line finding, and a swipe that snaps to the line. Several strokes, undo and clear.
- Two marks (highlighter, pen underline) and four colours.
- Four finishes (Clean, Polaroid, Film, Torn page) and fade-the-rest.
- Label: title, page, note, auto date.
- Square image (JPEG 1080×1080) and story video (MP4 1080×1920, 5 s).
- Share sheet with save fallbacks, clear file names, the saving tips.
- Built-in Jane Eyre sample page (public domain), drawn in code, for the landing demo and "Try it on a sample".
- Remembers last settings on the device. "More from Risheek" footer. "Made with" mark on every output.
- Vercel Web Analytics (page views).
- README (standard sections). Live on its own Vercel address.

### Optional, only if ahead of time (M5)
- **Copy the words:** read just the highlighted lines on the phone with Tesseract.js (see §6.6).

### Not today (goes in README "next steps")
- Flattening curved pages; perspective correction.
- A "my lines" collection on the site; a PDF of all your lines.
- Circles, margin scribbles, sticky-tab style.
- Story-format still image, feed 4:5 format.
- Bringing in your handwriting font from Day 2 for the note (a nice family link later).
- Add to Home Screen / offline.

---

## 5. Design

### 5.1 The look: Day 2's family, warmer and bookish
Copy Day 2's tokens (`../handwriting-font-converter/src/styles.css` `:root`). Always light.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f6f2ea` | page background (warm paper) |
| `--card` | `#fffdf8` | cards, panels |
| `--text` | `#1c2433` | text |
| `--muted` | `#6c6a64` | secondary text |
| `--accent` | `#1f3a5f` | ink-blue buttons and links |
| `--accent-soft` | `#e7edf6` | selected chips |
| `--line` | `#e6dfd1` | borders |
| `--radius` | `20px` | cards |
| `--serif` | `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` | headings |
| `--sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | body, buttons |
| Caveat 600 | local `fonts/caveat-600.woff2` | Polaroid caption, the swipe hint, the note |

- Feel: a quiet reading nook. Paper, a little warmth, one highlighter colour as the only bright thing on screen.
- Primary buttons are pill-shaped, 56px tall, ink-blue. Chips are 44px.

### 5.2 Voice
- Short, warm, bookish, talking to the person: *Snap a page. Swipe across the line you love. Keep it.*
- Never "upload", "process", "render", "OCR" or "AI".

### 5.3 Screens (phone first at 390×844, one-handed)
1. **Landing:** headline, animated sample card, Snap a page, Choose a photo, Try it on a sample, trust line, footer.
2. **Editor:**
   - the photo fills the width
   - swipe hint on first use
   - a bottom bar with Undo · Clear · **Next**
3. **Style:**
   - the live preview card
   - chip rows for Mark, Colour, Finish
   - a "Fade the rest" toggle and the label fields (collapsed under "Add title & page")
   - a sticky bottom bar: **Save image** (primary) · **Share story**
4. **Making video:** the preview keeps playing, "Making your video…" with progress.
5. **Done:** "Saved." The saving tips (search Photos for "underline"; the album tip once), Share story / Save image again, "Underline another line" (back to the editor, same photo), "New page".
6. **Errors** (always one friendly message plus one button):
   - not an image
   - HEIC that can't be read
   - photo too dark or blurry to find lines (still lets them swipe)
   - video not supported (offer the image)

Desktop: the same screens, centred in a 480px column, with paste-a-photo support.

### 5.4 The mark (the most important visual)
- **Highlighter:**
  - A band about 1.15× the line's text height, centred slightly below the line's middle (real highlighting sits low).
  - Drawn **multiply-blended** under the text, so black ink stays crisp.
  - Colour opacity 0.55–0.7, with a slight left-to-right variation in density.
  - Edges wobble ±1.5% of the band height, using low-frequency noise seeded per stroke.
  - Ends: slightly squarish chisel shape, a darker overlap blob where the marker starts and stops, and a faint second pass of 6–10% where strokes overlap.
  - A tiny upward drift (±0.5°) over the length, so it looks hand-drawn.
- **Pen underline:**
  - A 2–3px ink-blue or chosen-colour line, about 0.15× the text height below the baseline.
  - Gently wavy, with a small hook at the end, multiply-blended.
- **Colours** (as highlighter ink, multiply):
  - yellow `#ffe45c`
  - pink `#ff9ec7`
  - green `#a8f07a`
  - blue `#8fd3ff`
  - For the pen underline, use the same hue made darker (about 45% lightness).
- **Fade the rest:** everything outside the strokes' bands (plus a small soft margin) blends 55% toward the paper colour, with a soft 24px feather.

### 5.5 Finishes (the card around the page)
In every finish:
- The **page crop** centres on the marked lines, showing about 2 lines above and below (more if there's room), and keeps the photo's real texture.
- The label sits outside the page area.
- The made-with mark sits bottom-right, 22px, at 55% opacity.

| Finish | Square card (1080×1080) | Story frame (1080×1920) |
|---|---|---|
| **Clean** | `--bg` background, page crop on a `--card` rounded rectangle with a soft shadow, label underneath in serif | same, page crop larger and centred, label below |
| **Polaroid** | soft warm-grey background, a white instant-photo frame (bottom strip about 3× the side borders) tilted −2°, label written in Caveat on the strip, a faint drop shadow | same frame, larger, slight hand-held tilt |
| **Film** | page crop full-bleed, fine grain (seeded noise), warm fade (lifted blacks, warm highlights), a soft orange light leak in one corner, an orange 7-segment-style date stamp bottom-right (drawn in code), label in small serif on a strip | same, full-bleed |
| **Torn page** | linen-texture background (drawn in code), page crop with a torn top and bottom edge (jagged noise path plus a paper-fibre highlight), a washi-tape strip across one corner, label in serif | same |

- **Story safe zones:** keep the page, label and mark between y=270 and y=1540, with 90px side margins. Instagram's top and bottom bars cover the rest.

---

## 6. Tech

Plain HTML, CSS and JavaScript, no build step, no framework. Classic scripts that attach to `globalThis.UL`. Every engine file must load in Node without touching `document` or `window` at load time, so it can be tested.

### 6.1 Files

```
underline/
├── index.html
├── src/
│   ├── app.js            site-builder: screens, state, events, footer (MAKER_NAME = "Risheek")
│   ├── styles.css        site-builder
│   └── engine/           engine-builder
│       ├── util.js       copied from ../doodle-alive/src/engine/util.js, then trimmed; namespace DA → UL
│       ├── decode.js     copied from ../doodle-alive/src/engine/decode.js; namespace DA → UL
│       ├── clean.js      new: white balance, brighten, shadow lift, vignette
│       ├── lines.js      new: ink mask (from Day 2 reader.js inkMask) + line finding + snap
│       ├── mark.js       new: highlighter and underline strokes, fade-the-rest
│       ├── finishes.js   new: the 4 finishes, card layout, label, made-with mark
│       ├── card.js       new: the card object (settings, drawFrame, preview loop)
│       ├── sample.js     new: the Jane Eyre page drawn in code, with a preset stroke
│       ├── export.js     copied from ../doodle-alive/src/engine/export.js, adapted: 5 s, still image, file names
│       ├── share.js      copied from ../doodle-alive/src/engine/share.js; namespace DA → UL
│       └── vendor/       mp4-muxer.js + LICENSE-mp4-muxer.txt, copied from ../doodle-alive/src/engine/vendor/
├── fonts/                caveat-600.woff2 + OFL.txt, copied from ../doodle-alive/fonts/
├── tests/                never deployed
│   ├── smoke.js          integrator: every UL name exists
│   ├── page-check.js     integrator: headless Edge, pattern from ../doodle-alive/tests/page-check.js
│   ├── lines.html        engine-builder: shows the line finding + snap on a photo
│   ├── engine/           engine-builder: small Node tests
│   └── real/             Rishi's real page photos (gitignored)
├── shots/                ui-verifier screenshots (gitignored)
├── notes/
├── README.md, VERIFY.md
├── .gitignore            tests/real/, tests/out/, shots/, node_modules/, .vercel, OS junk (copy ../doodle-alive/.gitignore)
├── .vercelignore         tests/, notes/, shots/, VERIFY.md
└── .gitattributes        copy ../doodle-alive/.gitattributes
```

**Copy, never link** to other projects' files. Never edit anything outside `underline/`.

**Script order in `index.html`:**
`util, decode, clean, lines, mark, finishes, card, sample, export, share`, then `app.js`. The muxer is loaded by `export.js` only when a video is made.

### 6.2 Photo in and cleanup
- `decode.js` as in Day 3, with `maxSide` 2000. Book text needs more pixels than doodles did.
- **Clean:**
  1. Estimate paper colour from the brightest 40% of a blurred copy, and white-balance so paper becomes about `#f7f1e6` (warm, not white).
  2. Lift shadows with a large-radius local-brightness divide, blended at 60% so it still looks like a photo.
  3. Gentle S-curve on contrast, light vignette.
  4. Target about 300 ms on a mid-range phone.

### 6.3 Finding lines and snapping a swipe
- Start from Day 2's `inkMask` (`../handwriting-font-converter/src/reader.js`: local-mean threshold using an integral image). It works well for thin printed text, which is exactly what it was built for. Day 3's warning that it hollows thick lines doesn't matter for book type.
- **Precompute on prepare** (at about 1000px wide for speed):
  1. Ink mask.
  2. Split the page into vertical strips (about 6). In each strip, take the row-ink profile and find text rows (peaks) and gaps.
  3. Join row segments across strips into lines, fitting each line as `y = a + b·x` (Day 2's baseline slope idea).
  4. Store each line's top, bottom, slope and the x-range where ink starts and ends.
  5. Target about 250 ms.
- **Snap(swipe points):**
  1. Pick the line whose band the swipe's middle 60% overlaps most (by vertical distance after accounting for the line's slope).
  2. The stroke spans the swipe's x-range, extended to the nearest word gap within half a word, and clipped to the line's ink x-range.
  3. It takes the line's slope and height.
  4. If no line is within 1.2 line-heights, keep the raw swipe, smoothed and straightened to its own average slope, at the median line height (or 3.5% of page height).
- **Live feel:** while the finger moves, draw the raw stroke under the finger. On release, animate it into its snapped position over 120 ms.

### 6.4 The card and animation
- `card.drawFrame(ctx, t, format, scale)` is the single drawing function for the preview, the still image and the video:
  - `format` is `"square"` or `"story"`
  - `scale` 1 = full size (1080×1080 or 1080×1920)
  - `t` is in seconds, 0 to `END` (5.0)
- **Timeline (both formats):**
  - 0–0.6 s: page settles (scale 1.04 → 1, fade in)
  - 0.6–2.2 s: strokes sweep left to right, one after another, with ease-in-out per stroke
  - 2.2–3.0 s: fade-the-rest comes in, plus a 3% push toward the strokes
  - 3.0–5.0 s: hold, with the label fading in
- The still image is `drawFrame(t = END)`. The preview loops 0→END with a 1 s pause.
- Cache the static layers (finish background, cleaned page crop) and rebuild them only when the finish, crop, label or format changes. Strokes are cheap to redraw.

### 6.5 Export, saving and sharing
- **Image:** draw `t = END` at 1080×1080 and save as JPEG quality 0.92, usually 250–600 KB.
- **Video:**
  - Day 3's `export.js` path: WebCodecs H.264 plus mp4-muxer when available; otherwise MediaRecorder (real time).
  - 5 s, 30 fps, 1080×1920, about 4 Mbps.
  - Snapshot the card when the export starts. Support an `AbortSignal`.
- **File names:**
  - `underline-<title-slug>-p<page>.jpg` / `.mp4`
  - falling back to `underline-<title-slug>` and then `underline-<YYYY-MM-DD>`
  - slug: lower case, a–z0–9 and hyphens, max 40 characters
- **Sharing:**
  - Day 3's `share.js` unchanged except the namespace.
  - Call `share` / `save` **directly inside the tap**, with the file already made.
  - Make the image as soon as the style settles, so Save is instant.
  - Make the video only when Share story is tapped. After it's ready, the button turns into **Share now** (a second tap), because iOS needs a fresh tap to open the share sheet.
- **Remembered on device** (`localStorage`, wrapped in try/catch): last mark, colour, finish, fade, "album tip seen". Nothing else. The page works fine without it.

### 6.6 Optional M5: Copy the words
- Tesseract.js (Apache-2.0), **self-hosted** in `src/engine/vendor/tesseract/` with `eng.traineddata` (fast model). About 3–4 MB in total, loaded **only when tapped**.
- The main session downloads it with Rishi's okay; agents never download.
- Run it only on the crop of the highlighted bands, scaled up 2×. That's far faster and more accurate than the whole page.
- The result opens in an editable text box with **Copy**, because OCR mistakes must be fixable.
- Classic OCR is not generative AI: it doesn't create content. Don't call it "AI" anywhere.
- If it isn't solid on Rishi's real photos within about 30 minutes, cut it.

---

## 7. The contract between screens and engine

The site-builder and engine-builder work in parallel, and **this section keeps them in step**. Names, inputs and results must match exactly.

### 7.1 Who owns what
| Owner | Files |
|---|---|
| site-builder | `index.html`, `src/app.js`, `src/styles.css` |
| engine-builder | `src/engine/` (all), `tests/lines.html`, `tests/engine/` |
| integrator | small fixes anywhere; `fonts/`, `tests/smoke.js`, `tests/page-check.js`, `.gitignore`, `.vercelignore`, `.gitattributes`, `vercel.json` |
| ui-verifier | `VERIFY.md`, `shots/` |
| main session | git, GitHub, Vercel, downloads, `README.md`, root `../README.md` and `../CLAUDE.md` updates |

### 7.2 Errors
Engine functions reject with `Error` objects carrying `{ code, title, detail }`. Here `title` and `detail` are friendly, ready to show.

Codes:
- `not-image`, `heic`, `unreadable`
- `no-lines` (a warning only: the editor still works)
- `video-unsupported`, `cancelled` (the site ignores this one)
- `export-failed`

### 7.3 Names
**Constants**
- `UL.MARKS = ["highlighter", "underline"]`
- `UL.COLOURS = [{ id: "yellow", hex: "#ffe45c" }, { id: "pink", hex: "#ff9ec7" }, { id: "green", hex: "#a8f07a" }, { id: "blue", hex: "#8fd3ff" }]`
- `UL.FINISHES = [{ id: "clean", name: "Clean" }, { id: "polaroid", name: "Polaroid" }, { id: "film", name: "Film" }, { id: "torn", name: "Torn page" }]`
- `UL.DEFAULTS = { mark: "highlighter", colour: "yellow", finish: "torn", fade: true, title: "", page: "", note: "" }`
- `UL.END = 5.0`

**Photo in**
- `UL.decode.fileToImageData(file, { maxSide }) → Promise<ImageData>`

**The page**
- `UL.page.prepare(imageData) → Promise<Page>`: cleans the photo and finds the lines.
  - `page.width`, `page.height`
  - `page.image`: the cleaned canvas or ImageBitmap
  - `page.lines`: array of `{ top, bottom, slope, x0, x1 }` in page pixels
  - `page.warning`: `null` or `"no-lines"`
- `UL.page.snap(page, points) → Stroke`: `points` is `[{ x, y }]` in page pixels.
  - Result: `{ x0, x1, y, height, slope, snapped: true|false, seed }`
  - Never returns null.

**The sample**
- `UL.sample.load() → Promise<{ page, strokes }>`: the Jane Eyre page, already prepared, with one preset stroke.

**The card**
- `UL.card.create(page, strokes, settings) → Promise<Card>`: resolves once fonts are ready.
  - `card.settings`: current settings, defaults filled in
  - `card.update(partialSettings) → Promise<void>`
  - `card.setStrokes(strokes)`
  - `card.drawFrame(ctx, t, format, scale)`: see §6.4. Must tolerate any `t` (clamp) and a 0×0 canvas.
- `UL.card.startPreview(canvas, card, format) → { stop(), setFormat(format), setCard(card) }`
  - Loops the animation, sized to the canvas × devicePixelRatio (capped at 2), pauses when hidden.
- `UL.card.drawEditor(canvas, page, strokes, liveStroke)`: draws the editor view (the page with strokes, no finish), used while swiping.

**Export**
- `UL.export.support() → Promise<{ video: boolean, method: "webcodecs" | "mediarecorder" | null }>`
- `UL.export.makeImage(card) → Promise<File>`: JPEG 1080×1080
- `UL.export.makeVideo(card, { onProgress, signal }) → Promise<File>`: MP4 (or WebM fallback) 1080×1920, 5 s
- `UL.export.fileName(settings, ext) → string`

**Sharing**
- `UL.share.platform()`, `UL.share.canShare(file)`, `UL.share.share(file)`, `UL.share.save(file)`: as in Day 3

**Optional M5**
- `UL.words.read(page, strokes) → Promise<string>`

### 7.4 Dev shortcuts in the address (for checks and screenshots)
- `?sample=1`: start in the editor with the sample page
- `&screen=landing|editor|style|making|done|frame|error-heic|error-not-image`
- `&finish=<id>&mark=<id>&colour=<id>&fade=0|1&title=...&page=...&note=...`
- `&format=square|story&t=<seconds>`: with `screen=frame`, draw that one frame full size on a 1080-wide canvas and stop the animation
- `tests/lines.html?photo=real/<file>`: shows the photo, the cleaned page, the ink mask, the found lines with their slopes, and a few simulated swipes snapped (left-to-right and right-to-left, slightly diagonal, slightly too high or low)
- The site keeps `window.__underline = { screen, settings, page, strokes, card }` current, so scripts can call `UL.export.makeVideo(window.__underline.card)`.

---

## 8. Milestones (check on a phone-sized screen after each)

**M0. Real material first (Rishi, before anything).**
- 3–5 real photos of book pages in `tests/real/`, taken naturally: crooked, room light, a thumb, one near the spine curve, one with small type, and if possible one paperback and one hardback.
- Fake inputs hid the real problems on Day 2.

**M1. The magic stroke: go / no-go (engine-builder, about 1 h).**
- `decode`, `clean`, `lines`, `snap`, `mark` (highlighter plus fade) and `tests/lines.html`.
- Screenshot every real photo and **look at it**.
- Show Rishi a full-size crop of the highlighter on a real page.
- **Rishi decides: does it look like a real marker?** If not, fix the stroke before anything else.

**M2 + M3 in parallel (about 1 h).**
- engine-builder: `finishes`, `card`, `sample`, the underline mark.
- site-builder: all screens from §5.3, using the §7 names.

**Join (integrator):** smoke and page checks passing. Then ui-verifier writes `VERIFY.md`, and the fix loop runs until it's clean.

**M4. Export and sharing (about 45 min).** Image, video, file names, share/save, the done-screen tips. Then join, verify and fix again.

**M5. Optional: Copy the words.** Only if everything above is done and verified.

**M6. Ship (main session with Rishi):**
- `git init`, repo `keeshir-droid/underline-it`, push.
- Vercel project named `underline-it` (address `underline-it.vercel.app`, confirmed free; fallback `my-underline`), and enable Web Analytics.
- Rishi tests on a real iPhone and Android and marks the rows "tested by hand" in `VERIFY.md`.
- README with demo GIF.
- Root updates:
  - `../README.md` gets the Day 4 row
  - `../CLAUDE.md` "Where we are" gets Day 3 live and Day 4
  - `../CLAUDE.md` audience line says "young"
  - Add Underline as a sibling in Day 2 and Day 3's footers (main session, with Rishi's okay, because it touches other projects)

---

## 9. Risks and what we do about them

| Risk | Plan |
|---|---|
| The stroke looks fake | It's M1's go/no-go, judged on real photos at full size before any screens |
| Lines not found on curved or shadowed pages | Fit lines per strip with a slope; fall back to the smoothed raw swipe; never block the user |
| Video export slow or unsupported on iOS Safari | WebCodecs first, MediaRecorder fallback, the image is always available; show "Making your video…" with the preview |
| Share sheet needs a fresh tap on iOS | Make files before the tap; the video's Share is a second tap |
| Instagram in-app browser quirks (camera, downloads) | Test from a real Instagram link on both phones; if saving fails in-app, show "Open in your browser" with steps |
| Copyright | Encourage a line or a few lines, not whole pages: the crop centres on the marked lines and fades the rest |
| "Another quote app" | The reel leads with the animated stroke on a real page, and the page itself says "without ruining your book" |

## 10. Definition of done

On top of the root `../CLAUDE.md` checklist:
- [ ] On a real page photo, the highlighter looks like real marker (Rishi's judgement)
- [ ] Snap → swipe → Save works on a real iPhone (Safari and Instagram in-app) and a real Android (Chrome)
- [ ] The saved image lands in Photos / Gallery with the label and a sensible file name
- [ ] Searching Photos for "underline" finds it (iPhone, checked by hand)
- [ ] The story video posts to Instagram and looks right inside the safe zones
- [ ] Made-with mark on both outputs; "More from Risheek" footer; analytics on
- [ ] README, demo GIF, live address, root README and CLAUDE.md updated
