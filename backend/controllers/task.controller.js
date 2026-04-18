import {
  createTask,
  deleteTask as deleteTaskById,
  getTasksByDate,
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
