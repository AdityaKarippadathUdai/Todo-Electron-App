import {
  createTask,
  deleteTask as deleteTaskById,
  getAllTasks as getAllTasksFromService,
  getTasksByDate,
  getDueTasksForReminder,
  markTasksNotified,
  snoozeTask as snoozeTaskById,
  toggleTask as toggleTaskById
} from '../services/task.service.js';

export async function getAllTasks() {
  return getAllTasksFromService();
}

export async function getTasks(date) {
  return getTasksByDate(date);
}

export async function addTask(task) {
  return createTask(task);
}

export async function toggleTask(id) {
  return toggleTaskById(id);
}

export async function deleteTask(id) {
  return deleteTaskById(id);
}

export async function snoozeTask(id, minutes) {
  return snoozeTaskById(id, minutes);
}

export async function getDueReminders(windowStart, windowEnd) {
  return getDueTasksForReminder(windowStart, windowEnd);
}

export async function acknowledgeReminders(ids) {
  return markTasksNotified(ids);
}
