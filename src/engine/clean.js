// Light cleanup of a page photo (PLAN.md section 6.2). It must still look like THEIR book:
//   1. white balance so the paper becomes warm, not white (about #f7f1e6)
//   2. shadow lift: divide by the local paper brightness, blended in at 60%
//   3. a gentle S-curve for contrast
//   4. a light vignette
//
//   UL.clean.run(imageData) -> { data: ImageData, paper: {r,g,b}, map: {...} }
//     data  the cleaned picture (same size, a new ImageData; the input is not changed)
//     paper the paper colour that was measured in the photo
//     map   the coarse paper-brightness grid {cell, gw, gh, lum (Float32 per cell), global}: lines.js uses it to
//           ignore dark surroundings (grass, table) when looking for print
//
// Pure arrays, no browser features: runs in Node. About 3 million pixels in roughly 100 ms on a laptop.
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});
  const U = function () { return UL.util; };

  const TARGET = { r: 247, g: 241, b: 230 }; // warm paper (#f7f1e6)
  const CELL = 16;
  const LIFT = 0.6;       // how much of the shadow lift is applied
  const CURVE = 0.35;     // how much S-curve is applied
  const VIGNETTE = 0.10;  // darkening in the very corners

  function sCurve(x) { // x in 0..1
    const s = x * x * (3 - 2 * x);
    return x + CURVE * (s - x);
  }
  // the input value that the curve would turn into y (the curve is monotonic)
  function invCurve(y) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (sCurve(m) < y) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  function run(img) {
    const W = img.width, H = img.height, src = img.data;
    const gw = Math.max(1, Math.ceil(W / CELL)), gh = Math.max(1, Math.ceil(H / CELL));
    const nC = gw * gh;
    const cr = new Float32Array(nC), cg = new Float32Array(nC), cb = new Float32Array(nC);

    // ---- 1. paper colour per cell: the average of the brighter half of a few samples ----
    const lumTmp = new Float32Array(64), idxTmp = new Int32Array(64), sortTmp = new Float32Array(64);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        let n = 0;
        const y0 = gy * CELL, x0 = gx * CELL;
        const y1 = Math.min(H, y0 + CELL), x1 = Math.min(W, x0 + CELL);
        for (let y = y0; y < y1; y += 2) {
          for (let x = x0; x < x1; x += 2) {
            const i = (y * W + x) * 4;
            lumTmp[n] = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114;
            idxTmp[n] = i; sortTmp[n] = lumTmp[n]; n++;
          }
        }
        if (!n) continue;
        const sorted = sortTmp.subarray(0, n).sort();
        const thr = sorted[n >> 1];
        let sr = 0, sg = 0, sb = 0, c = 0;
        for (let k = 0; k < n; k++) {
          if (lumTmp[k] >= thr) { const i = idxTmp[k]; sr += src[i]; sg += src[i + 1]; sb += src[i + 2]; c++; }
        }
        const o = gy * gw + gx;
        cr[o] = sr / c; cg[o] = sg / c; cb[o] = sb / c;
      }
    }
    // smooth so that letters and small marks don't punch holes in the paper map
    const br = U().boxBlur(cr, gw, gh, 1, 2), bg = U().boxBlur(cg, gw, gh, 1, 2), bb = U().boxBlur(cb, gw, gh, 1, 2);
    const lum = new Float32Array(nC);
    for (let i = 0; i < nC; i++) lum[i] = br[i] * 0.299 + bg[i] * 0.587 + bb[i] * 0.114;

    // the photo's paper colour = the brightest 40% of the cells that could be paper. Paper is only mildly coloured
    // (cream, grey, yellowed); grass, wood and covers are strongly coloured, so they are left out. If nothing is
    // that neutral (a photo of a coloured page) all cells take part.
    const sat = function (i) { const mx = Math.max(br[i], bg[i], bb[i]), mn = Math.min(br[i], bg[i], bb[i]); return mx > 0 ? (mx - mn) / mx : 0; };
    let ids = [];
    for (let i = 0; i < nC; i++) if (sat(i) < 0.4 && lum[i] > 40) ids.push(i);
    if (ids.length < Math.max(4, nC * 0.02)) { ids = []; for (let i = 0; i < nC; i++) ids.push(i); }
    ids.sort(function (a, b) { return lum[b] - lum[a]; });
    const take = Math.max(1, Math.round(ids.length * 0.4));
    let pr = 0, pg = 0, pb = 0, pl = 0;
    for (let k = 0; k < take; k++) { const i = ids[k]; pr += br[i]; pg += bg[i]; pb += bb[i]; pl += lum[i]; }
    pr /= take; pg /= take; pb /= take; pl /= take;
    const paper = { r: pr, g: pg, b: pb };

    // ---- 2. gains: white balance x (blended) local shadow lift ----
    const tr = invCurve(TARGET.r / 255) * 255, tg = invCurve(TARGET.g / 255) * 255, tb = invCurve(TARGET.b / 255) * 255;
    // Per-channel white balance from the paper estimate, in two parts so each gets its own limit:
    //   - brightness: the channel that needs the least boost sets how much the picture is brightened (at most 1.9x)
    //   - colour: how much redder/yellower the paper is than the target (the other channels' gain relative to that one).
    //     A mild cast (ordinary warm or grey paper) is corrected most of the way but a trace of warmth stays, so it still
    //     looks like their book; a strong cast (a yellow or orange lamp) is corrected in full, up to 3.2x between channels.
    const gR = tr / Math.max(20, pr), gG = tg / Math.max(20, pg), gB = tb / Math.max(20, pb);
    const gMin = Math.min(gR, gG, gB);
    const spread = Math.max(gR, gG, gB) / gMin;                       // 1 = no cast
    const keep = U().clamp((spread - 1.5) / 0.8, 0, 1);               // 0 for a mild cast .. 1 for a strong one
    const strength = 0.86 + 0.14 * keep * keep * (3 - 2 * keep);      // share of the cast that is taken out
    const baseGain = U().clamp(gMin, 0.6, 1.9);
    const chroma = function (g) { return Math.pow(U().clamp(g / gMin, 1, 3.2), strength); };
    const wbR = baseGain * chroma(gR), wbG = baseGain * chroma(gG), wbB = baseGain * chroma(gB);
    const gain = new Float32Array(nC);
    for (let i = 0; i < nC; i++) {
      const rel = lum[i] / pl;                       // 1 = as bright as the paper, small = very dark
      const ratio = U().clamp(1 / Math.max(0.05, rel), 0.88, 1.9);
      // only real shadows on the page are lifted: things much darker than any paper (grass, a table in shade) are left alone
      const fade = rel >= 0.45 ? 1 : Math.max(0, (rel - 0.2) / 0.25);
      gain[i] = 1 + LIFT * (ratio - 1) * fade;
    }

    // ---- 3. the S-curve as a table, 4. vignette ----
    const lut = new Uint8Array(256);
    for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * sCurve(v / 255));

    const out = new Uint8ClampedArray(W * H * 4);
    // per-column helpers for the bilinear lookup of the gain grid
    const gx0 = new Int32Array(W), gx1 = new Int32Array(W), gfx = new Float32Array(W), vx2 = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const p = (x + 0.5) / CELL - 0.5;
      const a = Math.max(0, Math.min(gw - 1, Math.floor(p)));
      gx0[x] = a; gx1[x] = Math.min(gw - 1, a + 1);
      gfx[x] = Math.max(0, Math.min(1, p - a));
      const dx = (x + 0.5) / W * 2 - 1; vx2[x] = dx * dx;
    }
    for (let y = 0; y < H; y++) {
      const p = (y + 0.5) / CELL - 0.5;
      const a = Math.max(0, Math.min(gh - 1, Math.floor(p)));
      const b = Math.min(gh - 1, a + 1);
      const fy = Math.max(0, Math.min(1, p - a));
      const rowA = a * gw, rowB = b * gw;
      const dy = (y + 0.5) / H * 2 - 1, vy2 = dy * dy;
      let i = y * W * 4;
      for (let x = 0; x < W; x++, i += 4) {
        const f = gfx[x], x0 = gx0[x], x1 = gx1[x];
        const g0 = gain[rowA + x0] * (1 - f) + gain[rowA + x1] * f;
        const g1 = gain[rowB + x0] * (1 - f) + gain[rowB + x1] * f;
        const g = g0 * (1 - fy) + g1 * fy;
        const vig = 1 - VIGNETTE * 0.5 * (vx2[x] + vy2);
        let r = src[i] * g * wbR, gg = src[i + 1] * g * wbG, b2 = src[i + 2] * g * wbB;
        r = r > 255 ? 255 : r; gg = gg > 255 ? 255 : gg; b2 = b2 > 255 ? 255 : b2;
        out[i] = lut[r | 0] * vig;
        out[i + 1] = lut[gg | 0] * vig;
        out[i + 2] = lut[b2 | 0] * vig;
        out[i + 3] = 255;
      }
    }
    return { data: U().makeImageData(W, H, out), paper: paper, map: { cell: CELL, gw: gw, gh: gh, lum: lum, global: pl } };
  }

  UL.clean = { run: run, TARGET: TARGET };
})();
