import { Tray, Menu } from 'electron';

export function setupTray(win) {
  const tray = new Tray('icon.png');

  const menu = Menu.buildFromTemplate([
    { label: 'Open', click: () => win.show() },
    { label: 'Quit', click: () => process.exit(0) }
  ]);

  tray.setContextMenu(menu);
}