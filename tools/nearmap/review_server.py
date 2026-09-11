#!/usr/bin/env python3
"""Local static server that can PUT reviewer edits.

GET/HEAD: files under cwd (repo root).
PUT: only {delivery}/ai/edits/regions.json — never ai/original/.

  python tools/nearmap/review_server.py 8899
"""
from __future__ import annotations

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

MAX_PUT = 20 * 1024 * 1024


def edits_dest(rel: str, root: Path) -> Path | None:
    rel = rel.replace("\\", "/").lstrip("/")
    parts = [p for p in rel.split("/") if p]
    if ".." in parts:
        return None
    if len(parts) < 4:
        return None
    if parts[-1] != "regions.json" or parts[-2] != "edits" or parts[-3] != "ai":
        return None
    if "original" in parts:
        return None
    dest = (root / "/".join(parts)).resolve()
    try:
        dest.relative_to(root.resolve())
    except ValueError:
        return None
    return dest


class ReviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        path = (self.path or "").split("?", 1)[0].lower()
        if path.endswith(".html") or path.endswith(".js"):
            self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_PUT(self):
        root = Path.cwd()
        dest = edits_dest(self.path.split("?", 1)[0], root)
        if dest is None:
            self.send_error(403, "PUT is only allowed for ai/edits/regions.json")
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length < 2 or length > MAX_PUT:
            self.send_error(400, "bad Content-Length")
            return
        body = self.rfile.read(length)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
    print("Nearmap review server on http://127.0.0.1:%s (PUT only ai/edits/regions.json)" % port)
    ThreadingHTTPServer(("127.0.0.1", port), ReviewHandler).serve_forever()
