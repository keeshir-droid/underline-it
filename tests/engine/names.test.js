// Every engine file loads in Node with no document or window, and every PLAN.md 7.3 name exists.
//   node tests/engine/names.test.js
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const dir = path.join(__dirname, "..", "..", "src", "engine");
// run them in a bare context: no document, no window, no navigator
const ctx = vm.createContext({ console: console, setTimeout: setTimeout, clearTimeout: clearTimeout });
ctx.globalThis = ctx;
["util.js", "decode.js", "clean.js", "lines.js", "mark.js", "finishes.js", "card.js", "sample.js", "export.js", "share.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
});
const UL = ctx.UL;

let failed = 0;
function ok(cond, msg) { if (!cond) { failed++; console.log("FAIL: " + msg); } else console.log("ok:   " + msg); }

const names = [
  "MARKS", "COLOURS", "FINISHES", "DEFAULTS", "END",
  "decode.fileToImageData", "page.prepare", "page.snap", "sample.load",
  "card.create", "card.startPreview", "card.drawEditor",
  "export.support", "export.makeImage", "export.makeVideo", "export.fileName",
  "share.platform", "share.canShare", "share.share", "share.save"
];
names.forEach(function (n) {
  let v = UL; n.split(".").forEach(function (k) { v = v && v[k]; });
  ok(v !== undefined && v !== null, "UL." + n + " exists");
});

ok(JSON.stringify(UL.DEFAULTS) === JSON.stringify({ mark: "highlighter", colour: "yellow", finish: "torn", fade: true, title: "", page: "", note: "" }), "DEFAULTS exactly as specified");
ok(UL.END === 5.0, "END is 5.0");

// file names
const fn = UL.export.fileName;
ok(fn({ title: "Jane Eyre", page: "252" }, "jpg") === "underline-jane-eyre-p252.jpg", "fileName title + page");
ok(fn({ title: "Jane Eyre" }, "mp4") === "underline-jane-eyre.mp4", "fileName title only");
ok(/^underline-\d{4}-\d{2}-\d{2}\.jpg$/.test(fn({}, "jpg")), "fileName without a title is the date");
ok(fn({ title: "The Hitchhiker's Guide to the Galaxy: Mostly Harmless, Part Two" }, "jpg").length <= "underline-".length + 40 + ".jpg".length, "fileName slug is at most 40 characters");
ok(fn({ title: "Café Éclair!!", page: "12" }, "jpg") === "underline-cafe-eclair-p12.jpg", "fileName slug drops accents and punctuation");

// card: drawFrame tolerates a 0x0 canvas and odd times (no canvas in Node, so a fake context)
(async function () {
  const calls = [];
  const fakeCtx = new Proxy({ canvas: { width: 0, height: 0 } }, { get: function (t, k) { if (k in t) return t[k]; return function () { calls.push(k); }; }, set: function (t, k, v) { t[k] = v; return true; } });
  const page = { width: 100, height: 100, image: null, lines: [], warning: "no-lines" };
  const card = await UL.card.create(page, [], {});
  ok(card.settings.finish === "torn" && card.settings.fade === true, "card.settings has the defaults filled in");
  card.drawFrame(fakeCtx, 3, "square", 1);
  ok(calls.length === 0, "drawFrame on a 0x0 canvas draws nothing and does not throw");
  card.drawFrame(fakeCtx, NaN, "story", 0);
  card.drawFrame(fakeCtx, -5, "square", 1);
  ok(true, "drawFrame survives NaN, negative times and scale 0");
  await card.update({ finish: "film", note: "hello" });
  ok(card.settings.finish === "film" && card.settings.note === "hello", "card.update merges partial settings");
  card.setStrokes([{ x0: 1, x1: 50, y: 20, height: 10, slope: 0, snapped: true, seed: 3 }]);
  ok(card.strokes.length === 1, "card.setStrokes");

  console.log(failed ? "\n" + failed + " FAILED" : "\nall passed");
  process.exit(failed ? 1 : 0);
})();
