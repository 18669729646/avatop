import yt_dlp

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ctypes
import os
import sys
from pathlib import Path
from urllib import request as urlrequest
from urllib.parse import urlparse
import json
import shutil

import tempfile
import threading
import time
import traceback
from ctypes import wintypes

HOST = "127.0.0.1"
PORT = 17321
VERSION = "0.1.6"
YTDLP_SINGLE_FILE_FORMAT = "best[ext=mp4][acodec!=none][vcodec!=none]/best[acodec!=none][vcodec!=none]/best"
DEFAULT_REQUEST_TIMEOUT_SECONDS = 180
COMPLETE_UPLOAD_TIMEOUT_SECONDS = 600
LOG_LOCK = threading.Lock()
RUNNERS_LOCK = threading.Lock()
ACTIVE_RUNNERS = set()

if os.name == "nt":
    user32 = ctypes.windll.user32
    shell32 = ctypes.windll.shell32
    gdi32 = ctypes.windll.gdi32
    kernel32 = ctypes.windll.kernel32

    WM_USER = 0x0400
    WM_TRAYICON = WM_USER + 1
    WM_COMMAND = 0x0111
    WM_DESTROY = 0x0002
    WM_CLOSE = 0x0010
    WM_QUIT = 0x0012
    WM_RBUTTONUP = 0x0205
    WM_LBUTTONDBLCLK = 0x0203
    PM_REMOVE = 0x0001
    TPM_RIGHTBUTTON = 0x0002
    TPM_BOTTOMALIGN = 0x0020
    MF_STRING = 0x0000
    MF_SEPARATOR = 0x0800
    NIM_ADD = 0x00000000
    NIM_MODIFY = 0x00000001
    NIM_DELETE = 0x00000002
    NIF_MESSAGE = 0x00000001
    NIF_ICON = 0x00000002
    NIF_TIP = 0x00000004
    IMAGE_ICON = 1
    LR_LOADFROMFILE = 0x00000010
    LR_DEFAULTSIZE = 0x00000040
    IDI_APPLICATION = 32512
    IDOK = 1
    MB_OK = 0x00000000
    MB_ICONINFORMATION = 0x00000040
    IDM_STATUS = 1001
    IDM_OPEN_LOG = 1002
    IDM_EXIT = 1003
    LOG_DIR_NAME = "logs"
    LOG_FILE_NAME = "helper.log"

    LRESULT = ctypes.c_ssize_t
    WNDPROC = ctypes.WINFUNCTYPE(LRESULT, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)

    class POINT(ctypes.Structure):
        _fields_ = [("x", wintypes.LONG), ("y", wintypes.LONG)]

    class MSG(ctypes.Structure):
        _fields_ = [
            ("hwnd", wintypes.HWND),
            ("message", wintypes.UINT),
            ("wParam", wintypes.WPARAM),
            ("lParam", wintypes.LPARAM),
            ("time", wintypes.DWORD),
            ("pt", POINT),
            ("lPrivate", wintypes.DWORD),
        ]

    class WNDCLASSW(ctypes.Structure):
        _fields_ = [
            ("style", wintypes.UINT),
            ("lpfnWndProc", WNDPROC),
            ("cbClsExtra", ctypes.c_int),
            ("cbWndExtra", ctypes.c_int),
            ("hInstance", wintypes.HINSTANCE),
            ("hIcon", wintypes.HICON),
            ("hCursor", wintypes.HCURSOR),
            ("hbrBackground", wintypes.HBRUSH),
            ("lpszMenuName", wintypes.LPCWSTR),
            ("lpszClassName", wintypes.LPCWSTR),
        ]

    class NOTIFYICONDATAW(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("hWnd", wintypes.HWND),
            ("uID", wintypes.UINT),
            ("uFlags", wintypes.UINT),
            ("uCallbackMessage", wintypes.UINT),
            ("hIcon", wintypes.HICON),
            ("szTip", wintypes.WCHAR * 128),
            ("dwState", wintypes.DWORD),
            ("dwStateMask", wintypes.DWORD),
            ("szInfo", wintypes.WCHAR * 256),
            ("uTimeoutOrVersion", wintypes.UINT),
            ("szInfoTitle", wintypes.WCHAR * 64),
            ("dwInfoFlags", wintypes.DWORD),
        ]

    user32.RegisterClassW.argtypes = [ctypes.POINTER(WNDCLASSW)]
    user32.RegisterClassW.restype = wintypes.ATOM
    user32.CreateWindowExW.argtypes = [
        wintypes.DWORD,
        wintypes.LPCWSTR,
        wintypes.LPCWSTR,
        wintypes.DWORD,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_int,
        wintypes.HWND,
        wintypes.HMENU,
        wintypes.HINSTANCE,
        wintypes.LPVOID,
    ]
    user32.CreateWindowExW.restype = wintypes.HWND
    user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.DefWindowProcW.restype = LRESULT
    user32.DestroyWindow.argtypes = [wintypes.HWND]
    user32.DestroyWindow.restype = wintypes.BOOL
    user32.PostQuitMessage.argtypes = [ctypes.c_int]
    user32.PostQuitMessage.restype = None
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.PostMessageW.restype = wintypes.BOOL
    user32.GetMessageW.argtypes = [ctypes.POINTER(MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
    user32.GetMessageW.restype = ctypes.c_int
    user32.PeekMessageW.argtypes = [ctypes.POINTER(MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT, wintypes.UINT]
    user32.PeekMessageW.restype = wintypes.BOOL
    user32.TranslateMessage.argtypes = [ctypes.POINTER(MSG)]
    user32.TranslateMessage.restype = wintypes.BOOL
    user32.DispatchMessageW.argtypes = [ctypes.POINTER(MSG)]
    user32.DispatchMessageW.restype = LRESULT
    user32.CreatePopupMenu.argtypes = []
    user32.CreatePopupMenu.restype = wintypes.HMENU
    user32.AppendMenuW.argtypes = [wintypes.HMENU, wintypes.UINT, ctypes.c_size_t, wintypes.LPCWSTR]
    user32.AppendMenuW.restype = wintypes.BOOL
    user32.TrackPopupMenu.argtypes = [wintypes.HMENU, wintypes.UINT, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.HWND, ctypes.c_void_p]
    user32.TrackPopupMenu.restype = wintypes.BOOL
    user32.DestroyMenu.argtypes = [wintypes.HMENU]
    user32.DestroyMenu.restype = wintypes.BOOL
    user32.SetForegroundWindow.argtypes = [wintypes.HWND]
    user32.SetForegroundWindow.restype = wintypes.BOOL
    user32.GetCursorPos.argtypes = [ctypes.POINTER(POINT)]
    user32.GetCursorPos.restype = wintypes.BOOL
    user32.MessageBoxW.argtypes = [wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.UINT]
    user32.MessageBoxW.restype = ctypes.c_int

    shell32.Shell_NotifyIconW.argtypes = [ctypes.c_uint, ctypes.POINTER(NOTIFYICONDATAW)]
    shell32.Shell_NotifyIconW.restype = wintypes.BOOL
    user32.LoadImageW.argtypes = [wintypes.HINSTANCE, wintypes.LPCWSTR, wintypes.UINT, ctypes.c_int, ctypes.c_int, wintypes.UINT]
    user32.LoadImageW.restype = wintypes.HANDLE
    user32.DestroyIcon.argtypes = [wintypes.HICON]
    user32.DestroyIcon.restype = wintypes.BOOL

    _WND_CLASS_NAME = "AnalysisDownloadHelperTrayWindow"
    _TRAY_ICON_ID = 1
else:
    LOG_DIR_NAME = "logs"
    LOG_FILE_NAME = "helper.log"


def app_dir():
    return Path(__file__).resolve().parent


def runtime_dir():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return app_dir()


def json_bytes(data):
    return json.dumps(data, ensure_ascii=False).encode("utf-8")


def log_file_path():
    return runtime_dir() / LOG_DIR_NAME / LOG_FILE_NAME


def helper_log(message):
    line = f"[helper] {time.strftime('%Y-%m-%d %H:%M:%S')} {message}"
    log_path = log_file_path()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with LOG_LOCK:
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    try:
        print(line, flush=True)
    except Exception:
        pass


def post_json(url, token, payload, timeout=DEFAULT_REQUEST_TIMEOUT_SECONDS):
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
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_runner_json(url, runner_token, payload, timeout=DEFAULT_REQUEST_TIMEOUT_SECONDS):
    body = json_bytes(payload)
    req = urlrequest.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {runner_token}",
            "Content-Type": "application/json",
        },
    )
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_chunk(url, token, chunk, timeout=DEFAULT_REQUEST_TIMEOUT_SECONDS):
    req = urlrequest.Request(
        url,
        data=chunk,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
        },
    )
    with urlrequest.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def find_downloaded_file(directory):
    files = [p for p in Path(directory).iterdir() if p.is_file()]
    if not files:
        raise RuntimeError("视频解析失败，请检查当前网络环境后重试。")
    return max(files, key=lambda p: p.stat().st_size)


