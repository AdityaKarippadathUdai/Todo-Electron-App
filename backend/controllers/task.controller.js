import {
  createTask,
  deleteTask as deleteTaskById,
  getTasksByDate,
  getDueTasksForReminder,
  markTasksNotified,
  toggleTask as toggleTaskById
} from '../services/task.service.js';

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

export async function getDueReminders(windowStart, windowEnd) {
  return getDueTasksForReminder(windowStart, windowEnd);
}

export async function acknowledgeReminders(ids) {
  return markTasksNotified(ids);
}
