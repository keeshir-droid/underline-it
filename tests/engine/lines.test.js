// Node tests for the engine: everything loads without a browser, and lines/snap work on synthetic pages.
//   node tests/engine/lines.test.js
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const dir = path.join(__dirname, "..", "..", "src", "engine");
["util.js", "decode.js", "clean.js", "lines.js", "mark.js", "card.js"].forEach(function (f) {
  vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f });
});
const UL = globalThis.UL;
const { makePage } = require("./synth.js");

let failed = 0;
function ok(cond, msg) { if (!cond) { failed++; console.log("FAIL: " + msg); } else console.log("ok:   " + msg); }

// ---- constants (PLAN.md 7.3) ----
ok(JSON.stringify(UL.MARKS) === '["highlighter","underline"]', "UL.MARKS");
ok(UL.COLOURS.length === 4 && UL.COLOURS[0].hex === "#ffe45c" && UL.COLOURS[3].id === "blue", "UL.COLOURS");
ok(UL.FINISHES.map(function (f) { return f.id; }).join() === "clean,polaroid,film,torn", "UL.FINISHES");
ok(UL.DEFAULTS.finish === "torn" && UL.DEFAULTS.fade === true && UL.DEFAULTS.mark === "highlighter", "UL.DEFAULTS");
ok(UL.END === 5.0, "UL.END");
ok(typeof UL.decode.fileToImageData === "function" && typeof UL.page.prepare === "function" && typeof UL.page.snap === "function", "names exist");

// errors
(async function () {
  try { await UL.decode.fileToImageData({ type: "text/plain", name: "a.txt" }); ok(false, "not-image error"); }
  catch (e) { ok(e.code === "not-image" && e.title && e.detail, "not-image error carries code/title/detail"); }
  try { await UL.decode.fileToImageData({ type: "image/heic", name: "a.heic" }); ok(false, "heic error"); }
  catch (e) { ok(e.code === "heic" || e.code === "unreadable", "heic file gives heic/unreadable (" + e.code + ")"); }

  // ---- lines on synthetic pages ----
  const cases = [
    { name: "flat", o: { tiltDeg: 0, seed: 1 } },
    { name: "tilted 2.6", o: { tiltDeg: 2.6, seed: 2 } },
    { name: "tilted -3 small print", o: { tiltDeg: -3, pitch: 22, xh: 8, seed: 3 } },
    { name: "tilted 4 + shadow + thumb", o: { tiltDeg: 4, seed: 4, shadow: 0.5, thumb: true } }
  ];
  for (const cs of cases) {
    const p = makePage(cs.o);
    const t0 = Date.now();
    const page = await UL.page.prepare(p.img);
    const ms = Date.now() - t0;
    const lines = page.lines;
    console.log("  [" + cs.name + "] " + p.truth.length + " true rows, " + lines.length + " found, prepare " + ms + " ms (clean " + page._debug.cleanMs.toFixed(0) + ", lines " + page._debug.linesMs.toFixed(0) + ")");
    ok(lines.length >= 0.8 * p.truth.length && lines.length <= 1.25 * p.truth.length, cs.name + ": line count close to truth");
    // match each true row to a found line by centre at the page middle
    let good = 0, slopeOk = 0, spanOk = 0;
    const midX = p.img.width / 2;
    p.truth.forEach(function (t) {
      if (t.xa > midX - 100 || t.xb < midX + 100) return;
      let best = null, bd = 1e9;
      lines.forEach(function (l) { const d = Math.abs(l.a + l.slope * midX - t.at(midX)); if (d < bd) { bd = d; best = l; } });
      if (best && bd < p.pitch * 0.3) good++;
      if (best && Math.abs(best.slope - t.slope) < 0.012) slopeOk++;
      if (best && Math.abs(best.x0 - t.xa) < 40 && Math.abs(best.x1 - t.xb) < 40) spanOk++;
    });
    const nFull = p.truth.filter(function (t) { return t.xa < midX - 100 && t.xb > midX + 100; }).length;
    ok(good >= 0.85 * nFull, cs.name + ": centres within 0.3 pitch (" + good + "/" + nFull + ")");
    ok(slopeOk >= 0.8 * nFull, cs.name + ": slopes within 0.012 (" + slopeOk + "/" + nFull + ")");
    ok(spanOk >= 0.6 * nFull, cs.name + ": x-range of ink within 40 px (" + spanOk + "/" + nFull + ")");

    // ---- snap ----
    const T = p.truth.filter(function (t) { return t.xa < midX - 200 && t.xb > midX + 200; });
    const t = T[(T.length / 2) | 0];
    const xa = midX - 150, xb = midX + 150;
    function sw(x0, y0, x1, y1) { const pts = []; for (let i = 0; i <= 20; i++) pts.push({ x: x0 + (x1 - x0) * i / 20, y: y0 + (y1 - y0) * i / 20 + Math.sin(i) * 1.5 }); return pts; }
    const s1 = UL.page.snap(page, sw(xa, t.at(xa), xb, t.at(xb)));
    ok(s1.snapped === true && Math.abs(s1.y - t.at((s1.x0 + s1.x1) / 2)) < p.pitch * 0.25, cs.name + ": swipe on a line snaps onto it");
    ok(Math.abs(s1.slope - t.slope) < 0.012, cs.name + ": snapped slope matches the line");
    const s2 = UL.page.snap(page, sw(xb, t.at(xb) - 0.6 * s1.height, xa, t.at(xa) - 0.6 * s1.height));
    ok(s2.snapped === true && Math.abs(s2.y - s1.y) < 3, cs.name + ": right-to-left, 0.6 heights too high, still the same line");
    const s3 = UL.page.snap(page, sw(xa, t.at(xa) + 0.4 * s1.height, xb, t.at(xb) - 0.4 * s1.height));
    ok(s3.snapped === true && Math.abs(s3.y - s1.y) < 3, cs.name + ": diagonal swipe snaps to the same line");
    const s4 = UL.page.snap(page, sw(100, 20, 800, 30));
    ok(s4.snapped === false && isFinite(s4.y) && s4.x1 > s4.x0 && s4.height > 0, cs.name + ": swipe in the blank margin keeps the raw stroke");
    const s5 = UL.page.snap(page, []);
    ok(s5 && s5.snapped === false && isFinite(s5.x0), cs.name + ": empty swipe still returns a stroke");
    const s6 = UL.page.snap(page, [{ x: midX, y: t.at(midX) }]);
    ok(s6 && s6.snapped === true && s6.x1 > s6.x0, cs.name + ": a tap highlights a word");
  }

  // a blank page: warning, never null
  const blank = { width: 800, height: 600, data: new Uint8ClampedArray(800 * 600 * 4).fill(235) };
  const bp = await UL.page.prepare(blank);
  ok(bp.warning === "no-lines" && bp.lines.length === 0, "blank page gives warning no-lines");
  const bs = UL.page.snap(bp, [{ x: 100, y: 200 }, { x: 400, y: 210 }]);
  ok(bs && bs.snapped === false && Math.abs(bs.slope) < 0.2, "blank page swipe falls back to the raw stroke");
  try { await UL.page.prepare(null); ok(false, "prepare(null) rejects"); } catch (e) { ok(e.code === "unreadable", "prepare(null) rejects with unreadable"); }

  console.log(failed ? "\n" + failed + " FAILED" : "\nall passed");
  process.exit(failed ? 1 : 0);
})();