def download_video(source_url, output_dir):
    output_template = str(Path(output_dir) / "source.%(ext)s")
    helper_log("download start")

    ydl_opts = {
        "format": YTDLP_SINGLE_FILE_FORMAT,
        "outtmpl": output_template,
        "no_playlist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([source_url])
    except yt_dlp.utils.DownloadError as exc:
        raise RuntimeError(str(exc) or "视频解析失败") from exc
    except Exception as exc:
        raise RuntimeError(str(exc) or "视频解析失败，请检查当前网络环境后重试。") from exc

    file_path = find_downloaded_file(output_dir)
    helper_log(f"download done: {file_path.name} {file_path.stat().st_size} bytes")
    return file_path


def upload_video(payload, file_path):
    saas_base = payload["saasBaseUrl"].rstrip("/")
    token = payload["authToken"]
    source_url = payload["sourceUrl"]
    project_name = payload.get("projectName") or "链接分析项目"
    chunk_size = int(payload.get("chunkSize") or 512 * 1024)
    max_bytes = int(payload.get("maxBytes") or 100 * 1024 * 1024)
    file_size = file_path.stat().st_size

    if file_size <= 0:
        raise RuntimeError("视频解析失败，请检查当前网络环境后重试。")
    if file_size > max_bytes:
        raise RuntimeError("视频文件不能超过 100MB。")

    helper_log(f"upload init start: {file_path.name} {file_size} bytes")
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
            "projectId": payload.get("projectId"),
            "importRunId": payload.get("importRunId"),
            "importItemId": payload.get("importItemId"),
        },
    )
    data = init_data.get("data") or {}
    upload_id = data["uploadId"]
    project_id = data["projectId"]
    key = data["key"]
    total_chunks = int(data["totalChunks"])
    helper_log(f"upload init done: uploadId={upload_id} chunks={total_chunks}")

    with file_path.open("rb") as f:
        for index in range(total_chunks):
            chunk = f.read(chunk_size)
            helper_log(f"chunk upload start: {index + 1}/{total_chunks}")
            post_chunk(
                f"{saas_base}/api/analysis-master/upload/upload?uploadId={upload_id}&chunkIndex={index}",
                token,
                chunk,
            )
            helper_log(f"chunk upload done: {index + 1}/{total_chunks}")

    helper_log("complete upload start")
    complete_data = post_json(
        f"{saas_base}/api/analysis-master/upload/complete",
        token,
        {
            "uploadId": upload_id,
            "projectId": project_id,
            "key": key,
            "name": project_name,
        },
        timeout=COMPLETE_UPLOAD_TIMEOUT_SECONDS,
    )
    helper_log("complete upload done")
    return complete_data.get("data") or complete_data


