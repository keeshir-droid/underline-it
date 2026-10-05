# VERIFY.md: Underline (Day 4), second pass

Checked 2026-10-05 by the ui-verifier. Own server on port 8002 (the owner's 8000 serves a different project), one headless Edge at a time, driven over DevTools with real touch swipes and the real file input. Every screenshot named below was opened and looked at. All fresh shots are in `shots/v2/` (the first pass is still in `shots/`). Contact sheets: `shots/v2/sheet-matrix.png` (4 finishes x 4 mark/colour combos), `shots/v2/sheet-anim.png` (story animation at t=0.3, 1.2, 2.6, 4 for Torn and Film), `shots/v2/sheet-video.png` (frames read back out of a real exported MP4).

The "Tested by hand" column is blank on purpose: it is for the owner's real-phone checks.

## Final automated run

Run 2026-10-05 by the integrator after the site-builder and engine-builder changes (hint, `snapPreviewBox`, small-photo caption, `One sec…` label, focus rings, vibrate; cached stroke bitmaps, sweep through a chisel outline, crop by ink rows, torn tape, film vignette, overlap rejection). Own server on port 8001, one headless Edge at a time. Screenshots in `shots/final/`.

- `node --check` on every JS file in `src/`, `src/engine/` and `tests/`: all OK.
- `node tests/engine/lines.test.js` and `names.test.js`: all passed. `node tests/smoke.js`: SMOKE PASS, 0 FAIL.
- `UL_BASE=http://localhost:8001/ node tests/page-check.js`: **PAGE PASS, 146 PASS / 0 FAIL**, no console errors or exceptions on any screen. New checks added: hint gone after the first touch, preview is a whole-pixel square, video frames at 1 / 2 / 3 s not blank and the marker sweep growing, a 400x300 photo (soft caption shows, nothing breaks, sample page has no caption).
- Preview box (dpr 2): 337x337 CSS, canvas 674x674, sharp. After resize to 360x640 it becomes 230x230, landscape 140x140, back to 390x844 it is 337 again. Hidden or zero-size boxes are left alone (no 0x0). Making screen: 252x448 (9:16).
- Video (`UL.export.makeVideo`): video/mp4, 5.0 s, 1080x1920, about 1.9 MB, made in 1.9 s here. Frames read back from the file: yellow marker pixels 0 at 0.3 s, 58 at 1.2 s, 167 at 2 s, 274 at 3 s, so the sweep draws in the exported frames. Image: 1080x1080 JPEG, 272 KB.
- Tiny photo (400x300 through the real file input): editor opens, 13 lines found, caption "This photo is small, so it may look soft. A bigger one will look sharper." shows, swipe, Next and the style screen all work.
- Still true from above, not fixed: the story crop on Torn leaves a lot of bare linen; on a short or small page the swipe hint demo sits over the last line of print until the first touch; line finding now returns 0 lines (with the no-lines warning) on the engravings and small-print dictionary, so those fall back to the raw swipe.

## Summary

**PASS 55 / FAIL 7 / UNSURE 14** (76 rows). First pass was 46 / 9 / 18.

Scripts, all run fresh:
- `node tests/engine/lines.test.js`: all passed (synthetic pages tilted 2.6, -3, 4 degrees, blank page, null input).
- `node tests/engine/names.test.js`: all passed.
- `node tests/smoke.js`: SMOKE PASS.
- `UL_BASE=http://localhost:8002/ node tests/page-check.js`: **PAGE PASS**, 136 checks green, no console errors. Image 1080x1080 271 KB, video 1080x1920, 5.0 s, 1.8 MB, made in 1.9 s here (was 6 to 13 s).
- My own audit at 390x844 and 360x640 on 7 screens: scrollWidth equals the viewport everywhere, every button, link, chip and input is at least 44 px.

Remaining FAILs (7):
1. Row 12 and rows 41, 43: line finding still returns junk "lines" on engravings (bloom 31, hoosier 13 bands) with no warning.
2. Row 38: cc0-book, the stroke covers two lines of print on an oblique photo.
3. Row 44: small-print-dictionary, the finder misses the slanted text and the stroke snaps onto the page edge.
4. Row 72: the square page crop still clips a line at the edge on Clean (bottom) and Polaroid (top).
5. Row 73: the story crop on a tall page leaves a large blank area under the text (Torn, Polaroid).

**Marker realism score: 6.5 / 10.** See the section just before the fix list.

## Table

| # | Item | Verdict | Why | Screenshot | Tested by hand |
|---|---|---|---|---|---|
| 1 | Scope: photo from gallery through the real file input | PASS | 8 stock photos and 3 phone-style photos all reach the editor; lamp photo took 268 ms | shots/v2/lamp-editor-stroke.png | |
| 2 | Scope: camera capture (Snap a page) | UNSURE | `capture="environment"` input is in index.html (line 272) and the button is wired, but a desktop browser has no camera | (needs phone) | |
| 3 | Scope: paste a photo on a desktop | UNSURE | Paste handler exists; landing says "Paste a photo or drop one right here". Headless cannot paste an image | shots/v2/landing-laptop.png | |
| 4 | Scope: HEIC friendly message | PASS | A fake .HEIC through the real input gives "Your phone saved this in a format I can't read" with one button; a corrupt .jpg gives "I couldn't open that picture"; a .txt gives "That doesn't look like a photo". No raw errors | shots/v2/error-heic-phone.png, shots/v2/err-corruptjpg.png, shots/v2/error-phone.png | |
| 5 | Scope: a real iPhone HEIC file | UNSURE | Safari decodes HEIC itself, Edge cannot | (needs phone) | |
| 6 | Scope: light cleanup on ordinary photos | PASS | Warm phone-style pages become soft warm paper, text stays natural, thumb and desk stay in the picture | shots/v2/phonea-story-torn.png, shots/v2/phonec-story-torn.png | |
| 7 | Scope: cleanup on a strongly yellow lamp photo (tests/out/phone-b-lamp-small.jpg) | PASS | Fixed. The orange cast is now a soft cream page, and the yellow highlighter is clearly visible on it, text crisp and dark through it. Real file input, swipe, Next, all four finishes | shots/v2/lamp-square-polaroid.png, shots/v2/lamp-square-torn.png, shots/v2/lamp-story-torn.png | |
| 8 | Scope: line finding on flat text pages | PASS | lines.test.js finds 58 of 58, 42 of 42 true rows; lamp 23, phone-a 30, phone-c 29 lines, bands on the print | shots/v2/lamp-editor-stroke.png | |
| 9 | Scope: swipe snaps to the right line, height, slope (flat pages) | PASS | Lamp: slope -0.085, stroke on "must know, Mrs. Long says that Netherfield is taken by a young man of". Phone-a +0.084, phone-c +0.052; each trims to the swiped span and sits on one line | shots/v2/lamp-square-torn.png, shots/v2/phonea-story-torn.png, shots/v2/phonec-story-torn.png | |
| 10 | Scope: 5+ strokes, Undo, Clear | PASS | 6 strokes on 6 lines all snapped, edges stay separate; page-check confirms Undo and Clear. Torn story with 6 strokes looks good | shots/v2/six-editor.png, shots/v2/six-story-torn.png | |
| 11 | Scope: tiny swipe, no-text page | PASS | Tiny swipe adds nothing and says "Drag a little further along the line." Endpaper (godfrey) shows the no-lines caption and the swipe still draws a stroke where the finger went | shots/v2/tiny-swipe.png, shots/v2/nolines-stroke.png | |
| 12 | Scope: non-text photos get no junk lines | FAIL | Improved: open-book-1 (map and page edge) and open-book-2 (page edges) now give 0 lines and the warning. But engravings still get junk: bloom 31 bands across the sitter's dress, hoosier 13 bands across the face. No warning, and "GRANNY." and the caption are not found. | shots/v2/lines-open-book-1.png, shots/v2/lines-open-book-2.png, shots/v2/lines-page-scan-bloom.png, shots/v2/lines-page-scan-hoosier.png | |
| 13 | Scope: two marks, four colours | PASS | 4 finishes x (pink, green, blue highlighter, blue underline) all drawn, colours distinct | shots/v2/sheet-matrix.png | |
| 14 | 5.5 Clean finish | PASS | `--bg` background, rounded card with soft shadow, serif label underneath, mark bottom right. Small blemish: the bottom line of print touches the inner edge and its descenders are clipped | shots/v2/card-clean.png | |
| 15 | 5.5 Polaroid finish | PASS | White frame, deep strip, about -2 degree tilt, Caveat label, soft shadow. The top line is half cut by the photo edge | shots/v2/card-polaroid.png | |
| 16 | 5.5 Film finish | PASS | Fixed. Soft dark corners with a warm leak, grain, faded blacks, "UNDERLINE 400" and "12A" edge print, the date stamp and label now sit on a solid dark strip clear of the text, framed in story. Heavy: the vignette dims the outer lines a lot, so only the middle of the page is readable | shots/v2/card-film.png, shots/v2/story-film-guides.png | |
| 17 | 5.5 Torn page finish | PASS | Linen, torn top and bottom with fibre edge, washi tape, serif label. The tape still hides the first words of the top lines | shots/v2/card-torn.png | |
| 18 | Scope: Fade the rest on and off | PASS | On: line glows. Off: the whole page is dark and the line is plainer | shots/v2/card-polaroid.png (on), shots/v2/card-nofade.png (off) | |
| 19 | Scope: label (title, page, date, "underline") | PASS | "Jane Eyre · p. 252 · 5 Oct 2026 · underline" on every finish | shots/v2/card-clean.png, shots/v2/card-torn.png, shots/v2/card-polaroid.png | |
| 20 | Scope: label with nothing typed | PASS | Fixed. Polaroid with no title shows the date once in Caveat and "underline" underneath, no duplicate date. Torn shows "5 Oct 2026 · underline" | shots/v2/lamp-square-polaroid.png, shots/v2/lamp-story-torn.png | |
| 21 | Scope: long title (60), 60-character note, 8-digit page | PASS | Polaroid, Torn, Clean and Film all wrap or fit, note in Caveat on top, title line under it. Title is cut with "Ye" (truncated by design) | shots/v2/long-square-polaroid.png, shots/v2/long-square-torn.png, shots/v2/long-story-clean.png, shots/v2/long-story-film.png | |
| 22 | Scope: square image JPEG 1080x1080 | PASS | page-check: real File, image/jpeg, 1080x1080, 271 KB, name underline-jane-eyre-p252.jpg | (script) | |
| 23 | Scope: story video MP4 1080x1920, 5 s | PASS | Made here: video/mp4, 5 s, 1080x1920, about 1.8 MB. Frames read back out of the file at 0.2, 1.4, 2.6, 4.5 s show settle, sweep, fade with push-in, label | shots/v2/sheet-video.png | |
| 24 | Bar: video ready in about 5 s | UNSURE | Share story to Share now took 2.0 to 2.2 s here (WebCodecs, desktop). A mid-range phone is the real test | (needs phone) | |
| 25 | Scope: video plays smoothly, looks right | UNSURE | The file decodes and seeks correctly; smoothness and frame rate need eyes on a real playback | shots/v2/sheet-video.png | |
| 26 | Scope: share sheet with save fallbacks | UNSURE | Desktop shows the fallback copy correctly ("It's in your Downloads folder", Save video). The iOS and Android share sheets cannot be driven here | shots/v2/done-phone.png | |
| 27 | Scope: image lands in Photos, searching "underline" finds it | UNSURE | The label is printed on the card and the done screen promises the search works; whether Photos indexes it cannot be seen in a still | (needs phone) | |
| 28 | Scope: clear file names | PASS | underline-jane-eyre-p252.jpg and .mp4 in page-check; names.test.js passes for title+page, title only, date only, 40-char slug, accents stripped | (script) | |
| 29 | Scope: built-in Jane Eyre sample | PASS | Landing demo and Try it on a sample both work and the page reads as a real book page | shots/v2/landing-phone.png, shots/v2/editor-phone.png | |
| 30 | Scope: remembers last mark, colour, finish, fade on this device | PASS | Set Film, Pen underline, Pink, fade off; reloaded the page: all four came back (localStorage `underline.v1`). Real phones, including Instagram's in-app browser, still need a check | shots/v2/remembered-style.png | |
| 31 | Scope: "More from Risheek" footer | PASS | Handwriting to Font and Doodle Alive on landing, errors and done | shots/v2/landing-phone.png, shots/v2/error-phone.png | |
| 32 | Scope: made-with mark on every output | PASS | On all 4 finishes in square and story, 26 px at about 70% | shots/v2/sheet-matrix.png, shots/v2/story-film-guides.png | |
| 33 | Scope: Vercel Web Analytics | UNSURE | The snippet is in index.html (`/_vercel/insights/script.js`, defer, removes itself on error) and page-check ignores its local 404. It only works after deploy and after Analytics is switched on in the Vercel dashboard | (index.html line 18) | |
| 34 | 5.4 stroke looks like real marker on paper | UNSURE | Score 6.5/10, see below. Rishi's call at 1:1 on a phone | shots/v2/zoom.png, shots/v2/lamp-square-torn.png | |
| 35 | 5.4 multiply blend and text crisp | PASS | Black type stays darker than the ink on all colours and finishes; letters never grey out | shots/v2/zoom.png, shots/v2/sheet-matrix.png | |
| 36 | 5.4 pen underline | PASS | Thin wavy line under the baseline in the darker hue with an end hook | shots/v2/card-underline-pink.png | |
| 37 | Real photo: book-in-hand.jpg | UNSURE | Not a fair test (old book at -33 degrees, a cigarette packet inside). 3 lines, the snap lands on the print at -28.6 degrees, but the band is about 1.8 lines tall | shots/v2/lines-book-in-hand.png | |
| 38 | Real photo: cc0-book.jpg (open book on grass, oblique) | FAIL | 5 lines found, stroke at 11.6 degrees, band 46 px but the print pitch is about 22 px, so the highlight covers two lines ("and they wouldn't want to hear all" and "Mam know that we hadn't forgotten") | shots/v2/lines-cc0-book.png, shots/v2/cc0-square-polaroid.png | |
| 39 | Real photo: open-book-1.jpg | PASS | Map and page edge, correctly 0 lines and the no-lines warning | shots/v2/lines-open-book-1.png | |
| 40 | Real photo: open-book-2.jpg | PASS | Page edges, correctly 0 lines and the warning | shots/v2/lines-open-book-2.png | |
| 41 | Real photo: page-scan-bloom.jpg | FAIL | Portrait engraving: 31 junk bands over the dress, no warning, and the one real text line ("GRANNY.") is not found any more | shots/v2/lines-page-scan-bloom.png | |
| 42 | Real photo: page-scan-godfrey.jpg | PASS | Endpaper pattern: 0 lines and the warning; swipe still draws a stroke and the card builds | shots/v2/nolines-stroke.png | |
| 43 | Real photo: page-scan-hoosier.jpg | FAIL | Engraving: 13 junk bands across the face, no warning; the real caption line is not found | shots/v2/lines-page-scan-hoosier.png | |
| 44 | Real photo: small-print-dictionary.jpg | FAIL | Previously marked PASS but that was too generous. The 12 bands sit on the book spines and the pink page edge, not on the slanted text columns; a swipe on the print is not snapped (snapped:false, flat 1.0 degree band across the whole page). The cleaned photo itself looks like the real book | shots/v2/lines-small-print-dictionary.png, shots/v2/dict-story-torn.png | |
| 45 | Phone-style photos a (warm), b (lamp), c (cool shadow) | PASS | All three open, find 30, 23, 29 lines, snap on the right line, build cards and a video | shots/v2/phonea-story-torn.png, shots/v2/phonec-story-torn.png, shots/v2/lamp-story-torn.png | |
| 46 | Cleaned page still looks like the real book | PASS | Paper stays paper, shadows lifted without flattening; the engraving keeps its tone. Lamp photo keeps its curl and grain | shots/v2/lamp-square-torn.png, shots/v2/lines-page-scan-hoosier.png | |
| 47 | Story safe zone: Clean | PASS | Card x 90..990, y 270..1370, label y 1420, mark right edge 990. Mark text bottom is at about y 1537 (limit 1540), so it just fits | shots/v2/story-clean-guides.png | |
| 48 | Story safe zone: Polaroid | PASS | Frame x 95..985, y 300..1460, mark just inside the bottom limit | shots/v2/story-polaroid-guides.png | |
| 49 | Story safe zone: Torn | PASS | Fixed. Paper now x 98..982, tape starts at y 283 and x 97, label y 1449, mark inside | shots/v2/story-torn-guides.png | |
| 50 | Story safe zone: Film | PASS | Fixed. Now a framed card x 90..990, y 270..1540 with the dark strip, nothing runs under the Instagram bars | shots/v2/story-film-guides.png | |
| 51 | Story frame mid-sweep (t=1.4) | PASS | Stroke half drawn, page not yet faded, label not yet there. A sliver of the "JANE EYRE" running head shows at the top of the photo window here that is not there in the final frame | shots/v2/story-mid-sweep.png | |
| 52 | Animation order t=0.3, 1.2, 2.6, 4 | PASS | 0.3 page settling in, 1.2 stroke half drawn, 2.6 full stroke with the fade starting, 4 faded with the label in. Torn and Film both | shots/v2/sheet-anim.png | |
| 53 | Animation feels smooth | UNSURE | Only stills here, plus the 4 frames from the video | (needs phone) | |
| 54 | Label and made-with readable: Clean, Polaroid | PASS | Dark serif or navy Caveat on light, grey mark readable | shots/v2/card-clean.png, shots/v2/card-polaroid.png | |
| 55 | Label and made-with readable: Torn | PASS | Fixed. Label dark on linen and the mark is now clearly readable (darker, 26 px) | shots/v2/card-torn.png, shots/v2/story-torn-guides.png | |
| 56 | Label and made-with readable: Film | PASS | Fixed. Cream label and grey mark on the dark strip, date stamp clear of the page | shots/v2/card-film.png | |
| 57 | Label and made-with readable: story frames | PASS | All four visible and inside the zone; mark is bigger than before | shots/v2/story-clean-guides.png, shots/v2/story-film-guides.png | |
| 58 | 5.1 look: landing, 390x844 | PASS | Genuinely pretty: warm paper, serif headline with two hand-drawn highlighter stripes, a tilted torn-page demo card with washi tape, one big ink-blue button, links and trust line, sibling cards peeking below. Snap a page is visible without scrolling | shots/v2/landing-phone.png | |
| 59 | 5.1 look: landing, 360x640 | PASS | Still fits: headline, card, Snap a page, links and trust line, no overlap, Snap above the fold | shots/v2/landing-360.png | |
| 60 | 5.1 look: editor | PASS | Page fills the width, hint with a finger and Caveat text, clean bar with Undo / Clear / big Next. The hint card sits on top of the middle of the page text until the first swipe | shots/v2/editor-phone.png, shots/v2/editor-360.png | |
| 61 | 5.1 look: style | PASS | Preview first, then the Book title & page row (now visible without scrolling, fixed), Mark, Colour, Finish chips, Fade toggle, sticky Save image / Share story. Every control reachable | shots/v2/style-phone.png, shots/v2/style-labels-tall.png, shots/v2/style-360.png | |
| 62 | 5.1 look: making | PASS | Story preview, yellow progress bar, "Hang tight, this takes a few seconds.", Cancel | shots/v2/making-phone.png, shots/v2/making-360.png | |
| 63 | 5.1 look: done | PASS | New and nice: card thumbnail with a tick badge and sparkles, highlighted "Saved.", the Photos search tip, album tip with Got it, Underline another line, New page, footer, sticky Share story / Save image | shots/v2/done-phone.png, shots/v2/done-360.png | |
| 64 | 5.1 look: error screens | PASS | One friendly message, one big button, one link, a book illustration with washi tape, no raw text | shots/v2/error-phone.png, shots/v2/error-heic-phone.png | |
| 65 | 5.1 look: laptop | PASS | Same screens in a centred 480 px column on darker paper | shots/v2/landing-laptop.png, shots/v2/style-laptop.png, shots/v2/done-laptop.png | |
| 66 | Touch targets at least 44 px | PASS | Scripted audit of 7 screens at 390 and 360 wide found none smaller | (script) | |
| 67 | No horizontal scroll | PASS | scrollWidth equals the viewport on all 14 screen and width pairs | (script) | |
| 68 | Text size and cut-off on the phone | PASS | Nothing cut off; smallest text is the 12 px uppercase section headings | shots/v2/style-phone.png | |
| 69 | No lorem ipsum, raw errors, blank canvases | PASS | None found; console clean across all runs | all | |
| 70 | Bottom bar covers controls | PASS | Sticky bar, content ends above it on style and done, nothing unreachable | shots/v2/style-labels-tall.png, shots/v2/done-phone.png | |
| 71 | Scripts: lines.test.js, names.test.js, smoke.js, page-check.js | PASS | All pass (details above) | (scripts) | |
| 72 | Page crop picks line gaps for the square card | FAIL | Better but not fixed: Clean card clips descenders of the last line; Polaroid half-cuts its top line; Torn is fine. Looks cramped on a sample page | shots/v2/card-clean.png, shots/v2/card-polaroid.png | |
| 73 | Story crop on a tall page with one marked line | FAIL | On the lamp photo (text fills the top 60 percent of the page) the Torn and Polaroid story frames show about 400 px (a third of the paper) of empty page under the text, with the highlight in the upper third. It does not look finished. Square crops on the same photo are lovely. See fix 1 | shots/v2/lamp-story-torn.png, shots/v2/lamp-story-polaroid.png | |
| 74 | Multiply blend rendering on a real phone | UNSURE | Canvas `multiply` is fine in desktop Edge, not confirmed on iPhone Safari / Android Chrome | (needs phone) | |
| 75 | Speed on a mid-range phone (editor appears under 1 s) | UNSURE | 0.27 s from file chosen to editor here; prepare 140 to 200 ms | (needs phone) | |
| 76 | Instagram in-app browser (open, camera, save) | UNSURE | Cannot be driven here | (needs phone) | |

## Marker realism, frank score: 6.5 / 10

Looked at 1:1 and at 3x (`shots/v2/zoom.png`, on `card-clean.png`, `card-torn.png` and the lamp photo).

What works (why it is not a 4):
- Multiply blend is right: type stays black and crisp, paper grain shows through the ink.
- Squarish chisel ends, a slightly darker pooled start at the left end, a subtle soft halo like ink bleeding into fibre, a faint tilt.
- The stroke trims to the swiped words and sits low on the line, like real highlighting.
- On the lamp photo (small print, real grain, curl) it reads as a real highlighter at phone size, which is the moment that has to sell the reel.

What stops it from an 8:
- The top edge is almost perfectly straight and the bottom wobbles only a little. A real marker also wobbles at the top, and overshoots a letter or two at the ends.
- The density is very even: no streaks from the nib, no lighter band where the marker dries out, no darker overlap where two strokes meet on the next line.
- The soft halo is the same all the way round (gaussian-blur look). Real ink bleeds along paper fibres, so the halo should be patchy.
- The colour is a clean flat butter yellow; real highlighters are a little more saturated at the pooled ends and lighter in the middle.
- On oblique photos the band is too tall (covers two lines on cc0-book).

Fastest wins to reach 7.5 to 8: add 1 to 2 px of low-frequency wobble on the top edge too, a faint 3 to 6 px wide streak texture along the stroke, an uneven halo, and let the end overshoot by a couple of pixels (all `src/engine/mark.js`).

## Judging the new work critically (is it "really really pretty"?)

- **Landing: yes.** The warm paper, the two highlighter stripes behind the headline words, the tilted torn card with tape: this is the best screen and it looks like a product. Both 390x844 and 360x640 are clean.
- **Done screen: yes.** The badge, sparkles and highlighted "Saved." are charming. Only nit: on desktop it says "It's in your Downloads folder", which will be different on phones (should be checked).
- **Style screen: good.** Chips, swatches and toggle are clear. The preview image is soft because it is drawn at 1x for speed (looks a bit blurry at 390 wide); worth drawing the preview at dpr 2.
- **Torn and Polaroid cards in square: pretty.** The best output. Clean is plain but fine.
- **Film: striking but heavy.** The orange leak plus dark vignette is moody; outer lines of print are nearly unreadable on the lamp-lit shots. Reduce the dimming a little so the page reads.
- **Story frames: Torn and Polaroid look half-empty on tall pages** (row 73). This is the next thing a viewer of a reel would notice.
- **Editor hint** sits over the page text on first use. It disappears after the first swipe so this is minor.

## Other problems

- Washi tape on the Torn finish always covers the first words of the top two lines. Move the tape to sit on the border above the paper, or put it on a corner that has no text.
- Torn square card: the bottom line of print is hidden by the torn fibre edge (fine) but the top-left words are lost under the tape (not fine).
- The film date stamp reads `'26 10 5` with a stray apostrophe floating high; it is meant to be the disposable-camera year mark, but it looks like a glitch. Consider `26 10 5` or `'26 10 05`.
- Story animation: a sliver of the running head ("JANE EYRE") shows at the top of the page window at t=1.4 but not at t=5, because the crop moves with the push-in (`shots/v2/story-mid-sweep.png`). Keep the crop's top edge fixed, or clamp it between lines.
- A 1x1 PNG opens the editor with a huge red square and no message; "too small a picture" could be an error. (`shots/v2/one-px.png`)
- Photos where the page is a small part of the picture (desk, spine, dictionary on a table): the page is small to swipe. Auto-crop or let the editor zoom/pinch.
- The `?screen=frame` shortcut still fills the label from the sample, so "empty label" was checked on the lamp photo through the real file input instead.
- The first-pass "Film vignette is a hard-edged circle" and "label strip under text" problems are fixed.
- README.md exists but was not part of this pass (main session, M6).
- Fade-the-rest edge softness at the story zoom still has not been judged on a phone.

## Ranked fixes

1. `src/engine/card.js` (story crop, tall page): clamp the crop's bottom to the last line of print plus about 1.5 line pitches, then centre the crop on the marked lines. If the crop is then shorter than the frame, shorten the paper (Torn, Polaroid, Clean) instead of showing blank page. Fixes row 73.
2. `src/engine/lines.js`: also reject engravings and photos. Require a regular line pitch and a minimum run of consecutive similar-pitch rows, or reject when ink coverage is high and rows are not regular. Then bloom and hoosier give the no-lines warning. Fixes rows 12, 41, 43.
3. `src/engine/lines.js` (and `mark.js`): cap band height at about 1.2 times the local line pitch so one stroke never covers two lines. Fixes cc0-book (row 38) and `book-in-hand`.
4. `src/engine/lines.js`: slanted text (dictionary at 30 degrees): the strip-wise row profile cannot see slanted lines; estimate the global tilt first, then rotate-profile. At minimum give the no-lines warning instead of snapping to spines. Fixes row 44.
5. `src/engine/mark.js`: realism, raise to 7.5 to 8 (see the section above): wobble the top edge, add nib streaks, uneven halo, end overshoot.
6. `src/engine/card.js`: choose the square crop so top and bottom edges fall in line gaps with 8 px of air, so Clean and Polaroid stop clipping a line. Fixes row 72.
7. `src/engine/finishes.js` (Torn): move the tape so it does not cover text, and fix the odd `'26` in the Film date stamp. Reduce the Film vignette strength by about 25 percent.
8. `src/styles.css` / `src/app.js`: draw the style-screen preview at devicePixelRatio 2 (currently soft). Hide the editor hint card when the finger first touches, not only after the swipe ends.
9. `src/app.js`: show a "That picture is too small" error for tiny images (under about 200 px).
10. `src/engine/card.js`: keep the crop top fixed while the push-in plays (the running head sliver at t=1.4).

## Needs a real phone

Open the deployed address `https://underline-it.vercel.app` on each device. Do each check on **iPhone Safari**, **Instagram's in-app browser** (tap the link from a DM or bio) and **Android Chrome** unless noted. When done, write your initials in the "Tested by hand" column above.

1. **Camera capture (rows 2, 76).** Tap Snap a page. The camera must open (in Instagram's browser it may open a chooser: note what happens). Take a photo of a printed page, a little crooked, lamp on. The editor should show the page within about 1 s and with a warm, soft tone.
2. **Gallery photo and HEIC (rows 1, 5).** Tap Choose a photo and pick an iPhone photo taken with High Efficiency on. It must open and not show the "format I can't read" message.
3. **Swipe feel and snapping (rows 9, 10).** Swipe across a line with your thumb, then a second line. The stroke should follow your finger and settle on the line. Try Undo and Clear. Swipe a picture or the table: it should still draw.
4. **Marker realism (row 34).** Hold the phone at arm's length at 1:1 and look at the highlight. Does it look like a marker? Write your score out of 10. The text underneath must stay black.
5. **Multiply blend (row 74).** On a real book page, the highlighted words must stay dark through the colour on every colour.
6. **Share sheet and Save to Photos (rows 26, 27).** Tap Save image. On iPhone choose Save Image in the share sheet. On Android check Gallery or Downloads. Then open Photos and search for `underline` and for the book title: does the saved card appear? (Only iPhone Photos and Google Photos can do this.)
7. **Story video (rows 24, 25, 53).** Tap Share story. Time how long "Making your video..." takes (the goal is about 5 s or less). Tap Share now, then Save Video. Open it in Photos and play it: the highlight must sweep smoothly across the lines, with no stutter or black frames, and last 5 s.
8. **Instagram story (rows 25, 57).** Post that video from Photos as an Instagram story. Check nothing important is hidden by the top or bottom bars (page, label and the made-with mark should be clear of them). Check the Film story too.
9. **Settings remembered (row 30).** Pick Pink, Film, Pen underline and turn Fade off. Close the tab (and in Instagram close the browser), reopen the site, make another card: the choices should stick.
10. **Offline and slow data (not scripted).** Turn on Airplane mode after the page has loaded: Snap, swipe, Save image should still work (nothing is uploaded). Then on slow 3G or poor signal, load the landing page: it should show up within a few seconds with no blank page.
11. **Analytics (row 33).** After deploying, turn on Web Analytics in the Vercel dashboard, open the site on your phone, then check a page view appears there.
12. **Paste on a computer (row 3).** Copy an image, open the site, press Ctrl+V on the landing page.
13. **Real photos (rows 37 to 44).** Put 3 to 5 of your own page photos in `tests/real/` (flat page, one near the spine, small print, a paperback) and open `tests/lines.html?photo=real/<file>`: every stock photo in there now is either a picture or very oblique and was an unfair test.
14. **Speed (row 75).** Time from picking a photo to seeing the page in the editor. Goal: under 1 s.
15. **Desktop wording (row 63).** The done screen says "It's in your Downloads folder" on a computer. On the phone check it says the right thing for iPhone ("Save Image" in the share sheet) and Android (Gallery or Downloads).
