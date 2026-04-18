const list = document.getElementById('taskList');
const datePicker = document.getElementById('datePicker');
const timePicker = document.getElementById('timePicker');
const addBtn = document.getElementById('addBtn');
const taskInput = document.getElementById('taskInput');
const taskCount = document.getElementById('taskCount');
const selectedDateLabel = document.getElementById('selectedDateLabel');
const overdueCount = document.getElementById('overdueCount');
const upcomingCount = document.getElementById('upcomingCount');
const reminderBanner = document.getElementById('reminderBanner');
const todayTasks = document.getElementById('todayTasks');
const toast = document.getElementById('toast');

const REMINDER_POLL_MS = 60_000;
const REMINDER_HIGHLIGHT_MS = 3_000;
const SNOOZE_MINUTES = 10;
const reminderHighlightTimers = new Map();
let lastReminderCheckAt = new Date();
let bannerTimer = null;
let toastTimer = null;
let allTasksCache = [];
const taskFilterMemo = {
  source: null,
  todayKey: '',
  result: null
};

const today = new Date().toISOString().split('T')[0];
datePicker.value = today;
updateSelectedDateLabel(today);

window.onload = () => {
  initializeApp();
};

addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    addTask();
  }
});

async function loadTasks() {
  const date = datePicker.value;
  updateSelectedDateLabel(date);

  try {
    const tasks = getTasksForDate(allTasksCache, date);
    list.innerHTML = '';
    taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;

    if (tasks.length === 0) {
      const emptyState = document.createElement('li');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No tasks scheduled for this date yet.';
      list.appendChild(emptyState);
      return;
    }

    tasks.forEach(t => {
      const li = document.createElement('li');
      li.className = 'task-item is-entering';
      li.dataset.taskId = t.id;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = t.completed;
      checkbox.className = 'task-checkbox';
      checkbox.addEventListener('change', () => toggle(t.id));

      const taskMain = document.createElement('div');
      taskMain.className = 'task-main';

      const taskCopy = document.createElement('div');
      taskCopy.className = 'task-copy';

      const text = document.createElement('span');
      text.className = `task-text${t.completed ? ' is-complete' : ''}`;
      text.textContent = t.title;

      const date = document.createElement('span');
      date.className = 'task-date';
      date.textContent = formatTaskSchedule(t);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.type = 'button';
      delBtn.setAttribute('aria-label', `Delete ${t.title}`);
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', () => removeTask(t.id));

      taskMain.appendChild(checkbox);
      taskCopy.appendChild(text);
      taskCopy.appendChild(date);
      taskMain.appendChild(taskCopy);
      li.appendChild(taskMain);
      li.appendChild(delBtn);

      list.appendChild(li);
      requestAnimationFrame(() => {
        li.classList.remove('is-entering');
      });
    });

  } catch (err) {
    console.error('Load failed:', err);
  }
}

function loadTodayWidget() {
  const { todayTasks: pendingTodayTasks } = getTaskCollections(allTasksCache);
  renderTodayWidget(pendingTodayTasks);
}

async function addTask() {
  const title = taskInput.value.trim();
  const dueDate = datePicker.value;
  const dueTime = timePicker.value;

  if (!title) {
    alert('Enter a task');
    return;
  }

  if (!dueDate) {
    alert('Select a date');
    return;
  }

  if (isPastSchedule(dueDate, dueTime)) {
    alert('Choose a due date and time that is not in the past');
    return;
  }

  try {
    await window.api.addTask({
      title,
      dueDate,
      dueTime: dueTime || null
    });
    taskInput.value = '';
    timePicker.value = '';

    await refreshAllTasks();
    await loadTasks();
    loadTodayWidget();

  } catch (err) {
    console.error('Add failed:', err);
  }
}

async function toggle(id) {
  try {
    await window.api.toggleTask(id);
    await refreshAllTasks();
    await loadTasks();
    loadTodayWidget();
  } catch (err) {
    console.error('Toggle failed:', err);
  }
}

async function removeTask(id) {
  try {
    await window.api.deleteTask(id);
    await refreshAllTasks();
    await loadTasks();
    loadTodayWidget();
  } catch (err) {
    console.error('Delete failed:', err);
  }
}

datePicker.addEventListener('change', loadTasks);

