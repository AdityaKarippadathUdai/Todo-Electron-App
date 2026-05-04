export const REMINDER_HIGHLIGHT_MS = 3_000;
export const SNOOZE_MINUTES = 10;

export function normalizeDateKey(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getTodayKey(now = new Date()) {
  return normalizeDateKey(now);
}

export function getTaskDateKey(task) {
  return normalizeDateKey(task?.dueAt);
}

export function formatTaskDate(dateValue) {
  if (!dateValue) {
    return 'No due date';
  }

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatTimeLabel(timeValue) {
  const time = timeValue instanceof Date ? new Date(timeValue) : new Date(timeValue);

  if (Number.isNaN(time.getTime())) {
    return '';
  }

  return time.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatTaskSchedule(task) {
  const dateLabel = formatTaskDate(task?.dueAt);

  if (!isAllDaySchedule(task?.dueAt)) {
    return `${dateLabel} at ${formatTimeLabel(task?.dueAt)}`;
  }

  return dateLabel;
}

export function compareTasksByDueTime(a, b) {
  const aTime = getScheduleTimestamp(a);
  const bTime = getScheduleTimestamp(b);

  if (aTime === bTime) {
    return new Date(a?.createdAt ?? 0) - new Date(b?.createdAt ?? 0);
  }

  return aTime - bTime;
}

export function compareTasksBySchedule(a, b) {
  const dateCompare = getTaskDateKey(a).localeCompare(getTaskDateKey(b));

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return compareTasksByDueTime(a, b);
}

export function getTasksForDate(tasks, dateValue) {
  const dateKey = normalizeDateKey(dateValue);

  return tasks
    .filter((task) => getTaskDateKey(task) === dateKey)
    .sort(compareTasksBySchedule);
}

export function getTodayTasks(tasks, todayKey = getTodayKey()) {
  return tasks.filter((task) => !task.completed && getTaskDateKey(task) === todayKey);
}

export function getUpcomingTasks(tasks, todayKey = getTodayKey()) {
  return tasks.filter((task) => getTaskDateKey(task) > todayKey);
}

export function getOverdueTasks(tasks, todayKey = getTodayKey()) {
  return tasks.filter((task) => !task.completed && getTaskDateKey(task) < todayKey);
}

export function getTodayProgress(tasks, todayKey = getTodayKey()) {
  const todaysTasks = tasks.filter((task) => getTaskDateKey(task) === todayKey);
  const total = todaysTasks.length;
  const completed = todaysTasks.filter((task) => task.completed).length;
  const ratio = total ? completed / total : 0;

  return {
    total,
    completed,
    ratio,
    pending: total - completed
  };
}

export function getGreeting(now = new Date()) {
  const hour = now.getHours();

  if (hour < 12) {
    return 'Good Morning 👋';
  }

  if (hour < 18) {
    return 'Good Afternoon 👋';
  }

  return 'Good Evening 👋';
}

export function isPastSchedule(dateValue, timeValue) {
  const schedule = buildDueAt(dateValue, timeValue);
  return schedule.getTime() < Date.now();
}

export function getTaskScheduleDate(task) {
  return new Date(task?.dueAt ?? 0);
}

export function getSnoozedPreview(task, minutes = SNOOZE_MINUTES) {
  const baseSchedule = task?.dueAt ? getTaskScheduleDate(task) : new Date();
  const nextSchedule = new Date(baseSchedule.getTime() + minutes * 60 * 1000);

  return {
    dueAt: nextSchedule.toISOString()
  };
}

export function createTaskCollectionSelector() {
  let taskSource = null;
  let todayKey = '';
  let cachedResult = null;

  return function getCollections(tasks, nextTodayKey = getTodayKey()) {
    if (taskSource === tasks && todayKey === nextTodayKey && cachedResult) {
      return cachedResult;
    }

    cachedResult = {
      todayTasks: getTodayTasks(tasks, nextTodayKey).slice().sort(compareTasksByDueTime),
      upcomingTasks: getUpcomingTasks(tasks, nextTodayKey).slice().sort(compareTasksBySchedule),
      overdueTasks: getOverdueTasks(tasks, nextTodayKey).slice().sort(compareTasksBySchedule)
    };

    taskSource = tasks;
    todayKey = nextTodayKey;

    return cachedResult;
  };
}

export function buildDueAt(dateValue, timeValue) {
  if (!dateValue) {
    throw new Error('Due date is required.');
  }

  const scheduledAt = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid due date.');
  }

  if (timeValue) {
    const normalizedTime = String(timeValue).trim();

    if (!/^\d{2}:\d{2}$/.test(normalizedTime)) {
      throw new Error('Invalid due time.');
    }

    const [hours, minutes] = normalizedTime.split(':').map(Number);
    scheduledAt.setHours(hours, minutes, 0, 0);
  } else {
    scheduledAt.setHours(23, 59, 59, 999);
  }

  return scheduledAt;
}

export function isAllDaySchedule(dateValue) {
  const schedule = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);

  return (
    !Number.isNaN(schedule.getTime()) &&
    schedule.getHours() === 23 &&
    schedule.getMinutes() === 59 &&
    schedule.getSeconds() === 59 &&
    schedule.getMilliseconds() === 999
  );
}

function getScheduleTimestamp(task) {
  const schedule = task?.dueAt instanceof Date ? task.dueAt : new Date(task?.dueAt);

  return Number.isNaN(schedule.getTime()) ? Number.POSITIVE_INFINITY : schedule.getTime();
}
