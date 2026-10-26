const { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');

const APP_VERSION = '1.3.0';
const GITHUB_REPO = 'icandoit122118-del/D2R-HUD';
const isDevServer = process.env.D2R_HUD_DEV === '1';
const isSelfTest = process.argv.includes('--verify-self-test') || process.env.D2R_HUD_SELF_TEST === '1';

let mainWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { bounds } = primaryDisplay;

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    hasShadow: false,
    enableLargerThanScreen: true,
    skipTaskbar: true,
    show: !isSelfTest,
  });

  // 개발자 도구 단축키 (F12)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // 자체 내장(Self-Contained) 오프라인 번들 로드 — 외부 서버(d2hud.pages.dev) 의존성 완전 제거
  const localDistIndex = path.join(__dirname, 'web', 'dist', 'index.html');
  if (isDevServer) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(localDistIndex);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // 시작 시 저장된 HUD 위치값 및 모니터 설정 강제 초기화 (주모니터 상단 중앙에서 시작)
    mainWindow.webContents.executeJavaScript(`
      localStorage.removeItem('hud-pos');
      localStorage.removeItem('selected-monitor-id');
    `).catch(() => {});

    const currentPrimary = screen.getPrimaryDisplay();
    mainWindow.webContents.send('primary-display-info', {
      id: currentPrimary.id,
      x: 0,
      y: 0,
      width: currentPrimary.bounds.width,
      height: currentPrimary.bounds.height,
    });

    if (isSelfTest) {
      runSelfTestVerification();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const handleDisplayChange = () => {
    const info = getAllDisplaysInfo();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const currentBounds = mainWindow.getBounds();
      const currentDisplay = screen.getDisplayMatching(currentBounds);

      mainWindow.setBounds({
        x: currentDisplay.bounds.x,
        y: currentDisplay.bounds.y,
        width: currentDisplay.bounds.width,
        height: currentDisplay.bounds.height,
      });
      mainWindow.webContents.send('all-displays-info', info);
    }
  };

  screen.on('display-metrics-changed', handleDisplayChange);
  screen.on('display-added', handleDisplayChange);
  screen.on('display-removed', handleDisplayChange);
}

async function runSelfTestVerification() {
  const receiptPath = process.env.D2R_HUD_VERIFY_OUT || path.join(os.tmpdir(), 'd2r-hud-verify-receipt.json');
  try {
    await new Promise((resolve) => setTimeout(resolve, 650));
    const probe = await mainWindow.webContents.executeJavaScript(`
      (async () => {
        const { ipcRenderer } = window.require('electron');
        const version = await ipcRenderer.invoke('get-app-version');
        const hudPanel = document.querySelector('.d2r-panel');
        const titleText = document.title;

        // 1. Open Horadric Tome (Runewords & Cubing) via toolbar button
        const tomeBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('title') || '').includes('호라드림 사전'));
        if (tomeBtn) tomeBtn.click();
        await new Promise(r => setTimeout(r, 180));

        const bodyTextAfterTome = document.body.innerText;
        const rwMatch = bodyTextAfterTome.match(/룬어 사전\\s*\\((\\d+)\\)/);
        const cubeMatch = bodyTextAfterTome.match(/호라드림의 함 큐빙\\s*\\((\\d+)\\)/);
        const rwCardsCount = document.querySelectorAll('.d2r-card').length;

        // 2. Switch to Cubing tab
        const cubeTabBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('호라드림의 함 큐빙'));
        if (cubeTabBtn) cubeTabBtn.click();
        await new Promise(r => setTimeout(r, 150));
        const cubeCardsCount = document.querySelectorAll('.d2r-card').length;

        // 3. Open Guide Editor panel
        const editorBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('title') || '').includes('가이드 선택 및 편집'));
        if (editorBtn) editorBtn.click();
        await new Promise(r => setTimeout(r, 150));
        const editorOpened = document.body.innerText.includes('성역 원정대 가이드 편집기');

        // 4. Open Settings panel
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => (b.getAttribute('title') || '').includes('환경 설정'));
        if (settingsBtn) settingsBtn.click();
        await new Promise(r => setTimeout(r, 150));
        const settingsOpened = document.body.innerText.includes('인게임 픽셀 자동 숨김');

        // 5. Verify local rune image asset loading inside packaged app
        const runeResp = await fetch('./data/portal-master/images/items/socketables/rune/Ber_Rune.png');
        const runeBlob = await runeResp.blob();

        return {
          ok: true,
          version,
          titleText,
          locationHref: window.location.href,
          hudBarMounted: !!hudPanel,
          runewordCount: rwMatch ? Number(rwMatch[1]) : 0,
          cubeRecipeCount: cubeMatch ? Number(cubeMatch[1]) : 0,
          rwCardsRendered: rwCardsCount,
          cubeCardsRendered: cubeCardsCount,
          editorOpened,
          settingsOpened,
          berRuneAssetBytes: runeBlob.size,
        };
      })()
    `);

    const receipt = {
      verifiedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      isPackaged: app.isPackaged,
      displays: getAllDisplaysInfo().displays.length,
      probe,
    };
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
    app.exit(0);
  } catch (err) {
    const errorReceipt = {
      verifiedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      ok: false,
      error: err && err.stack ? err.stack : String(err),
    };
    fs.writeFileSync(receiptPath, JSON.stringify(errorReceipt, null, 2), 'utf8');
    app.exit(1);
  }
}