function updateSelectedDateLabel(dateValue) {
  if (!dateValue) {
    selectedDateLabel.textContent = 'No date';
    return;
  }

  const formattedDate = new Date(`${dateValue}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  selectedDateLabel.textContent = formattedDate;
}

function formatTaskDate(dateValue) {
  if (!dateValue) {
    return 'No due date';
  }

  return new Date(dateValue).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTaskSchedule(task) {
  const dateLabel = formatTaskDate(task.dueDate);

  if (task.dueTime) {
    return `${dateLabel} at ${formatTimeLabel(task.dueTime)}`;
  }

  return dateLabel;
}

function formatTimeLabel(timeValue) {
  const [hours = '00', minutes = '00'] = String(timeValue).split(':');
  const time = new Date();
  time.setHours(Number(hours), Number(minutes), 0, 0);

  return time.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function isPastSchedule(dateValue, timeValue) {
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

async function initializeReminderSystem() {
  await requestDesktopNotificationPermission();
  await checkDueReminders();
  window.setInterval(checkDueReminders, REMINDER_POLL_MS);
}

async function initializeApp() {
  try {
    await refreshAllTasks();
    await loadTasks();
    loadTodayWidget();
  } catch (err) {
    console.error('App initialization failed:', err);
  }

  initializeReminderSystem();
}

async function refreshAllTasks() {
  allTasksCache = await window.api.getAllTasks();
  taskFilterMemo.source = null;
  updateTaskSummary();
}

async function checkDueReminders() {
  const now = new Date();

  try {
    const reminders = await window.api.getDueReminders(
      lastReminderCheckAt.toISOString(),
      now.toISOString()
    );

    if (!Array.isArray(reminders) || reminders.length === 0) {
      lastReminderCheckAt = now;
      return;
    }

    const reminderIds = reminders.map((task) => task.id);
    await window.api.acknowledgeReminders(reminderIds);

    reminders.forEach((task) => {
      triggerReminder(task);
    });
  } catch (err) {
    console.error('Reminder check failed:', err);
  } finally {
    lastReminderCheckAt = now;
  }
}

async function requestDesktopNotificationPermission() {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (err) {
      console.error('Notification permission request failed:', err);
    }
  }
}

function triggerReminder(task) {
  const message = `⏰ Task Reminder: ${task.title}`;

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Reminder', {
      body: message,
      silent: true
    });
  }

  showReminderBanner(message);
  showToast(message);
  playReminderSound();
  highlightTask(task.id, { scroll: true });
}

function showReminderBanner(message) {
  if (!reminderBanner) {
    return;
  }

  reminderBanner.textContent = message;
  reminderBanner.hidden = false;
  reminderBanner.classList.add('is-visible');

  if (bannerTimer) {
    window.clearTimeout(bannerTimer);
  }

  bannerTimer = window.setTimeout(() => {
    reminderBanner.classList.remove('is-visible');
    bannerTimer = window.setTimeout(() => {
      reminderBanner.hidden = true;
    }, 200);
  }, 5000);
}

function playReminderSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 740;
  gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.03, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.34);
  oscillator.onended = () => {
    audioContext.close().catch(() => {});
  };
}

function highlightTask(taskId, options = {}) {
  const { scroll = false } = options;
  const taskItem = list.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
  const widgetItem = todayTasks.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
  const selectedDateKey = normalizeDateKey(datePicker.value);
  const task = getTaskById(taskId);

  if (task && selectedDateKey !== getTaskDateKey(task)) {
    datePicker.value = getTaskDateKey(task);
    updateSelectedDateLabel(datePicker.value);
    loadTasks().then(() => {
      const refreshedTaskItem = list.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
      applyReminderHighlight(taskId, refreshedTaskItem, widgetItem, scroll);
    }).catch((err) => {
      console.error('Scroll highlight failed:', err);
    });
    return;
  }

  applyReminderHighlight(taskId, taskItem, widgetItem, scroll);
}

function applyReminderHighlight(taskId, taskItem, widgetItem, shouldScroll) {
  if (taskItem) {
    taskItem.classList.add('is-reminded');
  }

  if (widgetItem) {
    widgetItem.classList.add('is-reminded');
  }

  if (shouldScroll && taskItem) {
    taskItem.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }

  if (reminderHighlightTimers.has(taskId)) {
    window.clearTimeout(reminderHighlightTimers.get(taskId));
  }

  const timerId = window.setTimeout(() => {
    if (taskItem) {
      taskItem.classList.remove('is-reminded');
    }

    if (widgetItem) {
      widgetItem.classList.remove('is-reminded');
    }

    reminderHighlightTimers.delete(taskId);
  }, REMINDER_HIGHLIGHT_MS);

  reminderHighlightTimers.set(taskId, timerId);
}

function renderTodayWidget(tasks) {
  todayTasks.innerHTML = '';

  if (!tasks.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'widget-empty';
    emptyState.textContent = 'No tasks for today 🎉';
    todayTasks.appendChild(emptyState);
    return;
  }

  tasks.forEach((task) => {
    const item = document.createElement('article');
    item.className = 'widget-item';
    item.dataset.taskId = task.id;
    item.addEventListener('click', () => focusTaskFromWidget(task.id));

    const copy = document.createElement('div');
    copy.className = 'widget-copy';

    const title = document.createElement('div');
    title.className = 'widget-title';
    title.textContent = task.title;

    const time = document.createElement('div');
    time.className = 'widget-time';
    time.textContent = task.dueTime ? formatTimeLabel(task.dueTime) : 'Any time';

    const actions = document.createElement('div');
    actions.className = 'widget-actions';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'widget-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Mark ${task.title} complete`);
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener('change', () => {
      handleWidgetToggle(task.id);
    });

    const snoozeBtn = document.createElement('button');
    snoozeBtn.type = 'button';
    snoozeBtn.className = 'widget-snooze';
    snoozeBtn.textContent = 'Snooze';
    snoozeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      handleWidgetSnooze(task.id);
    });

    const status = document.createElement('span');
    status.className = 'widget-status';
    status.setAttribute('aria-hidden', 'true');

    copy.appendChild(title);
    copy.appendChild(time);
    actions.appendChild(checkbox);
    actions.appendChild(snoozeBtn);
    actions.appendChild(status);
    item.appendChild(copy);
    item.appendChild(actions);
    todayTasks.appendChild(item);
  });
}

