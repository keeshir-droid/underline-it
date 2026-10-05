// The page: cleans the photo, finds every line of print, and snaps a swipe onto the line under it.
//
//   UL.page.prepare(imageData) -> Promise<Page>
//     Page = { width, height, image, lines:[{top,bottom,slope,x0,x1, ...}], warning }
//       image    the cleaned page as a canvas (or, where there is no canvas such as in Node, an ImageData)
//       lines    in page pixels, top to bottom. top/bottom are the band of the print measured straight up and down
//                at the middle of the line; slope is dy/dx (positive = the line runs downhill to the right);
//                x0/x1 are where the ink starts and ends. Extra fields: a (y of the line's centre at x = 0), height
//                (the band thickness measured across the line), words [[x0,x1]...] (word spans, page px).
//       warning  null, or "no-lines" (the editor still works: swipes just stay where the finger went)
//   UL.page.snap(page, points) -> Stroke { x0, x1, y, height, slope, snapped, seed }   (never null)
//       (snapped strokes also carry base: where the baseline is, measured down from y; the underline uses it)
//       y is the centre of the band of print at x = (x0 + x1) / 2, height is the band thickness across the line,
//       slope is dy/dx. The mark (mark.js) is drawn around exactly this band.
//   UL.page.rawStroke(page, points) -> Stroke    the un-snapped version (used while the finger is still moving)
//
// How lines are found (PLAN.md section 6.3), at about 1000 px wide:
//   1. ink mask (local-mean threshold on an integral image, from Day 2's reader.js "inkMask")
//   2. the page's overall tilt (try angles, keep the one where the ink is most "stacked" into rows)
//   3. the page is cut into vertical strips; in each strip (with its own small tilt, so curved or
//      perspective pages cope) the row-ink profile is split into bands of print
//   4. bands are joined across strips into lines, and every line is fitted as y = a + slope * x
//   5. ink x-range and word spans are read along each fitted line
//   6. vetting: book edges, spines, hairlines and tall bands are thrown out; a page needs a block of regularly spaced,
//      "busy" lines (letters and words starting again and again) or it gets warning "no-lines" and an empty lines array;
//      no band is taller than 1.2 line pitches (the local pitch); bands that sit on top of each other (hatching, stripes) are
//      settled, and a page where a quarter of the bands clash is not print. Each strip uses its own line pitch (lines are closer on the far side of an
//      oblique page); a chain that is not straight (the two pages of an open book) is cut back to its straight part.
//
// Pure arrays, no browser features at load time: runs in Node too.
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});
  const U = function () { return UL.util; };

  const WORK_WIDTH = 1000;      // line finding works at about this many pixels across
  const MAX_TILT = 40;          // degrees we are willing to straighten
  const DARK_CELL = 0.45;       // paper-brightness ratio below which a spot is "not page" (grass, dark table)

  // ---------- ink mask (Day 2, handwriting-font-converter reader.js) ----------

  // Marks pixels that are clearly darker than their surroundings (= ink).
  // Using the local average (not one global brightness) is what makes shadows mostly harmless.
  function inkMask(gray, w, h) {
    const r = Math.max(14, Math.round(Math.max(w, h) / 70));
    const W1 = w + 1;
    const integral = new Uint32Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += gray[y * w + x];
        integral[(y + 1) * W1 + (x + 1)] = integral[y * W1 + (x + 1)] + row;
      }
    }
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        const sum = integral[y1 * W1 + x1] - integral[y0 * W1 + x1] - integral[y1 * W1 + x0] + integral[y0 * W1 + x0];
        const mean = sum / ((x1 - x0) * (y1 - y0));
        const v = gray[y * w + x];
        if (v < mean - Math.max(22, mean * 0.16)) mask[y * w + x] = 1;
      }
    }
    return mask;
  }

  // Luminance, area-averaged down to w x h.
  function grayDown(img, w, h) {
    const sw = img.width, sh = img.height, d = img.data;
    const out = new Uint8Array(w * h);
    const kx = sw / w, ky = sh / h;
    for (let y = 0; y < h; y++) {
      const ya = Math.floor(y * ky), yb = Math.max(ya + 1, Math.min(sh, Math.ceil((y + 1) * ky)));
      for (let x = 0; x < w; x++) {
        const xa = Math.floor(x * kx), xb = Math.max(xa + 1, Math.min(sw, Math.ceil((x + 1) * kx)));
        let s = 0, n = 0;
        for (let yy = ya; yy < yb; yy++) {
          let i = (yy * sw + xa) * 4;
          for (let xx = xa; xx < xb; xx++, i += 4) { s += d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28; n++; }
        }
        out[y * w + x] = (s / n) >> 8;
      }
    }
    return out;
  }

  // ---------- tilt ----------

  // Sum over rows of (ink in that row)^2, for the rows of a page turned by `deg`: bigger = more stacked.
  function tiltScore(xs, ys, n, deg, bin, buf, off) {
    const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    buf.fill(0);
    for (let i = 0; i < n; i++) buf[((ys[i] * c - xs[i] * s + off) / bin) | 0]++;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (v) sum += v * v; }
    return sum;
  }

  function bestTilt(xs, ys, n, lo, hi, step, bin, buf, off) {
    let best = (lo + hi) / 2, bestScore = -1;
    for (let a = lo; a <= hi + 1e-6; a += step) {
      const sc = tiltScore(xs, ys, n, a, bin, buf, off);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    const c0 = best;
    for (let a = c0 - step; a <= c0 + step + 1e-6; a += step / 5) {
      const sc = tiltScore(xs, ys, n, a, bin, buf, off);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    return { deg: best, score: bestScore };
  }

  // ---------- strips ----------

  function smooth(arr, r, passes) {
    return U().boxBlur(arr, arr.length, 1, r, passes);
  }

  // Splits one strip's row profile into bands of print. prof is indexed by v (distance across the lines).
  function findBands(prof, P) {
    const n = prof.length;
    const r1 = Math.max(1, Math.round(P * 0.11));
    const sm = smooth(prof, r1, 2);
    const light = smooth(prof, 1, 1);
    // floor: ink that is everywhere (edges, specks) is not a line
    let first = 0, last = n - 1;
    while (first < n && sm[first] <= 0) first++;
    while (last > first && sm[last] <= 0) last--;
    if (last - first < P * 0.5) return [];
    const sorted = Array.prototype.slice.call(sm, first, last + 1).sort(function (a, b) { return a - b; });
    const base = sorted[Math.floor(sorted.length * 0.2)] || 0;
    // local maxima
    const maxima = [];
    for (let i = Math.max(1, first); i < Math.min(n - 1, last + 1); i++) {
      if (sm[i] - base > 0 && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1]) maxima.push({ i: i, h: sm[i] - base });
    }
    if (!maxima.length) return [];
    const heights = maxima.map(function (m) { return m.h; });
    const ref = U().percentile(heights, 0.75);
    const minH = Math.max(3, 0.18 * ref);
    const cand = maxima.filter(function (m) { return m.h >= minH; }).sort(function (a, b) { return b.h - a.h; });
    const kept = [];
    cand.forEach(function (m) {
      for (let k = 0; k < kept.length; k++) if (Math.abs(kept[k].i - m.i) < 0.6 * P) return;
      kept.push(m);
    });
    kept.sort(function (a, b) { return a.i - b.i; });
    // valleys between neighbours bound the bands
    const bands = [];
    for (let k = 0; k < kept.length; k++) {
      const m = kept[k];
      const prevI = k > 0 ? kept[k - 1].i : null, nextI = k + 1 < kept.length ? kept[k + 1].i : null;
      // a band is never wider than about 1.7 line pitches (two lines are never merged into one band)
      let lo = Math.max(0, m.i - Math.round(0.85 * P)), hi = Math.min(n - 1, m.i + Math.round(0.85 * P));
      if (prevI !== null) { let vi = prevI, vv = Infinity; for (let i = prevI; i <= m.i; i++) if (sm[i] < vv) { vv = sm[i]; vi = i; } lo = Math.max(lo, vi); }
      if (nextI !== null) { let vi = nextI, vv = Infinity; for (let i = m.i; i <= nextI; i++) if (sm[i] < vv) { vv = sm[i]; vi = i; } hi = Math.min(hi, vi); }
      const thr = base + 0.10 * m.h;
      let top = m.i; while (top > lo && light[top - 1] > thr) top--;
      let bot = m.i; while (bot < hi && light[bot + 1] > thr) bot++;
      let ink = 0; for (let i = top; i <= bot; i++) ink += prof[i];
      // the dense core of the profile is the x-height zone: its bottom edge is the baseline
      const cthr = base + 0.55 * m.h;
      let cTop = m.i; while (cTop > top && sm[cTop - 1] > cthr) cTop--;
      let cBot = m.i; while (cBot < bot && sm[cBot + 1] > cthr) cBot++;
      bands.push({ top: top, bottom: bot, peak: m.h, ink: ink, coreTop: cTop, coreBottom: cBot });
    }
    return bands;
  }

  // The distance between lines, where the row profiles repeat (the autocorrelation of the profiles, summed). 0 = no clear rhythm.
  function pitchOf(profs, minLag, maxLag) {
    const ac = new Float64Array(maxLag + 1);
    profs.forEach(function (p) {
      if (p.length < 40) return;
      const sm = smooth(p, 3, 2); // blur away the fine structure inside a line (x-height edge, baseline, serifs)
      let mean = 0; for (let i = 0; i < sm.length; i++) mean += sm[i]; mean /= sm.length;
      for (let lag = 0; lag <= maxLag && lag < sm.length - 10; lag++) {
        let sum = 0;
        for (let i = 0; i + lag < sm.length; i++) sum += (sm[i] - mean) * (sm[i + lag] - mean);
        ac[lag] += sum;
      }
    });
    let acMax = 0;
    for (let lag = minLag; lag <= maxLag; lag++) if (ac[lag] > acMax) acMax = ac[lag];
    if (ac[0] > 0 && acMax / ac[0] > 0.08) {
      for (let lag = minLag + 1; lag < maxLag; lag++) {
        if (ac[lag] >= ac[lag - 1] && ac[lag] > ac[lag + 1] && ac[lag] >= 0.75 * acMax) return lag;
      }
    }
    return 0;
  }

  // ---------- prepare ----------

  function analyse(cleanData, cleanMap, workWidth) {
    const W = cleanData.width, H = cleanData.height;
    const ww = Math.min(W, workWidth || WORK_WIDTH), k = W / ww, wh = Math.max(1, Math.round(H / k));
    const gray = grayDown(cleanData, ww, wh);
    const mask = inkMask(gray, ww, wh);

    // ignore ink where the paper-brightness map says "dark surroundings" (grass, table, black cover)
    if (cleanMap) {
      const g = cleanMap.global * DARK_CELL, cell = cleanMap.cell;
      for (let y = 0; y < wh; y++) {
        const gy = Math.min(cleanMap.gh - 1, ((y + 0.5) * k / cell) | 0);
        for (let x = 0; x < ww; x++) {
          if (!mask[y * ww + x]) continue;
          const gx = Math.min(cleanMap.gw - 1, ((x + 0.5) * k / cell) | 0);
          if (cleanMap.lum[gy * cleanMap.gw + gx] < g) mask[y * ww + x] = 0;
        }
      }
    }
    // the very border of the picture is lens shading and edges, not print
    const edge = 3;
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) if (x < edge || y < edge || x >= ww - edge || y >= wh - edge) mask[y * ww + x] = 0;

    // collect ink pixels (sparse) and sort them into strips
    let count = 0;
    for (let i = 0; i < mask.length; i++) count += mask[i];
    const stride = Math.max(1, Math.ceil(Math.sqrt(count / 90000)));
    const nStrips = U().clamp(Math.round(ww / 160), 4, 8);
    const stripW = ww / nStrips;
    const sx = [], sy = [];
    for (let s = 0; s < nStrips; s++) { sx.push([]); sy.push([]); }
    const allX = [], allY = [];
    for (let y = 0; y < wh; y += stride) {
      for (let x = 0; x < ww; x += stride) {
        if (!mask[y * ww + x]) continue;
        const s = Math.min(nStrips - 1, (x / stripW) | 0);
        sx[s].push(x); sy[s].push(y); allX.push(x); allY.push(y);
      }
    }
    const info = { ww: ww, wh: wh, k: k, mask: mask, ink: count / mask.length, theta: 0, P: 0, strips: nStrips, lines: [] };
    if (allX.length < 80) return info;

    const off = ww + wh;
    const bin = 1.5;
    const buf = new Float32Array(Math.ceil(2 * off / bin) + 4);
    const gX = Int16Array.from(allX), gY = Int16Array.from(allY);
    const glob = bestTilt(gX, gY, gX.length, -MAX_TILT, MAX_TILT, 1, bin, buf, off);
    info.theta = glob.deg;

    // ---- each strip: its own small tilt, then bands ----
    const stripData = [];
    for (let s = 0; s < nStrips; s++) {
      const X = Int16Array.from(sx[s]), Y = Int16Array.from(sy[s]);
      let deg = glob.deg;
      if (X.length > 120) deg = bestTilt(X, Y, X.length, Math.max(-45, glob.deg - 14), Math.min(45, glob.deg + 14), 1, bin, buf, off).deg;
      const t = deg * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
      let vmin = Infinity, vmax = -Infinity;
      const V = new Float32Array(X.length);
      for (let i = 0; i < X.length; i++) { const v = Y[i] * c - X[i] * sn; V[i] = v; if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
      const len = X.length ? Math.ceil(vmax - vmin) + 2 : 0;
      const prof = new Float32Array(len);
      for (let i = 0; i < X.length; i++) prof[(V[i] - vmin) | 0] += stride * stride;
      stripData.push({ deg: deg, c: c, s: sn, vmin: vmin, prof: prof, xc: (s + 0.5) * stripW });
    }

    // ---- the line pitch P: where the row profiles repeat ----
    const maxLag = Math.min(150, Math.floor(wh / 3));
    let P = pitchOf(stripData.map(function (sd) { return sd.prof; }), 9, maxLag);
    if (!P) P = Math.round(0.022 * Math.max(ww, wh));
    info.P = P;
    // each strip's own pitch: on an oblique page the lines are closer together on the far side (perspective)
    stripData.forEach(function (sd) {
      const ps = pitchOf([sd.prof], Math.max(6, Math.round(0.45 * P)), Math.min(maxLag, Math.round(1.6 * P)));
      sd.P = ps && ps >= 0.45 * P && ps <= 1.6 * P ? ps : P;
    });

    // ---- bands per strip ----
    const stripBands = stripData.map(function (sd) {
      if (!sd.prof.length) return [];
      return findBands(sd.prof, sd.P).map(function (b) {
        const vc = (b.top + b.bottom) / 2 + sd.vmin;
        return {
          P: sd.P, xc: sd.xc, y: (vc + sd.xc * sd.s) / sd.c, slope: Math.tan(sd.deg * Math.PI / 180),
          th: b.bottom - b.top + 1, peak: b.peak, ink: b.ink,
          baseOff: b.coreBottom - (b.top + b.bottom) / 2, xh: b.coreBottom - b.coreTop + 1
        };
      });
    });

    // ---- join bands across strips into chains ----
    const chains = [];
    let active = [];
    for (let s = 0; s < nStrips; s++) {
      const bands = stripBands[s].slice();
      const used = new Uint8Array(bands.length);
      const pairs = [];
      active.forEach(function (ch, ci) {
        const last = ch.pts[ch.pts.length - 1];
        const dx = (s * stripW + stripW / 2) - last.xc;
        const sl = ch.pts.length >= 2 ? (last.y - ch.pts[ch.pts.length - 2].y) / (last.xc - ch.pts[ch.pts.length - 2].xc) : last.slope;
        const slopeUse = (Math.abs(sl - last.slope) < 0.12) ? (sl + last.slope) / 2 : last.slope;
        const pred = last.y + slopeUse * dx;
        bands.forEach(function (b, bi) {
          const d = Math.abs(b.y - pred);
          const Pl = Math.min(P, last.P || P, b.P || P);
          if (d <= 0.55 * Pl && Math.abs(b.th - last.th) <= 1.2 * Pl) pairs.push({ d: d, ci: ci, bi: bi });
        });
      });
      pairs.sort(function (a, b) { return a.d - b.d; });
      const chainTaken = new Uint8Array(active.length);
      pairs.forEach(function (p) {
        if (chainTaken[p.ci] || used[p.bi]) return;
        chainTaken[p.ci] = 1; used[p.bi] = 1;
        active[p.ci].pts.push(bands[p.bi]); active[p.ci].lastStrip = s;
      });
      bands.forEach(function (b, bi) {
        if (used[bi]) return;
        const ch = { pts: [b], lastStrip: s, firstStrip: s };
        chains.push(ch); active.push(ch);
      });
      active = active.filter(function (ch) { return s - ch.lastStrip < 2; }); // a one-strip gap is forgiven
    }

    // keep believable chains
    const longPeaks = chains.filter(function (c) { return c.pts.length >= 2; }).map(function (c) { return U().median(c.pts.map(function (p) { return p.peak; })); });
    const refPeak = longPeaks.length ? U().median(longPeaks) : 0;
    const good = chains.filter(function (c) {
      const th = U().median(c.pts.map(function (p) { return p.th; }));
      if (th < 0.35 * P || th > 3.2 * P) return false;
      if (c.pts.length >= 2) return true;
      const pk = c.pts[0].peak;
      return refPeak === 0 ? pk > 6 : pk >= 0.25 * refPeak;
    });

    // ---- fit y = a + slope * x per chain, then read the ink along it ----
    const lines = [];
    good.forEach(function (c) {
      let pts = c.pts;
      function fit(pp) {
        let sl0;
        const meanTilt = U().median(pp.map(function (p) { return p.slope; }));
        if (pp.length >= 3) {
          const sl = [];
          for (let i = 0; i < pp.length; i++) for (let j = i + 1; j < pp.length; j++) sl.push((pp[j].y - pp[i].y) / (pp[j].xc - pp[i].xc));
          sl0 = U().median(sl);
          if (Math.abs(sl0 - meanTilt) > 0.2) sl0 = meanTilt;
        } else if (pp.length === 2) {
          sl0 = (pp[1].y - pp[0].y) / (pp[1].xc - pp[0].xc);
          if (Math.abs(sl0 - meanTilt) > 0.12) sl0 = meanTilt;
        } else sl0 = pp[0].slope;
        return { slope: sl0, a: U().median(pp.map(function (p) { return p.y - sl0 * p.xc; })) };
      }
      let f = fit(pts);
      // a chain whose strips do not lie on one straight line (the two pages of an open book, a page edge) is cut back to
      // its longest straight stretch, so the band sits on the print along its whole length
      if (pts.length >= 3) {
        const off = pts.map(function (p) { return Math.abs(p.y - (f.a + f.slope * p.xc)); });
        if (Math.max.apply(null, off) > 0.45 * P) {
          let best = [], cur = [];
          pts.forEach(function (p, i) { if (off[i] <= 0.35 * P) cur.push(p); else { if (cur.length > best.length) best = cur; cur = []; } });
          if (cur.length > best.length) best = cur;
          if (best.length < 2) return;
          pts = best; f = fit(pts);
        }
      }
      const slope = f.slope, a = f.a;
      const cosT = 1 / Math.sqrt(1 + slope * slope);
      const th = U().median(pts.map(function (p) { return p.th; })); // across the line
      const hv = th / cosT; // the same band measured straight up and down
      const xStart = Math.max(0, pts[0].xc - stripW / 2), xEnd = Math.min(ww - 1, pts[pts.length - 1].xc + stripW / 2);
      // column ink inside the band along the line (scanned one strip further out on each side: the first and last
      // letters of a line often sit in a strip where the line was too faint to be found)
      const scanA = Math.max(0, Math.floor(xStart - stripW)), scanB = Math.min(ww - 1, Math.ceil(xEnd + stripW));
      const col = new Float32Array(ww);
      for (let x = scanA; x <= scanB; x++) {
        const yc = a + slope * x;
        const y0 = Math.max(0, Math.round(yc - hv / 2)), y1 = Math.min(wh - 1, Math.round(yc + hv / 2));
        let n = 0;
        for (let y = y0; y <= y1; y++) n += mask[y * ww + x];
        col[x] = n;
      }
      // runs of inked columns -> words (a gap wider than ~a fifth of the band is a space)
      const gapMin = Math.max(3, 0.22 * th);
      const words = [];
      let runStart = -1, lastInk = -1, runInk = 0;
      function closeRun() { if (runStart >= 0) { words.push({ a: runStart, b: lastInk, ink: runInk }); } runStart = -1; runInk = 0; }
      for (let x = scanA; x <= scanB; x++) {
        if (col[x] > 0) {
          if (runStart < 0) runStart = x; else if (x - lastInk - 1 >= gapMin) { closeRun(); runStart = x; }
          lastInk = x; runInk += col[x];
        }
      }
      closeRun();
      let real = words.filter(function (w) { return (w.b - w.a + 1) >= 0.3 * th && w.ink >= 0.25 * th; });
      // the words inside the found range are certain; words just outside it count only if they follow on closely
      let i0 = -1, i1 = -1;
      real.forEach(function (w, i) { const c = (w.a + w.b) / 2; if (c >= xStart && c <= xEnd) { if (i0 < 0) i0 = i; i1 = i; } });
      if (i0 < 0) return;
      while (i0 > 0 && real[i0].a - real[i0 - 1].b <= 3 * gapMin) i0--;
      while (i1 < real.length - 1 && real[i1 + 1].a - real[i1].b <= 3 * gapMin) i1++;
      real = real.slice(i0, i1 + 1);
      let inkCols = 0;
      if (!real.length) return;
      const x0 = real[0].a, x1 = real[real.length - 1].b + 1;
      for (let x = Math.floor(x0); x < x1; x++) if (col[x] > 0) inkCols++;
      const coverage = inkCols / Math.max(1, x1 - x0);
      let starts = 0; // how often the ink starts again along the line: letters and words make text busy, edges and stripes do not
      for (let x = Math.floor(x0) + 1; x < x1; x++) if (col[x] > 0 && col[x - 1] <= 0) starts++;
      const busy = starts / Math.max(1, (x1 - x0) / th);
      if (coverage < 0.3 || (x1 - x0) < 1.5 * th) return; // a speck or an edge, not print
      let fillInk = 0;
      for (let x = Math.floor(x0); x < x1; x++) fillInk += col[x];
      const fill = fillInk / Math.max(1, (x1 - x0) * (hv + 1));
      let longRuns = 0; // text breaks into words; a long unbroken run of ink is an edge, a rule or a picture
      real.forEach(function (w) { if ((w.b - w.a + 1) > 14 * th) longRuns += w.b - w.a + 1; });
      if (longRuns > 0.3 * (x1 - x0)) return;
      if (fill > 0.8 || (real.length < 3 && (x1 - x0) > 8 * th)) return; // a solid edge or a rule, not print
      // the rhythm of words and spaces along the line (print has runs of very different lengths and clear spaces between them)
      const runs = real.map(function (w) { return (w.b - w.a + 1) / th; }), spaces = [];
      for (let i = 1; i < real.length; i++) spaces.push((real[i].a - real[i - 1].b - 1) / th);
      const cv = function (v) { if (v.length < 3) return 0; let m = 0; v.forEach(function (x) { m += x; }); m /= v.length; let q = 0; v.forEach(function (x) { q += (x - m) * (x - m); }); return m > 0 ? Math.sqrt(q / v.length) / m : 0; };
      const rhythm = { nw: real.length, wlen: runs.length ? U().median(runs) : 0, wcv: cv(runs), glen: spaces.length ? U().median(spaces) : 0, gcv: cv(spaces) };
      const xm = (x0 + x1) / 2, ym = a + slope * xm;
      lines.push({
        top: (ym - hv / 2) * k, bottom: (ym + hv / 2) * k, slope: slope, x0: x0 * k, x1: x1 * k,
        a: a * k, height: th * k,
        base: U().median(pts.map(function (p) { return p.baseOff; })) * k, // baseline, measured down from the band's middle
        words: real.map(function (w) { return [w.a * k, (w.b + 1) * k]; }), busy: busy, fill: fill, rhythm: rhythm,
        _ym: ym
      });
    });
    lines.sort(function (p, q) { return p._ym - q._ym || p.x0 - q.x0; });
    lines.forEach(function (l) { delete l._ym; });
    info.rawCount = lines.length; info.rawLines = lines;
    info.vet = {}; info.lines = vetLines(lines, W, H, info.vet);
    return info;
  }

  // Throws out what is not print, and decides whether this is a page of text at all.
  //   - hairlines, ultra-long thin bands and very tall bands are book edges, spines, rules and pictures
  //   - real text is a stack of lines about one pitch apart: a line belongs to a text block when it has neighbours above or
  //     below at a roughly regular spacing. Fewer than four lines in such a block (a map, an engraving, a spine) = no lines
  //   - no band is taller than 1.5 line pitches (two lines are never merged into one band)
  function vetLines(lines, W, H, note) {
    note = note || {};
    if (lines.length < 4) { note.why = "fewer than 4 raw lines"; return []; }
    const medH = U().median(lines.map(function (l) { return l.height; }));
    const ls = lines.filter(function (l) {
      if (l.height < 0.3 * medH) return false;            // a hairline: an edge, a rule, a crack
      if (l.x1 - l.x0 > 140 * l.height) return false;      // ultra-long and thin: a book edge or a spine
      if (l.height > 0.12 * H) return false;              // far too tall to be a line of print
      return true;
    });
    note.afterFilter = ls.length;
    if (ls.length < 4) { note.why = "fewer than 4 after the individual filters"; return []; }
    ls.forEach(function (l) { l._ym = l.a + l.slope * (l.x0 + l.x1) / 2; });
    ls.sort(function (p, q) { return p._ym - q._ym; });
    function yAt(l, x) { return l.a + l.slope * x; }
    // the next line below each line (they must share some of their width)
    const succ = new Array(ls.length).fill(-1), gap = new Array(ls.length).fill(0), gaps = [];
    for (let i = 0; i < ls.length; i++) {
      const p = ls[i];
      for (let j = i + 1; j < ls.length; j++) {
        const q = ls[j];
        const a = Math.max(p.x0, q.x0), b = Math.min(p.x1, q.x1);
        if (b - a < 0.4 * Math.min(p.x1 - p.x0, q.x1 - q.x0)) continue;
        const g = yAt(q, (a + b) / 2) - yAt(p, (a + b) / 2);
        if (g < 0.6 * medH) continue;
        if (succ[i] < 0 || g < gap[i]) { succ[i] = j; gap[i] = g; }
      }
      if (succ[i] >= 0 && gap[i] > 0.9 * medH && gap[i] < 3.2 * medH) gaps.push(gap[i]);
    }
    note.gaps = gaps.length;
    if (gaps.length < 3) { note.why = "fewer than 3 neighbour gaps"; return []; }
    const pitch = U().median(gaps); note.pitch = Math.round(pitch); note.medH = Math.round(medH);
    // join regularly spaced neighbours into blocks (union-find)
    const par = ls.map(function (_, i) { return i; });
    function find(i) { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }
    for (let i = 0; i < ls.length; i++) {
      if (succ[i] >= 0 && gap[i] >= 0.6 * pitch && gap[i] <= 1.8 * pitch) par[find(i)] = find(succ[i]);
    }
    const members = {};
    ls.forEach(function (l, i) { const r = find(i); (members[r] = members[r] || []).push(l); });
    // a block counts as print when its lines are busy (letters and words start again and again along the line); the
    // hatching of an engraving, the edge of a page or a spine is much calmer than that
    const MIN_BUSY = 0.9, MIN_BUSY_WORDY = 0.45, WORDY = 10; // (a long line with many words may be a little calmer)
    let biggest = 0, out = [];
    for (const r in members) {
      const bl = members[r];
      if (bl.length < 3) continue;
      const busy = U().median(bl.map(function (l) { return l.busy === undefined ? 1 : l.busy; }));
      const wordy = U().median(bl.map(function (l) { return (l.words || []).length; })) >= WORDY;
      if (busy < (wordy ? MIN_BUSY_WORDY : MIN_BUSY)) { note.calm = (note.calm || 0) + bl.length; continue; }
      biggest = Math.max(biggest, bl.length);
      out = out.concat(bl);
    }
    note.biggest = biggest;
    if (biggest < 3 || out.length < 3) { note.why = "no block of regular, busy lines"; return []; }
    out.sort(function (p, q) { return p._ym - q._ym; });
    // Two bands sitting on top of each other (in about the same place, sharing their width) cannot both be lines of print: that is
    // what hatching, shading and stripes do. A few clashes are settled (the weaker band goes); where many bands clash it is not text.
    const involved = {}, drop = {}, strength = function (l) { return (l.busy === undefined ? 1 : l.busy) * (l.x1 - l.x0); };
    let nInvolved = 0;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const p = out[i], q = out[j];
        const a = Math.max(p.x0, q.x0), b = Math.min(p.x1, q.x1);
        if (b - a < 0.3 * Math.min(p.x1 - p.x0, q.x1 - q.x0)) continue;
        const xm = (a + b) / 2;
        if (Math.abs(yAt(q, xm) - yAt(p, xm)) < 0.72 * pitch) {
          if (!involved[i]) { involved[i] = 1; nInvolved++; } if (!involved[j]) { involved[j] = 1; nInvolved++; }
          drop[strength(p) < strength(q) ? i : j] = 1;
        }
      }
    }
    note.clash = nInvolved; note.kept = out.length;
    if (nInvolved >= 0.25 * out.length && nInvolved >= 3) { note.why = "bands sit on top of each other (hatching or stripes, not print)"; return []; }
    out = out.filter(function (l, i) { return !drop[i]; });
    if (out.length < 3) { note.why = "too few lines left"; return []; }
    // no band is taller than 1.2 line pitches (the local pitch: the gap to the nearest neighbours; lines are closer on the far side of an
    // oblique page), so a stroke never covers two lines
    const gapTo = function (p, q) {
      const a = Math.max(p.x0, q.x0), b = Math.min(p.x1, q.x1);
      if (b - a < 0.3 * Math.min(p.x1 - p.x0, q.x1 - q.x0)) return 0;
      return Math.abs(yAt(q, (a + b) / 2) - yAt(p, (a + b) / 2));
    };
    out.forEach(function (l, i) {
      const gs = [];
      [i - 1, i + 1].forEach(function (j) { if (out[j]) { const g = gapTo(l, out[j]); if (g >= 0.5 * pitch && g <= 1.8 * pitch) gs.push(g); } });
      const local = gs.length ? Math.min.apply(null, gs) : pitch, cap = 1.2 * local;
      if (l.height > cap) { // shrink it around its middle
        const f = cap / l.height, mid = (l.top + l.bottom) / 2;
        l.top = mid - (mid - l.top) * f; l.bottom = mid + (l.bottom - mid) * f; l.height = cap;
      }
    });
    out.forEach(function (l) { delete l._ym; });
    return out;
  }

  function toPageImage(data) {
    try {
      const c = U().createCanvas(data.width, data.height);
      const ctx = c.getContext("2d");
      ctx.putImageData(data, 0, 0);
      return c;
    } catch (e) {
      return data; // no canvas here (Node): the plain ImageData will do
    }
  }

  async function prepare(imageData) {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) throw U().error("unreadable");
    const t0 = U().now();
    const cleaned = UL.clean.run(imageData);
    const t1 = U().now();
    let info = analyse(cleaned.data, cleaned.map);
    // small print (or a page far away): the rows are too thin at 1000 px, so look again at a finer scale
    if (info.P > 0 && info.P < 13 && imageData.width > info.ww * 1.2) {
      const finer = analyse(cleaned.data, cleaned.map, Math.min(imageData.width, Math.round(info.ww * 18 / info.P)));
      if (finer.lines.length >= info.lines.length) info = finer;
    }
    const t2 = U().now();
    return {
      width: imageData.width, height: imageData.height,
      image: toPageImage(cleaned.data),
      lines: info.lines,
      warning: info.lines.length ? null : "no-lines",
      _data: cleaned.data, _paper: cleaned.paper, _map: cleaned.map,
      _debug: { mask: info.mask, ww: info.ww, wh: info.wh, k: info.k, theta: info.theta, P: info.P, strips: info.strips,
        cleanMs: t1 - t0, linesMs: t2 - t1, rawCount: info.rawCount, vet: info.vet,
        raw: (info.rawLines || []).map(function (l) { return { a: Math.round(l.a), slope: +l.slope.toFixed(3), x0: Math.round(l.x0), x1: Math.round(l.x1), h: Math.round(l.height), busy: +(l.busy || 0).toFixed(2), fill: +(l.fill || 0).toFixed(2), r: l.rhythm, kept: info.lines.indexOf(l) >= 0 }; }) }
    };
  }

  // ---------- snapping a swipe ----------

  function hashSeed() {
    let h = 2166136261;
    for (let i = 0; i < arguments.length; i++) {
      h ^= Math.round(arguments[i] * 7) | 0;
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  function tidyPoints(points) {
    const out = [];
    (points || []).forEach(function (p) { if (p && isFinite(p.x) && isFinite(p.y)) out.push({ x: +p.x, y: +p.y }); });
    return out;
  }

  function medianHeight(page) {
    const hs = (page.lines || []).map(function (l) { return l.height || (l.bottom - l.top); }).filter(function (v) { return v > 0; });
    return hs.length ? U().median(hs) : 0.035 * page.height;
  }

  // The swipe as it is: smoothed, straightened to its own average slope, at the typical line height.
  function rawStroke(page, points) {
    const pts = tidyPoints(points);
    const W = page.width, H = page.height;
    const height = medianHeight(page);
    if (!pts.length) {
      const x0 = 0.2 * W, x1 = 0.8 * W, y = 0.5 * H;
      return { x0: x0, x1: x1, y: y, height: height, slope: 0, snapped: false, seed: hashSeed(x0, x1, y) };
    }
    let xa = Infinity, xb = -Infinity, my = 0, mx = 0;
    pts.forEach(function (p) { if (p.x < xa) xa = p.x; if (p.x > xb) xb = p.x; mx += p.x; my += p.y; });
    mx /= pts.length; my /= pts.length;
    let sxx = 0, sxy = 0;
    pts.forEach(function (p) { sxx += (p.x - mx) * (p.x - mx); sxy += (p.x - mx) * (p.y - my); });
    let slope = sxx > 1e-6 ? sxy / sxx : 0;
    slope = U().clamp(slope, -0.7, 0.7);
    if (xb - xa < height * 1.5) { // a tap or a very short swipe: give it a sensible length
      const mid = (xa + xb) / 2, half = height * 2;
      xa = mid - half; xb = mid + half;
    }
    xa = Math.max(0, xa); xb = Math.min(W, xb);
    const xm = (xa + xb) / 2;
    const y = my + slope * (xm - mx);
    return { x0: xa, x1: xb, y: y, height: height, slope: slope, snapped: false, seed: hashSeed(xa, xb, y) };
  }

  function snap(page, points) {
    const pts = tidyPoints(points);
    const lines = page && page.lines ? page.lines : [];
    if (pts.length < 1 || !lines.length) return rawStroke(page, pts);

    let xa = Infinity, xb = -Infinity;
    pts.forEach(function (p) { if (p.x < xa) xa = p.x; if (p.x > xb) xb = p.x; });
    const lo = pts.length >= 5 ? Math.floor(pts.length * 0.2) : 0, hi = pts.length >= 5 ? Math.ceil(pts.length * 0.8) : pts.length;
    const mid = pts.slice(lo, hi);

    // the line whose band the middle of the swipe sits in (measured across the line)
    let best = null, bestScore = Infinity;
    lines.forEach(function (l) {
      const h = l.height || (l.bottom - l.top);
      if (xb < l.x0 - 0.5 * h || xa > l.x1 + 0.5 * h) return; // beside the print, not on it
      const cosT = 1 / Math.sqrt(1 + l.slope * l.slope);
      let sum = 0;
      mid.forEach(function (p) { sum += Math.abs(p.y - (l.a + l.slope * p.x)) * cosT; });
      const score = sum / mid.length / h;
      if (score < bestScore) { bestScore = score; best = l; }
    });
    if (!best || bestScore > 1.2) return rawStroke(page, pts);

    const l = best, h = l.height || (l.bottom - l.top);
    let sa = Math.max(xa, l.x0), sb = Math.min(xb, l.x1);
    const words = l.words && l.words.length ? l.words : [[l.x0, l.x1]];

    if (xb - xa < 0.8 * h) {
      // a tap: highlight the word under the finger
      const cx = (xa + xb) / 2;
      let wBest = words[0], dBest = Infinity;
      words.forEach(function (w) { const d = cx < w[0] ? w[0] - cx : (cx > w[1] ? cx - w[1] : 0); if (d < dBest) { dBest = d; wBest = w; } });
      sa = wBest[0]; sb = wBest[1];
    } else {
      // start: the word the start sits in is included when more than half of it is covered; in a gap, the next word
      let na = null, nb = null;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (xa <= w[1]) { na = (xa <= w[0]) ? w[0] : ((xa - w[0]) <= 0.5 * (w[1] - w[0]) ? w[0] : (i + 1 < words.length ? words[i + 1][0] : w[0])); break; }
      }
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        if (xb >= w[0]) { nb = (xb >= w[1]) ? w[1] : ((w[1] - xb) <= 0.5 * (w[1] - w[0]) ? w[1] : (i > 0 ? words[i - 1][1] : w[1])); break; }
      }
      if (na !== null) sa = Math.max(l.x0, na);
      if (nb !== null) sb = Math.min(l.x1, nb);
      if (sb - sa < 0.5 * h) { sa = Math.max(xa, l.x0); sb = Math.min(xb, l.x1); }
    }
    if (sb - sa < 1) { sa = l.x0; sb = l.x1; }

    const xm = (sa + sb) / 2;
    const y = l.a + l.slope * xm;
    return { x0: sa, x1: sb, y: y, height: h, slope: l.slope, snapped: true, seed: hashSeed(sa, sb, y), base: l.base };
  }

  UL.page = { prepare: prepare, snap: snap, rawStroke: rawStroke, _internals: { vetLines: vetLines, inkMask: inkMask, analyse: analyse, findBands: findBands, grayDown: grayDown } };
})();
