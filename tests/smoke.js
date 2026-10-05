// Contract check: loads src/engine/*.js in Node (vm, PLAN.md 6.1 order, no browser) and checks that every
// name in PLAN.md 7.3 exists with the right type, that the ids in MARKS, COLOURS, FINISHES and DEFAULTS match,
// that fileName gives the names in PLAN.md 6.5, and that the screens only call UL names that exist.
//   node tests/smoke.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ORDER = ["util", "decode", "clean", "lines", "mark", "finishes", "card", "sample", "export", "share"];

// minimal stand-ins for the browser: nothing here may be needed at load time (no document, no window)
const sandbox = {
  console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, URL: URL, Promise: Promise,
  Uint8Array: Uint8Array, Float32Array: Float32Array, Int32Array: Int32Array, Uint8ClampedArray: Uint8ClampedArray
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let fails = 0;
function report(ok, label, extra) {
  if (!ok) fails += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (extra ? "  (" + extra + ")" : ""));
}

for (const name of ORDER) {
  const file = path.join(ROOT, "src", "engine", name + ".js");
  try {
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
    report(true, "load src/engine/" + name + ".js");
  } catch (e) {
    report(false, "load src/engine/" + name + ".js", e && e.message);
  }
}

const UL = sandbox.UL || {};
function get(p) {
  return p.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, UL);
}
function has(p, type) {
  const v = get(p);
  const t = Array.isArray(v) ? "array" : typeof v;
  report(v != null && t === type, "UL." + p + " is " + type, t === type ? "" : "found " + t);
}

// PLAN.md 7.3
has("MARKS", "array");
has("COLOURS", "array");
has("FINISHES", "array");
has("DEFAULTS", "object");
has("END", "number");
has("decode.fileToImageData", "function");
has("page.prepare", "function");
has("page.snap", "function");
has("sample.load", "function");
has("card.create", "function");
has("card.startPreview", "function");
has("card.drawEditor", "function");
has("export.support", "function");
has("export.makeImage", "function");
has("export.makeVideo", "function");
has("export.fileName", "function");
has("share.platform", "function");
has("share.canShare", "function");
has("share.share", "function");
has("share.save", "function");

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
report(same(get("MARKS"), ["highlighter", "underline"]), "MARKS match PLAN.md", JSON.stringify(get("MARKS")));
report(same(get("COLOURS"), [{ id: "yellow", hex: "#ffe45c" }, { id: "pink", hex: "#ff9ec7" }, { id: "green", hex: "#a8f07a" }, { id: "blue", hex: "#8fd3ff" }]), "COLOURS match PLAN.md");
report(same(get("FINISHES"), [{ id: "clean", name: "Clean" }, { id: "polaroid", name: "Polaroid" }, { id: "film", name: "Film" }, { id: "torn", name: "Torn page" }]), "FINISHES match PLAN.md");
report(same(get("DEFAULTS"), { mark: "highlighter", colour: "yellow", finish: "torn", fade: true, title: "", page: "", note: "" }), "DEFAULTS match PLAN.md", JSON.stringify(get("DEFAULTS")));
report(get("END") === 5.0, "END is 5.0");

// file names, PLAN.md 6.5
try {
  const fn = UL.export.fileName;
  const eq = function (got, want, label) { report(got === want, label, got); };
  eq(fn({ title: "Jane Eyre", page: "252" }, "jpg"), "underline-jane-eyre-p252.jpg", "fileName: title + page");
  eq(fn({ title: "Jane Eyre", page: "252" }, "mp4"), "underline-jane-eyre-p252.mp4", "fileName: title + page, mp4");
  eq(fn({ title: "Jane Eyre", page: "" }, "jpg"), "underline-jane-eyre.jpg", "fileName: title only");
  const today = new Date();
  const ymd = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  eq(fn({ title: "", page: "" }, "jpg"), "underline-" + ymd + ".jpg", "fileName: nothing gives the date");
  report(/^underline-[a-z0-9-]{1,40}\.jpg$/.test(fn({ title: "A Very Long Title: With Punctuation, Accents (Cafe) and More Words Than Fit" }, "jpg")), "fileName: slug is a-z0-9 and hyphens, max 40");
} catch (e) { report(false, "fileName runs in Node", e.message); }

// the screens only use names that exist
const used = new Set();
for (const f of ["index.html", "src/app.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  const re = /\bU(?:L)?\.(decode|page|sample|card|export|share|words)\.([A-Za-z_]+)/g;
  let m;
  while ((m = re.exec(src))) used.add(m[1] + "." + m[2]);
}
used.forEach(function (p) {
  if (p === "words.read") return; // optional M5
  report(get(p) !== undefined, "screens use UL." + p + " and it exists");
});

// platform() works without a browser
try {
  const p = UL.share.platform();
  report(["ios", "android", "desktop"].indexOf(p) >= 0, "share.platform() returns ios / android / desktop", p);
} catch (e) { report(false, "share.platform() runs in Node", e.message); }

// the font family the engine asks for is the one the page loads
const css = fs.readFileSync(path.join(ROOT, "src", "styles.css"), "utf8");
report(/@font-face\s*{[^}]*font-family:\s*["']?Caveat["']?[^}]*caveat-600\.woff2/s.test(css), "styles.css loads fonts/caveat-600.woff2 as \"Caveat\"");
report(fs.existsSync(path.join(ROOT, "fonts", "caveat-600.woff2")) && fs.existsSync(path.join(ROOT, "fonts", "OFL.txt")), "fonts/ has caveat-600.woff2 and OFL.txt");

// script order in index.html
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const order = [];
html.replace(/<script[^>]+src="src\/(?:engine\/)?([a-z]+)\.js"/g, function (_, n) { order.push(n); });
report(same(order, ORDER.concat(["app"])), "index.html script order matches PLAN.md 6.1", order.join(","));

console.log(fails ? "\nSMOKE FAIL (" + fails + " failing)" : "\nSMOKE PASS");
process.exit(fails ? 1 : 0);
