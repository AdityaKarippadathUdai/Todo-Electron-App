import { app } from 'electron';
import { createWindow } from './window.js';
import { setupTray } from './tray.js';

app.whenReady().then(() => {
  const win = createWindow();
  setupTray(win);
});
