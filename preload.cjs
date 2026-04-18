const { contextBridge } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const controllerModuleUrl = pathToFileURL(
  path.resolve(__dirname, 'backend/controllers/task.controller.js')
).href;

const controllerPromise = import(controllerModuleUrl);

async function withController(methodName, ...args) {
  const controller = await controllerPromise;
  const method = controller[methodName];

  if (typeof method !== 'function') {
    throw new Error(`Controller method "${methodName}" is not available.`);
  }

  return method(...args);
}

contextBridge.exposeInMainWorld('api', {
  ready: () => controllerPromise.then(() => true),
  getAllTasks: () => withController('getAllTasks'),
  getTasks: (date) => withController('getTasks', date),
  addTask: (task) => withController('addTask', task),
  getDueReminders: (windowStart, windowEnd) => withController('getDueReminders', windowStart, windowEnd),
  acknowledgeReminders: (ids) => withController('acknowledgeReminders', ids),
  snoozeTask: (id, minutes) => withController('snoozeTask', id, minutes),
  toggleTask: (id) => withController('toggleTask', id),
  deleteTask: (id) => withController('deleteTask', id)
});
