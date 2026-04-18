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
  return normalizeDateKey(task?.dueDate);
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
  const [hours = '00', minutes = '00'] = String(timeValue).split(':');
  const time = new Date();
  time.setHours(Number(hours), Number(minutes), 0, 0);

  return time.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatTaskSchedule(task) {
  const dateLabel = formatTaskDate(task?.dueDate);

  if (task?.dueTime) {
    return `${dateLabel} at ${formatTimeLabel(task.dueTime)}`;
  }

  return dateLabel;
}

export function compareTasksByDueTime(a, b) {
  const aTime = a?.dueTime ?? '99:99';
  const bTime = b?.dueTime ?? '99:99';

  if (aTime === bTime) {
    return new Date(a?.createdAt ?? 0) - new Date(b?.createdAt ?? 0);
  }

  return aTime.localeCompare(bTime);
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
  if (!dateValue) {
    return false;
  }

  const [year, month, day] = dateValue.split('-').map(Number);
  const schedule = new Date(year, month - 1, day);

  if (timeValue) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    schedule.setHours(hours, minutes, 0, 0);
  } else {
    schedule.setHours(23, 59, 59, 999);
  }

  return schedule.getTime() < Date.now();
}

export function getTaskScheduleDate(task) {
  const [year, month, day] = getTaskDateKey(task).split('-').map(Number);
  const [hours, minutes] = String(task?.dueTime ?? '00:00').split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function getSnoozedPreview(task, minutes = SNOOZE_MINUTES) {
  const baseSchedule = task?.dueTime ? getTaskScheduleDate(task) : new Date();
  const nextSchedule = new Date(baseSchedule.getTime() + minutes * 60 * 1000);

  return {
    dueDate: new Date(
      nextSchedule.getFullYear(),
      nextSchedule.getMonth(),
      nextSchedule.getDate(),
      0,
      0,
      0,
      0
    ).toISOString(),
    dueTime: [
      String(nextSchedule.getHours()).padStart(2, '0'),
      String(nextSchedule.getMinutes()).padStart(2, '0')
    ].join(':')
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
