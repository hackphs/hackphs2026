from pathlib import Path
from urllib.parse import unquote
from wsgiref.simple_server import make_server
import mimetypes
import os


PORT = 3000
ROOT = Path(__file__).resolve().parent


def application(environ, start_response):
    path = unquote(environ.get("PATH_INFO", "/"))
    if path == "/":
        path = "/index.html"

    file_path = (ROOT / path.lstrip("/")).resolve()

    if ROOT not in file_path.parents and file_path != ROOT:
        body = b"Not found"
        start_response(
            "404 Not Found",
            [("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))],
        )
        return [body]

    if not file_path.is_file():
        body = b"Not found"
        start_response(
            "404 Not Found",
            [("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))],
        )
        return [body]

    body = file_path.read_bytes()
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    if content_type.startswith("text/"):
        content_type += "; charset=utf-8"

    start_response("200 OK", [("Content-Type", content_type), ("Content-Length", str(len(body)))])
    if environ.get("REQUEST_METHOD", "GET").upper() == "HEAD":
        return [b""]
    return [body]


if __name__ == "__main__":
    os.chdir(ROOT)
    url = f"http://localhost:{PORT}"
    print(f"Serving {ROOT} at {url}")
    print("Run: python wsgi.py")
    print("Press Ctrl+C to stop.")
    with make_server("127.0.0.1", PORT, application) as httpd:
        httpd.serve_forever()
