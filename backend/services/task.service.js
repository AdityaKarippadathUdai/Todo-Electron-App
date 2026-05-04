import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getAllTasks() {
  return prisma.task.findMany({
    orderBy: [
      { dueAt: 'asc' },
      { createdAt: 'asc' }
    ]
  });
}

export async function getTasksByDate(date) {
  const { start, end } = getDayRange(date);

  return prisma.task.findMany({
    where: {
      dueAt: {
        gte: start,
        lte: end
      }
    },
    orderBy: {
      dueAt: 'asc'
    }
  });
}

export async function createTask(data) {
  const taskInput = normalizeTaskInput(data);

  return prisma.task.create({
    data: {
      title: taskInput.title,
      dueAt: taskInput.dueAt,
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
      dueAt: nextSchedule.dueAt,
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
      dueAt: {
        gte: rangeStart,
        lte: rangeEnd
      }
    },
    orderBy: {
      dueAt: 'asc'
    }
  });

  return tasks.filter((task) => {
    const scheduledAt = new Date(task.dueAt);
    return scheduledAt >= start && scheduledAt <= end;
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

  const dueAt = parseDueAt(data?.dueAt ?? combineSchedule(data?.dueDate, data?.dueTime));

  if (dueAt.getTime() < Date.now()) {
    throw new Error('Due date cannot be in the past.');
  }

  return {
    title,
    dueAt
  };
}

function parseDueAt(value) {
  if (!value) {
    throw new Error('Due date is required.');
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value);
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error('Invalid due date.');
}

function parseDateOnly(value) {
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

function combineSchedule(dueDate, dueTime) {
  const scheduledAt = parseDateOnly(dueDate);

  if (!dueTime) {
    scheduledAt.setHours(23, 59, 59, 999);
    return scheduledAt;
  }

  const normalizedValue = String(dueTime).trim();

  if (!/^\d{2}:\d{2}$/.test(normalizedValue)) {
    throw new Error('Invalid due time.');
  }

  const [hours, minutes] = normalizedValue.split(':').map(Number);
  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt;
}

function getSnoozedSchedule(task, minutes) {
  const increment = Number(minutes);

  if (!Number.isFinite(increment) || increment <= 0) {
    throw new Error('Invalid snooze duration.');
  }

  const baseSchedule = task.dueAt ? new Date(task.dueAt) : new Date();

  return {
    dueAt: new Date(baseSchedule.getTime() + increment * 60 * 1000)
  };
}

function getDayRange(value) {
  const start = parseDateOnly(value);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
