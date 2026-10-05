// Makes a fake photo of a page of print as plain RGBA (no canvas), for the Node tests.
// Letters are small hollow boxes with ascenders and descenders, grouped in words, in rows; the whole thing is rotated,
// given a warm cast, an uneven shadow and a little noise.
//
//   const { makePage } = require("./synth.js");
//   const p = makePage({ w, h, pitch, xh, tiltDeg, seed, shadow, thumb })
//   p.img   -> { width, height, data }   p.truth -> [{ yc (at x = 0), slope, x0, x1 }] true centre lines of the rows
(function () {
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makePage(o) {
    o = o || {};
    const w = o.w || 1200, h = o.h || 1600, pitch = o.pitch || 30, xh = o.xh || 11;
    const tilt = (o.tiltDeg || 0) * Math.PI / 180, r = rng(o.seed || 5);
    // flat page, 0 = ink, 255 = paper
    const flat = new Uint8Array(w * h).fill(255);
    function rect(x0, y0, x1, y1) {
      for (let y = Math.max(0, y0 | 0); y < Math.min(h, y1 | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(w, x1 | 0); x++) flat[y * w + x] = 30;
    }
    const marginX = 140, rows = [];
    let y = 170;
    while (y < h - 170) {
      const last = r() < 0.12, endX = last ? marginX + (w - 2 * marginX) * (0.3 + 0.5 * r()) : w - marginX;
      let x = marginX + (r() < 0.1 ? 40 : 0);
      const base = y; // baseline
      while (x < endX - 40) {
        const letters = 2 + ((r() * 6) | 0);
        for (let i = 0; i < letters && x < endX - 8; i++) {
          const asc = r() < 0.28, desc = r() < 0.15, lw = 6 + ((r() * 3) | 0);
          // hollow box of x-height
          rect(x, base - xh, x + lw, base - xh + 2); rect(x, base - 2, x + lw, base);
          rect(x, base - xh, x + 2, base); rect(x + lw - 2, base - xh, x + lw, base);
          if (asc) rect(x + 2, base - xh - 7, x + 4, base - xh);
          if (desc) rect(x + lw - 4, base, x + lw - 2, base + 6);
          x += lw + 1.5;
        }
        x += 7 + r() * 3; // a space
      }
      rows.push({ base: base, x0: marginX, x1: x });
      y += pitch;
    }
    // photograph it: rotate about the centre, warm cast, shadow, noise
    const out = new Uint8ClampedArray(w * h * 4), c = Math.cos(tilt), s = Math.sin(tilt), cx = w / 2, cy = h / 2;
    const nz = rng(99);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const dx = xx - cx, dy = yy - cy;
        const sx = dx * c + dy * s + cx, sy = -dx * s + dy * c + cy; // inverse rotation
        let v = 240;
        if (sx >= 0 && sy >= 0 && sx < w - 1 && sy < h - 1) {
          const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, i = y0 * w + x0;
          v = flat[i] * (1 - fx) * (1 - fy) + flat[i + 1] * fx * (1 - fy) + flat[i + w] * (1 - fx) * fy + flat[i + w + 1] * fx * fy;
        }
        let light = 0.92 - (o.shadow === undefined ? 0.35 : o.shadow) * (xx / w * 0.4 + yy / h * 0.6) + (nz() - 0.5) * 0.04;
        if (o.thumb && xx > w - 160 && yy > h * 0.75 && ((xx - (w - 40)) * (xx - (w - 40)) / 14000 + (yy - h * 0.88) * (yy - h * 0.88) / 30000) < 1) light *= 0.35;
        const k = (yy * w + xx) * 4;
        out[k] = v * light * 1.0; out[k + 1] = v * light * 0.9; out[k + 2] = v * light * 0.72; out[k + 3] = 255;
      }
    }
    const truth = rows.map(function (rw) {
      // the centre of the x-height band, rotated about the page centre
      const yc = rw.base - xh / 2 - 1;
      return { yc0: yc, x0: rw.x0, x1: rw.x1 };
    });
    // true centre line of row i in photo coordinates: forward map of (x, yc0): x' = dx c - dy s, y' = dx s + dy c
    truth.forEach(function (t) {
      function fwd(x) { const dx = x - cx, dy = t.yc0 - cy; return { x: dx * c - dy * s + cx, y: dx * s + dy * c + cy }; }
      const a = fwd(t.x0), b = fwd(t.x1);
      t.slope = (b.y - a.y) / (b.x - a.x); t.ya = a.y; t.xa = a.x; t.xb = b.x;
      t.at = function (x) { return t.ya + t.slope * (x - t.xa); };
    });
    return { img: { width: w, height: h, data: out, colorSpace: "srgb" }, truth: truth, pitch: pitch };
  }

  if (typeof module !== "undefined") module.exports = { makePage: makePage };
})();
