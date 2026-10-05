"""Test server (never deployed): serves the underline folder and has /hold?ms=N, which answers an empty script after N ms.
A test page loads <script src="/hold?ms=4000"> so that headless Edge keeps the page "loading" until the page's own async work has
finished. Run: python tests/engine/hold_server.py 8003   (stop it with Ctrl+C or by killing the process).
"""
import os, sys, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/hold":
            ms = int((parse_qs(u.query).get("ms") or ["3000"])[0])
            time.sleep(min(ms, 20000) / 1000.0)
            self.send_response(200); self.send_header("Content-Type", "application/javascript"); self.send_header("Content-Length", "0"); self.end_headers()
            return
        return super().do_GET()
    def log_message(self, *a):
        pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8003
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
