// The built-in sample: a page of Jane Eyre (public domain), typeset in code and "photographed" (a slight tilt, warm lamp light,
// a soft shadow), then prepared exactly like a real photo. It has one preset stroke on "I am no bird; and no net ensnares me".
//
//   UL.sample.load() -> Promise<{ page, strokes, settings }>
//     page      a prepared Page (UL.page.prepare), strokes = [Stroke], settings = { finish: "torn", title: "Jane Eyre", page: "252" }
//   UL.sample.settings   the same settings object
//
// Browser only at run time (it needs a canvas); loading the file does nothing.
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});

  const PARAS = [
    "“I tell you I must go!” I retorted, roused to something like passion. “Do you think I can stay to become nothing to you? Do you think I am an automaton?—a machine without feelings, and can bear to have my morsel of bread snatched from my lips, and my drop of living water dashed from my cup? Do you think, because I am poor, obscure, plain, and little, I am soulless and heartless? You think wrong!—I have as much soul as you,—and full as much heart!",
    "“I am no bird; and no net ensnares me: I am a free human being with an independent will, which I now exert to leave you.”",
    "“And my will shall decide your destiny,” he said: “I offer you my hand, my heart, and a share of all my possessions.”",
    "“You play a farce, which I merely laugh at.” “I ask you to pass through life at my side—to be my second self, and best earthly companion.”",
    "“For that fate you have already made your choice, and must abide by it.” “Jane, be still; don’t struggle so, like a wild frantic bird that is rending its own plumage in its desperation.”"
  ];
  const TARGET = "I am no bird; and no net ensnares me";
  const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif';
  const settings = { finish: "torn", title: "Jane Eyre", page: "252" };

  function wrap(ctx, text, maxW, firstIndent) {
    const words = text.split(" "), lines = []; let cur = "", w0 = maxW - firstIndent;
    words.forEach(function (w) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > (lines.length ? maxW : w0) && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function typeset() {
    const W = 1200, H = 1650, U = UL.util;
    const flat = U.createCanvas(W, H), f = flat.getContext("2d");
    f.fillStyle = "#f4eddc"; f.fillRect(0, 0, W, H);
    const size = 37, pitch = 57, mx = 135, indent = 46, colW = W - 2 * mx;
    f.fillStyle = "#1e1b18"; f.textBaseline = "alphabetic";
    f.font = size + "px " + SERIF;
    // running head and chapter
    f.font = "italic " + (size * 0.68) + "px " + SERIF; f.fillText("JANE EYRE", W / 2 - 60, 110);
    f.font = size + "px " + SERIF;
    let y = 215, target = null;
    PARAS.forEach(function (para, pi) {
      const lines = wrap(f, para, colW, indent);
      lines.forEach(function (ln, i) {
        const x0 = mx + (i === 0 ? indent : 0), avail = colW - (i === 0 ? indent : 0), last = i === lines.length - 1;
        const words = ln.split(" ");
        let gap = f.measureText(" ").width;
        if (!last && words.length > 1) {
          const total = words.reduce(function (s, w) { return s + f.measureText(w).width; }, 0);
          gap = (avail - total) / (words.length - 1);
        }
        let x = x0;
        const pos = [];
        words.forEach(function (w) { f.fillText(w, x, y); pos.push([x, x + f.measureText(w).width]); x += f.measureText(w).width + gap; });
        if (pi === 1 && i === 0) { // the target phrase: the first nine words, "I am no bird; ... ensnares me:"
          const first = /^“?I$/.test(words[0]) ? 0 : -1;
          if (first === 0 && words.length >= 9) target = { xa: pos[0][0] + 1, xb: pos[8][1], y: y - size * 0.3 };
        }
        y += pitch;
      });
      y += 4;
    });
    f.font = size * 0.8 + "px " + SERIF; f.fillText("252", W / 2 - 18, H - 110);
    return { flat: flat, W: W, H: H, target: target };
  }

  function photograph(flat, W, H) {
    const U = UL.util, out = U.createCanvas(W, H), x = out.getContext("2d");
    const ang = -1.3 * Math.PI / 180;
    x.fillStyle = "#e9e0cc"; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W / 2, H / 2); x.rotate(ang); x.scale(1.05, 1.05); x.translate(-W / 2, -H / 2);
    x.drawImage(flat, 0, 0); x.restore();
    // warm lamp cast, a soft shadow along the left, a darker corner
    x.globalCompositeOperation = "multiply";
    let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "rgb(255,238,190)"); g.addColorStop(1, "rgb(255,222,168)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createLinearGradient(0, 0, W * 0.5, 0); g.addColorStop(0, "rgb(190,176,160)"); g.addColorStop(1, "rgb(255,255,255)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(W * 0.75, H * 0.3, 80, W * 0.75, H * 0.3, H * 0.9); g.addColorStop(0, "rgb(255,255,255)"); g.addColorStop(1, "rgb(210,196,176)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = "source-over";
    return { canvas: out, ang: ang };
  }

  async function load() {
    const U = UL.util;
    const t = typeset();
    const ph = photograph(t.flat, t.W, t.H);
    const img = ph.canvas.getContext("2d").getImageData(0, 0, t.W, t.H);
    const page = await UL.page.prepare(img);
    // where the target phrase ended up after the "photograph" (rotated 1.05 x about the centre)
    function fwd(px, py) {
      const dx = (px - t.W / 2) * 1.05, dy = (py - t.H / 2) * 1.05, c = Math.cos(ph.ang), s = Math.sin(ph.ang);
      return { x: dx * c - dy * s + t.W / 2, y: dx * s + dy * c + t.H / 2 };
    }
    let strokes = [];
    if (t.target) {
      const a = fwd(t.target.xa + 6, t.target.y), b = fwd(t.target.xb - 6, t.target.y);
      const pts = [];
      for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + Math.sin(k * 5) * 2 }); }
      strokes = [UL.page.snap(page, pts)];
    }
    void U;
    return { page: page, strokes: strokes, settings: Object.assign({}, settings) };
  }

  UL.sample = { load: load, settings: settings };
})();