// --- IPC Communication Logic ---

function getAllDisplaysInfo() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  return {
    displays: displays.map((d) => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primaryDisplay.id,
      relativeX: 0,
      relativeY: 0,
    })),
  };
}

ipcMain.on('get-all-displays-info', (event) => {
  event.reply('all-displays-info', getAllDisplaysInfo());
});

ipcMain.on('move-to-monitor', (event, monitorId) => {
  const displays = screen.getAllDisplays();
  const target = displays.find((d) => d.id.toString() === monitorId.toString());
  if (target && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBounds({
      x: target.bounds.x,
      y: target.bounds.y,
      width: target.bounds.width,
      height: target.bounds.height,
    });
    event.reply('primary-display-info', {
      id: target.id,
      x: 0,
      y: 0,
      width: target.bounds.width,
      height: target.bounds.height,
    });
  }
});

ipcMain.on('get-primary-display-info', (event) => {
  const info = getAllDisplaysInfo();
  const primary = info.displays.find((d) => d.isPrimary) || info.displays[0];
  if (primary) {
    event.reply('primary-display-info', {
      id: primary.id,
      x: primary.relativeX,
      y: primary.relativeY,
      width: primary.bounds.width,
      height: primary.bounds.height,
    });
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

// --- Auto-Hide Logic ---
let autoHideConfig = {
  enabled: false,
  x: 0,
  y: 0,
  targetColor: '#000000',
  tolerance: 30,
  interval: 500,
};

// --- Hotkey Registry ---
let currentToggleHotkey = 'Control+Q';
let manualHide = false;

const registerToggleHotkey = (accelerator) => {
  if (currentToggleHotkey) {
    try {
      globalShortcut.unregister(currentToggleHotkey);
    } catch (_) {}
  }
  try {
    const ret = globalShortcut.register(accelerator, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
          manualHide = true;
          stopAutoHide(false);
          writeLog('Manual HIDE (Hotkey) - Auto-hide suspended');
        } else {
          mainWindow.show();
          manualHide = false;
          if (autoHideConfig.enabled) {
            startAutoHide();
            writeLog('Manual SHOW (Hotkey) - Auto-hide resumed');
          } else {
            writeLog('Manual SHOW (Hotkey) - Auto-hide remains disabled (settings off)');
          }
        }
      }
    });
    if (ret) {
      currentToggleHotkey = accelerator;
      console.log('Registered toggle hotkey:', accelerator);
    }
  } catch (error) {
    console.error('Failed to register hotkey:', error);
  }
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function colorsMatch(c1, c2, tolerance) {
  if (!c1 || !c2) return false;
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance
  );
}

