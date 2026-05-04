const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ready: () => ipcRenderer.invoke('tasks:ready'),
  getAllTasks: () => ipcRenderer.invoke('tasks:getAll'),
  getTasks: (date) => ipcRenderer.invoke('tasks:getByDate', date),
  addTask: (task) => ipcRenderer.invoke('tasks:add', task),
  getDueReminders: (windowStart, windowEnd) => ipcRenderer.invoke('tasks:getDueReminders', windowStart, windowEnd),
  acknowledgeReminders: (ids) => ipcRenderer.invoke('tasks:acknowledgeReminders', ids),
  snoozeTask: (id, minutes) => ipcRenderer.invoke('tasks:snooze', id, minutes),
  toggleTask: (id) => ipcRenderer.invoke('tasks:toggle', id),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id)
});
