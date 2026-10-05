// Tiny helper for the page checks (copied from ../doodle-alive/tests/cdp.js; port 9334): starts one headless Edge with a temporary profile, talks to it over the DevTools
// protocol using Node's built-in WebSocket and fetch (no npm packages), and always closes Edge again.
//   const { launch } = require("./cdp");
//   const b = await launch({ width: 390, height: 844, dpr: 1 });
//   await b.open(url); await b.eval("1+1"); await b.shot("file.png"); await b.close();
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9334;
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function launch(opts) {
  opts = opts || {};
  if (typeof WebSocket === "undefined") throw new Error("this Node has no global WebSocket (needs Node 22+): " + process.version);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ul-edge-"));
  const proc = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=" + profile, "--remote-debugging-port=" + PORT, "--window-size=" + (opts.width || 390) + "," + (opts.height || 844),
    "about:blank"
  ], { stdio: "ignore" });
  let ws = null;
  let closed = false;
  const b = { logs: [], errors: [], exceptions: [], failedRequests: [], ignored: [] };

  b.close = async function () {
    if (closed) return;
    closed = true;
    try { if (ws) ws.close(); } catch (e) { /* ignore */ }
    try { execFileSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" }); } catch (e) { try { proc.kill(); } catch (e2) { /* ignore */ } }
    await sleep(600);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  };
  const bail = function () { b.close(); };
  process.on("exit", bail);

  try {
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await sleep(500);
      try {
        const list = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
        target = list.filter(function (t) { return t.type === "page"; })[0] || null;
      } catch (e) { /* not up yet */ }
    }
    if (!target) throw new Error("Edge did not start");
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = function () { rej(new Error("ws error")); }; });
    let id = 0;
    const waiting = {};
    ws.onmessage = function (m) {
      const d = JSON.parse(m.data);
      if (d.id && waiting[d.id]) { waiting[d.id](d); delete waiting[d.id]; return; }
      if (d.method === "Runtime.consoleAPICalled") {
        const text = d.params.args.map(function (a) { return a.value !== undefined ? a.value : (a.description || a.type); }).join(" ");
        b.logs.push({ type: d.params.type, text: text });
        if (d.params.type === "error") b.errors.push(text);
      } else if (d.method === "Runtime.exceptionThrown") {
        const x = d.params.exceptionDetails;
        b.exceptions.push((x.exception && x.exception.description) || x.text);
      } else if (d.method === "Log.entryAdded") {
        const e = d.params.entry;
        // the one allowed failure: the Vercel analytics script does not exist on a local server (404). Anything else still counts.
        const isAnalytics404 = /\/_vercel\/insights\/script\.js/.test(e.url || "") && /404|Failed to load resource/i.test(e.text || "");
        if (isAnalytics404) b.ignored.push(e.url);
        else if (e.level === "error") b.errors.push("[" + e.source + "] " + e.text + (e.url ? " " + e.url : ""));
      }
    };
    b.send = function (method, params) {
      return new Promise(function (res) { const i = ++id; waiting[i] = res; ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); });
    };
    // evaluate in the page; promises are awaited; returns the value (or throws with the page's message)
    b.eval = async function (expr) {
      const r = await b.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result && r.result.exceptionDetails) {
        const x = r.result.exceptionDetails;
        throw new Error((x.exception && x.exception.description) || x.text);
      }
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    b.waitFor = async function (expr, seconds) {
      const t0 = Date.now();
      while (Date.now() - t0 < (seconds || 20) * 1000) {
        let v = false;
        try { v = await b.eval(expr); } catch (e) { v = false; }
        if (v) return true;
        await sleep(250);
      }
      return false;
    };
    b.open = async function (url) {
      b.errors.length = 0; b.exceptions.length = 0; b.logs.length = 0;
      await b.send("Page.navigate", { url: url });
      await sleep(300);
    };
    b.shot = async function (name) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const r = await b.send("Page.captureScreenshot", { format: "png" });
      const file = path.join(SHOTS, name);
      fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
      return file;
    };
    // put files into an <input type=file> the way a person's picker would (fires the change event)
    b.setFiles = async function (selector, files) {
      const doc = await b.send("DOM.getDocument", {});
      const q = await b.send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: selector });
      await b.send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: files });
    };
    b.sleep = sleep;
    await b.send("Runtime.enable");
    await b.send("Page.enable");
    await b.send("Log.enable");
    await b.send("DOM.enable");
    await b.send("Emulation.setDeviceMetricsOverride", {
      width: opts.width || 390, height: opts.height || 844, deviceScaleFactor: opts.dpr || 1, mobile: opts.mobile !== false
    });
    if (opts.mobile !== false) await b.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    return b;
  } catch (e) {
    await b.close();
    throw e;
  }
}

module.exports = { launch: launch, sleep: sleep };