const logFilePath = path.join(os.tmpdir(), 'd2hud_autohide.log');
function writeLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch (_) {}
  console.log(msg);
}

// --- 픽셀 체크용 persistent PowerShell 프로세스 관리 ---
let pixelProcess = null;

function initPixelProcess() {
  if (pixelProcess || isSelfTest) return;

  const { spawn } = require('child_process');
  pixelProcess = spawn('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    '-',
  ]);

  const setupScript = `
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap(1, 1)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    function Get-PixelColor($px, $py) {
      $g.CopyFromScreen($px, $py, 0, 0, [System.Drawing.Size]::new(1, 1))
      $c = $bmp.GetPixel(0, 0)
      Write-Output "$($c.R),$($c.G),$($c.B)"
    }
  `;
  pixelProcess.stdin.write(setupScript + '\n');

  pixelProcess.stdout.on('data', (data) => {
    const stdout = data.toString().trim();
    if (!stdout) return;

    const parts = stdout.split(',');
    if (parts.length === 3) {
      const r = parseInt(parts[0], 10);
      const g = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        const isMatch = colorsMatch(
          { r, g, b },
          hexToRgb(autoHideConfig.targetColor),
          autoHideConfig.tolerance
        );

        if (mainWindow && !mainWindow.isDestroyed() && !manualHide) {
          if (isMatch) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
              writeLog(`HIDE pixel=(${r},${g},${b})`);
            }
          } else {
            if (!mainWindow.isVisible()) {
              mainWindow.show();
              writeLog(`SHOW pixel=(${r},${g},${b})`);
            }
          }
        }
      }
    }
  });

  pixelProcess.stderr.on('data', (data) => {
    console.error(`[PS Error] ${data}`);
  });

  pixelProcess.on('close', () => {
    pixelProcess = null;
    if (autoHideRunning) initPixelProcess();
  });
}

function checkPixel() {
  if (!pixelProcess) initPixelProcess();
  if (pixelProcess && pixelProcess.stdin && !pixelProcess.stdin.destroyed) {
    const cmd = `Get-PixelColor ${autoHideConfig.x} ${autoHideConfig.y}\n`;
    pixelProcess.stdin.write(cmd);
  }
}

let autoHideRunning = false;
let autoHideTimer = null;

function scheduleNextCheck() {
  if (!autoHideConfig.enabled || !autoHideRunning) return;
  autoHideTimer = setTimeout(async () => {
    await checkPixel();
    scheduleNextCheck();
  }, autoHideConfig.interval || 500);
}

function startAutoHide() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
  autoHideRunning = true;
  scheduleNextCheck();
}

function stopAutoHide(forceShow = true) {
  autoHideRunning = false;
  if (autoHideTimer) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
  if (forceShow && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
  }
}

ipcMain.on('toggle-auto-hide', (event, config) => {
  writeLog(
    `toggle-auto-hide received: enabled=${config.enabled} x=${config.x} y=${config.y} color=${config.targetColor}`
  );
  autoHideConfig = { ...autoHideConfig, ...config };
  if (autoHideConfig.enabled) startAutoHide();
  else stopAutoHide();
});

ipcMain.on('update-toggle-hotkey', (event, newHotkey) => {
  console.log('Updating toggle hotkey to:', newHotkey);
  registerToggleHotkey(newHotkey);
});

