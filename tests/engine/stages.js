// Debug helper: shows what line finding found before and after the "is this text?" vetting, on the synthetic pages.
//   node tests/engine/stages.js
const path = require("path");
const fs = require("fs");
const vm = require("vm");
const dir = path.join(__dirname, "..", "..", "src", "engine");
["util.js", "decode.js", "clean.js", "lines.js"].forEach(function (f) { vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f }); });
const UL = globalThis.UL;
const { makePage } = require("./synth.js");
const I = UL.page._internals;
const cases = [
  { name: "flat", o: { tiltDeg: 0, seed: 1 } },
  { name: "small print", o: { tiltDeg: -3, pitch: 22, xh: 8, seed: 3 } },
  { name: "shadow+thumb", o: { tiltDeg: 4, seed: 4, shadow: 0.5, thumb: true } }
];
cases.forEach(function (cs) {
  const p = makePage(cs.o);
  const cleaned = UL.clean.run(p.img);
  const raw = I.analyse(cleaned.data, cleaned.map);
  // analyse already vets; call the finer scale too, and report heights
  const hs = raw.lines.map(function (l) { return l.height.toFixed(0); });
  console.log(cs.name + ": truth " + p.truth.length + ", vetted " + raw.lines.length + ", P=" + raw.P + ", heights " + hs.slice(0, 12).join(","));
});
