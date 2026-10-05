// Page check: opens the real site in headless Edge (phone size) and reports PASS or FAIL per item.
//   node tests/page-check.js                       (site at http://localhost:8000/)
//   UL_BASE=http://localhost:8001/ node tests/page-check.js
// Needs a local server running for THIS folder. Never starts or stops it.
// Pattern from ../doodle-alive/tests/page-check.js (copied and adapted).
//  1. The landing page loads with no console errors, and the sample card is live.
//  2. ?sample=1 reaches the editor; a real swipe (touch events) adds a stroke; Next goes to the style screen.
//  3. The style screen: preview has pixels, chips change the card, makeImage and makeVideo give real files.
//  4. Every finish draws a full story frame; the done, making and error screens show.
//  5. A real photo file goes through the real file input (tests/real/*.jpg, if present).
// Screenshots go to shots/ (gitignored).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launch } = require("./cdp");

const BASE = process.env.UL_BASE || "http://localhost:8000/";
let fails = 0;
function item(ok, label, extra) {
  if (!ok) fails += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (extra ? "  (" + extra + ")" : ""));
}

// non-blank = the canvas has several different colours, not one flat fill
const CANVAS_PROBE = `(function (id) {
  var c = document.getElementById(id);
  if (!c || !c.width || !c.height) return { ok: false, why: "no canvas or 0x0" };
  var ctx = c.getContext("2d");
  var d = ctx.getImageData(0, 0, c.width, c.height).data;
  var seen = {}, n = 0, step = 4 * 7;
  for (var i = 0; i < d.length; i += step) {
    var k = (d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4) + "," + (d[i + 3] >> 6);
    if (!seen[k]) { seen[k] = 1; n += 1; }
  }
  return { ok: n > 6, colours: n, w: c.width, h: c.height };
})`;

const NAMES = ["MARKS", "COLOURS", "FINISHES", "DEFAULTS", "END", "decode.fileToImageData", "page.prepare", "page.snap",
  "sample.load", "card.create", "card.startPreview", "card.drawEditor", "export.support", "export.makeImage", "export.makeVideo",
  "export.fileName", "share.platform", "share.canShare", "share.share", "share.save"];

// Which visible elements stick out past the left or right edge of the viewport (and are not clipped by a parent)?
// Also reports the page's own scrollWidth, which is what a person would feel as sideways scrolling.
const OVERFLOW_PROBE = `(function () {
  var vw = document.documentElement.clientWidth;
  var out = [];
  var skip = function (el) { return !!el.closest('.vh, #toast, .drop, #frameHolder, noscript'); };
  var all = document.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (skip(el)) continue;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.left >= -0.5 && r.right <= vw + 0.5) continue;
    // hidden by an ancestor that clips sideways overflow, or by a parent that is not shown at all
    var clipped = false, hiddenParent = false;
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var ps = getComputedStyle(p);
      if (ps.display === 'none' || ps.visibility === 'hidden') { hiddenParent = true; break; }
      if ((ps.overflowX !== 'visible') || (ps.overflow !== 'visible')) {
        var pr = p.getBoundingClientRect();
        if (pr.left >= -0.5 && pr.right <= vw + 0.5) { clipped = true; break; }
      }
    }
    if (clipped || hiddenParent) continue;
    out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && el.className.baseVal === undefined ? '.' + String(el.className).trim().split(/\\s+/).join('.') : '')) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    if (out.length >= 8) break;
  }
  return { vw: vw, scrollWidth: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, offenders: out };
})()`;

async function checkOverflow(b, label) {
  const o = await b.eval(OVERFLOW_PROBE);
  item(!!o && o.scrollWidth <= o.vw && o.offenders.length === 0, label + ": nothing sticks out past the " + (o && o.vw) + "px width",
    o ? "scrollWidth " + o.scrollWidth + (o.offenders.length ? ", offenders: " + o.offenders.join("; ") : "") : "no answer");
}