ipcMain.on('snap-pixel-color', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  try {
    win.hide();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const point = screen.getCursorScreenPoint();
    const targetDisplay = screen.getDisplayNearestPoint(point);
    const scaleFactor = targetDisplay.scaleFactor;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.floor(targetDisplay.size.width * scaleFactor),
        height: Math.floor(targetDisplay.size.height * scaleFactor),
      },
    });

    const source =
      sources.find(
        (s) =>
          (s.display_id && s.display_id.toString() === targetDisplay.id.toString()) ||
          (s.id && s.id.includes(targetDisplay.id.toString()))
      ) || sources[0];

    if (source) {
      const localX = point.x - targetDisplay.bounds.x;
      const localY = point.y - targetDisplay.bounds.y;
      const scaledX = Math.floor(localX * scaleFactor);
      const scaledY = Math.floor(localY * scaleFactor);

      const sampleSize = 3;
      const offset = Math.floor(sampleSize / 2);
      const pixelImg = source.thumbnail.crop({
        x: Math.max(0, scaledX - offset),
        y: Math.max(0, scaledY - offset),
        width: sampleSize,
        height: sampleSize,
      });
      const bitmap = pixelImg.toBitmap();

      if (bitmap.length >= 12) {
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let pc = 0;
        for (let i = 0; i < bitmap.length; i += 4) {
          bSum += bitmap[i];
          gSum += bitmap[i + 1];
          rSum += bitmap[i + 2];
          pc++;
        }
        const r = Math.floor(rSum / pc);
        const g = Math.floor(gSum / pc);
        const b = Math.floor(bSum / pc);
        const hexColor = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        console.log(`[Calibration] Captured at (${point.x}, ${point.y}) => ${hexColor}`);

        win.show();
        win.webContents.send('calibration-complete', {
          x: point.x,
          y: point.y,
          color: hexColor,
        });
        return;
      }
    }
    win.show();
    win.webContents.send('calibration-failed', 'No pixel data captured');
  } catch (err) {
    console.error('[Calibration] Snap Error:', err);
    if (win && !win.isDestroyed()) win.show();
    win.webContents.send('calibration-failed', err.message);
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

// --- File-based Guide Management ---

ipcMain.handle('save-guide-dialog', async (event, guideData) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: '가이드 파일 저장',
    defaultPath: `guide_${(guideData && guideData.meta && guideData.meta.title) || 'new'}.json`,
    filters: [
      { name: 'JSON 가이드 파일', extensions: ['json'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  });

  if (canceled || !filePath) return null;

  try {
    fs.writeFileSync(filePath, JSON.stringify(guideData, null, 2), 'utf8');
    return filePath;
  } catch (err) {
    console.error('Failed to save file:', err);
    throw err;
  }
});

ipcMain.handle('open-guide-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: '가이드 파일 열기',
    properties: ['openFile'],
    filters: [
      { name: 'JSON 가이드 파일', extensions: ['json'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  });

  if (canceled || filePaths.length === 0) return null;

  try {
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return { filePath, data: parsed };
  } catch (err) {
    console.error('Failed to open file:', err);
    throw err;
  }
});

ipcMain.handle('read-guide-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to read file:', err);
    return null;
  }
});

ipcMain.handle('save-guide-to-path', async (event, { filePath, guideData }) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(guideData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save to path:', err);
    throw err;
  }
});

