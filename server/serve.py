#!/usr/bin/env python3
"""Sync server buat extension Iklan Aman.
Baca list domain dari rules.json (atau Redis kalau redis module + REDIS_URL),
serve GET /rules sebagai JSON.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

here = os.path.dirname(os.path.abspath(__file__))
RULES_FILE = os.path.join(here, "rules.json")
REDIS_URL = os.environ.get("REDIS_URL", "")


def load_domains():
    if REDIS_URL:
        try:
            from urllib.parse import urlparse
            import redis

            u = urlparse(REDIS_URL)
            r = redis.Redis(
                host=u.hostname or "127.0.0.1",
                port=u.port or 6379,
                db=int((u.path or "/0")[1:] or 0),
            )
            return [d.decode() for d in r.smembers("iklan_aman:blocked")]
        except Exception as e:
            print("redis error, fallback file:", e)
    with open(RULES_FILE) as f:
        return json.load(f).get("domains", [])


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip("/") != "/rules":
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps({"domains": load_domains()}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"listening :{port}  file={RULES_FILE}  redis={'on' if REDIS_URL else 'off'}")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()