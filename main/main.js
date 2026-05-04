import { app, ipcMain } from 'electron';
import {
  acknowledgeReminders,
  addTask,
  deleteTask,
  getAllTasks,
  getDueReminders,
  getTasks,
  snoozeTask,
  toggleTask
} from '../backend/controllers/task.controller.js';
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

ipcMain.handle('tasks:ready', () => true);
ipcMain.handle('tasks:getAll', () => getAllTasks());
ipcMain.handle('tasks:getByDate', (_event, date) => getTasks(date));
ipcMain.handle('tasks:add', (_event, task) => addTask(task));
ipcMain.handle('tasks:getDueReminders', (_event, windowStart, windowEnd) => getDueReminders(windowStart, windowEnd));
ipcMain.handle('tasks:acknowledgeReminders', (_event, ids) => acknowledgeReminders(ids));
ipcMain.handle('tasks:snooze', (_event, id, minutes) => snoozeTask(id, minutes));
ipcMain.handle('tasks:toggle', (_event, id) => toggleTask(id));
ipcMain.handle('tasks:delete', (_event, id) => deleteTask(id));

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
