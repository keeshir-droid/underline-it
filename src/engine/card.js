// The card (PLAN.md sections 6.4, 7.3) and the editor view.
//
//   UL.card.create(page, strokes, settings) -> Promise<Card>      resolves once the Caveat font is ready
//     card.settings                      the current settings (UL.DEFAULTS filled in): mark, colour, finish, fade, title, page, note
//     card.update(partialSettings)       -> Promise<void>
//     card.setStrokes(strokes)           (may be called before update)
//     card.drawFrame(ctx, t, format, scale)
//         THE one drawing function: the live preview, the still image (t = UL.END) and the video all call it.
//         format "square" (1080x1080) or "story" (1080x1920); scale 1 = full size; t in seconds, clamped to 0..END.
//         Timeline (both formats): 0-0.6 the page settles (scale 1.04 -> 1, fades in) | 0.6-2.2 the strokes sweep left to
//         right, one after another | 2.2-3.0 fade-the-rest comes in with a 3% push toward the strokes | 3.0-5.0 hold,
//         the label fades in.  A 0x0 canvas or a scale of 0 draws nothing (no error).
//   UL.card.startPreview(canvas, card, format) -> { stop(), setFormat(format), setCard(card) }
//     Loops 0 -> END with a 1 s pause. The canvas is sized from its CSS box x devicePixelRatio (capped at 2); it pauses
//     while the tab is hidden or the canvas is off screen.
//   UL.card.drawEditor(canvas, page, strokes, liveStroke, opts?)
//     Clears the canvas and draws the page scaled to fill the canvas's CURRENT width/height (the canvas is never resized
//     here; the page keeps its shape and is centred if the two shapes differ), with every finished stroke and the one
//     being swiped. liveStroke may be null, any Stroke-shaped object (snapped, raw, or a blend between them while
//     it animates into place), an array of raw points [{x, y}], or a Stroke-shaped object carrying a points array.
//     A raw finger path is drawn as a soft tube under the finger.   opts: { mark, colour, progress }
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});
  const card = (UL.card = UL.card || {});
  const U = function () { return UL.util; };

  const T_SETTLE = 0.6, T_SWEEP_END = 2.2, T_FADE_END = 3.0, T_LABEL = 3.0, T_LABEL_END = 3.6;
  const PAPER = "#f7f1e6";

  // ---------- helpers ----------
  function pageCanvas(page) {
    const img = page.image;
    if (!img) return null;
    if (img.data) { // a plain ImageData (no canvas around): not drawable directly
      const tmp = U().createCanvas(img.width, img.height);
      tmp.getContext("2d").putImageData(img, 0, 0);
      page.image = tmp; // from now on it is a canvas
      return tmp;
    }
    return img;
  }
  function ss(a, b, t) { return U().smoothstep((t - a) / (b - a)); }

  // ---------- the crop: which part of the page the card shows ----------
  //
  // The crop is worked out in a frame "u, v" turned to the tilt of the marked line (u along the line, v across it), so on a
  // crooked photo the card shows the page straightened and its top and bottom edges can fall exactly between two lines.
  //   - it centres on the marked lines and shows about 2 lines above and below (more if there is room)
  //   - sideways it takes in the whole text block (so words are not cut at the edge) when the picture's shape allows
  //   - the top and bottom edges grow outward onto the quietest gap between lines (so no line is sliced in half)
  //   - it always stays inside the photo
  function lineY(l, x) { return l.a + l.slope * x; }

  function computeCrop(c, format, target) {
    const page = c.page, W = page.width, H = page.height;
    const aspect = (function () { const r = UL.finishes.get(c.settings.finish).picRect(format); return r.w / r.h; })();
    const strokes = c.strokes || [];
    const lines = (page.lines || []).filter(function (l) { return l.a !== undefined; });

    // the tilt: that of the marked line (only when the stroke really snapped to a line of print)
    let theta = 0;
    const snapped = strokes.filter(function (s) { return s.snapped; });
    if (snapped.length) theta = Math.atan(U().median(snapped.map(function (s) { return s.slope || 0; })));
    const lim = 20 * Math.PI / 180;
    theta = U().clamp(theta, -lim, lim);
    if (Math.abs(theta) < 0.25 * Math.PI / 180) theta = 0;
    const cs = Math.cos(theta), sn = Math.sin(theta), acs = Math.abs(cs), asn = Math.abs(sn);
    function toUV(x, y) { return [x * cs + y * sn, -x * sn + y * cs]; }
    function toXY(u, v) { return [u * cs - v * sn, u * sn + v * cs]; }

    // the strokes' box in u, v
    let bu0 = Infinity, bv0 = Infinity, bu1 = -Infinity, bv1 = -Infinity;
    if (strokes.length) {
      strokes.forEach(function (s) {
        const g = UL.mark.geometry(s), ca = Math.cos(g.angle), sa = Math.sin(g.angle), hl = g.halfLen, hh = g.halfH * 1.1;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (q) {
          const dx = q[0] * hl, dy = q[1] * hh;
          const p = toUV(g.cx + dx * ca - dy * sa, g.cy + dx * sa + dy * ca);
          bu0 = Math.min(bu0, p[0]); bu1 = Math.max(bu1, p[0]); bv0 = Math.min(bv0, p[1]); bv1 = Math.max(bv1, p[1]);
        });
      });
    } else {
      const w = W * 0.6, h = H * 0.25;
      bu0 = (W - w) / 2; bu1 = (W + w) / 2; bv0 = (H - h) / 2; bv1 = (H + h) / 2;
    }

    // the lines, sampled in u, v
    const L = lines.map(function (l) {
      const us = [], vs = [];
      for (let k = 0; k < 12; k++) { const x = l.x0 + (l.x1 - l.x0) * (k + 0.5) / 12, p = toUV(x, lineY(l, x)); us.push(p[0]); vs.push(p[1]); }
      let vm = 0; vs.forEach(function (v) { vm += v; }); vm /= vs.length;
      return { u0: toUV(l.x0, lineY(l, l.x0))[0], u1: toUV(l.x1, lineY(l, l.x1))[0], us: us, vs: vs, vm: vm, half: 0.5 * 1.35 * (l.height || (l.bottom - l.top)) };
    });
    const over = L.filter(function (l) { return l.u1 > bu0 && l.u0 < bu1; });
    const hs = over.map(function (l) { return 2 * l.half / 1.35; }).filter(function (v) { return v > 0; });
    const lineH = hs.length ? U().median(hs) : (strokes.length ? strokes[0].height : H * 0.03);
    // the distance between neighbouring lines of print
    let pitch = lineH * 1.45;
    if (over.length >= 3) {
      const sorted = over.slice().sort(function (p, q) { return p.vm - q.vm; }), d = [];
      for (let i = 1; i < sorted.length; i++) { const gap = sorted[i].vm - sorted[i - 1].vm; if (gap > 0.6 * pitch && gap < 2.4 * pitch) d.push(gap); }
      if (d.length >= 2) pitch = U().median(d);
    }

    // the text block around the strokes: the lines within a few lines' height of them
    let tu0 = bu0, tu1 = bu1;
    const near = over.filter(function (l) { return l.vm > bv0 - 7 * pitch && l.vm < bv1 + 7 * pitch && l.u1 - l.u0 > 0.15 * W; });
    if (strokes.length && near.length >= 3) {
      const m0 = U().median(near.map(function (l) { return l.u0; })), m1 = U().median(near.map(function (l) { return l.u1; }));
      if (m1 > m0) { tu0 = Math.min(tu0, m0); tu1 = Math.max(tu1, m1); }
    }
    const padX = Math.max(0.035 * W, 0.8 * pitch);
    const needW = (tu1 - tu0) + 2 * padX;
    const needH = (bv1 - bv0) + 4 * pitch;
    // the paper around the strokes (from the page's brightness map): the crop should not run off the page onto the desk
    const paper = { u0: -Infinity, u1: Infinity, v0: -Infinity, v1: Infinity };
    const map = page._map;
    if (strokes.length && map && map.lum && map.global > 0) {
      const thr = map.global * 0.6, step = map.cell * 0.5, lim = Math.max(W, H);
      const su = (bu0 + bu1) / 2, sv = (bv0 + bv1) / 2;
      const isPaper = function (u, v) {
        const p = toXY(u, v), gx = Math.floor(p[0] / map.cell), gy = Math.floor(p[1] / map.cell);
        return gx >= 0 && gy >= 0 && gx < map.gw && gy < map.gh && map.lum[gy * map.gw + gx] >= thr;
      };
      const reach = function (u, v, du, dv) { let d = 0; while (d < lim && isPaper(u + du * d, v + dv * d)) d += step; return d; };
      const med = function (a) { return a.length >= 3 ? U().median(a) : null; };
      const L0 = [], R0 = [], T0 = [], B0 = [];
      [-2, -1, 0, 1, 2].forEach(function (k) {
        const v = sv + k * pitch; if (!isPaper(su, v)) return;
        L0.push(reach(su, v, -1, 0)); R0.push(reach(su, v, 1, 0));
      });
      [-0.2, -0.1, 0, 0.1, 0.2].forEach(function (k) {
        const u = su + k * Math.max(needW, 4 * pitch); if (!isPaper(u, sv)) return;
        T0.push(reach(u, sv, 0, -1)); B0.push(reach(u, sv, 0, 1));
      });
      const mg = 0.5 * map.cell, l = med(L0), r = med(R0), tp = med(T0), bt = med(B0);
      if (l !== null && r !== null) { paper.u0 = su - l + mg; paper.u1 = su + r - mg; }
      if (tp !== null && bt !== null) { paper.v0 = sv - tp + mg; paper.v1 = sv + bt - mg; }
      // never squeeze the crop so far that it would cut the strokes
      if (paper.u1 - paper.u0 < (bu1 - bu0) + 0.6 * pitch) { paper.u0 = -Infinity; paper.u1 = Infinity; }
      if (paper.v1 - paper.v0 < (bv1 - bv0) + 2 * pitch) { paper.v0 = -Infinity; paper.v1 = Infinity; }
    }
    // the biggest crop (of this shape, turned by theta) that still fits inside the photo and on the paper
    const cwMax = Math.min(W / (acs + asn / aspect), H / (asn + acs / aspect), paper.u1 - paper.u0, (paper.v1 - paper.v0) * aspect);
    let cw = Math.min(Math.max(needW, needH * aspect), cwMax), ch = cw / aspect;
    if (target) { cw = Math.min(target.cw, cwMax); ch = cw / aspect; } // second pass: the width the first pass asked for

    function place(u, v, w, h) { // keep the turned crop inside the photo and on the paper; returns the (clamped) centre in u, v
      const p = toXY(u, v), bw = w * acs + h * asn, bh = w * asn + h * acs;
      const x = bw >= W ? W / 2 : U().clamp(p[0], bw / 2, W - bw / 2), y = bh >= H ? H / 2 : U().clamp(p[1], bh / 2, H - bh / 2);
      const q = toUV(x, y);
      return [U().clamp(q[0], paper.u0 + w / 2, Math.max(paper.u0 + w / 2, paper.u1 - w / 2)), U().clamp(q[1], paper.v0 + h / 2, Math.max(paper.v0 + h / 2, paper.v1 - h / 2))];
    }
    const midU = strokes.length && needW <= cw ? (tu0 + tu1) / 2 : (bu0 + bu1) / 2;
    let cen = place(midU, (bv0 + bv1) / 2, cw, ch);
    // do not show a lot of empty page beyond the first or last line of the text block: slide the crop toward the print
    if (strokes.length && over.length >= 3) {
      const tvMin = Math.min.apply(null, over.map(function (l) { return l.vm; })) - 1.5 * pitch, tvMax = Math.max.apply(null, over.map(function (l) { return l.vm; })) + 1.5 * pitch;
      let v = cen[1];
      if (v + ch / 2 > tvMax) v = Math.max(tvMax - ch / 2, bv1 + 2 * pitch - ch / 2);
      if (v - ch / 2 < tvMin) v = Math.min(tvMin + ch / 2, bv0 - 2 * pitch + ch / 2);
      if (v !== cen[1]) cen = place(cen[0], v, cw, ch);
    }

    // ---- the print itself: how much ink each row across the crop holds, read from the cleaned page ----
    // Lines are not found everywhere (and their bands are only estimates), so the crop's edges are placed by looking at the
    // pixels: an edge belongs in a stretch of rows with no ink in it.
    const px = page._data && page._data.data && page._data.width === W && page._data.height === H ? page._data : null;
    const air = Math.max(3, 0.16 * pitch);
    let ink = null;
    function buildInk(ua, ub, va, vb) {
      if (!px || !(vb > va) || !(ub > ua)) return null;
      const d = px.data, n = 120, rows = Math.max(2, Math.ceil(vb - va) + 1);
      function gray(x, y) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= W || y >= H) return -1;
        const i = (y * W + x) * 4;
        return (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
      }
      const samp = [], dv = Math.max(4, (vb - va) / 40);
      for (let v = va; v < vb; v += dv) for (let i = 0; i < 24; i++) { const p = toXY(ua + (ub - ua) * (i + 0.5) / 24, v), g = gray(p[0], p[1]); if (g >= 0) samp.push(g); }
      if (samp.length < 60) return null;
      samp.sort(function (a, b) { return a - b; });
      const thr = 0.74 * samp[Math.floor(samp.length * 0.75)];
      const f = new Float32Array(rows), cum = new Float32Array(rows + 1);
      for (let r = 0; r < rows; r++) {
        const v = va + r; let k = 0;
        for (let i = 0; i < n; i++) { const p = toXY(ua + (ub - ua) * (i + 0.5) / n, v), g = gray(p[0], p[1]); if (g >= 0 && g < thr) k++; }
        f[r] = k / n; cum[r + 1] = cum[r] + f[r];
      }
      return {
        va: va, rows: rows, f: f,
        at: function (v) { // the average ink in the rows within "air" of v (about 0.3 on a line of print, 0 in a gap)
          const a = Math.max(0, Math.min(rows, Math.round(v - air - va))), b = Math.max(a + 1, Math.min(rows, Math.round(v + air - va) + 1));
          return (cum[b] - cum[a]) / Math.max(1, b - a);
        }
      };
    }
    if (strokes.length && L.length >= 3) ink = buildInk(cen[0] - cw / 2, cen[0] + cw / 2, cen[1] - ch / 2 - 1.4 * pitch, cen[1] + ch / 2 + 1.4 * pitch);

    // Is the crop mostly blank paper beyond the print? Then ask for a shorter picture (the finish shortens its paper).
    let wantFit = 0, inkV0 = 0, inkV1 = 0, planW = 0;
    if (ink && !target) {
      // the block of print around the strokes: walk outward from them until a stretch of blank rows (or a solid dark band such as
      // a shadow or the edge of the page) longer than two and a half lines
      const row = function (v) { const r = Math.round(v - ink.va); return r >= 0 && r < ink.rows ? ink.f[r] : 0; };
      const textRow = function (v) { const f = row(v); return f >= 0.04 && f <= 0.6; };
      let first = (bv0 + bv1) / 2, last = first;
      for (let v = last, gap = 0; v < cen[1] + ch / 2 && gap < 2.5 * pitch; v++, gap++) if (textRow(v)) { last = v; gap = 0; }
      for (let v = first, gap = 0; v > cen[1] - ch / 2 && gap < 2.5 * pitch; v--, gap++) if (textRow(v)) { first = v; gap = 0; }
      if (first >= 0) {
        const m = 1.3 * pitch;
        let v0 = Math.max(cen[1] - ch / 2, first - m), v1 = Math.min(cen[1] + ch / 2, last + m);
        v0 = Math.min(v0, bv0 - 2 * pitch); v1 = Math.max(v1, bv1 + 2 * pitch);
        v0 = Math.max(v0, cen[1] - ch / 2); v1 = Math.min(v1, cen[1] + ch / 2);
        // The print is shorter than the picture window. Show it bigger: crop in a little at the sides (never to less than 60% of the
        // text block's width, and never so tight that the marked words are cut), and shorten the paper for whatever is left over.
        const Ht = v1 - v0, spanU = (bu1 - bu0) + 2 * padX;
        const zoomOK = aspect < 0.95; // (the square card keeps the whole line width: it only gets a shorter paper)
        const cw2 = zoomOK ? Math.min(cw, Math.max(Ht * aspect, spanU, 0.6 * Math.min(needW, cw))) : cw;
        const fit = U().clamp(Ht / (cw2 / aspect), 0.62, 1);
        if (fit < 0.88 || cw2 < 0.9 * cw) { wantFit = fit; inkV0 = v0; inkV1 = v1; planW = cw2; }
      }
    }
    if (target) { // second pass: if the print is taller than the crop keep the marked lines in view, else centre on the print
      const Ht = target.v1 - target.v0, vs = (bv0 + bv1) / 2;
      cen = place(cen[0], ch >= Ht ? (target.v0 + target.v1) / 2 : U().clamp(vs, target.v0 + ch / 2, target.v1 - ch / 2), cw, ch);
    }

    // top and bottom edges: grow outward (never inward) onto the quietest spot between lines
    function cutAt(v, ua, ub) {
      if (ink) return 4 * ink.at(v);
      let cut = 0;
      for (let i = 0; i < L.length; i++) {
        const l = L[i];
        if (l.u1 < ua || l.u0 > ub || l.vm - v > 3 * pitch || v - l.vm > 3 * pitch) continue;
        const wt = (l.u1 - l.u0) / 12;
        for (let k = 0; k < 12; k++) if (l.us[k] >= ua && l.us[k] <= ub && Math.abs(l.vs[k] - v) < l.half) cut += wt;
      }
      return cut / Math.max(1, ub - ua);
    }
    // The card ends (still image, and the last two seconds of the video) on a view 3% tighter and nudged toward the
    // strokes, so the edges are judged on that final view first and on the opening view second.
    const fuS = (bu0 + bu1) / 2, fvS = (bv0 + bv1) / 2, ZOOM = 1.03;
    function costOf(cu, top, bot) {
      const h = bot - top, w = h * aspect, cv = (top + bot) / 2, vw = w / ZOOM, vh = h / ZOOM;
      const fu = U().clamp(fuS, cu - w / 2 + vw / 2, cu + w / 2 - vw / 2), fv = U().clamp(fvS, cv - h / 2 + vh / 2, cv + h / 2 - vh / 2);
      return cutAt(fv - vh / 2, fu - vw / 2, fu + vw / 2) + cutAt(fv + vh / 2, fu - vw / 2, fu + vw / 2) +
        0.5 * (cutAt(top, cu - w / 2, cu + w / 2) + cutAt(bot, cu - w / 2, cu + w / 2));
    }
    if (strokes.length && L.length >= 3 && pitch > 4) {
      const top = cen[1] - ch / 2, bot = cen[1] + ch / 2, step = Math.max(1, pitch / 24);
      let best = Infinity, bT = top, bB = bot;
      const minH = (bv1 - bv0) + 3 * pitch;                  // keep at least about a line and a half of context each side
      const reach = ink ? 1.3 : 1.0;                         // with the pixels to go on, look a little further for a gap
      for (let dT = -0.6 * pitch; dT <= reach * pitch; dT += step) {   // (negative = the edge moves in, positive = out)
        for (let dB = -0.6 * pitch; dB <= reach * pitch; dB += step) {
          const h2 = bot + dB - top + dT;
          if (h2 * aspect > cwMax || h2 < Math.min(ch, minH) || top - dT < paper.v0 || bot + dB > paper.v1) continue;
          if (ink && (top - dT < ink.va + 0.5 || bot + dB > ink.va + ink.rows - 0.5)) continue;
          const cost = costOf(cen[0], top - dT, bot + dB) + 0.08 * (Math.abs(dT) + Math.abs(dB)) / pitch;
          if (cost < best) { best = cost; bT = top - dT; bB = bot + dB; }
        }
      }
      const nh = bB - bT, nw = nh * aspect;
      if (nw <= cwMax) { cw = nw; ch = nh; cen = place(cen[0], (bT + bB) / 2, cw, ch); }
    }
    const cp = toXY(cen[0], cen[1]), bx = cw / 2 * acs + ch / 2 * asn, by = cw / 2 * asn + ch / 2 * acs; // the crop's bounding box on the page
    return { cu: cen[0], cv: cen[1], w: cw, h: ch, theta: theta, fu: fuS, fv: fvS, wantFit: wantFit, target: wantFit ? { v0: inkV0, v1: inkV1, cw: planW } : null, bbox: { x: cp[0] - bx, y: cp[1] - by, w: 2 * bx, h: 2 * by } };
  }

  // ---------- the Card ----------
  function Card(page, strokes, settings) {
    this.page = page;
    this.strokes = (strokes || []).slice();
    this.settings = Object.assign({}, UL.DEFAULTS, settings || {});
    this._date = new Date();
    this._crops = {};
    this._bg = {};
    this._layers = {};
    this._strokeVersion = 1;
  }

  Card.prototype.update = function (partial) {
    partial = partial || {};
    for (const k in partial) if (partial[k] !== undefined) this.settings[k] = partial[k];
    this._crops = {}; this._bg = {}; this._layers = {};
    return Promise.resolve();
  };

  Card.prototype.setStrokes = function (strokes) {
    this.strokes = (strokes || []).slice();
    this._crops = {}; this._layers = {};
  };

  // a copy as it is right now (the video export draws from this, so edits during export do not leak in)
  Card.prototype._snapshot = function () {
    const c = new Card(this.page, this.strokes, this.settings);
    c._date = this._date;
    return c;
  };

  // The crop for a format. Also tells the finish how tall its paper should be (UL.finishes.setFit): when the print is shorter than
  // the picture window, the paper is made shorter (Clean, Polaroid, Torn) instead of showing blank page, and the crop is redone.
  Card.prototype._crop = function (format) {
    const key = this.settings.finish + "|" + format, F = UL.finishes;
    if (!this._crops[key]) {
      F.setFit(format, 1);
      let cr = computeCrop(this, format);
      cr.fit = 1;
      if (cr.wantFit) {
        const fit = this.settings.finish === "film" ? 1 : cr.wantFit; // (Film has a fixed layout: it only crops in)
        F.setFit(format, fit);
        const c2 = computeCrop(this, format, cr.target);
        c2.fit = fit; cr = c2;
      }
      this._crops[key] = cr;
    }
    F.setFit(format, this._crops[key].fit);
    return this._crops[key];
  };

  Card.prototype._drawBackground = function (ctx, fin, format, scale) {
    const b = UL.finishes.box(format);
    const key = fin.id + "|" + format + "|" + Math.round(scale * 100);
    let c = this._bg[key];
    if (c === undefined) {
      try {
        c = U().createCanvas(Math.max(1, Math.round(b.W * scale)), Math.max(1, Math.round(b.H * scale)));
        const x = c.getContext("2d");
        x.setTransform(c.width / b.W, 0, 0, c.height / b.H, 0, 0);
        fin.background(x, format);
      } catch (e) { c = null; }
      this._bg = {}; this._bg[key] = c; // keep only the latest size
    }
    if (c) ctx.drawImage(c, 0, 0, b.W, b.H);
    else fin.background(ctx, format);
  };

  // A cache of the static canvases a card needs (a finish's shadowed sheet, paper grain, tape, and the whole settled card).
  // Entries are canvases of a rectangle b in card units, rendered at the current scale; fn(ctx) draws in card units.
  Card.prototype._layer = function (key, b, scale, fn) {
    if (this._layerScale !== scale) { this._layers = {}; this._layerScale = scale; }
    let e = this._layers[key];
    if (e === undefined) {
      try {
        const w = Math.max(1, Math.ceil(b.w * scale)), h = Math.max(1, Math.ceil(b.h * scale));
        const c = U().createCanvas(w, h), x = c.getContext("2d");
        x.setTransform(w / b.w, 0, 0, h / b.h, -b.x * w / b.w, -b.y * h / b.h);
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        fn(x);
        e = { c: c, b: b };
      } catch (err) { e = null; }
      this._layers[key] = e;
    }
    return e;
  };

  // The picture area's drawing function for time t: the page, turned to the line's tilt, with fade-the-rest and the strokes.
  Card.prototype._picAt = function (t, format, mode) { // mode "strokes": only the strokes (for drawing over a cached picture)
    const S = this.settings, page = this.page, strokes = this.strokes, n = strokes.length;
    const crop = this._crop(format), img = pageCanvas(page);
    const push = ss(T_SWEEP_END, T_FADE_END, t), fadeP = S.fade ? push : 0;
    return function drawPic(c2, rect) {
      // the view: the crop, nudged 3% closer to the strokes while the rest fades
      const z = 1 + 0.03 * push, vw = crop.w / z, vh = crop.h / z;
      const fu = U().clamp(crop.fu, crop.cu - crop.w / 2 + vw / 2, crop.cu + crop.w / 2 - vw / 2);
      const fv = U().clamp(crop.fv, crop.cv - crop.h / 2 + vh / 2, crop.cv + crop.h / 2 - vh / 2);
      const vu = crop.cu + (fu - crop.cu) * push, vv = crop.cv + (fv - crop.cv) * push; // (centred on the crop, drifting to the strokes)
      const cs = Math.cos(crop.theta), sn = Math.sin(crop.theta);
      const vcx = vu * cs - vv * sn, vcy = vu * sn + vv * cs;     // the view's centre on the page
      const ex = vw / 2 * Math.abs(cs) + vh / 2 * Math.abs(sn), ey = vw / 2 * Math.abs(sn) + vh / 2 * Math.abs(cs);
      const view = { x: vcx - ex, y: vcy - ey, w: 2 * ex, h: 2 * ey }; // its bounding box on the page
      const k = rect.w / vw;
      c2.save();
      c2.beginPath(); c2.rect(rect.x, rect.y, rect.w, rect.h); c2.clip();
      if (mode !== "strokes") { c2.fillStyle = PAPER; c2.fillRect(rect.x, rect.y, rect.w, rect.h); }
      // page coordinates -> the card: the view's centre goes to the middle of the rect, the line's tilt is taken out
      c2.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      c2.scale(k, k);
      if (crop.theta) c2.rotate(-crop.theta);
      c2.translate(-vcx, -vcy);
      if (img && mode !== "strokes") c2.drawImage(img, 0, 0, page.width, page.height);
      if (n) {
        if (fadeP > 0 && mode !== "strokes") UL.mark.fadeRest(c2, strokes, view, { amount: 0.55, progress: fadeP, paper: PAPER, maskRect: crop.bbox });
        const slice = (T_SWEEP_END - T_SETTLE) / n;
        UL.mark.drawAll(c2, strokes, {
          mark: S.mark, colour: S.colour,
          progress: function (i) { return ss(T_SETTLE + i * slice, T_SETTLE + (i + 1) * slice, t); }
        });
      }
      c2.restore();
    };
  };

  // the card without its label, as it stands once everything has stopped moving (t >= 3.0), as one canvas
  Card.prototype._holdLayer = function (fin, format, scale, info) {
    const b = UL.finishes.box(format), self = this;
    const e = this._layer("hold|" + fin.id + "|" + format, { x: 0, y: 0, w: b.W, h: b.H }, scale, function (x) {
      self._drawBackground(x, fin, format, scale);
      const centre = fin.pieceCentre(format), tilt = fin.tilt(format);
      const inner = Object.assign({}, info, { labelAlpha: 0 });
      x.save();
      x.translate(centre.x, centre.y); x.rotate(tilt); x.translate(-centre.x, -centre.y);
      fin.piece(x, format, self._picAt(T_FADE_END, format), inner);
      x.restore();
    });
    return e && e.c ? e.c : null;
  };

  // the finished piece before anything is marked (page, finish decorations, tilt), on a transparent canvas
  Card.prototype._baseLayer = function (fin, format, scale, info) {
    const b = UL.finishes.box(format), self = this;
    const e = this._layer("base|" + fin.id + "|" + format, { x: 0, y: 0, w: b.W, h: b.H }, scale, function (x) {
      const centre = fin.pieceCentre(format), tilt = fin.tilt(format);
      const inner = Object.assign({}, info, { labelAlpha: 0 });
      x.save();
      x.translate(centre.x, centre.y); x.rotate(tilt); x.translate(-centre.x, -centre.y);
      fin.piece(x, format, self._picAt(0, format), inner);
      x.restore();
    });
    return e && e.c ? e.c : null;
  };

  Card.prototype.drawFrame = function (ctx, t, format, scale) {
    const cv = ctx && ctx.canvas;
    if (!ctx || (cv && (!cv.width || !cv.height)) || !(scale > 0)) return;
    format = format === "story" ? "story" : "square";
    t = U().clamp(isFinite(t) ? t : 0, 0, UL.END);
    const S = this.settings, self = this;
    const fin = UL.finishes.get(S.finish), box = UL.finishes.box(format);
    this._crop(format); // (also sets how tall this finish's paper is for this card)

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";

    const settle = ss(0, T_SETTLE, t);
    const labelAlpha = ss(T_LABEL, T_LABEL_END, t);
    const info = UL.finishes.labelInfo(S, this._date);
    info.labelAlpha = labelAlpha;
    info.scale = scale; info.format = format;
    info.cache = function (key, bb, fn) { return self._layer(fin.id + "|" + format + "|" + key, bb, scale, fn); };
    const centre = fin.pieceCentre(format), tilt = fin.tilt(format);

    const hold = t >= T_FADE_END ? this._holdLayer(fin, format, scale, info) : null;
    const base = !hold && t < T_SWEEP_END && fin.picClip ? this._baseLayer(fin, format, scale, info) : null;
    if (hold) {
      // nothing moves any more: one blit of the settled card, then only the label
      ctx.drawImage(hold, 0, 0, box.W, box.H);
      if (fin.pieceLabel && labelAlpha > 0) {
        ctx.save();
        ctx.translate(centre.x, centre.y); ctx.rotate(tilt); ctx.translate(-centre.x, -centre.y);
        fin.pieceLabel(ctx, format, info);
        ctx.restore();
      }
    } else if (base) {
      // the strokes are sweeping across a page that does not change: the finished piece (without strokes) is one cached
      // canvas; only the strokes are drawn, inside the picture area
      this._drawBackground(ctx, fin, format, scale);
      const sc = 1 + 0.04 * (1 - settle);
      ctx.save();
      ctx.globalAlpha = settle;
      ctx.translate(centre.x, centre.y); ctx.scale(sc, sc); ctx.translate(-centre.x, -centre.y);
      ctx.drawImage(base, 0, 0, box.W, box.H);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = settle;
      ctx.translate(centre.x, centre.y); ctx.rotate(tilt); ctx.scale(sc, sc); ctx.translate(-centre.x, -centre.y);
      fin.picClip(ctx, format);
      this._picAt(t, format, "strokes")(ctx, fin.picRect(format));
      if (fin.pieceLabel && labelAlpha > 0) fin.pieceLabel(ctx, format, info);
      ctx.restore();
    } else {
      this._drawBackground(ctx, fin, format, scale);
      // the page piece settles in
      ctx.save();
      ctx.globalAlpha = settle;
      const sc = 1 + 0.04 * (1 - settle);
      ctx.translate(centre.x, centre.y); ctx.rotate(tilt); ctx.scale(sc, sc); ctx.translate(-centre.x, -centre.y);
      fin.piece(ctx, format, this._picAt(t, format), info);
      if (fin.pieceLabel && labelAlpha > 0) fin.pieceLabel(ctx, format, info);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    fin.overlay(ctx, format, info, labelAlpha);
    ctx.restore();
  };

  card.create = async function (page, strokes, settings) {
    // the card's handwriting font: wait for it, but never hang
    try {
      if (typeof document !== "undefined" && document.fonts && document.fonts.load) {
        await Promise.race([
          document.fonts.load('600 40px "Caveat"', "Aa"),
          new Promise(function (res) { setTimeout(res, 2500); })
        ]);
      }
    } catch (e) { /* the fallback handwriting font is fine */ }
    return new Card(page, strokes, settings);
  };

  // ---------- the live preview ----------
  card.startPreview = function (canvas, cardObj, format) {
    let cur = cardObj, fmt = format === "story" ? "story" : "square";
    let raf = 0, stopped = false, visible = true, startT = null, lastKey = "";
    const PAUSE = 1.0;

    function size() {
      const dpr = Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
      let cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw) cw = canvas.width / dpr || 360;
      if (!ch) ch = cw * (fmt === "story" ? 16 / 9 : 1);
      const w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; lastKey = ""; }
    }

    function frame(now) {
      raf = 0;
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) { schedule(); return; }
      if (visible) {
        size();
        if (startT === null) startT = now;
        const period = UL.END + PAUSE;
        const el = ((now - startT) / 1000) % period;
        const t = Math.min(el, UL.END);
        const ctx = canvas.getContext("2d");
        const H = fmt === "story" ? 1920 : 1080;
        const sc = Math.min(canvas.width / 1080, canvas.height / H);
        const key = t.toFixed(3) + "|" + fmt + "|" + canvas.width + "x" + canvas.height;
        if (t < UL.END || key !== lastKey) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate((canvas.width - 1080 * sc) / 2, (canvas.height - H * sc) / 2);
          cur.drawFrame(ctx, t, fmt, sc);
          ctx.restore();
          lastKey = key;
        }
      }
      schedule();
    }
    function schedule() { if (!stopped && !raf && typeof requestAnimationFrame === "function") raf = requestAnimationFrame(frame); }

    let io = null;
    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver(function (entries) { visible = entries[entries.length - 1].isIntersecting; });
      io.observe(canvas);
    }
    schedule();
    return {
      stop: function () { stopped = true; if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf); raf = 0; if (io) io.disconnect(); },
      setFormat: function (f) { fmt = f === "story" ? "story" : "square"; startT = null; lastKey = ""; },
      setCard: function (c) { cur = c; startT = null; lastKey = ""; }
    };
  };

  // ---------- the editor view ----------
  function drawTube(ctx, page, points, o) {
    if (!points || !points.length) return;
    const rs = UL.page.rawStroke(page, points);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = UL.mark.colourHex(o.colour);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = rs.height * 1.05;
    ctx.beginPath();
    points.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    if (points.length === 1) ctx.lineTo(points[0].x + 0.01, points[0].y);
    ctx.stroke();
    ctx.restore();
  }

  card.drawEditor = function (canvas, page, strokes, liveStroke, opts) {
    opts = opts || {};
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    if (!W || !H) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (!page || !page.width || !page.height) { ctx.restore(); return; }
    const sc = Math.min(W / page.width, H / page.height);
    const ox = (W - page.width * sc) / 2, oy = (H - page.height * sc) / 2;
    const img = pageCanvas(page);
    if (img) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, ox, oy, page.width * sc, page.height * sc);
    }
    ctx.translate(ox, oy);
    ctx.scale(sc, sc);
    const o = { mark: opts.mark || UL.DEFAULTS.mark, colour: opts.colour || UL.DEFAULTS.colour };
    UL.mark.drawAll(ctx, strokes || [], o);
    if (liveStroke) {
      if (Array.isArray(liveStroke)) drawTube(ctx, page, liveStroke, o);
      else if (liveStroke.x1 !== undefined) {
        UL.mark.draw(ctx, liveStroke, { mark: o.mark, colour: o.colour, progress: opts.progress === undefined ? 1 : opts.progress });
      } else if (liveStroke.points) drawTube(ctx, page, liveStroke.points, o);
    }
    ctx.restore();
  };
})();
