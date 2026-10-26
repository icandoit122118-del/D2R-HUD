const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const RE_DIR = 'C:/Users/icand/.gemini/antigravity/scratch/d2r-hud-re';
const OUT_DIR = path.join(ROOT, 'release', 'D2R-HUD-win32-x64');
const RECEIPT_PATH = path.join(ROOT, 'verification-receipt.json');

/**
 * Packs a directory or explicit file tree into an Electron ASAR archive buffer.
 * ASAR format:
 *   Bytes 0..3:   uint32LE(4)
 *   Bytes 4..7:   uint32LE(headerPickleSize)  -> alignedSize + 8
 *   Bytes 8..11:  uint32LE(headerPayloadSize) -> alignedSize + 4
 *   Bytes 12..15: uint32LE(headerStringLength)
 *   Bytes 16..16+alignedSize: header JSON UTF-8 padded with 0x00 to 4-byte boundary
 *   Followed by concatenated file payloads.
 */
function createAsarArchive(stagingDir, outputAsarPath) {
  const payloads = [];
  let currentOffset = 0;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const filesObj = {};
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        filesObj[entry.name] = { files: walk(fullPath) };
      } else if (entry.isFile()) {
        const buf = fs.readFileSync(fullPath);
        filesObj[entry.name] = {
          size: buf.length,
          offset: String(currentOffset),
        };
        payloads.push(buf);
        currentOffset += buf.length;
      }
    }
    return filesObj;
  }

  const headerObj = { files: walk(stagingDir) };
  const headerJsonBuf = Buffer.from(JSON.stringify(headerObj), 'utf8');
  const headerLen = headerJsonBuf.length;
  const alignedLen = Math.ceil(headerLen / 4) * 4;

  const preamble = Buffer.alloc(16 + alignedLen, 0);
  preamble.writeUInt32LE(4, 0);
  preamble.writeUInt32LE(alignedLen + 8, 4);
  preamble.writeUInt32LE(alignedLen + 4, 8);
  preamble.writeUInt32LE(headerLen, 12);
  headerJsonBuf.copy(preamble, 16);

  fs.mkdirSync(path.dirname(outputAsarPath), { recursive: true });
  const fd = fs.openSync(outputAsarPath, 'w');
  fs.writeSync(fd, preamble);
  for (const buf of payloads) {
    fs.writeSync(fd, buf);
  }
  fs.closeSync(fd);
  return { totalFilesBytes: currentOffset, asarBytes: fs.statSync(outputAsarPath).size };
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  const webDist = path.join(ROOT, 'web', 'dist', 'index.html');
  if (!fs.existsSync(webDist)) {
    throw new Error(`Missing web/dist/index.html at ${webDist}. Run 'npm run web:build' first.`);
  }

  // 1. Prepare staging directory for app.asar
  const stagingDir = path.join(ROOT, 'release', '.asar-staging');
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });

  fs.copyFileSync(path.join(ROOT, 'index.js'), path.join(stagingDir, 'index.js'));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(stagingDir, 'package.json'));
  copyDirRecursive(path.join(ROOT, 'web', 'dist'), path.join(stagingDir, 'web', 'dist'));

  // 2. Prepare standalone Electron runtime directory
  fs.mkdirSync(path.join(OUT_DIR, 'resources'), { recursive: true });
  const runtimeFiles = [
    'D2R-HUD.exe',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'd3dcompiler_47.dll',
    'ffmpeg.dll',
    'icudtl.dat',
    'libEGL.dll',
    'libGLESv2.dll',
    'LICENSE',
    'LICENSES.chromium.html',
    'resources.pak',
    'snapshot_blob.bin',
    'v8_context_snapshot.bin',
    'version',
    'vk_swiftshader.dll',
    'vk_swiftshader_icd.json',
    'vulkan-1.dll',
  ];
  for (const f of runtimeFiles) {
    const srcFile = path.join(RE_DIR, f);
    const dstFile = path.join(OUT_DIR, f);
    if (fs.existsSync(srcFile) && !fs.existsSync(dstFile)) {
      fs.copyFileSync(srcFile, dstFile);
    }
  }
  if (fs.existsSync(path.join(RE_DIR, 'locales')) && !fs.existsSync(path.join(OUT_DIR, 'locales'))) {
    copyDirRecursive(path.join(RE_DIR, 'locales'), path.join(OUT_DIR, 'locales'));
  }

  // 3. Build self-contained resources/app.asar
  const outputAsarPath = path.join(OUT_DIR, 'resources', 'app.asar');
  const asarStats = createAsarArchive(stagingDir, outputAsarPath);
  fs.rmSync(stagingDir, { recursive: true, force: true });
  console.log(`[ASAR] Packed self-contained app.asar (${asarStats.asarBytes} bytes) -> ${outputAsarPath}`);

  // 4. Execute headless self-test verification via D2R-HUD.exe --verify-self-test
  if (fs.existsSync(RECEIPT_PATH)) fs.unlinkSync(RECEIPT_PATH);
  const exePath = path.join(OUT_DIR, 'D2R-HUD.exe');
  console.log(`[VERIFY] Running ${exePath} --verify-self-test ...`);
  execFileSync(exePath, ['--verify-self-test'], {
    env: {
      ...process.env,
      D2R_HUD_SELF_TEST: '1',
      D2R_HUD_VERIFY_OUT: RECEIPT_PATH,
    },
    timeout: 25000,
  });

  const receipt = JSON.parse(fs.readFileSync(RECEIPT_PATH, 'utf8'));
  console.log('[VERIFY] Self-test receipt:', JSON.stringify(receipt, null, 2));
  if (!receipt.allPassed) {
    throw new Error('Self-test probe failed');
  }
}

main();