async function handleWidgetToggle(taskId) {
  const task = getTaskById(taskId);

  if (!task) {
    return;
  }

  const previousTask = { ...task };
  task.completed = !task.completed;
  patchTaskInDom(task);
  refreshDerivedViews();

  try {
    await window.api.toggleTask(taskId);
  } catch (err) {
    Object.assign(task, previousTask);
    patchTaskInDom(task);
    refreshDerivedViews();
    console.error('Widget toggle failed:', err);
  }
}

async function handleWidgetSnooze(taskId) {
  const task = getTaskById(taskId);

  if (!task) {
    return;
  }

  const previousTask = { ...task };
  applySnoozeToTask(task, SNOOZE_MINUTES);
  patchTaskInDom(task);
  refreshDerivedViews();
  showToast(`⏰ Task Reminder: ${task.title} snoozed for ${SNOOZE_MINUTES} minutes`);

  try {
    const updatedTask = await window.api.snoozeTask(taskId, SNOOZE_MINUTES);
    replaceTaskInCache(updatedTask);
    patchTaskInDom(updatedTask);
    refreshDerivedViews();
  } catch (err) {
    replaceTaskInCache(previousTask);
    patchTaskInDom(previousTask);
    refreshDerivedViews();
    console.error('Snooze failed:', err);
  }
}

function focusTaskFromWidget(taskId) {
  highlightTask(taskId, { scroll: true });
}

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 3600);
}

function updateTaskSummary() {
  const { overdueTasks, upcomingTasks } = getTaskCollections(allTasksCache);
  overdueCount.textContent = `${overdueTasks.length} overdue`;
  upcomingCount.textContent = `${upcomingTasks.length} upcoming`;
}

function refreshDerivedViews() {
  taskFilterMemo.source = null;
  updateTaskSummary();
  loadTodayWidget();
}

function getTaskById(taskId) {
  return allTasksCache.find((task) => task.id === taskId) ?? null;
}

function replaceTaskInCache(updatedTask) {
  const index = allTasksCache.findIndex((task) => task.id === updatedTask.id);

  if (index === -1) {
    allTasksCache.push(updatedTask);
    return;
  }

  allTasksCache[index] = updatedTask;
}

