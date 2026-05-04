import { app } from 'electron';
import { createWindow } from './window.js';
import { setupTray } from './tray.js';

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let mainWindow = null;

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-oop-rasterization');
app.commandLine.appendSwitch(
  'disable-features',
  [
    'AutofillServerCommunication',
    'AutofillEnableAccountWalletStorage',
    'AutofillEnablePayments',
    'AutofillEnableOffers',
    'AutofillEnableManualFilling'
  ].join(',')
);

process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled rejection:', reason);
});

app.whenReady().then(() => {
  mainWindow = createWindow({ isDev });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  setupTray(mainWindow);
});

app.on('activate', () => {
  if (mainWindow == null) {
    mainWindow = createWindow({ isDev });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    setupTray(mainWindow);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
