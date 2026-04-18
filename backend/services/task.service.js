import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getAllTasks() {
  return prisma.task.findMany({
    orderBy: [
      { dueDate: 'asc' },
      { dueTime: 'asc' },
      { createdAt: 'asc' }
    ]
  });
}

export async function getTasksByDate(date) {
  const { start, end } = getDayRange(date);

  return prisma.task.findMany({
    where: {
      dueDate: {
        gte: start,
        lte: end
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
}

export async function createTask(data) {
  const taskInput = normalizeTaskInput(data);

  return prisma.task.create({
    data: {
      title: taskInput.title,
      dueDate: taskInput.dueDate,
      dueTime: taskInput.dueTime,
      notified: false,
      completed: false
    }
  });
}

export async function toggleTask(id) {
  const task = await prisma.task.findUnique({ where: { id } });

  return prisma.task.update({
    where: { id },
    data: { completed: !task.completed }
  });
}

export async function snoozeTask(id, minutes = 10) {
  const task = await prisma.task.findUnique({ where: { id } });

  if (!task) {
    throw new Error('Task not found.');
  }

  const nextSchedule = getSnoozedSchedule(task, minutes);

  return prisma.task.update({
    where: { id },
    data: {
      dueDate: nextSchedule.dueDate,
      dueTime: nextSchedule.dueTime,
      notified: false
    }
  });
}

export async function deleteTask(id) {
  return prisma.task.delete({ where: { id } });
}

export async function getDueTasksForReminder(windowStart, windowEnd) {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const rangeStart = new Date(start);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      notified: false,
      dueTime: {
        not: null
      },
      dueDate: {
        gte: rangeStart,
        lte: rangeEnd
      }
    },
    orderBy: {
      dueDate: 'asc'
    }
  });

  return tasks.filter((task) => {
    const dueAt = combineSchedule(task.dueDate, task.dueTime);
    return dueAt >= start && dueAt <= end;
  });
}

export async function markTasksNotified(ids) {
  const taskIds = Array.isArray(ids) ? ids.filter(Boolean) : [];

  if (taskIds.length === 0) {
    return { count: 0 };
  }

  return prisma.task.updateMany({
    where: {
      id: {
        in: taskIds
      }
    },
    data: {
      notified: true
    }
  });
}

function normalizeTaskInput(data) {
  const title = String(data?.title ?? '').trim();

  if (!title) {
    throw new Error('Task title is required.');
  }

  const dueDate = parseDueDate(data?.dueDate);
  const dueTime = parseDueTime(data?.dueTime);
  const scheduledAt = combineSchedule(dueDate, dueTime);

  if (scheduledAt.getTime() < Date.now()) {
    throw new Error('Due date cannot be in the past.');
  }

  return {
    title,
    dueDate,
    dueTime
  };
}

function parseDueDate(value) {
  if (!value) {
    throw new Error('Due date is required.');
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const normalized = new Date(value);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
    }
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid due date.');
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function parseDueTime(value) {
  if (value == null || value === '') {
    return null;
  }

  const normalizedValue = String(value).trim();

  if (!/^\d{2}:\d{2}$/.test(normalizedValue)) {
    throw new Error('Invalid due time.');
  }

  return normalizedValue;
}

function combineSchedule(dueDate, dueTime) {
  const scheduledAt = new Date(dueDate);

  if (!dueTime) {
    scheduledAt.setHours(23, 59, 59, 999);
    return scheduledAt;
  }

  const [hours, minutes] = dueTime.split(':').map(Number);
  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt;
}

function getSnoozedSchedule(task, minutes) {
  const increment = Number(minutes);

  if (!Number.isFinite(increment) || increment <= 0) {
    throw new Error('Invalid snooze duration.');
  }

  const baseSchedule = task.dueTime
    ? combineSchedule(task.dueDate, task.dueTime)
    : new Date();

  const nextSchedule = new Date(baseSchedule.getTime() + increment * 60 * 1000);

  return {
    dueDate: new Date(
      nextSchedule.getFullYear(),
      nextSchedule.getMonth(),
      nextSchedule.getDate(),
      0,
      0,
      0,
      0
    ),
    dueTime: [
      String(nextSchedule.getHours()).padStart(2, '0'),
      String(nextSchedule.getMinutes()).padStart(2, '0')
    ].join(':')
  };
}

function getDayRange(value) {
  const start = parseDueDate(value);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
