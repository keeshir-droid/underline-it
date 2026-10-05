// Small shared helpers and the constants of Underline's engine.
// Copied from Day 3 (doodle-alive/src/engine/util.js), namespace DA -> UL, trimmed.
// No browser features are touched at load time, so this runs in Node too.
//
//   UL.util.error(code, overrides?)      -> Error carrying {code, title, detail} (throw it)
//   UL.util.errorInfo(code, overrides?)  -> plain {code, title, detail} (put it in a result)
//   UL.util.median / percentile / clamp / lerp / smoothstep / mulberry32 / now / hexToRgb
//   UL.util.makeImageData(w, h, data)    -> an ImageData (or a look-alike object in Node)
//   UL.util.createCanvas(w, h)           -> a canvas (browser only, called at run time)
//   UL.util.boxBlur(src, w, h, r, passes)-> blurred Float32Array
//
// Constants (PLAN.md section 7.3): UL.MARKS, UL.COLOURS, UL.FINISHES, UL.DEFAULTS, UL.END
(function () {
  const UL = (globalThis.UL = globalThis.UL || {});

  // ---------- constants ----------
  UL.MARKS = ["highlighter", "underline"];
  UL.COLOURS = [
    { id: "yellow", hex: "#ffe45c" },
    { id: "pink", hex: "#ff9ec7" },
    { id: "green", hex: "#a8f07a" },
    { id: "blue", hex: "#8fd3ff" }
  ];
  UL.FINISHES = [
    { id: "clean", name: "Clean" },
    { id: "polaroid", name: "Polaroid" },
    { id: "film", name: "Film" },
    { id: "torn", name: "Torn page" }
  ];
  UL.DEFAULTS = { mark: "highlighter", colour: "yellow", finish: "torn", fade: true, title: "", page: "", note: "" };
  UL.END = 5.0;

  // ---------- friendly messages ----------
  const MESSAGES = {
    "not-image": { title: "That doesn’t look like a photo.", detail: "Choose a picture (a JPG or PNG), or take a new photo." },
    "heic": { title: "Your phone saved this in a format I can’t read.", detail: "Take a screenshot of it and use that." },
    "unreadable": { title: "I couldn’t open that picture.", detail: "Try a different photo, or take a screenshot of it and use that." },
    "no-lines": { title: "I couldn’t find the lines of print.", detail: "You can still swipe: the highlight will go where your finger goes." },
    "video-unsupported": { title: "This browser can’t make videos.", detail: "You can still save your page as a picture." },
    "cancelled": { title: "Cancelled.", detail: "" },
    "export-failed": { title: "That didn’t work.", detail: "Please try again. You can still save the picture." }
  };

  function errorInfo(code, overrides) {
    const m = MESSAGES[code] || { title: "Something went wrong.", detail: "Please try again." };
    const o = overrides || {};
    return { code: code, title: o.title || m.title, detail: o.detail || m.detail };
  }
  function makeError(code, overrides) {
    const info = errorInfo(code, overrides);
    const e = new Error(info.title);
    e.code = info.code; e.title = info.title; e.detail = info.detail;
    return e;
  }

  // ---------- numbers ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = t < 0 ? 0 : (t > 1 ? 1 : t); return t * t * (3 - 2 * t); }
  function median(arr) {
    if (!arr.length) return 0;
    const a = Array.prototype.slice.call(arr).sort(function (x, y) { return x - y; });
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function percentile(arr, p) {
    if (!arr.length) return 0;
    const a = Array.prototype.slice.call(arr).sort(function (x, y) { return x - y; });
    return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))];
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function now() {
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }
  function hexToRgb(hex) {
    const h = String(hex).replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16) || 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // ---------- images and canvases (only touched when called) ----------
  function makeImageData(w, h, data) {
    if (typeof ImageData !== "undefined") {
      try { return new ImageData(data, w, h); } catch (e) { /* fall through */ }
    }
    return { width: w, height: h, data: data, colorSpace: "srgb" };
  }
  function createCanvas(w, h) {
    if (typeof document !== "undefined" && document.createElement) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      return c;
    }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    throw new Error("No canvas available here");
  }

  // Separable box blur of a Float32 field, edge pixels repeated outwards. Returns a new array.
  function boxBlur(src, w, h, r, passes) {
    passes = passes || 1;
    const inv = 1 / (2 * r + 1);
    let cur = src;
    const tmp = new Float32Array(w * h);
    const colSum = new Float64Array(w);
    for (let p = 0; p < passes; p++) {
      const out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) { // horizontal
        const row = y * w, last = row + w - 1;
        let sum = cur[row] * (r + 1);
        for (let i = 1; i <= r; i++) sum += cur[row + (i < w ? i : w - 1)];
        for (let x = 0; x < w; x++) {
          tmp[row + x] = sum * inv;
          const add = x + r + 1, rem = x - r;
          sum += cur[add < w ? row + add : last] - cur[rem > 0 ? row + rem : row];
        }
      }
      // vertical: a running sum of whole rows
      for (let x = 0; x < w; x++) colSum[x] = tmp[x] * (r + 1);
      for (let i = 1; i <= r; i++) { const o = (i < h ? i : h - 1) * w; for (let x = 0; x < w; x++) colSum[x] += tmp[o + x]; }
      for (let y = 0; y < h; y++) {
        const o = y * w, addRow = (y + r + 1 < h ? y + r + 1 : h - 1) * w, remRow = (y - r > 0 ? y - r : 0) * w;
        for (let x = 0; x < w; x++) {
          const s = colSum[x];
          out[o + x] = s * inv;
          colSum[x] = s + tmp[addRow + x] - tmp[remRow + x];
        }
      }
      cur = out;
    }
    return cur;
  }

  UL.util = {
    error: makeError, errorInfo: errorInfo, MESSAGES: MESSAGES,
    clamp: clamp, lerp: lerp, smoothstep: smoothstep, median: median, percentile: percentile,
    mulberry32: mulberry32, now: now, hexToRgb: hexToRgb,
    makeImageData: makeImageData, createCanvas: createCanvas, boxBlur: boxBlur
  };
})();