def fail_import_item(saas_base, runner_token, run_id, item_id, message):
    try:
        post_runner_json(
            f"{saas_base}/api/analysis-master/import-runs/{run_id}/items/{item_id}/fail",
            runner_token,
            {"error": message, "maxRetries": 1},
        )
    except Exception as exc:
        helper_log(f"item fail callback failed: {item_id} {exc}")


def run_import_runner(payload):
    run_id = payload["runId"]
    saas_base = payload["saasBaseUrl"].rstrip("/")
    runner_token = payload["runnerToken"]
    auth_token = payload["authToken"]
    concurrency = max(1, min(int(payload.get("concurrency") or 3), 3))
    worker_id = payload.get("workerId") or f"helper-{VERSION}"

    helper_log(f"import run start: {run_id}")
    try:
        while True:
            claim = post_runner_json(
                f"{saas_base}/api/analysis-master/import-runs/{run_id}/claim",
                runner_token,
                {"workerId": worker_id, "limit": concurrency},
            )
            items = (claim.get("data") or {}).get("items") or []
            if not items:
                helper_log(f"import run empty: {run_id}")
                break

            for item in items:
                item_id = item["id"]
                item_payload = {
                    "sourceUrl": item["sourceUrl"],
                    "projectName": (item.get("metadata") or {}).get("name") or (item.get("metadata") or {}).get("title") or "链接分析项目",
                    "saasBaseUrl": saas_base,
                    "authToken": auth_token,
                    "chunkSize": int(payload.get("chunkSize") or 512 * 1024),
                    "maxBytes": int(payload.get("maxBytes") or 100 * 1024 * 1024),
                    "projectId": item["projectId"],
                    "importRunId": run_id,
                    "importItemId": item_id,
                }
                try:
                    helper_log(f"import item start: {item_id}")
                    with tempfile.TemporaryDirectory(prefix="am-helper-") as tmp:
                        file_path = download_video(item_payload["sourceUrl"], tmp)
                        upload_video(item_payload, file_path)
                    helper_log(f"import item done: {item_id}")
                except Exception as exc:
                    msg = str(exc) or "视频解析失败，请检查当前网络环境后重试。"
                    helper_log(f"import item failed: {item_id} {msg}")
                    fail_import_item(saas_base, runner_token, run_id, item_id, msg)
    finally:
        with RUNNERS_LOCK:
            ACTIVE_RUNNERS.discard(run_id)
        helper_log(f"import run stopped: {run_id}")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        helper_log(format % args)

    def send_json(self, status, data):
        try:
            body = json_bytes(data)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionAbortedError, OSError) as exc:
            helper_log(f"response dropped: {exc}")
            raise
        except Exception as exc:
            helper_log(f"send_json failed: {exc}")
            helper_log(traceback.format_exc())
            raise

    def do_OPTIONS(self):
        self.send_json(200, {"success": True})

    def do_GET(self):
        helper_log(f"health request received: {self.path}")
        if self.path != "/health":
            self.send_json(404, {"success": False, "error": "Not found"})
            return
        self.send_json(200, {"success": True, "version": VERSION})
        helper_log("health response sent")

    def do_POST(self):
        if self.path == "/v1/import-run/start":
            try:
                helper_log("import run request received")
                length = int(self.headers.get("Content-Length") or "0")
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                run_id = payload["runId"]
                origin = self.headers.get("Origin")
                saas_origin = "{uri.scheme}://{uri.netloc}".format(uri=urlparse(payload["saasBaseUrl"]))
                if origin and origin != saas_origin:
                    self.send_json(403, {"success": False, "error": "请求来源不被允许。"})
                    return

                with RUNNERS_LOCK:
                    if run_id not in ACTIVE_RUNNERS:
                        ACTIVE_RUNNERS.add(run_id)
                        threading.Thread(
                            target=run_import_runner,
                            args=(payload,),
                            name=f"analysis-import-run-{run_id}",
                            daemon=True,
                        ).start()

                self.send_json(200, {"success": True, "data": {"runId": run_id, "status": "started"}})
            except Exception as exc:
                helper_log(f"import run request failed: {exc}")
                self.send_json(500, {"success": False, "error": str(exc) or "启动批量解析失败"})
            return

        if self.path != "/v1/download":
            self.send_json(404, {"success": False, "error": "Not found"})
            return

        try:
            helper_log("request received")
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
            try:
                self.send_json(200, {"success": True, "data": result})
            except (BrokenPipeError, ConnectionAbortedError, OSError) as exc:
                helper_log(f"success response dropped: {exc}")
                return
            helper_log("request done")
        except Exception as exc:
            msg = str(exc) or "视频解析失败，请检查当前网络环境后重试。"
            helper_log(f"request failed: {msg}")
            self.send_json(500, {"success": False, "error": msg})


