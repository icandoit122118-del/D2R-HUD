import ctypes
from ctypes import wintypes
import hashlib
import json
import os
import shutil

STORMLIB_DLL = r"C:\Users\icand\Downloads\D2R-Yupgoolg-20261025\stormlib\x64\StormLib.dll"
INSTALLED_MPQ = r"D:\Diablo II Resurrected\mods\yupgoolg\yupgoolg.mpq"
BACKUP_MPQ = r"D:\Diablo II Resurrected\mods\yupgoolg\yupgoolg.before-d2rhud.mpq"
PATCH_DIR = r"C:\Users\icand\.gemini\antigravity\scratch\D2R-HUD\mod\yupgoolg-patch\data\global\ui\layouts"
STANDALONE_MPQ = r"C:\Users\icand\.gemini\antigravity\scratch\D2R-HUD\mod\d2rhud\d2rhud.mpq"
RECEIPT_PATH = r"C:\Users\icand\.gemini\antigravity\scratch\D2R-HUD\mpq-install-receipt.json"

MPQ_FILE_COMPRESS = 0x00000200
MPQ_FILE_REPLACEEXISTING = 0x80000000
MPQ_COMPRESSION_ZLIB = 0x02

storm = ctypes.WinDLL(STORMLIB_DLL)

storm.SFileOpenArchive.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
storm.SFileOpenArchive.restype = wintypes.BOOL

storm.SFileCloseArchive.argtypes = [wintypes.HANDLE]
storm.SFileCloseArchive.restype = wintypes.BOOL

storm.SFileFlushArchive.argtypes = [wintypes.HANDLE]
storm.SFileFlushArchive.restype = wintypes.BOOL

storm.SFileAddFileEx.argtypes = [
    wintypes.HANDLE,
    wintypes.LPCWSTR,
    wintypes.LPCSTR,
    wintypes.DWORD,
    wintypes.DWORD,
    wintypes.DWORD,
]
storm.SFileAddFileEx.restype = wintypes.BOOL

storm.SFileHasFile.argtypes = [wintypes.HANDLE, wintypes.LPCSTR]
storm.SFileHasFile.restype = wintypes.BOOL

storm.SFileOpenFileEx.argtypes = [
    wintypes.HANDLE,
    wintypes.LPCSTR,
    wintypes.DWORD,
    ctypes.POINTER(wintypes.HANDLE),
]
storm.SFileOpenFileEx.restype = wintypes.BOOL

storm.SFileGetFileSize.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
storm.SFileGetFileSize.restype = wintypes.DWORD

storm.SFileReadFile.argtypes = [
    wintypes.HANDLE,
    wintypes.LPVOID,
    wintypes.DWORD,
    ctypes.POINTER(wintypes.DWORD),
    wintypes.LPVOID,
]
storm.SFileReadFile.restype = wintypes.BOOL

storm.SFileCloseFile.argtypes = [wintypes.HANDLE]
storm.SFileCloseFile.restype = wintypes.BOOL


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def read_mpq_file(hMpq, archived_name):
    hFile = wintypes.HANDLE()
    if not storm.SFileOpenFileEx(hMpq, archived_name.encode("utf-8"), 0, ctypes.byref(hFile)):
        raise RuntimeError(f"Failed to open {archived_name} in MPQ")
    try:
        high = wintypes.DWORD(0)
        size = storm.SFileGetFileSize(hFile, ctypes.byref(high))
        buf = ctypes.create_string_buffer(size)
        read_bytes = wintypes.DWORD(0)
        if not storm.SFileReadFile(hFile, buf, size, ctypes.byref(read_bytes), None):
            raise RuntimeError(f"Failed to read {archived_name} in MPQ")
        return buf.raw[: read_bytes.value]
    finally:
        storm.SFileCloseFile(hFile)


def main():
    if not os.path.exists(BACKUP_MPQ):
        shutil.copy2(INSTALLED_MPQ, BACKUP_MPQ)
        print(f"Created backup MPQ: {BACKUP_MPQ}")

    before_sha = sha256_file(INSTALLED_MPQ)

    hMpq = wintypes.HANDLE()
    if not storm.SFileOpenArchive(INSTALLED_MPQ, 0, 0, ctypes.byref(hMpq)):
        raise RuntimeError(f"Failed to open MPQ archive: {INSTALLED_MPQ}")

    injected = []
    try:
        for fname in sorted(os.listdir(PATCH_DIR)):
            if not fname.endswith(".json"):
                continue
            disk_path = os.path.join(PATCH_DIR, fname)
            mpq_path = f"data\\global\\ui\\layouts\\{fname}"
            flags = MPQ_FILE_COMPRESS | MPQ_FILE_REPLACEEXISTING
            ok = storm.SFileAddFileEx(
                hMpq,
                disk_path,
                mpq_path.encode("utf-8"),
                flags,
                MPQ_COMPRESSION_ZLIB,
                MPQ_COMPRESSION_ZLIB,
            )
            if not ok:
                err = ctypes.GetLastError()
                raise RuntimeError(f"SFileAddFileEx failed for {mpq_path} (WinError {err})")
            injected.append((disk_path, mpq_path))

        storm.SFileFlushArchive(hMpq)
    finally:
        storm.SFileCloseArchive(hMpq)

    # Re-open in read-only mode (0x100 = MPQ_OPEN_READ_ONLY) and verify every file
    hVerify = wintypes.HANDLE()
    if not storm.SFileOpenArchive(INSTALLED_MPQ, 0, 0x00000100, ctypes.byref(hVerify)):
        raise RuntimeError("Failed to reopen MPQ for verification")

    verified = []
    try:
        for disk_path, mpq_path in injected:
            has = bool(storm.SFileHasFile(hVerify, mpq_path.encode("utf-8")))
            raw_mpq = read_mpq_file(hVerify, mpq_path)
            with open(disk_path, "rb") as f:
                raw_disk = f.read()
            parsed = json.loads(raw_mpq.decode("utf-8"))
            match = raw_mpq == raw_disk
            if not (has and match):
                raise RuntimeError(f"Verification mismatch for {mpq_path}")
            verified.append(
                {
                    "mpqPath": mpq_path,
                    "panelType": parsed.get("type"),
                    "panelName": parsed.get("name"),
                    "bytes": len(raw_mpq),
                    "sha256": hashlib.sha256(raw_mpq).hexdigest(),
                    "verifiedInMpq": True,
                }
            )
    finally:
        storm.SFileCloseArchive(hVerify)

    after_sha = sha256_file(INSTALLED_MPQ)
    receipt = {
        "installedMpqPath": INSTALLED_MPQ,
        "backupMpqPath": BACKUP_MPQ,
        "beforeSha256": before_sha,
        "afterSha256": after_sha,
        "totalInjectedFiles": len(verified),
        "allVerifiedByteExact": True,
        "files": verified,
    }
    with open(RECEIPT_PATH, "w", encoding="utf-8") as f:
        json.dump(receipt, f, ensure_ascii=False, indent=2)

    print(f"Successfully injected and verified {len(verified)} native UI layouts into {INSTALLED_MPQ}")
    print(f"MPQ SHA256: {before_sha} -> {after_sha}")


if __name__ == "__main__":
    main()