// the book fonts really loaded (not a fallback) and the page uses them
const FONT_PROBE = `(async function () {
  var specs = ['500 18px "EB Garamond"', 'italic 500 18px "EB Garamond"', '600 18px "EB Garamond"', '600 30px "Cormorant Garamond"', 'italic 600 30px "Cormorant Garamond"', '600 20px "Caveat"'];
  await Promise.all(specs.map(function (x) { return document.fonts.load(x, "Aa").catch(function () {}); }));
  var out = { loaded: {}, h1: getComputedStyle(document.querySelector(".screen.is-active h1")).fontFamily, body: getComputedStyle(document.body).fontFamily, btn: getComputedStyle(document.querySelector(".screen.is-active .btn")).fontFamily };
  specs.forEach(function (x) { out.loaded[x] = document.fonts.check(x); });
  return out;
})()`;

// every tap target is at least 44 x 44 css px
const TARGET_PROBE = `(function () {
  var bad = [], list = document.querySelectorAll(".screen.is-active button, .screen.is-active a[href], .screen.is-active summary, .screen.is-active input:not(.vh), .screen.is-active .chip, .screen.is-active .swatch");
  for (var i = 0; i < list.length; i++) {
    var el = list[i]; if (el.closest(".vh")) continue;
    var r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.width < 43.5 || r.height < 43.5) bad.push((el.id || el.className || el.tagName) + " " + Math.round(r.width) + "x" + Math.round(r.height));
  }
  return bad;
})()`;

function problems(b) { return b.errors.concat(b.exceptions).join(" | "); }

// a swipe with real touch events across the canvas, between two fractions of its box
async function swipe(b, canvasId, fx0, fy0, fx1, fy1) {
  const r = await b.eval("(function(){var r=document.getElementById('" + canvasId + "').getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height};})()");
  const at = function (k) { return { x: r.l + r.w * (fx0 + (fx1 - fx0) * k), y: r.t + r.h * (fy0 + (fy1 - fy0) * k), id: 1 }; };
  await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at(0)] });
  for (let i = 1; i <= 12; i++) {
    await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [at(i / 12)] });
    await b.sleep(16);
  }
  await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await b.sleep(400);
}

// load a File in a <video> and give back its duration
const VIDEO_INFO = function (call) {
  return `(async function () {
    var t0 = performance.now();
    var file = await ${call};
    var secs = (performance.now() - t0) / 1000;
    var url = URL.createObjectURL(file);
    var v = document.createElement("video");
    v.muted = true; v.preload = "metadata"; v.src = url;
    var dur = await new Promise(function (res) {
      var done = false;
      var fin = function (x) { if (!done) { done = true; res(x); } };
      v.onloadedmetadata = function () {
        if (isFinite(v.duration)) return fin(v.duration);
        v.currentTime = 1e101;
        v.ontimeupdate = function () { v.ontimeupdate = null; fin(v.duration); };
      };
      v.onerror = function () { fin(-1); };
      setTimeout(function () { fin(-2); }, 10000);
    });
    return { type: file.type, name: file.name, kb: Math.round(file.size / 1024), duration: dur, vw: v.videoWidth, vh: v.videoHeight, makeSecs: Math.round(secs * 10) / 10, isFile: file instanceof File };
  })()`;
};

