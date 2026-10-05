# Underline

**Highlight the line you love, without ruining your book.**
Photograph a page, swipe over the line on your phone screen, and a real-looking highlighter sweeps across it. You get a keepsake card or a story video. It's for readers who love a line but won't write in their books. Free, no account, nothing uploaded.

**Live:** https://underline-it.vercel.app

<!-- TODO: demo GIF (record the reel: page → swipe → torn-page card). Save as notes/demo.gif and link it here. -->

## The story

A lot of readers love a line in a book and refuse to mark the page. Others photograph pages, and then the photo gets lost in the camera roll with no label and no memory of which book it came from. One heavy reader I know copies lines into a notebook by hand for exactly that reason.

Underline keeps your real page, adds a highlighter that looks like real marker, and hands you a picture that labels itself (book, page, date), so it's findable later. Search "underline" or the book title in your Photos and every saved line shows up.

Day 4 of my 21 Days of Creative Tech.

## How it works

1. **Snap a page.** The phone camera (or a photo from your gallery) opens the page. It warms and brightens the photo, so it still looks like your book.
2. **Swipe the line you love.** The site has quietly found the lines of print on the page. Your stroke follows your finger, then settles onto the line: it straightens to the line's slope, matches its height and trims to where the words start and end.
3. **Make it yours.** Highlighter or pen underline, four colours, four finishes (Clean, Polaroid, Film, Torn page), optionally fade the rest of the page and add the book title and page number.
4. **Keep it and send it.** Save a square image, or make a 5-second story video with the highlight sweeping across the line. Every picture carries a small label and a "made with" mark.

Everything happens on your phone. The photo is never uploaded, the site stores nothing about you, and it uses no AI. The highlighter is drawn with code: multiply-blended marker ink with wobbly edges, chisel ends and ink pooling, so the printed words stay crisp underneath.

Plain HTML, CSS and JavaScript with no build step. Video uses WebCodecs and a small MP4 muxer (MIT), falling back to MediaRecorder.

## What broke (honest notes)

- **Fake pages hide real problems.** Synthetic test pages found lines perfectly. Real photos (oblique shots, spines, lamp-lit yellow pages, two-column small print) did not, which led to a pickier line finder and stronger colour correction.
- **Headless video testing lies.** `createImageBitmap` hangs under headless Edge's virtual time, so screenshots had to be taken in real time.
- **The Film finish fought with the page.** The date stamp landed on the text and the vignette became a hard circle. It was redesigned around a label strip.
- **Still to confirm on real phones:** the iOS Safari share sheet, the Instagram in-app browser, video playback and speed.

## Limits and next steps

- Flat, top-down photos work best. Strongly curved pages, steep angles and spines aren't flattened (no perspective correction yet).
- "Copy the words" (reading just the highlighted lines on-device) is planned.
- A "my lines" collection and a PDF of your lines.
- Circles, margin scribbles, sticky tabs.
- Using your own handwriting from Day 2 for the note.
- Add to Home Screen / offline.

## Links

- Reel: _coming soon_
- Related projects: [Handwriting → Font](https://handwriting-font-converter.vercel.app) (Day 2), [Doodle Alive](https://doodle-alive.vercel.app) (Day 3)

## Credits

- Caveat font (SIL Open Font License), see `fonts/OFL.txt`.
- mp4-muxer (MIT), see `src/engine/vendor/LICENSE-mp4-muxer.txt`.
- Sample page: *Jane Eyre* by Charlotte Brontë (public domain).
