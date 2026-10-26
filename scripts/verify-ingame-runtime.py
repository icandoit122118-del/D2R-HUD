import ctypes
from ctypes import wintypes
import datetime
import hashlib
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, r"C:\Users\icand\Downloads\D2R-Yupgoolg-20261025\process-reader")
import psutil

D2R_DIR = r"D:\Diablo II Resurrected"
D2R_EXE = os.path.join(D2R_DIR, "D2R.exe")
BLZ_LOG = os.path.join(D2R_DIR, "blz-log.txt")
INSTALLED_MPQ = r"D:\Diablo II Resurrected\mods\yupgoolg\yupgoolg.mpq"
STORMLIB_DLL = r"C:\Users\icand\Downloads\D2R-Yupgoolg-20261025\stormlib\x64\StormLib.dll"
RECEIPT_OUT = r"C:\Users\icand\.gemini\antigravity\scratch\D2R-HUD\ingame-verification-receipt.json"
INSTALL_RECEIPT = r"C:\Users\icand\.gemini\antigravity\scratch\D2R-HUD\mpq-install-receipt.json"


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def verify_mpq_graph_and_links():
    storm = ctypes.WinDLL(STORMLIB_DLL)
    storm.SFileOpenArchive.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    storm.SFileOpenArchive.restype = wintypes.BOOL
    storm.SFileCloseArchive.argtypes = [wintypes.HANDLE]
    storm.SFileCloseArchive.restype = wintypes.BOOL
    storm.SFileOpenFileEx.argtypes = [wintypes.HANDLE, wintypes.LPCSTR, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    storm.SFileOpenFileEx.restype = wintypes.BOOL
    storm.SFileGetFileSize.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    storm.SFileGetFileSize.restype = wintypes.DWORD
    storm.SFileReadFile.argtypes = [wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), wintypes.LPVOID]
    storm.SFileReadFile.restype = wintypes.BOOL
    storm.SFileCloseFile.argtypes = [wintypes.HANDLE]
    storm.SFileCloseFile.restype = wintypes.BOOL

    def read_json_in_mpq(hMpq, rel):
        hFile = wintypes.HANDLE()
        if not storm.SFileOpenFileEx(hMpq, rel.encode("utf-8"), 0, ctypes.byref(hFile)):
            raise RuntimeError(f"Missing in MPQ: {rel}")
        try:
            high = wintypes.DWORD(0)
            sz = storm.SFileGetFileSize(hFile, ctypes.byref(high))
            buf = ctypes.create_string_buffer(sz)
            rd = wintypes.DWORD(0)
            storm.SFileReadFile(hFile, buf, sz, ctypes.byref(rd), None)
            return json.loads(buf.raw[: rd.value].decode("utf-8"))
        finally:
            storm.SFileCloseFile(hFile)

    hMpq = wintypes.HANDLE()
    if not storm.SFileOpenArchive(INSTALLED_MPQ, 0, 0x00000100, ctypes.byref(hMpq)):
        raise RuntimeError("Cannot open yupgoolg.mpq")

    try:
        # 1. Verify entry points trigger PanelManager:OpenPanel:D2RHudMainPanel / D2RHudTrackerPanel
        entry_checks = {}
        for entry_file in [
            "hudpanelhd.json",
            "mainmenubuttonribbonhd.json",
            "pauselayouthd.json",
            "playerinventoryexpansionlayouthd.json",
            "horadriccubelayouthd.json",
        ]:
            obj = read_json_in_mpq(hMpq, f"data\\global\\ui\\layouts\\{entry_file}")
            raw_str = json.dumps(obj, ensure_ascii=False)
            opens_main = "PanelManager:OpenPanel:D2RHudMainPanel" in raw_str
            opens_tracker = "PanelManager:OpenPanel:D2RHudTrackerPanel" in raw_str
            entry_checks[entry_file] = {
                "opensD2RHudMainPanel": opens_main,
                "opensD2RHudTrackerPanel": opens_tracker,
                "valid": opens_main or opens_tracker,
            }

        # 2. Verify D2RHudMainPanelhd.json and all 7 sub-panels
        main_panel = read_json_in_mpq(hMpq, "data\\global\\ui\\layouts\\D2RHudMainPanelhd.json")
        tabs_widget = next(c for c in main_panel["children"] if c["name"] == "OptionsTabs")
        tab_messages = tabs_widget["fields"]["tabMessages"]
        main_subpanels = []
        for msg in tab_messages:
            sub_name = msg.split(":")[-1]
            sub_rel = f"data\\global\\ui\\layouts\\{sub_name}hd.json"
            sub_obj = read_json_in_mpq(hMpq, sub_rel)
            table_rows = (
                sub_obj["children"][1]["children"][0]["children"]
                if len(sub_obj.get("children", [])) > 1
                else []
            )
            main_subpanels.append(
                {
                    "subPanelName": sub_name,
                    "mpqPath": sub_rel,
                    "type": sub_obj.get("type"),
                    "tableRowCount": len(table_rows),
                }
            )

        # 3. Verify D2RHudTrackerPanelhd.json and all 7 sub-panels
        tracker_panel = read_json_in_mpq(hMpq, "data\\global\\ui\\layouts\\D2RHudTrackerPanelhd.json")
        tracker_tabs = next(c for c in tracker_panel["children"] if c["name"] == "OptionsTabs")
        tracker_subpanels = []
        for msg in tracker_tabs["fields"]["tabMessages"]:
            sub_name = msg.split(":")[-1]
            sub_rel = f"data\\global\\ui\\layouts\\{sub_name}hd.json"
            sub_obj = read_json_in_mpq(hMpq, sub_rel)
            table_rows = (
                sub_obj["children"][1]["children"][0]["children"]
                if len(sub_obj.get("children", [])) > 1
                else []
            )
            tracker_subpanels.append(
                {
                    "subPanelName": sub_name,
                    "mpqPath": sub_rel,
                    "type": sub_obj.get("type"),
                    "tableRowCount": len(table_rows),
                }
            )

        return {
            "entryPointChecks": entry_checks,
            "mainEncyclopediaSubPanels": main_subpanels,
            "compactTrackerSubPanels": tracker_subpanels,
        }
    finally:
        storm.SFileCloseArchive(hMpq)