function patchTaskInDom(task) {
  const taskItem = list.querySelector(`[data-task-id="${CSS.escape(task.id)}"]`);

  if (taskItem && normalizeDateKey(datePicker.value) === getTaskDateKey(task)) {
    const text = taskItem.querySelector('.task-text');
    const date = taskItem.querySelector('.task-date');
    const checkbox = taskItem.querySelector('.task-checkbox');

    if (text) {
      text.textContent = task.title;
      text.className = `task-text${task.completed ? ' is-complete' : ''}`;
    }

    if (date) {
      date.textContent = formatTaskSchedule(task);
    }

    if (checkbox) {
      checkbox.checked = task.completed;
    }
  } else if (taskItem) {
    taskItem.remove();
  }

  syncVisibleTaskListState();
}

function applySnoozeToTask(task, minutes) {
  const nextSchedule = getSnoozedTaskSchedule(task, minutes);
  task.dueDate = nextSchedule.dueDate;
  task.dueTime = nextSchedule.dueTime;
  task.notified = false;
}

function getSnoozedTaskSchedule(task, minutes) {
  const base = task.dueTime ? getTaskScheduleDate(task) : new Date();
  const next = new Date(base.getTime() + minutes * 60 * 1000);

  return {
    dueDate: new Date(
      next.getFullYear(),
      next.getMonth(),
      next.getDate(),
      0,
      0,
      0,
      0
    ).toISOString(),
    dueTime: `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
  };
}

function getTaskScheduleDate(task) {
  const [year, month, day] = getTaskDateKey(task).split('-').map(Number);
  const [hours, minutes] = String(task.dueTime ?? '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function syncVisibleTaskListState() {
  const visibleTasks = getTasksForDate(allTasksCache, datePicker.value);
  const hasRenderedTask = Boolean(list.querySelector('.task-item'));
  const emptyState = list.querySelector('.empty-state');

  taskCount.textContent = `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'}`;

  if (visibleTasks.length === 0 && !emptyState) {
    const nextEmptyState = document.createElement('li');
    nextEmptyState.className = 'empty-state';
    nextEmptyState.textContent = 'No tasks scheduled for this date yet.';
    list.appendChild(nextEmptyState);
    return;
  }

  if (visibleTasks.length > 0 && emptyState) {
    emptyState.remove();
  }

  if (!hasRenderedTask && visibleTasks.length > 0) {
    loadTasks().catch((err) => {
      console.error('Visible task sync failed:', err);
    });
  }
}

function compareTasksByDueTime(a, b) {
  const aTime = a.dueTime ?? '99:99';
  const bTime = b.dueTime ?? '99:99';

  if (aTime === bTime) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  }

  return aTime.localeCompare(bTime);
}

function getTodayTasks(tasks) {
  const todayKey = getTodayKey();

  return tasks.filter((task) => {
    return !task.completed && getTaskDateKey(task) === todayKey;
  });
}

function getUpcomingTasks(tasks) {
  const todayKey = getTodayKey();

  return tasks.filter((task) => {
    return getTaskDateKey(task) > todayKey;
  });
}

function getOverdueTasks(tasks) {
  const todayKey = getTodayKey();

  return tasks.filter((task) => {
    return !task.completed && getTaskDateKey(task) < todayKey;
  });
}

function getTaskCollections(tasks) {
  const todayKey = getTodayKey();

  if (taskFilterMemo.source === tasks && taskFilterMemo.todayKey === todayKey && taskFilterMemo.result) {
    return taskFilterMemo.result;
  }

  const result = {
    todayTasks: getTodayTasks(tasks).sort(compareTasksByDueTime),
    upcomingTasks: getUpcomingTasks(tasks).sort(compareTasksBySchedule),
    overdueTasks: getOverdueTasks(tasks).sort(compareTasksBySchedule)
  };

  taskFilterMemo.source = tasks;
  taskFilterMemo.todayKey = todayKey;
  taskFilterMemo.result = result;

  return result;
}

function getTasksForDate(tasks, dateValue) {
  const dateKey = normalizeDateKey(dateValue);

  return tasks
    .filter((task) => getTaskDateKey(task) === dateKey)
    .sort(compareTasksBySchedule);
}

function compareTasksBySchedule(a, b) {
  const dateCompare = getTaskDateKey(a).localeCompare(getTaskDateKey(b));

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return compareTasksByDueTime(a, b);
}

function getTaskDateKey(task) {
  return normalizeDateKey(task?.dueDate);
}

function getTodayKey() {
  return normalizeDateKey(new Date());
}

function normalizeDateKey(value) {
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
