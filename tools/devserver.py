#!/usr/bin/env python3
"""本地开发服务器：明确禁用缓存，避免浏览器对 sw.js / app.js 做隐式缓存导致更新不生效。
用法：python3 tools/devserver.py   然后打开 http://localhost:8080"""
import http.server
import functools
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    Handler = functools.partial(NoCacheHandler, directory=ROOT)
    print(f'Serving {ROOT} at http://localhost:8080 (no-cache)')
    http.server.ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
