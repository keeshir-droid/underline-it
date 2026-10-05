// The mark: a highlighter stroke (or a pen underline) drawn around a Stroke, and "fade the rest".
// This is the product (PLAN.md section 5.4): it has to look like a real marker on real paper.
//
//   UL.mark.draw(ctx, stroke, opts)       draws one stroke in page pixels (the ctx's transform decides the scale)
//       opts: { mark: "highlighter" | "underline", colour: id or "#hex", progress: 0..1, alpha: 0..1 }
//       progress sweeps the stroke from left to right (the tip is a chisel end that moves with it)
//   UL.mark.drawAll(ctx, strokes, opts)   several strokes (opts.progress may be a function (index) -> 0..1)
//   UL.mark.fadeRest(ctx, strokes, rect, opts)
//       dims everything outside the strokes' bands toward the paper colour inside rect {x, y, w, h}
//       opts: { amount: 0..1 (default 0.55: that is the 55% of PLAN 5.4, times opts.progress), feather (page px),
//               paper: "#f7f1e6" }
//   UL.mark.geometry(stroke)              { cx, cy, angle, halfLen, halfH, bbox:{x0,y0,x1,y1} } the marked band
//
// The highlighter, in order:
//   - a band about 1.15x the text height, sitting a little below the middle of the line
//   - top and bottom edges that wobble on their own (low-frequency noise seeded per stroke), the whole band bending a little, a tiny drift
//     off the line's angle, a band a touch wider where the marker touched down
//   - chisel ends: both leaning the same way, slightly bulging, rounded corners, overshooting the words a little
//   - ink pooled where the marker starts and stops, an uneven darker rim and a patchy faint halo outside the edges (strongest where the
//     ink pools), felt-tip streaks along the stroke, paper fibres eating into the ink
//   - finished strokes are painted once into a cached picture; a sweep (progress < 1) reveals it through the band's outline
//   - density that varies a little along the stroke
//   - composited with MULTIPLY, so the printed letters stay black and crisp underneath
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});
  const U = function () { return UL.util; };

  // ---- knobs (everything about the feel lives here) ----
  const K = {
    bandScale: 1.15,     // band height / text height
    lowShift: 0.045,     // the band's centre sits this much (x text height) below the line's middle
    pad: 0.13,           // the marker overshoots the text by this much (x text height) at each end
    wobble: 0.050,       // edge wobble amplitude (x text height); the top and bottom edges wobble on their own
    bend: 0.035,         // the whole band bends a little with the hand (x text height), both edges together
    startWide: 0.06,     // the band is this much wider where the marker touched down (x half band height)
    driftDeg: 0.6,       // random drift of the whole stroke's angle
    alpha: 0.62,         // base ink opacity (PLAN: 0.55 to 0.7)
    alphaVar: 0.08,      // density variation along the stroke
    pool: 0.30,          // extra opacity in the start/stop blobs
    rim: 0.34,           // extra opacity along the edges (patchy: strongest where the ink pools)
    bleed: 0.17,         // the faint halo outside the edges (patchy, nearly gone in places)
    streak: 0.28,        // felt-tip streaks running along the stroke
    grain: 0.30          // how much the paper fibres break up the ink
  };

  // ---------- small helpers ----------
  function makeNoise(seed) {
    const r = U().mulberry32(seed), t = new Float32Array(256);
    for (let i = 0; i < 256; i++) t[i] = r() * 2 - 1;
    return function (u) {
      u = ((u % 256) + 256) % 256;
      const i = Math.floor(u), f = u - i, s = f * f * (3 - 2 * f);
      return t[i & 255] * (1 - s) + t[(i + 1) & 255] * s;
    };
  }

  function colourHex(c) {
    if (!c) return UL.COLOURS[0].hex;
    if (c.charAt && c.charAt(0) === "#") return c;
    for (let i = 0; i < UL.COLOURS.length; i++) if (UL.COLOURS[i].id === c) return UL.COLOURS[i].hex;
    return UL.COLOURS[0].hex;
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }
  function hslCss(h, s, l, a) { return "hsla(" + Math.round(h * 360) + "," + Math.round(s * 100) + "%," + Math.round(l * 100) + "%," + a + ")"; }

  function scaleOf(ctx) {
    try { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; } catch (e) { return 1; }
  }

  // ---------- geometry of one stroke ----------
  function strokeFrame(stroke) {
    const H = Math.max(4, stroke.height || 20);
    const L = Math.max(2, stroke.x1 - stroke.x0);
    const rng = U().mulberry32(stroke.seed || 1);
    const drift = (rng() * 2 - 1) * K.driftDeg * Math.PI / 180;
    const angle = Math.atan(stroke.slope || 0) + drift;
    const xm = (stroke.x0 + stroke.x1) / 2;
    const hb = K.bandScale * H / 2;
    const pad = K.pad * H;
    return { H: H, L: L, rng: rng, angle: angle, xm: xm, ym: stroke.y, hb: hb, pad: pad, T: L + 2 * pad, yOff: K.lowShift * H };
  }

  function geometry(stroke) {
    const f = strokeFrame(stroke);
    const c = Math.cos(f.angle), s = Math.sin(f.angle);
    const hl = f.T / 2, hh = f.hb + f.yOff;
    const ex = Math.abs(c) * hl + Math.abs(s) * hh, ey = Math.abs(s) * hl + Math.abs(c) * hh;
    return { cx: f.xm, cy: f.ym, angle: f.angle, halfLen: hl, halfH: f.hb, bbox: { x0: f.xm - ex, y0: f.ym - ey, x1: f.xm + ex, y1: f.ym + ey } };
  }

  // ---------- the highlighter ----------
  // The paper's fibres: a tileable blotchy noise (coarse + medium + fine), used to eat into the ink where the fibres are high.
  let grainCanvas = null;
  function grain() {
    if (grainCanvas !== null) return grainCanvas || null;
    try {
      const S = 128, c = U().createCanvas(S, S), x = c.getContext("2d");
      const img = x.createImageData(S, S), r = U().mulberry32(7);
      const grid = function (n) { const t = new Float32Array(n * n); for (let i = 0; i < t.length; i++) t[i] = r(); return t; };
      const sample = function (t, n, px, py) { // bilinear, wrapping
        const u = px / S * n, v = py / S * n, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
        const a = t[(j % n) * n + (i % n)], b = t[(j % n) * n + ((i + 1) % n)], cc = t[((j + 1) % n) * n + (i % n)], d = t[((j + 1) % n) * n + ((i + 1) % n)];
        return (a * (1 - fu) + b * fu) * (1 - fv) + (cc * (1 - fu) + d * fu) * fv;
      };
      const g1 = grid(16), g2 = grid(32);
      for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const v = 0.34 * sample(g1, 16, px, py) + 0.30 * sample(g2, 32, px, py) + 0.36 * r();
        const k = (py * S + px) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
        img.data[k + 3] = Math.round(Math.pow(U().clamp((v - 0.2) / 0.7, 0, 1), 1.5) * 255);
      }
      x.putImageData(img, 0, 0);
      grainCanvas = c;
    } catch (e) { grainCanvas = false; }
    return grainCanvas || null;
  }

  function pathOf(octx, g, uL, uR) {
    const N = U().clamp(Math.ceil((uR - uL) / 5), 6, 400);
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) { const u = uL + (uR - uL) * i / N; top.push([u, g.topAt(u)]); bot.push([u, g.botAt(u)]); }
    const M = 14;
    function capPts(u, sign, slant, t0, t1) { // sign: +1 right end, -1 left end
      const pts = [];
      const yt = g.topAt(u), yb = g.botAt(u);
      const total = yb - yt, rc = 0.2 * total, eps = rc / Math.max(1, total);
      for (let i = 0; i <= M; i++) {
        const t = t0 + (t1 - t0) * i / M;
        const tt = Math.min(t, 1 - t);
        const pull = tt < eps ? rc * (1 - Math.sqrt(Math.max(0, 1 - Math.pow((eps - tt) / eps, 2)))) : 0;
        const bulge = 0.06 * total * Math.pow(Math.sin(Math.PI * t), 0.8);
        const x = u + sign * (bulge - pull) + sign * slant * (t - 0.5) * total;
        pts.push([x, yt + total * t]);
      }
      return pts;
    }
    octx.beginPath();
    top.forEach(function (p, i) { if (i === 0) octx.moveTo(p[0], p[1]); else octx.lineTo(p[0], p[1]); });
    capPts(uR, 1, g.slantR, 0, 1).forEach(function (p) { octx.lineTo(p[0], p[1]); });
    for (let i = bot.length - 1; i >= 0; i--) octx.lineTo(bot[i][0], bot[i][1]);
    capPts(uL, -1, g.slantL, 1, 0).forEach(function (p) { octx.lineTo(p[0], p[1]); });
    octx.closePath();
  }

  // a polyline along one edge, from uA to uB
  function edgePath(octx, fn, uA, uB) {
    const N = U().clamp(Math.ceil((uB - uA) / 4), 6, 500);
    octx.beginPath();
    for (let i = 0; i <= N; i++) { const u = uA + (uB - uA) * i / N; if (i === 0) octx.moveTo(u, fn(u)); else octx.lineTo(u, fn(u)); }
  }
  // a horizontal gradient whose colour is cssAt(u) (used for strokes whose strength varies along the band)
  function gradAlong(octx, uA, uB, step, cssAt) {
    const gr = octx.createLinearGradient(uA, 0, uB, 0);
    const n = U().clamp(Math.ceil((uB - uA) / step), 2, 240);
    for (let i = 0; i <= n; i++) gr.addColorStop(i / n, cssAt(uA + (uB - uA) * i / n));
    return gr;
  }

  // Draws the whole highlighter band (progress 1), in local coordinates (origin = the band's middle), onto octx.
  // Sweeping is done by the caller, which reveals this picture through the band's own outline.
  function paintHighlighter(octx, stroke, f, g, hex) {
    const rgb = U().hexToRgb(hex), hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const T = f.T, H = f.H, uL = -T / 2, uR = T / 2, rng = g.rng, cl = U().clamp;
    const colour = function (a) { return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a + ")"; };
    const deep = function (a) { return hslCss(hsl.h, Math.min(1, hsl.s * 1.05), Math.max(0.2, hsl.l * 0.8), a); };
    const stepA = Math.max(3, 0.42 * H);
    // where ink pools: strongest at the two ends, with patches in between
    const ends = function (u) { return 0.95 * Math.exp(-(u - uL) / (0.9 * H)) + 0.6 * Math.exp(-(uR - u) / (0.8 * H)); };
    const patch = function (n, u, k) { const v = cl(0.45 + 1.1 * n(u / (1.5 * H)) + k * ends(u), 0, 1.4); return v * v; };

    // 1. the halo outside the edges: the ink bled a little into the fibres, here and there
    [[g.topAt, g.nBleedT], [g.botAt, g.nBleedB]].forEach(function (e) {
      [[0.36, 0.30], [0.24, 0.35], [0.13, 0.45]].forEach(function (p) {
        octx.strokeStyle = gradAlong(octx, uL, uR, stepA, function (u) { return deep(K.bleed * p[1] * Math.max(0, patch(e[1], u, 0.5) - 0.18)); });
        octx.lineWidth = p[0] * H; octx.lineJoin = "round"; octx.lineCap = "butt";
        edgePath(octx, e[0], uL, uR); octx.stroke();
      });
    });

    // 2. the base fill, with the density drifting along the stroke (and a drier stretch toward the far end)
    pathOf(octx, g, uL, uR);
    const grad = octx.createLinearGradient(uL, 0, uR, 0);
    const stops = cl(Math.ceil(T / stepA), 8, 120);
    for (let i = 0; i <= stops; i++) {
      const fr = i / stops, u = uL + T * fr;
      grad.addColorStop(fr, colour(cl(K.alpha + K.alphaVar * g.dens(u) - 0.045 * fr, 0.3, 0.9)));
    }
    octx.fillStyle = grad;
    octx.fill();

    octx.save();
    pathOf(octx, g, uL, uR);
    octx.clip();

    // 3. ink pooled where the marker touched down (a bigger, darker blob) and where it lifted off
    const pool = function (u0, dir, w, a, blobs) {
      const pg = octx.createLinearGradient(u0, 0, u0 + dir * w, 0);
      pg.addColorStop(0, deep(a)); pg.addColorStop(1, deep(0));
      octx.fillStyle = pg; octx.fillRect(Math.min(u0, u0 + dir * w), -H * 2, w, H * 4);
      for (let i = 0; i < blobs; i++) {
        const cx = u0 + dir * (0.05 + 0.5 * rng()) * H, cy = g.yMid + (rng() - 0.5) * 1.1 * g.thick, r = (0.3 + 0.4 * rng()) * H;
        const rg = octx.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, deep(a * (0.35 + 0.4 * rng()))); rg.addColorStop(1, deep(0));
        octx.fillStyle = rg; octx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    };
    pool(uL, 1, 0.6 * H, K.pool, 3);
    pool(uR, -1, 0.42 * H, K.pool * 0.75, 2);

    // 4. a faint second pass along one edge for part of the length (the hand went over it again)
    if (g.lap) {
      const l = g.lap, ua = uL + T * l.from, ub = uL + T * l.to, yh = l.w * H * 2;
      octx.fillStyle = deep(0.10);
      octx.beginPath();
      octx.moveTo(ua, l.top ? g.topAt(ua) : g.botAt(ua) - yh);
      for (let i = 0; i <= 14; i++) { const u = ua + (ub - ua) * i / 14; octx.lineTo(u, l.top ? g.topAt(u) + yh * (0.7 + 0.5 * g.dens(u)) : g.botAt(u) - yh * (0.7 + 0.5 * g.dens(u))); }
      for (let i = 14; i >= 0; i--) { const u = ua + (ub - ua) * i / 14; octx.lineTo(u, l.top ? g.topAt(u) - 2 : g.botAt(u) + 2); }
      octx.closePath(); octx.fill();
    }

    // 5. felt-tip streaks: thin strips along the stroke, each a little darker or lighter, coming and going
    const vTop = g.yMid - g.thick / 2 - 3, vBot = g.yMid + g.thick / 2 + 3, unit = Math.max(0.8, H / 22);
    let sj = 0;
    for (let v = vTop; v < vBot; sj++) {
      const sh = (0.5 + 1.7 * rng()) * unit, amp = Math.pow(rng(), 1.6), dark = rng() < 0.5, len = (1.3 + 3.2 * rng()) * H, off = sj * 7.31;
      if (amp > 0.08) {
        octx.globalCompositeOperation = dark ? "source-over" : "destination-out";
        octx.fillStyle = gradAlong(octx, uL, uR, stepA * 1.3, function (u) {
          const n = Math.max(0, g.nStreak(u / len + off) * 1.3 - 0.05);
          return dark ? deep(K.streak * amp * n * 1.4) : "rgba(0,0,0," + (K.streak * 0.9 * amp * n) + ")";
        });
        octx.fillRect(uL, v, T, sh);
      }
      v += sh;
    }
    octx.globalCompositeOperation = "source-over";

    // 6. the darker rim where the felt edge pressed on the paper: uneven, strongest where the ink pools
    [[g.topAt, g.nPoolT], [g.botAt, g.nPoolB]].forEach(function (e) {
      octx.strokeStyle = gradAlong(octx, uL, uR, stepA * 0.7, function (u) { return deep(K.rim * (0.1 + 0.9 * patch(e[1], u, 0.8) / 1.4)); });
      octx.lineWidth = Math.max(1.3, 0.085 * H); octx.lineJoin = "round";
      edgePath(octx, e[0], uL, uR); octx.stroke();
    });
    // and the two chisel ends
    octx.strokeStyle = gradAlong(octx, uL, uR, stepA * 0.5, function (u) { return deep(K.rim * 0.9 * Math.min(1, ends(u) * ends(u))); });
    octx.lineWidth = Math.max(1.3, 0.07 * H);
    pathOf(octx, g, uL, uR); octx.stroke();

    // 7. paper fibres eat into the ink (the pattern is laid in device pixels, shifted per stroke so nothing repeats)
    const gr = grain();
    if (gr) {
      octx.save();
      const ox = Math.floor(rng() * 128), oy = Math.floor(rng() * 128);
      octx.setTransform(1, 0, 0, 1, ox, oy);
      octx.globalCompositeOperation = "destination-out";
      octx.globalAlpha = K.grain;
      octx.fillStyle = octx.createPattern(gr, "repeat");
      octx.fillRect(-ox, -oy, octx.canvas.width, octx.canvas.height);
      octx.restore();
    }
    octx.restore();
  }

  function makeGeom(f) {
    const rng = U().mulberry32((f.rng() * 4294967296) >>> 0);
    const N = function () { return makeNoise((rng() * 1e9) >>> 0); };
    const nTop = N(), nTop2 = N(), nBot = N(), nBot2 = N(), nShared = N(), nDen = N(), nDen2 = N(), nRag = N(), nRag2 = N();
    const A = K.wobble * f.H, B = K.bend * f.H, l1 = 5.5 * f.H, l2 = 1.7 * f.H, l3 = 8 * f.H, l4 = 0.32 * f.H;
    const uL0 = -f.T / 2, W0 = K.startWide * f.hb;
    const start = function (u) { return W0 * Math.exp(-Math.max(0, u - uL0) / (2.2 * f.H)); }; // wider where the marker touched down
    const bend = function (u) { return B * nShared(u / (8 * f.H) + 5); };
    // a second, overlapping pass along one edge (the hand drifted and went over part of the line again)
    const lap = rng() < 0.7 ? { top: rng() < 0.5, from: rng() * 0.35, to: 0.55 + rng() * 0.45, w: 0.14 + 0.1 * rng() } : null;
    // a chisel nib: both ends lean the same way (like a parallelogram), mostly "/"
    const lean = (0.08 + 0.16 * rng()) * (rng() < 0.8 ? -1 : 1), jit = function () { return (rng() - 0.5) * 0.06; };
    return {
      rng: rng,
      slantR: lean + jit(), slantL: -lean + jit(),
      // two slow octaves (the hand) plus a fast, small one (the felt tip dragging on paper fibres); the two edges differ
      topAt: function (u) { return f.yOff - f.hb - start(u) + bend(u) + A * (0.62 * nTop(u / l1) + 0.30 * nTop2(u / l2) + 0.20 * nRag(u / l4)); },
      botAt: function (u) { return f.yOff + f.hb + start(u) + bend(u) + A * (0.62 * nBot(u / l1 + 31) + 0.30 * nBot2(u / l2 + 17) + 0.20 * nRag2(u / l4 + 9)); },
      lap: lap,
      dens: function (u) { return 0.7 * nDen(u / l3) + 0.3 * nDen2(u / (2.4 * f.H)); },
      nStreak: N(), nBleedT: N(), nBleedB: N(), nPoolT: N(), nPoolB: N(),
      yMid: f.yOff, thick: 2 * f.hb
    };
  }

  // ---------- the pen underline ----------
  function paintUnderline(octx, stroke, f, g, hex, progress) {
    const rgb = U().hexToRgb(hex), hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const css = hslCss(hsl.h, Math.max(0.55, hsl.s), 0.45, 0.88);
    const uL = -f.T / 2 + f.pad * 0.5, uR = f.T / 2 - f.pad * 0.5;
    const uEnd = uL + (uR - uL) * progress;
    // just under the baseline (0.15 x text height below it); without a measured baseline, a typical one
    const baseline = (stroke.base !== undefined && isFinite(stroke.base)) ? stroke.base : 0.2 * f.H;
    const y0 = Math.min(0.62 * f.H, baseline + 0.15 * f.H);
    const w = Math.max(2, 0.075 * f.H);
    const nW = makeNoise((g.rng() * 1e9) >>> 0);
    octx.lineCap = "round"; octx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      octx.beginPath();
      const N = U().clamp(Math.ceil((uEnd - uL) / 4), 2, 500);
      for (let i = 0; i <= N; i++) {
        const u = uL + (uEnd - uL) * i / N;
        const hook = progress >= 0.999 && u > uR - 0.9 * f.H ? -0.35 * f.H * Math.pow((u - (uR - 0.9 * f.H)) / (0.9 * f.H), 2.2) : 0;
        const y = y0 + (pass ? 0.9 : 0) + 0.035 * f.H * nW(u / (2.2 * f.H)) + hook;
        if (i === 0) octx.moveTo(u, y); else octx.lineTo(u, y);
      }
      octx.lineWidth = pass ? w * 0.55 : w;
      octx.strokeStyle = pass ? hslCss(hsl.h, Math.max(0.55, hsl.s), 0.38, 0.35) : css;
      octx.stroke();
    }
  }

  // ---------- drawing a stroke onto a context ----------
  // Finished highlighter strokes are painted once into an offscreen picture and cached; a sweep (progress < 1) shows that picture
  // through the band's own outline, so a frame of the video costs one drawImage per stroke.
  const cache = [];       // cached pictures, keyed by what the stroke looks like
  let scratch = null;     // reused for pen underlines that are still being swept

  function getCanvas(w, h, reuse) {
    if (reuse && scratch && scratch.width >= w && scratch.height >= h) { return scratch; }
    const c = U().createCanvas(w, h);
    if (reuse) scratch = c;
    return c;
  }

  function draw(ctx, stroke, opts) {
    opts = opts || {};
    const p = U().clamp(opts.progress === undefined ? 1 : opts.progress, 0, 1);
    if (p <= 0 || !stroke) return;
    const mark = opts.mark === "underline" ? "underline" : "highlighter";
    const hex = colourHex(opts.colour);
    const f = strokeFrame(stroke);
    const res = U().clamp(scaleOf(ctx) * (opts.resolution || 1), 0.5, 2);
    const mx = 0.25 * f.H + 6;
    const wl = f.T + 2 * mx, hl = 2 * f.hb + 2 * mx + 0.1 * f.H + 4;
    let ow = Math.ceil(wl * res), oh = Math.ceil(hl * res);
    const cap = 4096;
    const rs = Math.min(1, cap / ow, cap / oh);
    ow = Math.max(2, Math.floor(ow * rs)); oh = Math.max(2, Math.floor(oh * rs));
    const eff = res * rs;

    const key = mark + "|" + hex + "|" + stroke.seed + "|" + Math.round(f.T) + "|" + Math.round(f.H * 10) + "|" + Math.round((stroke.base === undefined ? -1 : stroke.base) * 4) + "|" + eff.toFixed(2);
    const sweeping = p < 0.999;
    const cacheable = mark === "highlighter" || !sweeping;
    let ent = null;
    if (cacheable) for (let i = 0; i < cache.length; i++) if (cache[i].key === key) { ent = cache[i]; break; }
    if (!ent) {
      const g = makeGeom(f);
      const off = getCanvas(ow, oh, !cacheable);
      const octx = off.getContext("2d");
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalCompositeOperation = "source-over"; octx.globalAlpha = 1;
      octx.clearRect(0, 0, off.width, off.height);
      octx.setTransform(eff, 0, 0, eff, ow / 2, oh / 2);
      if (mark === "underline") paintUnderline(octx, stroke, f, g, hex, p);
      else paintHighlighter(octx, stroke, f, g, hex);
      octx.setTransform(1, 0, 0, 1, 0, 0);
      ent = { key: key, canvas: off, g: g };
      if (cacheable) { cache.push(ent); if (cache.length > 24) cache.shift(); }
    }
    ctx.save();
    ctx.translate(f.xm, f.ym);
    ctx.rotate(f.angle);
    if (mark === "highlighter" && sweeping) { // reveal the picture up to the tip, which keeps the chisel shape
      pathOf(ctx, ent.g, -f.T / 2, -f.T / 2 + Math.max(f.T * p, 0.4 * f.H));
      ctx.clip();
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = opts.alpha === undefined ? 1 : opts.alpha;
    ctx.drawImage(ent.canvas, 0, 0, ow, oh, -ow / (2 * eff), -oh / (2 * eff), ow / eff, oh / eff);
    ctx.restore();
    return !cacheable;
  }

  function drawAll(ctx, strokes, opts) {
    opts = opts || {};
    (strokes || []).forEach(function (s, i) {
      const o = {};
      for (const k in opts) o[k] = opts[k];
      if (typeof opts.progress === "function") o.progress = opts.progress(i);
      draw(ctx, s, o);
    });
  }

  // ---------- fade the rest ----------
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fadeRest(ctx, strokes, rect, opts) {
    opts = opts || {};
    const amount = (opts.amount === undefined ? 0.55 : opts.amount) * U().clamp(opts.progress === undefined ? 1 : opts.progress, 0, 1);
    if (amount <= 0 || !rect || rect.w < 1 || rect.h < 1) return;
    // With opts.maskRect (a fixed area that covers every view of the animation) the soft-edged mask is made once and only
    // blended in at the right strength each frame; without it the mask is drawn fresh over rect.
    const mr = opts.maskRect && opts.maskRect.w > 1 && opts.maskRect.h > 1 ? opts.maskRect : rect;
    const sc = scaleOf(ctx);
    let res = U().clamp(0.5 * sc, 0.2, 1);
    if (mr !== rect) res = Math.round(res * 10) / 10 || 0.2;
    const paper = opts.paper || "#f7f1e6";
    const ow = Math.max(2, Math.ceil(mr.w * res)), oh = Math.max(2, Math.ceil(mr.h * res));
    const key = mr === rect ? "" : (strokes || []).map(function (s) { return [s.seed, Math.round(s.x0), Math.round(s.x1), Math.round(s.y), Math.round(s.height * 10), Math.round((s.slope || 0) * 1000)].join(","); }).join(";") +
      "|" + res + "|" + [mr.x, mr.y, mr.w, mr.h].map(Math.round).join(",") + "|" + paper + "|" + (opts.feather || "");
    let off = null;
    if (key) for (let i = 0; i < maskCache.length; i++) if (maskCache[i].key === key) { off = maskCache[i].canvas; break; }
    if (!off) {
      off = key ? U().createCanvas(ow, oh) : getCanvasFade(ow, oh);
      const octx = off.getContext("2d");
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalCompositeOperation = "source-over"; octx.globalAlpha = 1;
      octx.clearRect(0, 0, off.width, off.height);
      octx.fillStyle = paper;
      octx.fillRect(0, 0, ow, oh);
      octx.globalCompositeOperation = "destination-out";
      const steps = 10;
      (strokes || []).forEach(function (s) {
        const f = strokeFrame(s);
        const feather = opts.feather || Math.max(10, 0.9 * f.H);
        const margin = 0.12 * f.H;
        let hPrev = 0;
        for (let j = 0; j < steps; j++) {
          const e = margin + feather * (1 - j / (steps - 1)); // outermost first
          const target = U().smoothstep((j + 1) / steps);
          const a = (target - hPrev) / (1 - hPrev);
          hPrev = target;
          octx.setTransform(res, 0, 0, res, -mr.x * res, -mr.y * res);
          octx.translate(f.xm, f.ym);
          octx.rotate(f.angle);
          octx.fillStyle = "rgba(0,0,0," + Math.min(1, a) + ")";
          roundRectPath(octx, -f.T / 2 - e, f.yOff - f.hb - e, f.T + 2 * e, 2 * f.hb + 2 * e, 0.35 * f.H + e * 0.6);
          octx.fill();
        }
      });
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalCompositeOperation = "source-over";
      if (key) { maskCache.push({ key: key, canvas: off }); if (maskCache.length > 6) maskCache.shift(); }
    }
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, ow, oh, mr.x, mr.y, mr.w, mr.h);
    ctx.restore();
  }
  const maskCache = [];
  let fadeCanvas = null;
  function getCanvasFade(w, h) {
    if (fadeCanvas && fadeCanvas.width === w && fadeCanvas.height === h) return fadeCanvas;
    fadeCanvas = U().createCanvas(w, h);
    return fadeCanvas;
  }

  UL.mark = {
    draw: draw, drawAll: drawAll, fadeRest: fadeRest, geometry: geometry, colourHex: colourHex,
    K: K
  };
})();