ipcMain.handle('save-guide-direct', async (event, filePath, guideData) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(guideData, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save direct:', err);
    throw err;
  }
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('get-app-version', () => APP_VERSION);

ipcMain.handle('check-update', async () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_REPO}/releases/latest`,
      headers: { 'User-Agent': 'D2R-HUD-App' },
    };
    https
      .get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            if (!release || !release.tag_name) {
              resolve({
                hasUpdate: false,
                currentVersion: APP_VERSION,
                latestVersion: APP_VERSION,
                releaseNotes: '현재 최신 자체 내장 버전(v1.3.0)입니다.',
                downloadUrl: null,
                fileName: 'D2R-HUD-v1.3.0-win32-x64.zip',
                releaseName: `v${APP_VERSION}`,
              });
              return;
            }
            const latestVersion = release.tag_name.replace(/^v/, '');
            const hasUpdate = latestVersion !== APP_VERSION;
            const zipAsset = release.assets?.find((a) => a.name.endsWith('.zip'));
            const exeAsset = release.assets?.find((a) => a.name.endsWith('.exe'));
            const asset = zipAsset || exeAsset;
            resolve({
              hasUpdate,
              currentVersion: APP_VERSION,
              latestVersion,
              releaseNotes: release.body || '',
              downloadUrl: asset?.browser_download_url || null,
              fileName: asset?.name || 'D2R-HUD-Update.zip',
              releaseName: release.name || `v${latestVersion}`,
            });
          } catch (e) {
            reject(new Error('버전 정보를 파싱할 수 없습니다.'));
          }
        });
      })
      .on('error', () => reject(new Error('GitHub에 연결할 수 없습니다.')));
  });
});

ipcMain.handle('download-and-install-update', async (event, { downloadUrl, fileName }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: '업데이트 파일 저장',
    defaultPath: fileName,
    filters: [
      { name: 'Archive Files', extensions: ['zip', 'exe'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || !filePath) {
    return { success: false, reason: 'canceled' };
  }

  const doDownload = (url) =>
    new Promise((resolve, reject) => {
      try {
        const urlStr = typeof url === 'string' ? url : String(url);
        const urlObj = new URL(urlStr);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          protocol: urlObj.protocol,
          headers: { 'User-Agent': 'D2R-HUD-App' },
        };

        const lib = urlObj.protocol === 'http:' ? require('http') : https;

        lib
          .get(options, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              doDownload(res.headers.location).then(resolve).catch(reject);
              return;
            }

            if (res.statusCode !== 200) {
              reject(new Error(`다운로드 실패 (상태 코드: ${res.statusCode})`));
              return;
            }

            const total = parseInt(res.headers['content-length'] || '0', 10);
            let downloaded = 0;
            const file = fs.createWriteStream(filePath);

            res.on('data', (chunk) => {
              downloaded += chunk.length;
              file.write(chunk);
              if (total > 0) {
                const percent = Math.round((downloaded / total) * 100);
                event.sender.send('update-download-progress', {
                  percent,
                  downloaded,
                  total,
                });
              }
            });

            res.on('end', () => {
              file.end();
              resolve(filePath);
            });

            res.on('error', (err) => {
              file.end();
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
              reject(err);
            });
          })
          .on('error', (err) => {
            reject(err);
          });
      } catch (err) {
        reject(err);
      }
    });

  try {
    await doDownload(downloadUrl);
    event.sender.send('update-download-progress', {
      percent: 100,
      status: 'completed',
      filePath,
    });
    return { success: true, filePath };
  } catch (err) {
    console.error('Download error:', err);
    event.sender.send('update-download-progress', {
      percent: 0,
      status: 'error',
      message: err.message,
    });
    throw err;
  }
});

app.whenReady().then(() => {
  initPixelProcess();
  createWindow();
  registerToggleHotkey(currentToggleHotkey);
  globalShortcut.register('Control+F8', () => {
    if (mainWindow) mainWindow.webContents.send('cycle-monitor');
  });
  globalShortcut.register('Control+F9', () => {
    if (mainWindow) mainWindow.webContents.send('snap-to-corner', 'top-left');
  });
  globalShortcut.register('Control+F10', () => {
    if (mainWindow) mainWindow.webContents.send('snap-to-corner', 'top-right');
  });
  globalShortcut.register('Control+F11', () => {
    if (mainWindow) mainWindow.webContents.send('snap-to-corner', 'bottom-left');
  });
  globalShortcut.register('Control+F12', () => {
    if (mainWindow) mainWindow.webContents.send('snap-to-corner', 'bottom-right');
  });
  globalShortcut.register('Control+Right', () => {
    if (mainWindow) mainWindow.webContents.send('next-step');
  });
  globalShortcut.register('Control+Left', () => {
    if (mainWindow) mainWindow.webContents.send('prev-step');
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('will-quit', () => {
  if (pixelProcess) {
    pixelProcess.kill();
    pixelProcess = null;
    console.log('Persistent pixel process terminated.');
  }
  globalShortcut.unregisterAll();
});
