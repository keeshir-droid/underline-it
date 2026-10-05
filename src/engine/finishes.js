// The four finishes: the card around the page (PLAN.md section 5.5). Everything is drawn in code.
//
//   UL.finishes.get(id) -> finish { id, picRect(format), pieceCentre(format), tilt(format),
//                                  background(ctx, format), piece(ctx, format, drawPic, info), overlay(ctx, format, info) }
//   UL.finishes.box(format)   the safe content box {x, y, w, h, W, H} (story: y 270..1540, 90 px side margins)
//   UL.finishes.labelInfo(settings, date) -> { main, line, note, date }
//   UL.finishes.madeWith(ctx, x, y, color, size)   "made with underline-it.vercel.app", right aligned at (x, y), size 22 px (26 on story), 70%
//
// Everything is in "card units": the card is 1080 wide (1080 high for "square", 1920 high for "story"); the caller
// scales the context. background() is static (the card caches it); piece() draws the page piece (shadow, frame, the
// picture through drawPic(ctx, rect), decorations) and may be transformed by the caller (settle, tilt); overlay() draws
// the label, stamp and made-with mark in untransformed card space.
//
// Story safe zone: every finish keeps its page, tape, label and mark inside x 90..990, y 270..1540 (the tape and torn
// paper edge included), because Instagram's bars cover the rest.
//
// Nothing here touches document/window at load time.
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});
  const U = function () { return UL.util; };

  const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';
  const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  const HAND = '"Caveat","Segoe Print","Bradley Hand",cursive';
  const SITE = "underline-it.vercel.app";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // ---------- layout basics ----------
  function box(format) {
    return format === "story" ? { x: 90, y: 270, w: 900, h: 1270, W: 1080, H: 1920 } : { x: 60, y: 60, w: 960, h: 960, W: 1080, H: 1080 };
  }

  // How tall the page picture is, as a share of its full height (1 = full). The card shortens the paper when the printed text
  // is shorter than the picture window (Clean, Polaroid and Torn only), so the card never shows a patch of blank page.
  // The card sets it at the start of every drawFrame.
  const FIT = { square: 1, story: 1 };
  function setFit(format, k) { FIT[format === "story" ? "story" : "square"] = Math.max(0.5, Math.min(1, k || 1)); }
  function fitOf(format) { return FIT[format === "story" ? "story" : "square"]; }

  function labelInfo(settings, date) {
    const d = date || new Date();
    const dateStr = d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
    const title = (settings.title || "").trim(), page = (settings.page || "").toString().trim(), note = (settings.note || "").trim();
    const main = title ? (page ? title + " · p. " + page : title) : (page ? "p. " + page : "");
    return {
      main: main, note: note, date: d, dateStr: dateStr,
      line: [main, dateStr, "underline"].filter(Boolean).join(" · ")
    };
  }

  // ---------- drawing helpers ----------
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makeNoise(seed) {
    const r = U().mulberry32(seed), t = new Float32Array(256);
    for (let i = 0; i < 256; i++) t[i] = r() * 2 - 1;
    return function (u) {
      u = ((u % 256) + 256) % 256;
      const i = Math.floor(u), f = u - i, s = f * f * (3 - 2 * f);
      return t[i & 255] * (1 - s) + t[(i + 1) & 255] * s;
    };
  }

  // seeded grey noise, reused for film grain and paper grain (a canvas, made when first needed)
  let noiseCanvas = null;
  function noise() {
    if (noiseCanvas !== null) return noiseCanvas || null;
    try {
      const c = U().createCanvas(192, 192), x = c.getContext("2d"), img = x.createImageData(192, 192), r = U().mulberry32(3);
      for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 90; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0);
      noiseCanvas = c;
    } catch (e) { noiseCanvas = false; }
    return noiseCanvas || null;
  }
  function grainOver(ctx, x, y, w, h, op, alpha) { // texture over a rectangle
    const n = noise(); if (!n) return;
    ctx.save();
    ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha;
    ctx.fillStyle = ctx.createPattern(n, "repeat");
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // A static part of a finish (a shadowed sheet, paper grain, the tape) drawn once into an offscreen canvas by the card
  // (info.cache) and then just blitted every frame; without a card around, it is drawn directly.
  function layer(ctx, info, key, b, fn, op) {
    if (info && typeof info.cache === "function") {
      const e = info.cache(key, b, fn);
      if (e && e.c) {
        if (op) { ctx.save(); ctx.globalCompositeOperation = op; }
        ctx.drawImage(e.c, e.b.x, e.b.y, e.b.w, e.b.h);
        if (op) ctx.restore();
        return;
      }
    }
    ctx.save();
    if (op) ctx.globalCompositeOperation = op;
    fn(ctx);
    ctx.restore();
  }

  function fitText(ctx, text, maxW, size, minSize, fontOf) {
    let s = size;
    ctx.font = fontOf(s);
    while (s > minSize && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = fontOf(s); }
    return s;
  }

  function madeWith(ctx, x, y, color, size) {
    ctx.save();
    ctx.globalAlpha = 0.7; ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color || "#1c2433";
    ctx.font = (size || 22) + "px " + SANS;
    ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
    ctx.fillText("made with " + SITE, x, y);
    ctx.restore();
  }

  // ---------- seven-segment date stamp ----------
  const SEG = { // a b c d e f g
    "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg", "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg"
  };
  function sevenSeg(ctx, str, x, y, h, color) { // x = right edge, y = baseline; returns nothing
    const w = h * 0.56, t = h * 0.11, gap = h * 0.26;
    const chars = str.split("");
    let total = 0;
    chars.forEach(function (c) { total += (c === " " ? w * 0.6 : (c === "'" ? t * 2.2 : w)) + gap; });
    let cx = x - total + gap;
    ctx.save();
    ctx.fillStyle = color; ctx.shadowColor = "rgba(255,110,0,.85)"; ctx.shadowBlur = h * 0.35;
    ctx.transform(1, 0, -0.12, 1, 0.12 * y, 0); // a little slant
    chars.forEach(function (c) {
      if (c === " ") { cx += w * 0.6 + gap; return; }
      if (c === "'") { ctx.beginPath(); ctx.moveTo(cx, y - h); ctx.lineTo(cx + t * 1.6, y - h); ctx.lineTo(cx + t * 0.6, y - h * 0.8); ctx.closePath(); ctx.fill(); cx += t * 2.2 + gap; return; }
      const on = SEG[c] || "";
      const seg = {
        a: [0, 0, w, t], b: [w - t, 0, t, h / 2], c: [w - t, h / 2, t, h / 2], d: [0, h - t, w, t],
        e: [0, h / 2, t, h / 2], f: [0, 0, t, h / 2], g: [0, h / 2 - t / 2, w, t]
      };
      for (let i = 0; i < on.length; i++) { const s = seg[on[i]]; ctx.fillRect(cx + s[0], y - h + s[1], s[2], s[3]); }
      cx += w + gap;
    });
    ctx.restore();
  }

  // ---------- label block (note in handwriting, then the label line) ----------
  function labelBlock(ctx, info, cx, cy, maxW, o) {
    o = o || {};
    ctx.save();
    ctx.textBaseline = "middle"; ctx.textAlign = o.align || "center"; ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    const hasNote = !!info.note;
    const lineY = hasNote ? cy + 22 : cy;
    const sz = fitText(ctx, info.line, maxW, o.size || 28, 16, function (s) { return (o.italic ? "italic " : "") + s + "px " + SERIF; });
    ctx.fillStyle = o.color || "#1c2433";
    ctx.fillText(info.line, cx, lineY);
    if (hasNote) {
      fitText(ctx, info.note, maxW, o.noteSize || 44, 24, function (s) { return "600 " + s + "px " + HAND; });
      ctx.fillStyle = o.noteColor || o.color || "#1c2433";
      ctx.fillText(info.note, cx, cy - 22);
    }
    ctx.restore();
  }

  // ---------- CLEAN ----------
  const clean = (function () {
    function geo(format) {
      const b = box(format), labelH = format === "story" ? 170 : 130;
      const fullH = b.h - labelH, ph = fullH * fitOf(format);
      const piece = { x: b.x, y: b.y + (fullH - ph) / 2, w: b.w, h: ph };
      const pad = 22;
      return { b: b, labelH: labelH, piece: piece, pic: { x: piece.x + pad, y: piece.y + pad, w: piece.w - 2 * pad, h: piece.h - 2 * pad } };
    }
    return {
      id: "clean",
      picRect: function (format) { return geo(format).pic; },
      pieceCentre: function (format) { const g = geo(format); return { x: g.piece.x + g.piece.w / 2, y: g.piece.y + g.piece.h / 2 }; },
      tilt: function () { return 0; },
      background: function (ctx, format) {
        const b = box(format);
        ctx.fillStyle = "#f6f2ea"; ctx.fillRect(0, 0, b.W, b.H);
        const g = ctx.createRadialGradient(b.W / 2, b.H / 2, 100, b.W / 2, b.H / 2, b.H * 0.75);
        g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(220,205,180,.25)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, b.W, b.H);
        grainOver(ctx, 0, 0, b.W, b.H, "multiply", 0.05);
      },
      picClip: function (ctx, format) { const g = geo(format); rr(ctx, g.pic.x, g.pic.y, g.pic.w, g.pic.h, 16); ctx.clip(); },
      piece: function (ctx, format, drawPic, info) {
        const g = geo(format);
        layer(ctx, info, "card", { x: g.piece.x - 120, y: g.piece.y - 120, w: g.piece.w + 240, h: g.piece.h + 240 }, function (c) {
          c.shadowColor = "rgba(70,50,25,.24)"; c.shadowBlur = 44; c.shadowOffsetY = 16;
          c.fillStyle = "#fffdf8"; rr(c, g.piece.x, g.piece.y, g.piece.w, g.piece.h, 30); c.fill();
        });
        ctx.save();
        rr(ctx, g.pic.x, g.pic.y, g.pic.w, g.pic.h, 16); ctx.clip();
        drawPic(ctx, g.pic);
        ctx.restore();
        ctx.save(); ctx.strokeStyle = "rgba(60,45,25,.10)"; ctx.lineWidth = 1.5; rr(ctx, g.pic.x, g.pic.y, g.pic.w, g.pic.h, 16); ctx.stroke(); ctx.restore();
      },
      overlay: function (ctx, format, info, labelAlpha) {
        const g = geo(format);
        labelBlock(ctx, info, g.b.x + g.b.w / 2, g.piece.y + g.piece.h + 56, g.b.w - 40, { alpha: labelAlpha, color: "#1c2433", noteColor: "#2b3d63" });
        madeWith(ctx, g.b.x + g.b.w, g.b.y + g.b.h - 6, "#1c2433", format === "story" ? 26 : 22);
      }
    };
  })();

  // ---------- POLAROID ----------
  const polaroid = (function () {
    function geo(format) {
      const b = box(format);
      const side = 46, strip = side * 3.3;
      const fw = format === "story" ? 860 : 790;
      const pw = fw - 2 * side, ph = Math.round((format === "story" ? pw * 1.22 : pw * 0.93) * fitOf(format));
      const fh = side + ph + strip;
      const cx = b.x + b.w / 2, cy = b.y + (b.h - 50) / 2;
      const frame = { x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh };
      return { b: b, side: side, strip: strip, frame: frame, pic: { x: frame.x + side, y: frame.y + side, w: pw, h: ph }, cx: cx, cy: cy };
    }
    return {
      id: "polaroid",
      picRect: function (format) { return geo(format).pic; },
      pieceCentre: function (format) { const g = geo(format); return { x: g.cx, y: g.cy }; },
      tilt: function (format) { return (format === "story" ? 1.6 : -2) * Math.PI / 180; },
      background: function (ctx, format) {
        const b = box(format);
        ctx.fillStyle = "#e7e1d5"; ctx.fillRect(0, 0, b.W, b.H);
        const g = ctx.createRadialGradient(b.W / 2, b.H * 0.45, 80, b.W / 2, b.H / 2, b.H * 0.8);
        g.addColorStop(0, "rgba(255,252,244,.7)"); g.addColorStop(1, "rgba(150,135,110,.28)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, b.W, b.H);
        grainOver(ctx, 0, 0, b.W, b.H, "multiply", 0.06);
      },
      picClip: function (ctx, format) { const g = geo(format); ctx.beginPath(); ctx.rect(g.pic.x, g.pic.y, g.pic.w, g.pic.h); ctx.clip(); },
      piece: function (ctx, format, drawPic, info) {
        const g = geo(format), f = g.frame;
        layer(ctx, info, "frame", { x: f.x - 110, y: f.y - 110, w: f.w + 220, h: f.h + 220 }, function (c) {
          c.save();
          c.shadowColor = "rgba(50,35,15,.32)"; c.shadowBlur = 40; c.shadowOffsetY = 18; c.shadowOffsetX = 4;
          c.fillStyle = "#fdfcf8"; rr(c, f.x, f.y, f.w, f.h, 6); c.fill();
          c.restore();
          // a hint of the card's paper
          const pg = c.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.h);
          pg.addColorStop(0, "rgba(255,255,255,.0)"); pg.addColorStop(1, "rgba(200,185,150,.14)");
          c.fillStyle = pg; rr(c, f.x, f.y, f.w, f.h, 6); c.fill();
        });
        ctx.save(); ctx.beginPath(); ctx.rect(g.pic.x, g.pic.y, g.pic.w, g.pic.h); ctx.clip();
        drawPic(ctx, g.pic);
        // the picture sits slightly sunk into the frame
        const sh = ctx.createLinearGradient(0, g.pic.y, 0, g.pic.y + 18);
        sh.addColorStop(0, "rgba(0,0,0,.16)"); sh.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sh; ctx.fillRect(g.pic.x, g.pic.y, g.pic.w, 18);
        ctx.restore();
      },
      // The caption, in handwriting, on the strip (drawn by the card in the frame's own tilted space, after the picture, so
      // that it can fade in on its own). With no title, page or note the date is the caption and the small line
      // says only "underline" (the date is never printed twice).
      pieceLabel: function (ctx, format, info) {
        const g = geo(format), f = g.frame;
        ctx.save();
        const sy = g.pic.y + g.pic.h, mid = sy + g.strip / 2;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const dateIsCaption = !info.note && !info.main;
        const cap = info.note || info.main || info.dateStr;
        fitText(ctx, cap, f.w - 2 * g.side - 10, info.capAlphaSize || 58, 26, function (s) { return "600 " + s + "px " + HAND; });
        ctx.fillStyle = "#26365a"; ctx.globalAlpha = info.labelAlpha === undefined ? 1 : info.labelAlpha;
        ctx.fillText(cap, f.x + f.w / 2, mid - 12);
        const small = [info.note ? info.main : "", dateIsCaption ? "" : info.dateStr, "underline"].filter(Boolean).join(" · ");
        fitText(ctx, small, f.w - 2 * g.side, 22, 14, function (s) { return s + "px " + SANS; });
        ctx.fillStyle = "#6b6a64";
        ctx.fillText(small, f.x + f.w / 2, mid + 34);
        ctx.restore();
      },
      overlay: function (ctx, format) {
        const g = geo(format);
        madeWith(ctx, g.b.x + g.b.w, g.b.y + g.b.h - 6, "#3b3326", format === "story" ? 26 : 22);
      }
    };
  })();

  // ---------- FILM ----------
  // Square: the page full-bleed with a solid dark label strip along the bottom. Story: the same thing as a framed print (a dark
  // film-negative border with a little edge print) kept inside the safe zone. Label, date stamp and made-with mark all sit on the
  // dark strip, never over the page text.
  const film = (function () {
    const INK = "#14100b";
    function geo(format) {
      const b = box(format);
      if (format === "story") {
        const side = 26, top = 46, stripH = 172;
        return { b: b, story: true, side: side, stripH: stripH, stripY: b.y + b.h - stripH,
          frame: { x: b.x, y: b.y, w: b.w, h: b.h }, pic: { x: b.x + side, y: b.y + top, w: b.w - 2 * side, h: b.h - top - stripH } };
      }
      const stripH = 128;
      return { b: b, story: false, side: 0, stripH: stripH, stripY: b.H - stripH, frame: { x: 0, y: 0, w: b.W, h: b.H }, pic: { x: 0, y: 0, w: b.W, h: b.H - stripH } };
    }
    function spaced(ctx, text, x, y, gap, align) { // tiny letter-spaced text (ctx.letterSpacing is not everywhere)
      let w = 0; for (let i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + gap; w -= gap;
      let cx = align === "right" ? x - w : x;
      ctx.textAlign = "left";
      for (let i = 0; i < text.length; i++) { ctx.fillText(text[i], cx, y); cx += ctx.measureText(text[i]).width + gap; }
      return w;
    }
    // soft falloff: a gaussian-ish ramp as gradient stops, so nothing has a visible edge
    function softStops(grad, rgb, peak, n) {
      for (let i = 0; i <= n; i++) { const t = i / n; grad.addColorStop(t, "rgba(" + rgb + "," + (peak * Math.exp(-3.4 * t * t)).toFixed(4) + ")"); }
    }
    return {
      id: "film",
      picRect: function (format) { return geo(format).pic; },
      pieceCentre: function (format) { const g = geo(format); return { x: g.pic.x + g.pic.w / 2, y: g.pic.y + g.pic.h / 2 }; },
      tilt: function () { return 0; },
      background: function (ctx, format) {
        const b = box(format);
        ctx.fillStyle = INK; ctx.fillRect(0, 0, b.W, b.H);
        grainOver(ctx, 0, 0, b.W, b.H, "screen", 0.05);
      },
      piece: function (ctx, format, drawPic) {
        const g = geo(format), r = g.pic;
        ctx.save();
        if (g.story) rr(ctx, r.x, r.y, r.w, r.h, 6); else { ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); }
        ctx.clip();
        ctx.fillStyle = "#f5eedd"; ctx.fillRect(r.x, r.y, r.w, r.h);
        drawPic(ctx, r);
        // warm fade: lifted blacks, warm highlights
        ctx.globalCompositeOperation = "lighten"; ctx.fillStyle = "#2c2016"; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = 0.5; ctx.fillStyle = "#ffb55c"; ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.globalAlpha = 1;
        // soft corner darkening (no hard circle): an ellipse that touches the corners, eased
        ctx.globalCompositeOperation = "multiply";
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(r.w * 0.5, r.h * 0.5);
        let lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.42);
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, e = Math.max(0, (t - 0.5) / 0.5), k = e * e * (3 - 2 * e), a = 0.34 * k; // 0 .. 0.34 (eased in from 50% of the way out)
          const q = a / 0.34 * 0.7;                                                              // 30% gentler than before: the outer lines stay readable
          lg.addColorStop(t, "rgba(" + Math.round(255 - 120 * q) + "," + Math.round(255 - 150 * q) + "," + Math.round(255 - 175 * q) + ",1)");
        }
        ctx.fillStyle = lg; ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
        // one gentle warm light leak, spilling in from the top-right corner
        ctx.globalCompositeOperation = "screen";
        ctx.save();
        ctx.translate(r.x + r.w * 1.0, r.y + r.h * 0.0); ctx.scale(r.w * 0.8, r.h * 0.46);
        lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        softStops(lg, "255,120,40", 0.62, 12);
        ctx.fillStyle = lg; ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
        ctx.save(); // a fainter, redder streak down that edge
        ctx.translate(r.x + r.w, r.y + r.h * 0.3); ctx.scale(r.w * 0.2, r.h * 0.4);
        lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        softStops(lg, "255,70,45", 0.26, 10);
        ctx.fillStyle = lg; ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
        ctx.globalCompositeOperation = "source-over";
        grainOver(ctx, r.x, r.y, r.w, r.h, "overlay", 0.5);
        ctx.restore();
      },
      overlay: function (ctx, format, info, labelAlpha) {
        const g = geo(format), b = g.b, f = g.frame, r = g.pic, story = g.story;
        // the dark border and label strip, in one piece with a hole for the picture
        ctx.save();
        ctx.fillStyle = INK;
        if (story) {
          ctx.beginPath();
          rr(ctx, f.x, f.y, f.w, f.h, 18);
          ctx.moveTo(r.x + 6, r.y); ctx.arcTo(r.x, r.y, r.x, r.y + r.h, 6); ctx.arcTo(r.x, r.y + r.h, r.x + r.w, r.y + r.h, 6);
          ctx.arcTo(r.x + r.w, r.y + r.h, r.x + r.w, r.y, 6); ctx.arcTo(r.x + r.w, r.y, r.x, r.y, 6); ctx.closePath();
          ctx.fill("evenodd");
          ctx.strokeStyle = "rgba(255,214,160,.14)"; ctx.lineWidth = 1.5; rr(ctx, f.x + 0.75, f.y + 0.75, f.w - 1.5, f.h - 1.5, 17.5); ctx.stroke();
          // edge print, like the numbers along the rebate of a negative
          ctx.fillStyle = "rgba(255,150,50,.82)"; ctx.font = "600 15px " + SANS; ctx.textBaseline = "middle";
          const ey = f.y + (r.y - f.y) / 2 + 1;
          spaced(ctx, "UNDERLINE 400", r.x + 6, ey, 3.2, "left");
          const wr = spaced(ctx, "12A", r.x + r.w - 6, ey, 3.2, "right");
          const tx = r.x + r.w - 6 - wr - 12;
          ctx.beginPath(); ctx.moveTo(tx - 12, ey - 6); ctx.lineTo(tx, ey); ctx.lineTo(tx - 12, ey + 6); ctx.closePath(); ctx.fill();
        } else {
          ctx.fillRect(0, g.stripY, b.W, g.stripH);
        }
        ctx.restore();
        // the strip: label on the left; date stamp and made-with mark on the right
        const x0 = story ? r.x + 16 : b.x, x1 = story ? r.x + r.w - 16 : b.x + b.w;
        const sy = g.stripY, sh = g.stripH, stampH = story ? 38 : 30;
        const d = info.date, yy = String(d.getFullYear()).slice(2);
        const stampW = stampH * 0.56 * 8 + stampH * 0.26 * 8 + 20;
        labelBlock(ctx, info, x0, sy + sh / 2 + (story ? -14 : -4), Math.min(560, x1 - x0 - stampW - 24), { align: "left", alpha: labelAlpha, size: story ? 27 : 26, color: "#f3e7cf", noteColor: "#f8d9a8", noteSize: story ? 44 : 38 });
        const two = function (n) { return (n < 10 ? "0" : "") + n; };
        sevenSeg(ctx, yy + " " + two(d.getMonth() + 1) + " " + two(d.getDate()), x1, sy + (story ? 66 : 52), stampH, "#ff8a1f");
        madeWith(ctx, x1, sy + sh - (story ? 28 : 26), "#f3e7cf", story ? 26 : 22);
      }
    };
  })();

  // ---------- TORN PAGE ----------
  const torn = (function () {
    function geo(format) {
      const b = box(format), story = format === "story", labelH = story ? 150 : 160;
      // story: the sheet is kept 16 px inside the safe box on the sides (the 0.9 degree tilt would otherwise push a corner out)
      const inX = story ? 16 : 0, top = story ? 48 : 34;
      const fullH = b.h - labelH - top, ph = fullH * fitOf(format);
      const piece = { x: b.x + inX, y: b.y + top + (fullH - ph) / 2, w: b.w - 2 * inX, h: ph };
      return { b: b, labelH: labelH, piece: piece, pic: { x: piece.x, y: piece.y + 12, w: piece.w, h: piece.h - 24 } };
    }
    // torn top and bottom edges: low-frequency tear plus small jag, deterministic per format
    function edges(g, format, inset) {
      const nA = makeNoise(format === "story" ? 41 : 17), nB = makeNoise(format === "story" ? 88 : 53), nC = makeNoise(7), nD = makeNoise(19);
      const top = [], bot = [];
      const p = g.piece, step = 7;
      for (let x = p.x; x <= p.x + p.w + 0.1; x += step) {
        const u = (x - p.x);
        top.push([x, p.y + inset + 9 * nA(u / 70) + 6 * nB(u / 17) + 2.5 * nC(u / 5)]);
        bot.push([x, p.y + p.h - inset + 9 * nD(u / 80 + 5) + 6 * nA(u / 15 + 9) + 2.5 * nB(u / 4 + 3)]);
      }
      return { top: top, bot: bot };
    }
    const edgeMemo = {};
    function edgesFor(format) { // the same two tears every frame: made once per format (and paper height)
      const key = format + "|" + fitOf(format).toFixed(3);
      if (!edgeMemo[key]) { const g = geo(format); edgeMemo[key] = { outer: edges(g, format, 0), inner: edges(g, format, 11) }; }
      return edgeMemo[key];
    }
    function pathOf(ctx, e, rough) {
      ctx.beginPath();
      e.top.forEach(function (pt, i) { if (i === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); });
      for (let i = e.bot.length - 1; i >= 0; i--) ctx.lineTo(e.bot[i][0], e.bot[i][1]);
      ctx.closePath();
    }
    return {
      id: "torn",
      picRect: function (format) { return geo(format).pic; },
      pieceCentre: function (format) { const g = geo(format); return { x: g.piece.x + g.piece.w / 2, y: g.piece.y + g.piece.h / 2 }; },
      tilt: function (format) { return (format === "story" ? 0.9 : -1.2) * Math.PI / 180; },
      background: function (ctx, format) {
        // linen: a woven grid of fine threads on a warm grey-beige
        const b = box(format), r = U().mulberry32(11);
        ctx.fillStyle = "#d8cebd"; ctx.fillRect(0, 0, b.W, b.H);
        for (let y = 0; y < b.H; y += 3) {
          for (let seg = 0; seg < b.W; seg += 60) {
            const dark = r() < 0.5;
            ctx.strokeStyle = dark ? "rgba(90,70,45," + (0.04 + 0.08 * r()) + ")" : "rgba(255,250,238," + (0.06 + 0.12 * r()) + ")";
            ctx.lineWidth = 1 + r();
            ctx.beginPath(); ctx.moveTo(seg + r() * 8, y + r()); ctx.lineTo(seg + 40 + r() * 30, y + r()); ctx.stroke();
          }
        }
        for (let x = 0; x < b.W; x += 3) {
          for (let seg = 0; seg < b.H; seg += 60) {
            const dark = r() < 0.5;
            ctx.strokeStyle = dark ? "rgba(90,70,45," + (0.04 + 0.07 * r()) + ")" : "rgba(255,250,238," + (0.05 + 0.1 * r()) + ")";
            ctx.lineWidth = 1 + r();
            ctx.beginPath(); ctx.moveTo(x + r(), seg + r() * 8); ctx.lineTo(x + r(), seg + 40 + r() * 30); ctx.stroke();
          }
        }
        grainOver(ctx, 0, 0, b.W, b.H, "multiply", 0.10);
        const v = ctx.createRadialGradient(b.W / 2, b.H / 2, b.W * 0.3, b.W / 2, b.H / 2, b.H * 0.75);
        v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(60,40,20,.28)");
        ctx.fillStyle = v; ctx.fillRect(0, 0, b.W, b.H);
      },
      picClip: function (ctx, format) { pathOf(ctx, edgesFor(format).inner); ctx.clip(); },
      piece: function (ctx, format, drawPic, info) {
        const g = geo(format), p = g.piece, E = edgesFor(format), outer = E.outer, inner = E.inner;
        // the sheet (with its pale torn fibre rim) and its shadow
        layer(ctx, info, "sheet", { x: p.x - 80, y: p.y - 80, w: p.w + 160, h: p.h + 160 }, function (c) {
          c.save();
          c.shadowColor = "rgba(50,35,15,.38)"; c.shadowBlur = 36; c.shadowOffsetY = 14;
          c.fillStyle = "#fbf6ea"; pathOf(c, outer); c.fill();
          c.restore();
          // fibres: a slightly darker ragged line just inside the rim
          c.strokeStyle = "rgba(190,170,130,.55)"; c.lineWidth = 1.5;
          [outer.top, outer.bot].forEach(function (e) { c.beginPath(); e.forEach(function (pt, i) { if (i === 0) c.moveTo(pt[0], pt[1] + (e === outer.top ? 4 : -4)); else c.lineTo(pt[0], pt[1] + (e === outer.top ? 4 : -4)); }); c.stroke(); });
        });
        // the picture inside the rim
        ctx.save(); pathOf(ctx, inner); ctx.clip();
        drawPic(ctx, g.pic);
        ctx.restore();
        // paper tooth over the whole sheet (a multiply layer)
        layer(ctx, info, "tooth", { x: p.x - 10, y: p.y - 30, w: p.w + 20, h: p.h + 60 }, function (c) {
          pathOf(c, outer); c.clip(); grainOver(c, p.x, p.y - 20, p.w, p.h + 40, "source-over", 0.07);
        }, "multiply");
        // washi tape holding the sheet: laid mostly on the linen above the top edge, so only the blank paper rim is covered and
        // never a word of print. It stays inside the story safe zone (y >= 270).
        const tcx = p.x + 120, tcy = p.y - 6;
        layer(ctx, info, "tape", { x: tcx - 130, y: tcy - 130, w: 260, h: 260 }, function (c) {
          c.translate(tcx, tcy); c.rotate(-5 * Math.PI / 180);
          const tw = 190, th = 46;
          c.shadowColor = "rgba(40,25,10,.25)"; c.shadowBlur = 8; c.shadowOffsetY = 3;
          c.fillStyle = "rgba(236,170,150,.86)";
          c.beginPath();
          c.moveTo(-tw / 2, -th / 2);
          for (let y = -th / 2; y <= th / 2; y += 6) c.lineTo(-tw / 2 + (Math.floor((y + th / 2) / 6) % 2 ? 4 : 0), y);
          c.lineTo(-tw / 2, th / 2); c.lineTo(tw / 2, th / 2);
          for (let y = th / 2; y >= -th / 2; y -= 6) c.lineTo(tw / 2 - (Math.floor((y + th / 2) / 6) % 2 ? 4 : 0), y);
          c.closePath(); c.fill();
          c.shadowColor = "transparent";
          c.save(); c.clip();
          c.strokeStyle = "rgba(255,255,255,.38)"; c.lineWidth = 7;
          for (let x = -tw; x < tw; x += 22) { c.beginPath(); c.moveTo(x, th); c.lineTo(x + th, -th); c.stroke(); }
          c.restore();
        });
      },
      overlay: function (ctx, format, info, labelAlpha) {
        const g = geo(format), b = g.b;
        labelBlock(ctx, info, b.x + b.w / 2, g.piece.y + g.piece.h + 62, b.w - 30, { alpha: labelAlpha, color: "#3a2f24", noteColor: "#4a3b6a" });
        madeWith(ctx, b.x + b.w, b.y + b.h - 4, "#2e251b", format === "story" ? 26 : 22);
      }
    };
  })();

  const ALL = { clean: clean, polaroid: polaroid, film: film, torn: torn };
  function get(id) { return ALL[id] || ALL.torn; }

  UL.finishes = { get: get, box: box, setFit: setFit, fitOf: fitOf, labelInfo: labelInfo, madeWith: madeWith, SERIF: SERIF, SANS: SANS, HAND: HAND, _rr: rr };
})();
