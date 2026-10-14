import mimetypes
import os
import re
from pathlib import Path
from socketserver import ThreadingMixIn
from urllib.parse import unquote
from wsgiref.simple_server import WSGIServer, make_server


PORT = 3000
ROOT = Path(__file__).resolve().parent


class ThreadingWSGIServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


def application(environ, start_response):
    path = unquote(environ.get("PATH_INFO", "/"))
    if path == "/":
        path = "/index.html"

    file_path = (ROOT / path.lstrip("/")).resolve()
    if file_path.is_dir():
        file_path = file_path / "index.html"

    private_path = any(part.startswith(".") for part in Path(path).parts) or file_path.suffix == ".gs"
    if private_path or not file_path.is_relative_to(ROOT) or not file_path.is_file():
        body = b"Not found"
        start_response(
            "404 Not Found",
            [("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))],
        )
        return [body]

    size = file_path.stat().st_size
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    if content_type.startswith("text/"):
        content_type += "; charset=utf-8"

    headers = [("Content-Type", content_type), ("Accept-Ranges", "bytes")]
    method = environ.get("REQUEST_METHOD", "GET").upper()
    if method == "HEAD":
        start_response("200 OK", headers + [("Content-Length", str(size))])
        return []

    start, end = 0, size - 1
    range_header = environ.get("HTTP_RANGE")
    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        try:
            if not match or not any(match.groups()):
                raise ValueError("Invalid range")
            first, last = match.groups()
            if first:
                start = int(first)
                end = min(int(last), size - 1) if last else size - 1
            else:
                suffix = int(last)
                if suffix <= 0:
                    raise ValueError("Invalid suffix")
                start = max(0, size - suffix)
            if start > end or start >= size:
                raise ValueError("Unsatisfiable range")
        except ValueError:
            start_response("416 Range Not Satisfiable", headers + [("Content-Range", f"bytes */{size}"), ("Content-Length", "0")])
            return []
        status = "206 Partial Content"
        headers.append(("Content-Range", f"bytes {start}-{end}/{size}"))
    else:
        status = "200 OK"

    length = max(0, end - start + 1)
    start_response(status, headers + [("Content-Length", str(length))])

    def chunks():
        with file_path.open("rb") as stream:
            stream.seek(start)
            remaining = length
            while remaining:
                chunk = stream.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    return chunks()


if __name__ == "__main__":
    os.chdir(ROOT)
    url = f"http://localhost:{PORT}"
    print(f"Serving {ROOT} at {url}")
    print("Run: python wsgi.py")
    print("Press Ctrl+C to stop.")
    with make_server("127.0.0.1", PORT, application, server_class=ThreadingWSGIServer) as httpd:
        httpd.serve_forever()
