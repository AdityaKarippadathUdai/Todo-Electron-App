import { BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function createWindow({ isDev = false } = {}) {
  const rendererUrl = path.join(projectRoot, 'renderer/index.html');
  let recoveryAttempts = 0;
  let recoveryTimer = null;

  const recoverWindow = (reason) => {
    if (recoveryTimer || recoveryAttempts >= 3 || win.isDestroyed()) {
      return;
    }

    recoveryAttempts += 1;
    recoveryTimer = setTimeout(() => {
      recoveryTimer = null;

      if (!win.isDestroyed()) {
        void win.loadFile(rendererUrl).catch((error) => {
          console.error('[main] Renderer recovery failed:', error, reason);
        });
      }
    }, 250);
  };

  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(projectRoot, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev
    }
  });

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show();
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    if (['crashed', 'abnormal-exit', 'killed', 'oom', 'launch-failed'].includes(details.reason)) {
      recoverWindow(details.reason);
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode !== -3) {
      recoverWindow(`${errorCode}: ${errorDescription}`);
    }
  });

  win.on('unresponsive', () => {
    recoverWindow('unresponsive');
  });

  win.on('closed', () => {
    if (recoveryTimer) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  });

  void win.loadFile(rendererUrl).catch((error) => {
    console.error('[main] Failed to load renderer:', error);
  });

  if (isDev) {
    win.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed()) {
        win.webContents.openDevTools({ mode: 'detach', activate: false });
      }
    });
  }

  return win;
}
