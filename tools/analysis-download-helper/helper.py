from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import request as urlrequest
from urllib.parse import urlparse
import json
import shutil
import subprocess
import tempfile

HOST = "127.0.0.1"
PORT = 17321
VERSION = "0.1.1"
YTDLP_SINGLE_FILE_FORMAT = "best[ext=mp4][acodec!=none][vcodec!=none]/best[acodec!=none][vcodec!=none]/best"


def app_dir():
    return Path(__file__).resolve().parent


def resolve_tool(name):
    candidates = [
        app_dir() / "bin" / f"{name}.exe",
        app_dir() / f"{name}.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    found = shutil.which(name)
    if found:
        return found
    found_exe = shutil.which(f"{name}.exe")
    if found_exe:
        return found_exe
    return None


def json_bytes(data):
    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def post_json(url, token, payload):
    body = json_bytes(payload)
    req = urlrequest.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urlrequest.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_chunk(url, token, chunk):
    req = urlrequest.Request(
        url,
        data=chunk,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
        },
    )
    with urlrequest.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def find_downloaded_file(directory):
    files = [p for p in Path(directory).iterdir() if p.is_file()]
    if not files:
        raise RuntimeError("视频解析失败，请检查当前网络环境后重试。")
    return max(files, key=lambda p: p.stat().st_size)


def download_video(source_url, output_dir):
    yt_dlp = resolve_tool("yt-dlp")
    if not yt_dlp:
        raise RuntimeError("解析组件缺少下载引擎，请重新安装解析组件。")

    output_template = str(Path(output_dir) / "source.%(ext)s")
    command = [
        yt_dlp,
        "--no-playlist",
        "--no-warnings",
        "-f",
        YTDLP_SINGLE_FILE_FORMAT,
        "--output",
        output_template,
        source_url,
    ]

    subprocess.run(
        command,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        timeout=300,
    )
    return find_downloaded_file(output_dir)


def upload_video(payload, file_path):
    saas_base = payload["saasBaseUrl"].rstrip("/")
    token = payload["authToken"]
    source_url = payload["sourceUrl"]
    project_name = payload.get("projectName") or "链接分析项目"
    chunk_size = int(payload.get("chunkSize") or 5 * 1024 * 1024)
    max_bytes = int(payload.get("maxBytes") or 100 * 1024 * 1024)
    file_size = file_path.stat().st_size

    if file_size <= 0:
        raise RuntimeError("视频解析失败，请检查当前网络环境后重试。")
    if file_size > max_bytes:
        raise RuntimeError("视频文件不能超过 100MB。")

    init_data = post_json(
        f"{saas_base}/api/analysis-master/upload/init",
        token,
        {
            "fileName": file_path.name,
            "fileSize": file_size,
            "chunkSize": chunk_size,
            "totalChunks": (file_size + chunk_size - 1) // chunk_size,
            "name": project_name,
            "sourceUrl": source_url,
        },
    )
    data = init_data.get("data") or {}
    upload_id = data["uploadId"]
    project_id = data["projectId"]
    key = data["key"]
    total_chunks = int(data["totalChunks"])

    with file_path.open("rb") as f:
        for index in range(total_chunks):
            chunk = f.read(chunk_size)
            post_chunk(
                f"{saas_base}/api/analysis-master/upload/upload?uploadId={upload_id}&chunkIndex={index}",
                token,
                chunk,
            )

    complete_data = post_json(
        f"{saas_base}/api/analysis-master/upload/complete",
        token,
        {
            "uploadId": upload_id,
            "projectId": project_id,
            "key": key,
            "name": project_name,
        },
    )
    return complete_data.get("data") or complete_data


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        body = json_bytes(data)
        origin = self.headers.get("Origin")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(200, {"success": True})

    def do_GET(self):
        if self.path != "/health":
            self.send_json(404, {"success": False, "error": "Not found"})
            return
        self.send_json(200, {"success": True, "version": VERSION})

    def do_POST(self):
        if self.path != "/v1/download":
            self.send_json(404, {"success": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length") or "0")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            origin = self.headers.get("Origin")
            saas_origin = "{uri.scheme}://{uri.netloc}".format(uri=urlparse(payload["saasBaseUrl"]))
            if origin and origin != saas_origin:
                self.send_json(403, {"success": False, "error": "请求来源不被允许。"})
                return

            with tempfile.TemporaryDirectory(prefix="am-helper-") as tmp:
                file_path = download_video(payload["sourceUrl"], tmp)
                result = upload_video(payload, file_path)
            self.send_json(200, {"success": True, "data": result})
        except subprocess.TimeoutExpired:
            self.send_json(500, {"success": False, "error": "视频解析超时，请检查当前网络环境后重试。"})
        except subprocess.CalledProcessError:
            self.send_json(500, {"success": False, "error": "视频解析失败，请检查当前网络环境后重试。"})
        except Exception as exc:
            self.send_json(500, {"success": False, "error": str(exc) or "视频解析失败，请检查当前网络环境后重试。"})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Analysis Download Helper {VERSION} listening on http://{HOST}:{PORT}")
    server.serve_forever()
