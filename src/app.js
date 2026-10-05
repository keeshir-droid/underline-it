/* Underline: screens, state and wiring.
   The engine (src/engine/) is used only through the names in PLAN.md section 7.3.
   Flow: snap -> the page appears -> swipe the line -> make it yours -> save or share. */

// The name in the footer ("More from ...").
const MAKER_NAME = "Risheek";

// Sibling projects shown in the footer. icon: "aa" | "doodle".
const SIBLINGS = [
  { name: "Handwriting → Font", url: "https://handwriting-font-converter.vercel.app", blurb: "Type in your own handwriting.", icon: "aa" },
  { name: "Doodle Alive", url: "https://doodle-alive.vercel.app", blurb: "Snap a doodle, watch it come alive.", icon: "doodle" }
];

(function () {
  "use strict";

  var W = window;
  var D = document;
  var U = W.UL || {};

  /* ---------- tiny helpers ---------- */

  function $(id) { return D.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }
  function dpr() { return Math.min(W.devicePixelRatio || 1, 2); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function buzz() { try { if (W.navigator && W.navigator.vibrate) W.navigator.vibrate(8); } catch (e) { /* ignore */ } }   // a tiny tick where phones allow it
  function warn() { if (W.console && console.warn) console.warn.apply(console, arguments); }
  function reduceMotion() {
    try { return !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  function idsOf(list) {
    return (Array.isArray(list) ? list : []).map(function (x) { return typeof x === "string" ? x : x && x.id; });
  }
  function capital(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- icons (inline SVG) ---------- */

  var ICONS = {
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    clear: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2.2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    book: '<path d="M6 3.5h11a2 2 0 0 1 2 2V20H8a2 2 0 0 1-2-2z"/><path d="M6 18a2 2 0 0 1 2-2h11"/><path d="M10 8h5"/>',
    pen: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
  }
  var MARK_SVG = {
    highlighter: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2.5" y="7" width="19" height="10" rx="2.5" fill="#ffe45c" stroke="#c9a800" stroke-width="1.5"/><path d="M6.5 12h6" stroke="#1c2433" stroke-width="2" stroke-linecap="round"/></svg>',
    underline: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M6 5v8M12 5v8M18 5v8" stroke="#1c2433" stroke-width="2.4" stroke-linecap="round"/><path d="M3 19c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0" stroke="#1f3a5f" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  var SIB_SVG = {
    aa: "Aa",
    doodle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 16c2-5 4-5 5-1s3 3 4-2 3-6 4-2 2 5 3 3"/><path d="M19 4l.8 1.8L21.6 6.6 19.8 7.4 19 9.2 18.2 7.4 16.4 6.6 18.2 5.8z"/></svg>'
  };

  /* ---------- the engine must be there ---------- */

  var NEEDED = [
    "MARKS", "COLOURS", "FINISHES", "DEFAULTS", "END",
    "decode.fileToImageData", "page.prepare", "page.snap", "sample.load",
    "card.create", "card.startPreview", "card.drawEditor",
    "export.makeImage", "export.makeVideo",
    "share.platform", "share.canShare", "share.share", "share.save"
  ];
  function missingParts() {
    return NEEDED.filter(function (path) {
      var o = U;
      var keys = path.split(".");
      for (var i = 0; i < keys.length; i += 1) {
        if (o == null || o[keys[i]] == null) return true;
        o = o[keys[i]];
      }
      return false;
    });
  }
  var missing = missingParts();
  var engineOk = missing.length === 0;
  if (!engineOk) warn("Underline: engine parts missing:", missing.join(", "));

  /* ---------- address shortcuts (PLAN.md section 7.4) ---------- */

  var Q = new URLSearchParams(location.search);
  var devScreen = Q.get("screen");
  var devT = null;
  if (Q.has("t")) {
    var tt = parseFloat(Q.get("t"));
    if (isFinite(tt)) devT = tt;
  }
  var devFormat = Q.get("format") === "story" ? "story" : "square";
  var SAMPLE_SCREENS = ["editor", "style", "making", "done", "error-video", "error-no-lines"];

  /* ---------- saved preferences: last mark, colour, finish, fade; album tip seen. Nothing else. ---------- */

  var PREF_KEY = "underline.v1";
  var prefs = {};
  function loadPrefs() {
    try {
      var raw = W.localStorage.getItem(PREF_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") prefs = o;
      }
    } catch (e) { /* the site works without it */ }
  }
  function savePrefs() {
    try { W.localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  /* ---------- state ---------- */

  var S = {
    screen: "landing",
    screenName: "landing",
    settings: null,
    page: null,
    strokes: [],
    card: null,
    preview: null,
    job: 0,
    queue: Promise.resolve(),
    // the swipe
    drag: null,
    live: null,
    snapAnim: null,
    kbLine: -1,
    hintOn: true,
    hintSeen: false,
    lineH: 0,
    warnNoLines: false,
    drawQueued: false,
    // outputs
    imageFile: null,
    imageToken: 0,
    imageFailed: false,
    imageTimer: 0,
    imagePromise: null,
    videoFile: null,
    videoToken: 0,
    ctrl: null,
    makeState: "making",   // making | ready
    videoShareFailed: false,
    devHold: false,
    returnTo: "style",
    doneUrl: null,
    photoUrl: null,
    fromSample: false,
    support: null,
    forceAlbumTip: false
  };

  // window.__underline: kept current for scripts, e.g. UL.export.makeVideo(window.__underline.card)
  var dbg = {};
  Object.defineProperties(dbg, {
    screen: { enumerable: true, get: function () { return S.screenName; } },
    settings: { enumerable: true, get: function () { return S.settings; } },
    page: { enumerable: true, get: function () { return S.page; } },
    strokes: { enumerable: true, get: function () { return S.strokes; } },
    card: { enumerable: true, get: function () { return S.card; } }
  });
  W.__underline = dbg;

  /* ---------- settings ---------- */

  var MARK_NAMES = { highlighter: "Highlighter", underline: "Pen underline" };
  var FALLBACK_DEFAULTS = { mark: "highlighter", colour: "yellow", finish: "torn", fade: true, title: "", page: "", note: "" };

  function clampText(s, n) { return Array.from(String(s || "").replace(/[\r\n]+/g, " ")).slice(0, n).join(""); }

  function initialSettings() {
    var s = Object.assign({}, FALLBACK_DEFAULTS, U.DEFAULTS || {});
    if (idsOf(U.MARKS).indexOf(prefs.mark) !== -1) s.mark = prefs.mark;
    if (idsOf(U.COLOURS).indexOf(prefs.colour) !== -1) s.colour = prefs.colour;
    if (idsOf(U.FINISHES).indexOf(prefs.finish) !== -1) s.finish = prefs.finish;
    if (typeof prefs.fade === "boolean") s.fade = prefs.fade;
    // address shortcuts
    if (idsOf(U.MARKS).indexOf(Q.get("mark")) !== -1) s.mark = Q.get("mark");
    if (idsOf(U.COLOURS).indexOf(Q.get("colour")) !== -1) s.colour = Q.get("colour");
    if (idsOf(U.FINISHES).indexOf(Q.get("finish")) !== -1) s.finish = Q.get("finish");
    if (Q.get("fade") === "0") s.fade = false;
    if (Q.get("fade") === "1") s.fade = true;
    if (Q.has("title")) s.title = clampText(Q.get("title"), 60);
    if (Q.has("page")) s.page = clampText(Q.get("page"), 8);
    if (Q.has("note")) s.note = clampText(Q.get("note"), 60);
    return s;
  }

  /* ---------- errors ---------- */

  function normalizeError(e) {
    if (e && typeof e === "object") {
      if (typeof e.title === "string" && e.title) {
        return { code: e.code || "unknown", title: e.title, detail: typeof e.detail === "string" ? e.detail : "" };
      }
      if (e.error && typeof e.error.title === "string") return normalizeError(e.error);
    }
    if (e) warn("Underline:", e);
    return { code: "unknown", title: "Hmm, that didn't work.", detail: "Give it another go. A fresh photo sometimes helps." };
  }

  var DEV_ERRORS = {
    "error-heic": { code: "heic", title: "Your phone saved this in a format I can't read.", detail: "Take a screenshot of the page and use that, or switch your camera to Most Compatible." },
    "error-not-image": { code: "not-image", title: "That doesn't look like a photo.", detail: "Pick a picture of a page: a photo from your camera, a JPG or a PNG." }
  };

  /* ---------- screens ---------- */

  function showScreen(name, dbgName) {
    qsa(".screen").forEach(function (s) { s.classList.toggle("is-active", s.id === "screen-" + name); });
    S.screen = name;
    S.screenName = dbgName || name;
    D.body.setAttribute("data-screen", S.screenName);
    W.scrollTo(0, 0);
    var focusEl = null;
    if (name === "landing") focusEl = qsa(".headline")[0];
    else if (name === "error") focusEl = $("errTitle");
    else if (name === "done") focusEl = $("doneTitle");
    if (focusEl) { try { focusEl.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  var toastTimer = 0;
  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, ms || 3600);
  }

  function platform() {
    try { return U.share.platform(); } catch (e) { return "desktop"; }
  }

  function ensureEngine() {
    if (engineOk) return true;
    showScreen("broken");
    return false;
  }

  /* ---------- previews ---------- */

  function stopPreview() {
    if (S.preview) { try { S.preview.stop(); } catch (e) { /* ignore */ } S.preview = null; }
  }

  // One still frame (used for reduced motion and the t= shortcut)
  function drawStill(canvas, card, format, t) {
    try {
      var w = canvas.clientWidth || 360;
      var h = format === "story" ? Math.round(w * 16 / 9) : w;
      var d = dpr();
      canvas.width = Math.round(w * d);
      canvas.height = Math.round(h * d);
      card.drawFrame(canvas.getContext("2d"), t, format, canvas.width / 1080);
    } catch (e) { warn("Underline: could not draw the frame", e); }
  }

  // Give the preview box whole-pixel sizes, so the canvas (which the engine sizes from its CSS box times dpr)
  // is never stretched by the browser: sharp on high-density phones, and an exact square (or 9:16) shape.
  var previewSpot = null;
  function snapPreviewBox(canvas, format) {
    var box = canvas && canvas.parentNode;
    if (!box || !box.style) return;
    box.style.width = "";
    box.style.height = "";
    var r = box.getBoundingClientRect();
    var w, h;
    if (format === "story") {
      h = Math.floor(r.height / 16) * 16;
      w = h * 9 / 16;
    } else {
      w = Math.floor(r.width);
      h = w;
    }
    if (!(w >= 40 && h >= 40)) return;
    box.style.width = w + "px";
    box.style.height = h + "px";
  }

  function mountPreview(canvas, card, format) {
    stopPreview();
    if (!card) return;
    previewSpot = { canvas: canvas, format: format };
    snapPreviewBox(canvas, format);
    try {
      if (devT != null || reduceMotion()) drawStill(canvas, card, format, devT != null ? devT : U.END);
      else S.preview = U.card.startPreview(canvas, card, format);
    } catch (e) { warn("Underline: preview failed", e); }
  }

  /* ---------- 1. landing: the sample card animating ---------- */

  var hero = { card: null, preview: null, starting: false, failed: false };

  function stopHero() {
    if (hero.preview) { try { hero.preview.stop(); } catch (e) { /* ignore */ } hero.preview = null; }
    $("heroCard").classList.remove("is-live");
  }

  async function startHero() {
    if (!engineOk || hero.starting || hero.failed || S.screen !== "landing") return;
    hero.starting = true;
    try {
      if (!hero.card) {
        var smp = await U.sample.load();
        var hs = Object.assign({}, U.DEFAULTS || FALLBACK_DEFAULTS, { mark: "highlighter", colour: "yellow", finish: "torn", fade: true, title: "Jane Eyre", page: "252", note: "" });
        hero.card = await U.card.create(smp.page, smp.strokes, hs);
      }
      if (S.screen !== "landing") return;
      stopHero();
      var cv = $("heroCanvas");
      if (devT != null || reduceMotion()) drawStill(cv, hero.card, "square", devT != null ? devT : U.END);
      else hero.preview = U.card.startPreview(cv, hero.card, "square");
      $("heroCard").classList.add("is-live");
    } catch (e) {
      hero.failed = true; // the little drawn card stays
      warn("Underline: the sample card is not available", e);
    } finally {
      hero.starting = false;
    }
  }
  function startHeroSoon() {
    var go = function () { startHero(); };
    if ("requestIdleCallback" in W) W.requestIdleCallback(go, { timeout: 1200 });
    else setTimeout(go, 300);
  }

  function goLanding() {
    S.job += 1;
    resetSession(true);
    showScreen("landing");
    startHeroSoon();
  }

  /* ---------- session reset ---------- */

  function releasePhotoUrl() {
    if (S.photoUrl) { try { URL.revokeObjectURL(S.photoUrl); } catch (e) { /* ignore */ } S.photoUrl = null; }
  }
  function releaseDoneUrl() {
    if (S.doneUrl) { try { URL.revokeObjectURL(S.doneUrl); } catch (e) { /* ignore */ } S.doneUrl = null; }
  }

  function resetSession(forNewPhoto) {
    stopPreview();
    stopHero();
    finishSnap(true);
    abortVideo();
    invalidateOutputs();
    S.page = null;
    S.strokes = [];
    S.card = null;
    S.live = null;
    S.drag = null;
    S.kbLine = -1;
    S.lineH = 0;
    S.warnNoLines = false;
    S.hintSeen = false;
    S.queue = Promise.resolve();
    S.devHold = false;
    releaseDoneUrl();
    if (forNewPhoto && S.settings) {
      // same book, next page: keep the title, clear the page number and the note
      S.settings.page = "";
      S.settings.note = "";
      if (S.fromSample) S.settings.title = "";
    }
    S.fromSample = false;
  }

  /* ---------- photo in ---------- */

  function setWorking(url) {
    var img = $("workImg");
    img.onerror = function () { img.hidden = true; };
    if (url) { img.hidden = false; img.src = url; } else { img.hidden = true; img.removeAttribute("src"); }
  }

  function handleFile(file) {
    if (!file || !ensureEngine()) return;
    releasePhotoUrl();
    var url = null;
    try { url = URL.createObjectURL(file); S.photoUrl = url; } catch (e) { url = null; }
    openPhoto(function () { return U.decode.fileToImageData(file, { maxSide: 2000 }); }, url, false);
  }

  function trySample() {
    if (!ensureEngine()) return;
    openPhoto(null, null, true);
  }

  async function openPhoto(getImageData, url, isSample) {
    S.job += 1;
    var job = S.job;
    resetSession(true);
    setWorking(url);
    showScreen("working");
    try {
      var page;
      if (isSample) {
        var smp = await U.sample.load();
        page = smp.page;
      } else {
        var imageData = await getImageData();
        if (job !== S.job) return;
        page = await U.page.prepare(imageData);
      }
      if (job !== S.job) return;
      S.page = page;
      S.strokes = [];
      S.fromSample = !!isSample;
      if (isSample) applySampleLabel();
      releasePhotoUrl();
      S.warnNoLines = page && page.warning === "no-lines";
      enterEditor();
    } catch (e) {
      if (job !== S.job) return;
      if (e && e.code === "cancelled") { goLanding(); return; }
      showError(e);
    }
  }

  function applySampleLabel() {
    if (!Q.has("title") && !S.settings.title) S.settings.title = "Jane Eyre";
    if (!Q.has("page") && !S.settings.page) S.settings.page = "252";
  }

  /* ---------- errors: one friendly message, one button ---------- */

  function showError(err, opts) {
    var e = normalizeError(err);
    stopPreview();
    stopHero();
    releasePhotoUrl();
    $("errTitle").textContent = e.title;
    $("errDetail").textContent = e.detail;
    var btn = $("errBtn");
    var link = $("errLink");
    link.hidden = false;
    link.textContent = "Back to the start";
    link.onclick = goLanding;
    var action;
    if (e.code === "not-image" || e.code === "heic" || e.code === "unreadable") {
      btn.textContent = "Choose another photo";
      action = function () { $("galleryInput").click(); };
    } else if (e.code === "video-unsupported") {
      var canImage = !!(S.card || S.imageFile);
      if (canImage) {
        btn.textContent = "Save the image instead";
        action = function () { onSaveImage(); };
        link.textContent = "Back to my card";
        link.onclick = function () { backToStyle(); };
      } else {
        btn.textContent = "Start over";
        link.hidden = true;
        action = goLanding;
      }
    } else if (e.code === "export-failed" && S.card) {
      btn.textContent = "Try again";
      action = function () { backToStyle(); };
      link.textContent = "Start over";
    } else {
      btn.textContent = "Start over";
      link.hidden = true;
      action = goLanding;
    }
    btn.onclick = action;
    showScreen("error", "error-" + e.code);
  }

  /* ---------- 2. editor: the swipe (PLAN.md section 6.3) ---------- */

  var SMALL_PHOTO_SIDE = 600;   // shorter side, in page pixels, under which we say the photo may look soft
  var STAGE_PAD_X = 24;
  var STAGE_PAD_Y = 16;

  function enterEditor() {
    stopPreview();
    S.live = null;
    S.drag = null;
    S.kbLine = -1;
    S.hintOn = S.strokes.length === 0 && !S.hintSeen;
    showScreen("editor");
    updateHint();
    updateEditorUi();
    fitEditor();
  }

  function medianLineHeight() {
    if (S.lineH) return S.lineH;
    var hs = ((S.page && S.page.lines) || []).map(function (l) { return l.bottom - l.top; })
      .filter(function (h) { return h > 0; }).sort(function (a, b) { return a - b; });
    S.lineH = hs.length ? hs[hs.length >> 1] : (S.page ? S.page.height * 0.035 : 20);
    return S.lineH;
  }

  function fitEditor() {
    if (!S.page || S.screen !== "editor") return;
    var stage = $("stage");
    var cw = stage.clientWidth - STAGE_PAD_X;
    var ch = stage.clientHeight - STAGE_PAD_Y;
    if (cw < 40 || ch < 40) return;
    var ar = S.page.width / S.page.height;
    var w = cw;
    var h = w / ar;
    if (h > ch) { h = ch; w = h * ar; }
    var wrap = $("pageWrap");
    wrap.style.width = Math.floor(w) + "px";
    wrap.style.height = Math.floor(h) + "px";
    var cv = $("editCanvas");
    var d = dpr();
    var pw = Math.max(1, Math.round(Math.floor(w) * d));
    var ph = Math.max(1, Math.round(Math.floor(h) * d));
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    drawEditorNow();
  }

  function drawEditorNow() {
    S.drawQueued = false;
    if (!S.page || S.screen !== "editor") return;
    try { U.card.drawEditor($("editCanvas"), S.page, S.strokes, S.live || null); }
    catch (e) { warn("Underline: could not draw the page", e); }
  }
  function requestDraw() {
    if (S.drawQueued) return;
    S.drawQueued = true;
    W.requestAnimationFrame(drawEditorNow);
  }

  // The raw stroke under the finger: straight line fitted through the points, at the median line height.
  // Stroke fields as in PLAN.md 7.3. y is the stroke's vertical centre at its x-midpoint; slope is dy/dx in page pixels.
  function rawStroke(points) {
    var n = points.length;
    var x0 = Infinity, x1 = -Infinity, sx = 0, sy = 0, i;
    for (i = 0; i < n; i += 1) {
      var p = points[i];
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      sx += p.x; sy += p.y;
    }
    var mx = sx / n, my = sy / n, num = 0, den = 0;
    for (i = 0; i < n; i += 1) {
      num += (points[i].x - mx) * (points[i].y - my);
      den += (points[i].x - mx) * (points[i].x - mx);
    }
    var slope = den > 1e-6 ? clamp(num / den, -0.35, 0.35) : 0;
    var xm = (x0 + x1) / 2;
    return {
      x0: x0, x1: x1, y: my + slope * (xm - mx), height: medianLineHeight(), slope: slope,
      snapped: false, seed: (Math.random() * 1e9) | 0, points: points
    };
  }

  function mixStroke(a, b, k) {
    var o = {};
    ["x0", "x1", "y", "height", "slope"].forEach(function (f) { o[f] = a[f] + (b[f] - a[f]) * k; });
    o.snapped = b.snapped;
    o.seed = b.seed;
    return o;
  }

  function validStroke(s) {
    return !!s && isFinite(s.x0) && isFinite(s.x1) && isFinite(s.y) && isFinite(s.height) && isFinite(s.slope);
  }

  function snapPoints(points) {
    var s = null;
    try { s = U.page.snap(S.page, points); } catch (e) { warn("Underline: snap failed", e); }
    return validStroke(s) ? s : null;
  }

  function toPage(ev) {
    var cv = $("editCanvas");
    var r = cv.getBoundingClientRect();
    return {
      x: clamp((ev.clientX - r.left) / r.width, 0, 1) * S.page.width,
      y: clamp((ev.clientY - r.top) / r.height, 0, 1) * S.page.height
    };
  }

  function hideHint() {
    S.hintSeen = true;
    if (!S.hintOn) return;
    S.hintOn = false;
    updateHint();
  }
  function updateHint() { $("hint").classList.toggle("is-gone", !S.hintOn); }

  // 120 ms: the raw stroke slides into the line of print
  function startSnap(raw, snapped) {
    finishSnap(false);
    if (reduceMotion()) { commitStroke(snapped); return; }
    var start = W.performance.now();
    var anim = { raw: raw, snapped: snapped, id: 0 };
    S.snapAnim = anim;
    S.live = raw;
    var step = function (now) {
      if (S.snapAnim !== anim) return;
      var k = clamp((now - start) / 120, 0, 1);
      var e = 1 - Math.pow(1 - k, 3);
      if (k < 1) {
        S.live = mixStroke(raw, snapped, e);
        drawEditorNow();
        anim.id = W.requestAnimationFrame(step);
      } else {
        finishSnap(false);
      }
    };
    anim.id = W.requestAnimationFrame(step);
  }

  // put a running snap straight into place (or throw it away)
  function finishSnap(discard) {
    var anim = S.snapAnim;
    if (!anim) return;
    S.snapAnim = null;
    try { W.cancelAnimationFrame(anim.id); } catch (e) { /* ignore */ }
    S.live = null;
    if (!discard) commitStroke(anim.snapped);
  }

  function commitStroke(stroke) {
    S.strokes.push(stroke);
    S.live = null;
    S.kbLine = -1;
    hideHint();
    buzz();
    onStrokesChanged();
    drawEditorNow();
  }

  function onStrokesChanged() {
    invalidateOutputs();
    updateEditorUi();
  }

  function updateEditorUi() {
    var n = S.strokes.length;
    $("btnUndo").disabled = n === 0;
    $("btnClear").disabled = n === 0;
    $("btnNext").classList.toggle("is-off", n === 0);
    $("btnNext").setAttribute("aria-disabled", n === 0 ? "true" : "false");
    // a small photo: a gentle, non-blocking heads-up that stays while you work
    var small = !!S.page && !S.fromSample && Math.min(S.page.width, S.page.height) < SMALL_PHOTO_SIDE;
    $("smallNote").hidden = !small;
    var cap = $("caption");
    cap.classList.remove("is-nudge");
    if (n > 0) {
      cap.textContent = n === 1 ? "Lovely. Swipe another line to add it, or tap Next." : "Swipe another line to add it, or tap Next.";
    } else if (S.warnNoLines) {
      cap.textContent = "I couldn't spot lines of print here, so I'll put the mark right where you swipe.";
    } else {
      cap.textContent = "";
    }
  }

  function onPointerDown(ev) {
    if (!S.page || S.drag) return;
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    ev.preventDefault();
    finishSnap(false);
    try { $("editCanvas").setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    S.kbLine = -1;
    S.drag = { id: ev.pointerId, points: [toPage(ev)] };
    hideHint();
  }

  function onPointerMove(ev) {
    var d = S.drag;
    if (!d || ev.pointerId !== d.id) return;
    ev.preventDefault();
    var evs = (typeof ev.getCoalescedEvents === "function" && ev.getCoalescedEvents()) || [];
    if (!evs.length) evs = [ev];
    for (var i = 0; i < evs.length && d.points.length < 3000; i += 1) d.points.push(toPage(evs[i]));
    if (d.points.length > 1) {
      var raw = rawStroke(d.points);
      if (raw.x1 - raw.x0 > 0.5) { S.live = raw; requestDraw(); }
    }
  }

  function onPointerUp(ev) {
    var d = S.drag;
    if (!d || ev.pointerId !== d.id) return;
    ev.preventDefault();
    S.drag = null;
    try { $("editCanvas").releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    d.points.push(toPage(ev));
    var raw = rawStroke(d.points);
    if (raw.x1 - raw.x0 < S.page.width * 0.03) {
      S.live = null;
      drawEditorNow();
      var cap = $("caption");
      cap.textContent = "Drag a little further along the line.";
      cap.classList.add("is-nudge");
      return;
    }
    var snapped = snapPoints(d.points);
    if (!snapped) { snapped = Object.assign({}, raw); delete snapped.points; }
    startSnap(raw, snapped);
  }

  function onPointerCancel(ev) {
    var d = S.drag;
    if (!d || ev.pointerId !== d.id) return;
    S.drag = null;
    S.live = null;
    drawEditorNow();
  }

  // keyboard: up and down choose a line of print, Enter marks it
  function kbPoints(i) {
    var ln = S.page.lines[i];
    var y = (ln.top + ln.bottom) / 2;
    return [0, 0.25, 0.5, 0.75, 1].map(function (k) { return { x: ln.x0 + (ln.x1 - ln.x0) * k, y: y }; });
  }
  function onKey(ev) {
    if (!S.page) return;
    var lines = S.page.lines || [];
    var n = lines.length;
    if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && n) {
      ev.preventDefault();
      finishSnap(false);
      var dir = ev.key === "ArrowDown" ? 1 : -1;
      S.kbLine = S.kbLine < 0 ? (dir > 0 ? 0 : n - 1) : (S.kbLine + dir + n) % n;
      S.live = snapPoints(kbPoints(S.kbLine));
      hideHint();
      requestDraw();
    } else if (ev.key === "Enter" && S.kbLine >= 0) {
      ev.preventDefault();
      var s = snapPoints(kbPoints(S.kbLine));
      S.kbLine = -1;
      S.live = null;
      if (s) commitStroke(s); else drawEditorNow();
    } else if (ev.key === "Escape" && S.kbLine >= 0) {
      S.kbLine = -1;
      S.live = null;
      drawEditorNow();
    }
  }

  function undo() {
    finishSnap(false);
    if (!S.strokes.length) return;
    S.strokes.pop();
    S.live = null;
    onStrokesChanged();
    drawEditorNow();
  }
  function clearAll() {
    finishSnap(true);
    if (!S.strokes.length) return;
    S.strokes.length = 0;
    S.live = null;
    onStrokesChanged();
    drawEditorNow();
  }
  function onNext() {
    finishSnap(false);
    if (!S.strokes.length) {
      var cap = $("caption");
      cap.textContent = "Swipe across a line first, then tap Next.";
      cap.classList.add("is-nudge");
      var b = $("btnNext");
      b.classList.remove("nudge");
      void b.offsetWidth;
      b.classList.add("nudge");
      return;
    }
    goStyle();
  }

  /* ---------- 3. style: make it yours ---------- */

  var styleBuilt = false;

  function buildStyleControls() {
    if (styleBuilt || !engineOk) return;
    styleBuilt = true;
    if (Q.get("labels") === "1") $("labels").open = true;   // address shortcut, for screenshots

    var mrow = $("markRow");
    idsOf(U.MARKS).forEach(function (id) {
      var b = D.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = id;
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = (MARK_SVG[id] || "") + "<span>" + esc(MARK_NAMES[id] || capital(id)) + "</span>";
      b.addEventListener("click", function () { change({ mark: id }); });
      mrow.appendChild(b);
    });

    var crow = $("colourRow");
    (U.COLOURS || []).forEach(function (c) {
      var b = D.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.dataset.id = c.id;
      b.setAttribute("aria-label", capital(c.id));
      b.setAttribute("aria-pressed", "false");
      b.innerHTML = '<i style="--c:' + esc(c.hex) + '"></i>';
      b.addEventListener("click", function () { change({ colour: c.id }); });
      crow.appendChild(b);
    });

    var frow = $("finishRow");
    (U.FINISHES || []).forEach(function (f) {
      var b = D.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = f.id;
      b.setAttribute("aria-pressed", "false");
      b.textContent = f.name;
      b.addEventListener("click", function () { change({ finish: f.id }); });
      frow.appendChild(b);
    });
  }

  function syncStyleControls() {
    var s = S.settings;
    if (!s) return;
    qsa("#markRow .chip").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === s.mark ? "true" : "false"); });
    qsa("#colourRow .swatch").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === s.colour ? "true" : "false"); });
    qsa("#finishRow .chip").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.id === s.finish ? "true" : "false"); });
    $("fadeToggle").setAttribute("aria-checked", s.fade ? "true" : "false");
    var fields = { fTitle: s.title, fPage: s.page, fNote: s.note };
    Object.keys(fields).forEach(function (id) {
      var el = $(id);
      if (el.value !== fields[id]) el.value = fields[id] || "";
    });
    // the label row stays closed until tapped; its second line shows what's already there
    var bits = [];
    if (s.title) bits.push(s.title);
    if (s.page) bits.push("p. " + s.page);
    var lt = $("labelsTitle"), lh = $("labelsHint");
    if (lt) lt.textContent = bits.length ? "Book title & page" : "Add the book title & page";
    if (lh) lh.textContent = bits.length ? bits.join(" · ") : "So your card says where it's from.";
    updateShareLabels();
  }

  function updateShareLabels() {
    var label = S.videoFile ? "Share now" : "Share story";
    $("shareStoryLabel").textContent = label;
    $("doneShareLabel").textContent = label;
  }

  async function goStyle() {
    if (!S.page || !S.strokes.length || !ensureEngine()) return;
    invalidateOutputs();
    finishSnap(false);
    buildStyleControls();
    syncStyleControls();
    showScreen("style");
    var job = S.job;
    try {
      if (!S.card) {
        S.card = await U.card.create(S.page, S.strokes.slice(), Object.assign({}, S.settings));
      } else {
        S.card.setStrokes(S.strokes.slice());
        await S.card.update(Object.assign({}, S.settings));
      }
    } catch (e) {
      if (job === S.job && S.screen === "style") showError(e);
      return;
    }
    if (job !== S.job || S.screen !== "style") return;
    mountPreview($("styleCanvas"), S.card, "square");
    scheduleImage(0);
  }

  function backToStyle() {
    if (!S.card) { goLanding(); return; }
    abortVideo();
    buildStyleControls();
    syncStyleControls();
    showScreen("style");
    mountPreview($("styleCanvas"), S.card, "square");
    if (!S.imageFile && !S.imagePromise) scheduleImage(0);
  }

  var labelTimer = 0;
  var labelPending = null;
  function flushLabels() {
    clearTimeout(labelTimer);
    var p = labelPending;
    labelPending = null;
    if (p) change(p, true);
  }

  function change(partial, force) {
    if (!S.settings) return;
    var changed = force || Object.keys(partial).some(function (k) { return S.settings[k] !== partial[k]; });
    if (!changed) return;
    Object.assign(S.settings, partial);
    ["mark", "colour", "finish", "fade"].forEach(function (k) { if (k in partial) prefs[k] = S.settings[k]; });
    savePrefs();
    invalidateOutputs();
    syncStyleControls();
    if (!S.card) return;
    var card = S.card;
    S.queue = S.queue
      .then(function () { return card.update(partial); })
      .catch(function (e) { warn("Underline: update failed", e); toast("That one didn't stick. Try again?"); });
    scheduleImage(350);
  }

  /* ---------- the image makes itself as soon as the style settles ---------- */

  function invalidateOutputs() {
    S.imageToken += 1;
    S.imageFile = null;
    S.imagePromise = null;
    clearTimeout(S.imageTimer);
    S.imageFailed = false;
    S.videoFile = null;
    S.videoShareFailed = false;
    releaseDoneUrl();
    updateShareLabels();
    updateSaveState();
  }

  // While the picture is still being made the button says so; a tap still works (it waits, then saves).
  function updateSaveState() {
    var b = $("btnSaveImage");
    if (!b) return;
    var busy = !S.imageFile && !S.imageFailed;
    b.classList.toggle("is-busy", busy);
    b.setAttribute("aria-busy", busy ? "true" : "false");
    $("saveLabel").textContent = busy ? "One sec…" : "Save image";
  }

  function scheduleImage(delay) {
    if (!S.card) return;
    clearTimeout(S.imageTimer);
    S.imageToken += 1;
    S.imageFile = null;
    S.imagePromise = null;
    S.imageFailed = false;
    updateSaveState();
    var tok = S.imageToken;
    if (!delay) { buildImage(tok); return; }
    S.imageTimer = setTimeout(function () { buildImage(tok); }, delay);
  }

  function buildImage(tok) {
    var card = S.card;
    if (!card) return Promise.resolve(null);
    var p = S.queue.then(function () { return U.export.makeImage(card); }).then(function (file) {
      if (tok === S.imageToken && card === S.card) { S.imageFile = file; updateSaveState(); }
      return file;
    });
    p.catch(function (e) {
      if (tok !== S.imageToken) return;
      warn("Underline: image failed", e);
      S.imagePromise = null;
      S.imageFailed = true;
      updateSaveState();
    });
    S.imagePromise = p;
    return p;
  }

  /* ---------- saving and sharing: called straight from the tap, with the file already made ---------- */

  function runShare(file, mode, kind) {
    var promise;
    try {
      promise = mode === "share" ? U.share.share(file) : U.share.save(file);
    } catch (e) {
      promise = Promise.resolve("failed");
    }
    Promise.resolve(promise).then(
      function (r) { afterShare(r, mode, kind); },
      function () { afterShare("failed", mode, kind); }
    );
  }

  function afterShare(result, mode, kind) {
    if (result === "cancelled") return;
    if (result === "failed") {
      if (kind === "video" && mode === "share") {
        S.videoShareFailed = true;
        renderMaking();
        toast("Sharing didn't open. Tap Save video, then post it from your gallery.");
      } else {
        toast(kind === "video" ? "That didn't save. Give it another tap." : "That didn't save. Tap Save image once more.");
      }
      return;
    }
    goDone(kind, mode);
  }

  function onSaveImage() {
    if (labelPending) flushLabels();   // words typed a moment ago go into the card first
    var file = S.imageFile;
    if (file) { runShare(file, "save", "image"); return; }
    // not ready yet (the style only just changed): wait for it, then go
    if (!S.card) { toast("Pick a line first."); return; }
    toast("One moment…", 1500);
    var tok = S.imageToken;
    var p = S.imagePromise;
    if (!p) { clearTimeout(S.imageTimer); p = buildImage(tok); }
    Promise.resolve(p).then(function () {
      if (tok !== S.imageToken || !S.imageFile) return;
      runShare(S.imageFile, "save", "image");
    }, function (e) { showError(e); });
  }

  /* ---------- share story: make the video first, then a second tap shares it ---------- */

  function onShareStory(from) {
    S.returnTo = from;
    if (S.videoFile) { shareVideoNow(); return; }
    if (!S.card) return;
    if (S.support && S.support.video === false) {
      showError({ code: "video-unsupported", title: "This browser can't make videos.", detail: "You can still keep your card as a picture." });
      return;
    }
    startVideo();
  }

  function setProgress(f) {
    f = clamp(+f || 0, 0, 1);
    $("makeProgress").style.setProperty("--p", String(f));
    $("makeProgress").setAttribute("aria-valuenow", String(Math.round(f * 100)));
  }

  function abortVideo() {
    S.videoToken += 1;
    if (S.ctrl) { try { S.ctrl.abort(); } catch (e) { /* ignore */ } S.ctrl = null; }
  }

  async function startVideo() {
    var card = S.card;
    if (!card) return;
    abortVideo();
    var tok = S.videoToken;
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    S.ctrl = ctrl;
    S.makeState = "making";
    S.videoShareFailed = false;
    setProgress(0);
    showScreen("making");
    renderMaking();
    mountPreview($("makeCanvas"), card, "story");
    try {
      await S.queue;
      var file = await U.export.makeVideo(card, {
        onProgress: function (f) { if (tok === S.videoToken) setProgress(f); },
        signal: ctrl ? ctrl.signal : undefined
      });
      if (tok !== S.videoToken) return;
      S.ctrl = null;
      S.videoFile = file;
      S.makeState = "ready";
      setProgress(1);
      updateShareLabels();
      renderMaking();
    } catch (e) {
      if (tok !== S.videoToken) return;
      S.ctrl = null;
      if (e && e.code === "cancelled") return;
      showError(e);
    }
  }

  function renderMaking() {
    var ready = S.makeState === "ready";
    $("screen-making").classList.toggle("is-ready", ready);
    var canShare = false;
    try { canShare = !!(S.videoFile && U.share.canShare(S.videoFile)) && !S.videoShareFailed; } catch (e) { canShare = false; }
    $("makeTitle").textContent = ready ? "Your video is ready." : "Making your video…";
    $("makeProgress").hidden = ready;
    $("btnMakeCancel").hidden = ready;
    $("btnShareNow").hidden = !ready;
    $("btnMakeBack").hidden = !ready;
    $("shareNowLabel").textContent = canShare ? "Share now" : "Save video";
    $("shareNowIcon").innerHTML = icon(canShare ? "share" : "download");
    if (ready) {
      $("makeNote").textContent = canShare
        ? "Tap Share now, then pick Instagram, WhatsApp or Messages."
        : "Save it, then post it from your gallery: Instagram, New story.";
    } else {
      $("makeNote").textContent = "Hang tight, this takes a few seconds.";
    }
  }

  function shareVideoNow() {
    var file = S.videoFile;
    if (!file) return;
    var can = false;
    try { can = !!U.share.canShare(file) && !S.videoShareFailed; } catch (e) { can = false; }
    runShare(file, can ? "share" : "save", "video");
  }

  function leaveMaking() {
    abortVideo();
    if (S.returnTo === "done") { showDone(); } else { backToStyle(); }
  }

  /* ---------- 5. done ---------- */

  function platformSub(kind, mode) {
    if (kind === "video") return mode === "share" ? "Go post it. Someone is about to smile." : "Now post it from your gallery: Instagram, New story.";
    var p = platform();
    if (p === "ios") return "If you tapped Save Image, it's in your Photos now.";
    if (p === "android") return "It's in your Gallery or your Downloads.";
    return "It's in your Downloads folder.";
  }

  function goDone(kind, mode) {
    S.doneKind = kind;
    S.doneMode = mode;
    showDone();
  }

  function showDone() {
    var kind = S.doneKind || "image";
    var mode = S.doneMode || "save";
    $("doneTitle").textContent = (kind === "video" && mode === "share") ? "Shared." : "Saved.";
    $("doneSub").textContent = platformSub(kind, mode);
    releaseDoneUrl();
    var img = $("doneImg");
    if (S.imageFile) {
      try { S.doneUrl = URL.createObjectURL(S.imageFile); img.src = S.doneUrl; img.hidden = false; } catch (e) { img.hidden = true; }
    } else {
      img.hidden = true;
    }
    // the album tip shows once, then it's remembered
    var showAlbum = S.forceAlbumTip || !prefs.albumTipSeen;
    $("tipAlbum").hidden = !showAlbum;
    if (showAlbum && !S.forceAlbumTip) { prefs.albumTipSeen = true; savePrefs(); }
    updateShareLabels();
    stopPreview();
    showScreen("done");
  }

  function anotherLine() {
    if (!S.page) { goLanding(); return; }
    finishSnap(true);
    S.strokes = [];
    S.settings.note = "";
    invalidateOutputs();
    enterEditor();
  }

  /* ---------- footer, static bits ---------- */

  function footerHTML() {
    var cards = SIBLINGS.map(function (s) {
      return '<a class="sib-card" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        '<span class="sib-ico" aria-hidden="true">' + (SIB_SVG[s.icon] || "") + "</span>" +
        '<span class="sib-text"><strong>' + esc(s.name) + "</strong><span>" + esc(s.blurb) + "</span></span></a>";
    }).join("");
    return '<footer class="site-footer"><p class="more-from">More from ' + esc(MAKER_NAME) + "</p>" + cards + "</footer>";
  }

  function fillStatic() {
    qsa("[data-footer]").forEach(function (el) { el.innerHTML = footerHTML(); });
    qsa("[data-icon]").forEach(function (el) { el.innerHTML = icon(el.getAttribute("data-icon")); });
  }

  /* ---------- wiring ---------- */

  function wire() {
    $("btnSnap").addEventListener("click", function () { if (ensureEngine()) $("cameraInput").click(); });
    $("btnChoose").addEventListener("click", function () { if (ensureEngine()) $("galleryInput").click(); });
    $("btnSample").addEventListener("click", trySample);
    $("brokenBtn").addEventListener("click", function () { W.location.reload(); });

    ["cameraInput", "galleryInput"].forEach(function (id) {
      var input = $(id);
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        input.value = "";
        if (f) handleFile(f);
      });
    });

    // editor
    var cv = $("editCanvas");
    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", onPointerCancel);
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    cv.addEventListener("keydown", onKey);
    cv.addEventListener("blur", function () { if (S.kbLine >= 0) { S.kbLine = -1; S.live = null; drawEditorNow(); } });
    $("btnUndo").addEventListener("click", undo);
    $("btnClear").addEventListener("click", clearAll);
    $("btnNext").addEventListener("click", onNext);
    $("btnEditorBack").addEventListener("click", goLanding);
    var stage = $("stage");
    if ("ResizeObserver" in W) new ResizeObserver(function () { fitEditor(); }).observe(stage);
    W.addEventListener("resize", function () {
      fitEditor();
      if (previewSpot && S.preview && (S.screen === "style" || S.screen === "making")) snapPreviewBox(previewSpot.canvas, previewSpot.format);
    });

    // style
    $("btnStyleBack").addEventListener("click", function () {
      stopPreview();
      invalidateOutputs();
      enterEditor();
    });
    $("fadeToggle").addEventListener("click", function () { change({ fade: !S.settings.fade }); });
    [["fTitle", "title", 60], ["fPage", "page", 8], ["fNote", "note", 60]].forEach(function (row) {
      $(row[0]).addEventListener("input", function () {
        var el = $(row[0]);
        var v = clampText(el.value, row[2]);
        if (v !== el.value) el.value = v;
        // the settings follow every keystroke; the card and the image wait for a short pause in typing
        S.settings[row[1]] = v;
        labelPending = labelPending || {};
        labelPending[row[1]] = v;
        invalidateOutputs();
        clearTimeout(labelTimer);
        labelTimer = setTimeout(flushLabels, 250);
      });
    });
    $("btnSaveImage").addEventListener("click", onSaveImage);
    $("btnShareStory").addEventListener("click", function () { onShareStory("style"); });

    // making
    $("btnMakeCancel").addEventListener("click", leaveMaking);
    $("btnMakeBack").addEventListener("click", leaveMaking);
    $("btnShareNow").addEventListener("click", shareVideoNow);

    // done
    $("btnDoneShare").addEventListener("click", function () { onShareStory("done"); });
    $("btnDoneSave").addEventListener("click", onSaveImage);
    $("btnAnother").addEventListener("click", anotherLine);
    $("btnNewPage").addEventListener("click", goLanding);
    $("btnAlbumOk").addEventListener("click", function () {
      prefs.albumTipSeen = true;
      savePrefs();
      S.forceAlbumTip = false;
      $("tipAlbum").hidden = true;
    });

    // paste (computers) and drag-and-drop
    D.addEventListener("paste", function (e) {
      if (!engineOk || S.screen === "working") return;
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].kind === "file" && items[i].type.indexOf("image/") === 0) {
          var f = items[i].getAsFile();
          if (f) { e.preventDefault(); handleFile(f); return; }
        }
      }
    });
    D.addEventListener("dragover", function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1) {
        e.preventDefault();
        D.body.classList.add("dragging");
      }
    });
    D.addEventListener("dragleave", function (e) { if (!e.relatedTarget) D.body.classList.remove("dragging"); });
    D.addEventListener("drop", function (e) {
      D.body.classList.remove("dragging");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (S.screen !== "working") handleFile(f);
    });

    // something unexpected while a photo is being read: never a blank screen
    W.addEventListener("unhandledrejection", function (ev) {
      if (S.screen === "working") showError(ev.reason);
    });
  }

  /* ---------- address shortcut screens ---------- */

  async function devFrame() {
    try {
      var smp = await U.sample.load();
      S.page = smp.page;
      S.strokes = (smp.strokes || []).slice();
      S.fromSample = true;
      applySampleLabel();
      S.card = await U.card.create(S.page, S.strokes.slice(), Object.assign({}, S.settings));
      var cv = $("frameCanvas");
      cv.width = 1080;
      cv.height = devFormat === "story" ? 1920 : 1080;
      S.card.drawFrame(cv.getContext("2d"), devT == null ? U.END : devT, devFormat, 1);
      D.documentElement.classList.add("frame-only");
      S.screen = "frame";
      S.screenName = "frame";
      D.body.setAttribute("data-screen", "frame");
    } catch (e) {
      D.documentElement.classList.remove("frame-only");
      showError(e);
    }
  }

  async function devFlow(target) {
    try {
      var smp = await U.sample.load();
      S.page = smp.page;
      S.fromSample = true;
      applySampleLabel();
      var keep = target !== "editor" && target !== "error-no-lines" || Q.get("stroke") === "1";
      S.strokes = keep ? (smp.strokes || []).slice() : [];
      S.warnNoLines = target === "error-no-lines" || (S.page && S.page.warning === "no-lines");
      if (target === "editor" || target === "error-no-lines") { enterEditor(); return; }
      await goStyle();
      if (S.screen !== "style") return;
      if (target === "making") {
        S.returnTo = "style";
        S.makeState = "making";
        S.devHold = true;
        setProgress(0.55);
        showScreen("making");
        renderMaking();
        mountPreview($("makeCanvas"), S.card, "story");
      } else if (target === "done") {
        if (S.imagePromise) { try { await S.imagePromise; } catch (e) { /* ignore */ } }
        S.forceAlbumTip = true;
        goDone("image", "save");
      } else if (target === "error-video") {
        showError({ code: "video-unsupported", title: "This browser can't make videos.", detail: "You can still keep your card as a picture." });
      }
    } catch (e) {
      showError(e);
    }
  }

  /* ---------- start ---------- */

  function boot() {
    loadPrefs();
    S.settings = initialSettings();
    fillStatic();
    wire();

    // states that don't need the engine
    if (devScreen && devScreen.indexOf("error-") === 0 && SAMPLE_SCREENS.indexOf(devScreen) === -1) {
      showError(DEV_ERRORS[devScreen] || { code: devScreen.slice(6), title: "Hmm, that didn't work.", detail: "Give it another go." });
      return;
    }
    if (devScreen === "landing") {
      showScreen("landing");
      startHeroSoon();
      return;
    }
    if (!engineOk) {
      // friendly message instead of a blank page
      showScreen("broken");
      return;
    }
    if (engineOk && U.export && typeof U.export.support === "function") {
      try { U.export.support().then(function (s) { S.support = s; }, function () { /* ignore */ }); } catch (e) { /* ignore */ }
    }
    if (devScreen === "frame") { devFrame(); return; }
    if (SAMPLE_SCREENS.indexOf(devScreen) !== -1 || Q.get("sample") === "1") {
      devFlow(devScreen || "editor");
      return;
    }
    showScreen("landing");
    startHeroSoon();
  }

  boot();
})();