def main():
    graph_verification = verify_mpq_graph_and_links()

    # Launch D2R.exe -mod yupgoolg -txt directly and monitor runtime
    proc = subprocess.Popen(
        [D2R_EXE, "-mod", "yupgoolg", "-txt"],
        cwd=D2R_DIR,
    )
    print(f"Launched D2R.exe (PID={proc.pid}) with args: -mod yupgoolg -txt")

    samples = []
    opened_mod_files = set()
    max_rss = 0

    for i in range(16):
        time.sleep(1.0)
        for p in psutil.process_iter(["pid", "name", "cmdline", "memory_info"]):
            if (p.info.get("name") or "").lower() == "d2r.exe":
                rss = p.info["memory_info"].rss if p.info.get("memory_info") else 0
                if rss > max_rss:
                    max_rss = rss
                try:
                    for of in p.open_files():
                        if "mods" in of.path.lower() or "yupgoolg" in of.path.lower() or "d2rhud" in of.path.lower():
                            opened_mod_files.add(of.path)
                except Exception:
                    pass
                samples.append(
                    {
                        "second": i + 1,
                        "pid": p.info["pid"],
                        "cmdline": p.info.get("cmdline"),
                        "rssMB": round(rss / (1024 * 1024), 2),
                    }
                )

    blz_log_lines = []
    ui_parse_errors = []
    if os.path.exists(BLZ_LOG):
        with open(BLZ_LOG, "r", encoding="utf-8", errors="replace") as f:
            blz_log_lines = [line.strip() for line in f.readlines() if line.strip()]
        for line in blz_log_lines:
            low = line.lower()
            if ("error" in low or "fail" in low or "invalid" in low) and ("json" in low or "layout" in low or "d2rhud" in low or "panel" in low):
                ui_parse_errors.append(line)

    with open(INSTALL_RECEIPT, "r", encoding="utf-8") as f:
        install_data = json.load(f)

    # Cleanly stop the test game instance after collecting runtime evidence
    for p in psutil.process_iter(["pid", "name"]):
        if (p.info.get("name") or "").lower() == "d2r.exe":
            try:
                p.terminate()
            except Exception:
                pass

    receipt = {
        "verifiedAt": datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(),
        "gameExecutable": D2R_EXE,
        "launchCommand": f'"{D2R_EXE}" -mod yupgoolg -txt',
        "installedModMpq": INSTALLED_MPQ,
        "installedModMpqSha256": sha256_file(INSTALLED_MPQ),
        "standaloneModDir": r"D:\Diablo II Resurrected\mods\d2rhud\d2rhud.mpq",
        "runtimeVerification": {
            "launchedPid": proc.pid,
            "peakWorkingSetMB": round(max_rss / (1024 * 1024), 2),
            "openedModFilesByD2R": sorted(list(opened_mod_files)),
            "processSamplesCount": len(samples),
            "lastSample": samples[-1] if samples else None,
            "blzLogTail": blz_log_lines[-12:],
            "uiLayoutParseErrors": ui_parse_errors,
        },
        "uiPanelGraphVerification": graph_verification,
        "injectedMpqFilesSummary": {
            "totalFiles": install_data["totalInjectedFiles"],
            "allVerifiedByteExact": install_data["allVerifiedByteExact"],
        },
    }

    with open(RECEIPT_OUT, "w", encoding="utf-8") as f:
        json.dump(receipt, f, ensure_ascii=False, indent=2)

    print(f"Peak D2R.exe RSS: {receipt['runtimeVerification']['peakWorkingSetMB']} MB")
    print(f"Opened mod files by D2R.exe: {receipt['runtimeVerification']['openedModFilesByD2R']}")
    print(f"UI layout parse errors: {len(ui_parse_errors)}")
    print(f"Saved live verification receipt to: {RECEIPT_OUT}")


if __name__ == "__main__":
    main()