class TrayApp:
    def __init__(self):
        self.server = None
        self.hwnd = None
        self.icon_handle = None
        self._window_proc_ref = None
        self._exit_requested = threading.Event()
        self._icon_path = runtime_dir() / "favicon.ico"

    def start_server(self):
        self.server = ThreadingHTTPServer((HOST, PORT), Handler)

    def _load_icon(self):
        if not self._icon_path.exists():
            raise RuntimeError(f"托盘图标不存在: {self._icon_path}")
        icon_handle = user32.LoadImageW(
            None,
            str(self._icon_path),
            IMAGE_ICON,
            0,
            0,
            LR_LOADFROMFILE | LR_DEFAULTSIZE,
        )
        if not icon_handle:
            raise RuntimeError("无法加载托盘图标")
        return icon_handle

    def _notify_icon(self, action):
        nid = NOTIFYICONDATAW()
        nid.cbSize = ctypes.sizeof(NOTIFYICONDATAW)
        nid.hWnd = self.hwnd
        nid.uID = _TRAY_ICON_ID
        nid.uFlags = NIF_MESSAGE | NIF_ICON
        nid.uCallbackMessage = WM_TRAYICON
        nid.hIcon = self.icon_handle
        if not shell32.Shell_NotifyIconW(action, ctypes.byref(nid)):
            raise RuntimeError("托盘图标更新失败")

    def _show_status(self):
        helper_log("tray status requested")
        user32.MessageBoxW(
            self.hwnd,
            f"Analysis Download Helper is running on http://{HOST}:{PORT}",
            "Analysis Download Helper",
            MB_OK | MB_ICONINFORMATION,
        )

    def _open_log(self):
        helper_log("tray open log requested")
        log_path = log_file_path()
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.touch(exist_ok=True)
        os.startfile(str(log_path))

    def _shutdown_async(self):
        try:
            if self.server:
                self.server.shutdown()
                self.server.server_close()
        finally:
            if self.hwnd:
                user32.PostMessageW(self.hwnd, WM_CLOSE, 0, 0)

    def _request_exit(self):
        if self._exit_requested.is_set():
            return
        self._exit_requested.set()
        helper_log("tray exit requested")
        threading.Thread(target=self._shutdown_async, name="analysis-download-helper-shutdown", daemon=True).start()

    def _show_menu(self):
        menu = user32.CreatePopupMenu()
        try:
            user32.AppendMenuW(menu, MF_STRING, IDM_STATUS, "状态")
            user32.AppendMenuW(menu, MF_STRING, IDM_OPEN_LOG, "打开日志")
            user32.AppendMenuW(menu, MF_SEPARATOR, 0, None)
            user32.AppendMenuW(menu, MF_STRING, IDM_EXIT, "退出")
            point = POINT()
            user32.GetCursorPos(ctypes.byref(point))
            user32.SetForegroundWindow(self.hwnd)
            user32.TrackPopupMenu(
                menu,
                TPM_RIGHTBUTTON | TPM_BOTTOMALIGN,
                point.x,
                point.y,
                0,
                self.hwnd,
                None,
            )
        finally:
            user32.DestroyMenu(menu)

    def _window_proc(self, hwnd, msg, wparam, lparam):
        if msg == WM_TRAYICON:
            if lparam == WM_RBUTTONUP:
                self._show_menu()
            elif lparam == WM_LBUTTONDBLCLK:
                self._show_status()
            return 0
        if msg == WM_COMMAND:
            command_id = int(wparam) & 0xFFFF
            if command_id == IDM_STATUS:
                self._show_status()
            elif command_id == IDM_OPEN_LOG:
                self._open_log()
            elif command_id == IDM_EXIT:
                self._request_exit()
            return 0
        if msg == WM_CLOSE:
            user32.DestroyWindow(hwnd)
            return 0
            if msg == WM_DESTROY:
                try:
                    self._notify_icon(NIM_DELETE)
                except Exception:
                    pass
            if self.icon_handle:
                try:
                    user32.DestroyIcon(self.icon_handle)
                except Exception:
                    pass
                self.icon_handle = None
            user32.PostQuitMessage(0)
            return 0
        return user32.DefWindowProcW(hwnd, msg, wparam, lparam)

    def _start_tray_window(self):
        if os.name != "nt":
            return

        class_name = _WND_CLASS_NAME
        self.icon_handle = self._load_icon()
        wnd_proc = WNDPROC(self._window_proc)
        self._window_proc_ref = wnd_proc
        window_class = WNDCLASSW()
        window_class.style = 0
        window_class.lpfnWndProc = wnd_proc
        window_class.cbClsExtra = 0
        window_class.cbWndExtra = 0
        window_class.hInstance = kernel32.GetModuleHandleW(None)
        window_class.hIcon = self.icon_handle
        window_class.hCursor = None
        window_class.hbrBackground = None
        window_class.lpszMenuName = None
        window_class.lpszClassName = class_name
        atom = user32.RegisterClassW(ctypes.byref(window_class))
        if not atom:
            raise RuntimeError("无法注册托盘窗口类")

        self.hwnd = user32.CreateWindowExW(
            0,
            class_name,
            class_name,
            0,
            0,
            0,
            0,
            0,
            None,
            None,
            window_class.hInstance,
            None,
        )
        if not self.hwnd:
            raise RuntimeError("无法创建托盘窗口")

        self._notify_icon(NIM_ADD)
        helper_log("tray icon added")

    def _run_tray_thread(self):
        try:
            self._start_tray_window()
            message = MSG()
            while not self._exit_requested.is_set():
                has_message = user32.PeekMessageW(ctypes.byref(message), None, 0, 0, PM_REMOVE)
                if has_message:
                    if message.message == WM_QUIT:
                        break
                    user32.TranslateMessage(ctypes.byref(message))
                    user32.DispatchMessageW(ctypes.byref(message))
                else:
                    time.sleep(0.05)
        except Exception as exc:
            helper_log(f"tray loop failed: {exc}")
            helper_log(traceback.format_exc())
            self._request_exit()
        finally:
            self._cleanup_tray()

    def _cleanup_tray(self):
        if self.hwnd:
            try:
                self._notify_icon(NIM_DELETE)
            except Exception:
                pass
        if self.icon_handle:
            try:
                user32.DestroyIcon(self.icon_handle)
            except Exception:
                pass
            self.icon_handle = None
        if self.hwnd:
            try:
                user32.DestroyWindow(self.hwnd)
            except Exception:
                pass
            self.hwnd = None

    def run(self):
        self.start_server()
        helper_log(f"tray ready on http://{HOST}:{PORT}")
        if os.name != "nt":
            try:
                self.server.serve_forever()
            finally:
                self.server.server_close()
            return

        tray_thread = threading.Thread(
            target=self._run_tray_thread,
            name="analysis-download-helper-tray",
            daemon=True,
        )
        tray_thread.start()
        try:
            self.server.serve_forever()
        finally:
            self._exit_requested.set()
            self.server.server_close()


def main():
    app = TrayApp()
    app.run()


if __name__ == "__main__":
    main()