async function main() {
  try {
    const r = await fetch(BASE);
    if (!r.ok) throw new Error("status " + r.status);
    const html = await r.text();
    if (!/<title>Underline/i.test(html)) throw new Error("the page at " + BASE + " is not Underline (wrong folder being served?)");
  } catch (e) {
    console.log("FAIL local server for the underline folder is not answering at " + BASE + " (" + e.message + ")");
    process.exit(2);
  }

  const b = await launch({ width: 390, height: 844, dpr: 1 });
  try {
    await b.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(function () {});

    // ---- 1. landing ----
    await b.open(BASE);
    const live = await b.waitFor("document.getElementById('heroCard') && document.getElementById('heroCard').classList.contains('is-live')", 25);
    await b.sleep(2500);
    item(live, "landing: the sample card is live");
    const heroPx = await b.eval(CANVAS_PROBE + "('heroCanvas')");
    item(!!(heroPx && heroPx.ok), "landing: hero canvas has pixels", JSON.stringify(heroPx));
    const missing = await b.eval("(" + function (names) {
      return names.filter(function (p) { var o = window.UL; return !p.split(".").every(function (k) { if (o == null || o[k] == null) return false; o = o[k]; return true; }); });
    } + ")(" + JSON.stringify(NAMES) + ")");
    item(Array.isArray(missing) && missing.length === 0, "landing: every UL name from PLAN.md 7.3 exists in the page", JSON.stringify(missing));
    const snapVisible = await b.eval("(function(){var r=document.getElementById('btnSnap').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width>0;})()");
    item(snapVisible === true, "landing: Snap a page is visible without scrolling");
    await b.shot("pc-landing.png");
    const fonts = await b.eval(FONT_PROBE);
    item(!!fonts && Object.keys(fonts.loaded).every(function (k) { return fonts.loaded[k]; }), "landing: EB Garamond, Cormorant Garamond and Caveat are really loaded", JSON.stringify(fonts && fonts.loaded));
    item(!!fonts && /^"?Cormorant Garamond/.test(fonts.h1) && /^"?EB Garamond/.test(fonts.body) && /^"?EB Garamond/.test(fonts.btn), "landing: headings use Cormorant Garamond, text and buttons use EB Garamond", fonts && fonts.h1.split(",")[0] + " / " + fonts.body.split(",")[0]);
    const tgt0 = await b.eval(TARGET_PROBE);
    item(Array.isArray(tgt0) && tgt0.length === 0, "landing: every tap target is at least 44px", JSON.stringify(tgt0));
    await checkOverflow(b, "landing screen");
    item(b.errors.length === 0, "landing: no console errors", b.errors.join(" | "));
    item(b.exceptions.length === 0, "landing: no uncaught exceptions", b.exceptions.join(" | "));

    // ---- 2. editor: a real swipe ----
    await b.open(BASE + "?sample=1");
    await b.waitFor("window.__underline && window.__underline.screen === 'editor'", 30);
    await b.sleep(600);
    item(await b.eval("window.__underline.screen") === "editor", "editor: ?sample=1 lands in the editor");
    const edPx = await b.eval(CANVAS_PROBE + "('editCanvas')");
    item(!!(edPx && edPx.ok), "editor: the page canvas has pixels", JSON.stringify(edPx));
    await b.shot("pc-editor.png");
    const nextOff = await b.eval("document.getElementById('btnNext').classList.contains('is-off')");
    item(nextOff === true, "editor: Next is quiet until there is a stroke");
    // the sample line "I am no bird..." sits about 40% down the page, across the text
    const line = await b.eval("(function(){var p=window.__underline.page;var l=p.lines;return {n:l.length,h:p.height,w:p.width,mid:(l[Math.floor(l.length/2)].top+l[Math.floor(l.length/2)].bottom)/2};})()");
    const fy = line.mid / line.h;
    await swipe(b, "editCanvas", 0.2, fy, 0.8, fy);
    const hintHidden = await b.eval("(function(){var h=document.getElementById('hint');var cs=getComputedStyle(h);return h.classList.contains('is-gone')||cs.visibility==='hidden'||cs.opacity==='0';})()");
    item(hintHidden === true, "editor: the swipe hint is gone after the first touch");
    const nStrokes = await b.eval("window.__underline.strokes.length");
    item(nStrokes === 1, "editor: a touch swipe adds one stroke", String(nStrokes));
    const stroke = await b.eval("JSON.stringify(window.__underline.strokes[0])");
    item(/"snapped":true/.test(stroke || ""), "editor: the stroke snapped to a line", stroke);
    await b.shot("pc-editor-stroke.png");
    await b.eval("document.getElementById('btnUndo').click()");
    item(await b.eval("window.__underline.strokes.length") === 0, "editor: Undo removes it");
    await swipe(b, "editCanvas", 0.15, fy, 0.85, fy);
    await swipe(b, "editCanvas", 0.15, fy + 0.04, 0.7, fy + 0.04);
    await b.eval("document.getElementById('btnClear').click()");
    item(await b.eval("window.__underline.strokes.length") === 0, "editor: Clear removes all");
    await swipe(b, "editCanvas", 0.2, fy, 0.8, fy);
    await b.eval("document.getElementById('btnNext').click()");
    const gotStyle = await b.waitFor("window.__underline.screen === 'style' && !!window.__underline.card", 15);
    item(gotStyle, "editor: Next goes to the style screen and the card exists");
    await b.sleep(1500);
    await b.shot("pc-style-from-swipe.png");
    item(b.errors.length === 0 && b.exceptions.length === 0, "editor flow: no console errors or exceptions", problems(b));

    // ---- 3. style screen: chips, image, video ----
    await b.open(BASE + "?sample=1&screen=style");
    const gotCard = await b.waitFor("window.__underline && window.__underline.screen === 'style' && !!window.__underline.card", 30);
    item(gotCard, "style: window.__underline.card exists");
    await b.sleep(1500);
    const px = await b.eval(CANVAS_PROBE + "('styleCanvas')");
    item(!!(px && px.ok), "style: preview canvas has non-blank pixels", JSON.stringify(px));
    const sq = await b.eval("(function(){var c=document.getElementById('styleCanvas');var r=c.getBoundingClientRect();return {w:r.width,h:r.height,cw:c.width,ch:c.height};})()");
    item(!!sq && sq.w >= 40 && Math.abs(sq.w - sq.h) < 1 && Math.round(sq.w) === sq.w && sq.cw === sq.ch, "style: the preview is a sharp whole-pixel square", JSON.stringify(sq));
    await b.shot("pc-style.png");
    await checkOverflow(b, "style screen");
    const tgt1 = await b.eval(TARGET_PROBE);
    item(Array.isArray(tgt1) && tgt1.length === 0, "style: every tap target is at least 44px", JSON.stringify(tgt1));
    const chipTops = await b.eval("Array.prototype.map.call(document.querySelectorAll('#finishRow .chip'), function (c) { return Math.round(c.getBoundingClientRect().top); })");
    item(Array.isArray(chipTops) && chipTops.length === 4 && chipTops.every(function (t) { return t === chipTops[0]; }), "style: Clean, Polaroid, Film, Torn page fit on one row", JSON.stringify(chipTops));
    const lbl = await b.eval("UL.finishes.labelInfo({ title: 'Jane Eyre', page: '252', note: 'x' }, new Date(2026, 9, 5)).line");
    item(typeof lbl === "string" && !/underline/i.test(lbl) && /^Jane Eyre . p\. 252 . 5 Oct 2026$/.test(lbl), "card label line is title, page, date and never says underline", lbl);
    const support = await b.eval("UL.export.support()");
    item(!!(support && typeof support.video === "boolean" && "method" in support), "UL.export.support() answers", JSON.stringify(support));
    item(!!(support && support.video), "UL.export.support(): this browser can make video", JSON.stringify(support));

    // chips change the card
    for (const [sel, key, want] of [
      ["#finishRow .chip[data-id=film]", "finish", "film"], ["#finishRow .chip[data-id=polaroid]", "finish", "polaroid"],
      ["#markRow .chip[data-id=underline]", "mark", "underline"], ["#colourRow .swatch[data-id=pink]", "colour", "pink"]
    ]) {
      await b.eval("document.querySelector('" + sel + "').click()");
      await b.sleep(500);
      const got = await b.eval("window.__underline.card.settings." + key);
      item(got === want, "style: tapping " + want + " sets card.settings." + key, String(got));
    }
    await b.eval("document.getElementById('fadeToggle').click()");
    await b.sleep(300);
    item(await b.eval("window.__underline.card.settings.fade") === false, "style: Fade the rest toggle changes card.settings.fade");
    await b.shot("pc-style-polaroid-underline-pink.png");
    await b.eval("document.getElementById('finishRow').querySelector('.chip[data-id=torn]').click()");
    await b.eval("document.getElementById('markRow').querySelector('.chip[data-id=highlighter]').click()");
    await b.eval("document.getElementById('colourRow').querySelector('.swatch[data-id=yellow]').click()");
    await b.eval("document.getElementById('fadeToggle').click()");
    await b.sleep(600);

    const img = await b.eval(`(async function () {
      var file = await UL.export.makeImage(window.__underline.card);
      var bmp = await createImageBitmap(file);
      return { type: file.type, name: file.name, kb: Math.round(file.size / 1024), w: bmp.width, h: bmp.height, isFile: file instanceof File };
    })()`);
    console.log("     makeImage result: " + JSON.stringify(img));
    item(!!(img && img.isFile && img.type === "image/jpeg"), "makeImage: returns a JPEG File", img && img.type);
    item(!!(img && img.w === 1080 && img.h === 1080), "makeImage: 1080x1080", img && img.w + "x" + img.h);
    item(!!(img && img.kb > 40 && img.kb < 1500), "makeImage: size is sensible", img && img.kb + " KB");
    item(!!(img && /^underline-.*\.jpg$/.test(img.name)), "makeImage: file name", img && img.name);

    const vid = await b.eval(VIDEO_INFO("UL.export.makeVideo(window.__underline.card, {})"));
    console.log("     makeVideo result: " + JSON.stringify(vid));
    item(!!(vid && vid.isFile && /^video\//.test(vid.type)), "makeVideo: returns a video File", vid && vid.type);
    item(!!(vid && vid.kb > 50), "makeVideo: size is sensible", vid && vid.kb + " KB");
    item(!!(vid && vid.duration > 4.5 && vid.duration < 6), "makeVideo: duration is about 5 s", vid && String(vid.duration));
    item(!!(vid && vid.vw === 1080 && vid.vh === 1920), "makeVideo: 1080x1920", vid && vid.vw + "x" + vid.vh);
    // frames read back out of a real exported video: not blank, and the marker sweep is drawing (more yellow as time goes on)
    const fr = await b.eval("(async function(){var f=await UL.export.makeVideo(window.__underline.card,{});var v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(f);v.preload='auto';await new Promise(function(r){v.onloadeddata=r;v.onerror=r;});var c=document.createElement('canvas');c.width=270;c.height=480;var x=c.getContext('2d');var out=[];for(var t of [0.3,1,2,3]){v.currentTime=t;await new Promise(function(r){v.onseeked=r;});x.drawImage(v,0,0,270,480);var d=x.getImageData(0,0,270,480).data,seen={},n=0,yel=0;for(var i=0;i<d.length;i+=4){var k=(d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4);if(!seen[k]){seen[k]=1;n++;}if(d[i]>220&&d[i+1]>190&&d[i+2]<150&&d[i]-d[i+2]>90)yel++;}out.push({t:t,colours:n,yellow:yel});}return out;})()");
    item(!!fr && fr.slice(1).every(function (f) { return f.colours > 20; }), "makeVideo: frames at 1, 2 and 3 s are not blank", JSON.stringify(fr));
    item(!!fr && fr[0].yellow < fr[1].yellow && fr[1].yellow < fr[2].yellow && fr[2].yellow < fr[3].yellow, "makeVideo: the marker sweep draws (yellow grows from 0.3 s to 3 s)");
    item(b.errors.length === 0 && b.exceptions.length === 0, "style: no console errors or exceptions", problems(b));

    // the buttons themselves: Save image, then Share story
    await b.open(BASE + "?sample=1&screen=style");
    await b.waitFor("window.__underline && window.__underline.screen === 'style' && !!window.__underline.card", 30);
    await b.sleep(1500);
    await b.eval("document.getElementById('btnSaveImage').click()");
    const doneOk = await b.waitFor("window.__underline.screen === 'done'", 10);
    item(doneOk, "Save image: lands on the done screen");
    await b.sleep(400);
    await b.shot("pc-done-after-save.png");
    await checkOverflow(b, "done screen after Save image");
    await b.eval("document.getElementById('btnAnother').click()");
    item(await b.waitFor("window.__underline.screen === 'editor'", 5), "done: Underline another line goes back to the editor");
    item(b.errors.length === 0 && b.exceptions.length === 0, "Save image flow: no console errors or exceptions", problems(b));

    await b.open(BASE + "?sample=1&screen=style");
    await b.waitFor("window.__underline && window.__underline.screen === 'style' && !!window.__underline.card", 30);
    await b.sleep(1200);
    await b.eval("document.getElementById('btnShareStory').click()");
    await b.sleep(800);
    item(await b.eval("window.__underline.screen") === "making", "Share story: shows the making screen");
    await b.shot("pc-making.png");
    const madeVideo = await b.waitFor("!document.getElementById('btnShareNow').hidden", 60);
    item(madeVideo, "Share story: the video is made and Share now / Save video appears");
    await b.shot("pc-making-ready.png");
    item(b.errors.length === 0 && b.exceptions.length === 0, "Share story flow: no console errors or exceptions", problems(b));

    // ---- 4. every finish, as a full frame ----
    for (const finish of ["clean", "polaroid", "film", "torn"]) {
      for (const format of ["square", "story"]) {
        await b.open(BASE + "?sample=1&screen=frame&finish=" + finish + "&format=" + format + "&t=5");
        const ok = await b.waitFor("window.__underline && window.__underline.screen === 'frame'", 30);
        const framePx = await b.eval(CANVAS_PROBE + "('frameCanvas')");
        const wantH = format === "story" ? 1920 : 1080;
        item(ok && !!(framePx && framePx.ok && framePx.w === 1080 && framePx.h === wantH), "frame: " + finish + " " + format + " draws at 1080x" + wantH, JSON.stringify(framePx));
        if (ok) {
          // save the canvas itself (half size), not the cropped window
          const data = await b.eval("(function(){var c=document.getElementById('frameCanvas');var o=document.createElement('canvas');o.width=c.width/2;o.height=c.height/2;o.getContext('2d').drawImage(c,0,0,o.width,o.height);return o.toDataURL('image/png').split(',')[1];})()");
          fs.mkdirSync(path.join(__dirname, "..", "shots"), { recursive: true });
          fs.writeFileSync(path.join(__dirname, "..", "shots", "pc-frame-" + finish + "-" + format + ".png"), Buffer.from(data, "base64"));
        }
        item(b.errors.length === 0 && b.exceptions.length === 0, "frame " + finish + " " + format + ": no console errors", problems(b));
      }
    }

    // ---- 5. the other screens ----
    await b.open(BASE + "?sample=1&screen=done");
    item(await b.waitFor("window.__underline && window.__underline.screen === 'done'", 30), "done: the shortcut shows the done screen");
    await b.sleep(500);
    await b.shot("pc-done.png");
    await checkOverflow(b, "done screen");
    const tipText = await b.eval("Array.prototype.map.call(document.querySelectorAll('.tip p'), function (p) { return p.textContent; }).join(' | ')");
    item(typeof tipText === "string" && tipText.length > 20 && !/search(ing)?\s+(for\s+)?['"‘“]?underline/i.test(tipText), "done: the tip does not tell people to search for 'underline'", tipText);
    const tgt2 = await b.eval(TARGET_PROBE);
    item(Array.isArray(tgt2) && tgt2.length === 0, "done: every tap target is at least 44px", JSON.stringify(tgt2));
    // the style screen with the label fields open
    await b.open(BASE + "?sample=1&screen=style&labels=1");
    await b.waitFor("window.__underline && window.__underline.screen === 'style' && !!window.__underline.card", 30);
    await b.sleep(800);
    await b.shot("pc-style-labels.png");
    await checkOverflow(b, "style screen with the label fields open");
    await b.open(BASE + "?sample=1&screen=making");
    item(await b.waitFor("window.__underline && window.__underline.screen === 'making'", 30), "making: the shortcut shows the making screen");
    await b.sleep(1500);
    await b.shot("pc-making-shortcut.png");
    for (const s of ["error-heic", "error-not-image"]) {
      await b.open(BASE + "?screen=" + s);
      const shown = await b.waitFor("window.__underline && window.__underline.screen === '" + s + "'", 15);
      const title = await b.eval("document.getElementById('errTitle').textContent");
      item(shown && !!title, s + ": the friendly message shows", title);
      await b.shot("pc-" + s + ".png");
      await checkOverflow(b, s + " screen");
    }
    item(b.errors.length === 0 && b.exceptions.length === 0, "other screens: no console errors or exceptions", problems(b));

    // ---- 5b. the landing buttons and a file that is not a photo ----
    await b.open(BASE);
    await b.waitFor("window.UL && document.getElementById('btnSample')", 15);
    await b.sleep(500);
    await b.eval("document.getElementById('btnSample').click()");
    item(await b.waitFor("window.__underline.screen === 'editor'", 20), "landing: Try it on a sample opens the editor");
    await b.open(BASE);
    await b.waitFor("window.UL && document.getElementById('galleryInput')", 15);
    await b.sleep(500);
    const txt = path.join(os.tmpdir(), "ul-not-an-image.txt");
    fs.writeFileSync(txt, "this is not a photo");
    await b.setFiles("#galleryInput", [txt]);
    const gotErr = await b.waitFor("window.__underline.screen === 'error-not-image' || window.__underline.screen.indexOf('error-') === 0", 15);
    const errScreen = await b.eval("window.__underline.screen");
    item(gotErr && errScreen === "error-not-image", "a text file gives the friendly not-an-image message", errScreen);
    await b.shot("pc-error-from-file.png");
    try { fs.unlinkSync(txt); } catch (e) { /* ignore */ }
    item(b.exceptions.length === 0, "landing buttons and bad file: no uncaught exceptions", problems(b));

    // ---- 5b. a tiny photo (400x300) gets the soft caption and still works ----
    {
      const tinyFile = path.join(os.tmpdir(), "ul-tiny-400x300.jpg");
      await b.open(BASE);
      await b.waitFor("window.UL && document.getElementById('galleryInput')", 15);
      await b.sleep(600);
      const dataUrl = await b.eval("(function(){var c=document.createElement('canvas');c.width=400;c.height=300;var x=c.getContext('2d');x.fillStyle='#f4eedf';x.fillRect(0,0,400,300);x.fillStyle='#222';x.font='15px serif';for(var i=0;i<13;i++){x.fillText('It was a bright cold day in April and the clocks were '+i,20,30+i*20);}return c.toDataURL('image/jpeg',0.9);})()");
      fs.writeFileSync(tinyFile, Buffer.from(dataUrl.split(",")[1], "base64"));
      await b.setFiles("#galleryInput", [tinyFile]);
      const tinyEditor = await b.waitFor("window.__underline.screen === 'editor'", 20);
      item(tinyEditor, "tiny photo: file input leads to the editor");
      await b.sleep(500);
      item(await b.eval("document.getElementById('smallNote').hidden === false"), "tiny photo: the soft caption shows");
      await swipe(b, "editCanvas", 0.15, 0.4, 0.85, 0.4);
      item(await b.eval("window.__underline.strokes.length") === 1, "tiny photo: a swipe adds a stroke");
      await b.eval("document.getElementById('btnNext').click()");
      item(await b.waitFor("window.__underline.screen === 'style' && !!window.__underline.card", 15), "tiny photo: Next reaches the style screen");
      await b.open(BASE + "?sample=1");
      await b.waitFor("window.__underline && window.__underline.screen === 'editor'", 20);
      await b.sleep(500);
      item(await b.eval("document.getElementById('smallNote').hidden === true"), "sample page: no soft caption");
      try { fs.unlinkSync(tinyFile); } catch (e) { /* ignore */ }
      item(b.errors.length === 0 && b.exceptions.length === 0, "tiny photo: no console errors or exceptions", problems(b));
    }

    // ---- 6. a real photo through the real file input ----
    const realDir = path.join(__dirname, "real");
    // tests/real/*.jpg plus the phone-style photos in tests/out/phone-*.jpg
    const outDir = path.join(__dirname, "out");
    const photos = (fs.existsSync(realDir) ? fs.readdirSync(realDir).filter(function (f) { return /\.(jpe?g|png)$/i.test(f); }).map(function (f) { return path.join(realDir, f); }) : [])
      .concat(fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(function (f) { return /^phone-.*\.jpe?g$/i.test(f); }).map(function (f) { return path.join(outDir, f); }) : []);
    if (!photos.length) {
      console.log("SKIP real photos: none in tests/real/");
    } else {
      for (const full of photos) {
        const name = path.basename(full);
        await b.open(BASE);
        await b.waitFor("window.UL && document.getElementById('galleryInput')", 15);
        await b.sleep(600);
        const t0 = Date.now();
        await b.setFiles("#galleryInput", [full]);
        const inEditor = await b.waitFor("window.__underline.screen === 'editor'", 40);
        item(inEditor, "real photo " + name + ": file input leads to the editor", (Date.now() - t0) + " ms");
        if (!inEditor) { await b.shot("pc-real-" + name + "-fail.png"); continue; }
        await b.sleep(500);
        const info = await b.eval("(function(){var p=window.__underline.page;return {w:p.width,h:p.height,lines:p.lines.length,warning:p.warning};})()");
        console.log("     page: " + JSON.stringify(info));
        // a page with no print (an endpaper, a picture) must warn and still work, never fail
        item(info.lines > 0 || info.warning === "no-lines", "real photo " + name + ": lines found, or the no-lines warning is set", info.lines + " lines, warning " + info.warning);
        const mid = await b.eval("(function(){var p=window.__underline.page;var l=p.lines[Math.floor(p.lines.length/3)];return l?{y:(l.top+l.bottom)/2/p.height,x0:l.x0/p.width,x1:l.x1/p.width}:{y:0.4,x0:0.2,x1:0.8};})()");
        await b.shot("pc-real-" + name + "-editor.png");
        await swipe(b, "editCanvas", Math.min(0.9, mid.x0 + 0.05), mid.y, Math.max(0.2, mid.x1 - 0.1), mid.y);
        item(await b.eval("window.__underline.strokes.length") === 1, "real photo " + name + ": a swipe adds a stroke");
        await b.shot("pc-real-" + name + "-stroke.png");
        await b.eval("document.getElementById('btnNext').click()");
        item(await b.waitFor("window.__underline.screen === 'style' && !!window.__underline.card", 15), "real photo " + name + ": Next reaches the style screen");
        await b.sleep(2200);
        await b.shot("pc-real-" + name + "-style.png");
        const f = await b.eval("(async function(){var f=await UL.export.makeImage(window.__underline.card);return {type:f.type,kb:Math.round(f.size/1024)};})()");
        item(f && f.type === "image/jpeg", "real photo " + name + ": makeImage works", JSON.stringify(f));
        item(b.errors.length === 0 && b.exceptions.length === 0, "real photo " + name + ": no console errors or exceptions", problems(b));
      }
    }
  } catch (e) {
    item(false, "page check ran to the end", e && e.message);
  } finally {
    await b.close();
  }
  console.log(fails ? "\nPAGE FAIL (" + fails + " failing)" : "\nPAGE PASS");
  process.exit(fails ? 1 : 0);
}

main();
