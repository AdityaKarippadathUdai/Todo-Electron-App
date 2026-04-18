const list = document.getElementById('taskList');
const datePicker = document.getElementById('datePicker');
const timePicker = document.getElementById('timePicker');
const addBtn = document.getElementById('addBtn');
const taskInput = document.getElementById('taskInput');
const taskCount = document.getElementById('taskCount');
const selectedDateLabel = document.getElementById('selectedDateLabel');
const reminderBanner = document.getElementById('reminderBanner');
const todayTasks = document.getElementById('todayTasks');

const REMINDER_POLL_MS = 60_000;
const REMINDER_HIGHLIGHT_MS = 12_000;
const reminderHighlightTimers = new Map();
let lastReminderCheckAt = new Date();
let bannerTimer = null;

const today = new Date().toISOString().split('T')[0];
datePicker.value = today;
updateSelectedDateLabel(today);

window.onload = () => {
  loadTasks();
  loadTodayWidget();
  initializeReminderSystem();
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
    const tasks = await window.api.getTasks(date);
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

async function loadTodayWidget() {
  const todayDate = new Date().toISOString().split('T')[0];

  try {
    const tasks = await window.api.getTasks(todayDate);
    const pendingTodayTasks = tasks
      .filter((task) => !task.completed)
      .sort(compareTasksByDueTime);

    renderTodayWidget(pendingTodayTasks);
  } catch (err) {
    console.error('Today widget load failed:', err);
  }
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

    await loadTasks();
    await loadTodayWidget();

  } catch (err) {
    console.error('Add failed:', err);
  }
}

async function toggle(id) {
  try {
    await window.api.toggleTask(id);
    await loadTasks();
    await loadTodayWidget();
  } catch (err) {
    console.error('Toggle failed:', err);
  }
}

async function removeTask(id) {
  try {
    await window.api.deleteTask(id);
    await loadTasks();
    await loadTodayWidget();
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
  const scheduleLabel = formatTaskSchedule(task);
  const message = `${task.title} is due ${scheduleLabel ? `now (${scheduleLabel})` : 'now'}.`;

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Reminder', {
      body: message,
      silent: true
    });
  } else {
    showReminderBanner(message);
  }

  playReminderSound();
  highlightTask(task.id);
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

function highlightTask(taskId) {
  const taskItem = list.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
  const widgetItem = todayTasks.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);

  if (taskItem) {
    taskItem.classList.add('is-reminded');
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

  if (widgetItem) {
    widgetItem.classList.add('is-reminded');
  }

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

    const copy = document.createElement('div');
    copy.className = 'widget-copy';

    const title = document.createElement('div');
    title.className = 'widget-title';
    title.textContent = task.title;

    const time = document.createElement('div');
    time.className = 'widget-time';
    time.textContent = task.dueTime ? formatTimeLabel(task.dueTime) : 'Any time';

    const status = document.createElement('span');
    status.className = 'widget-status';
    status.setAttribute('aria-hidden', 'true');

    copy.appendChild(title);
    copy.appendChild(time);
    item.appendChild(copy);
    item.appendChild(status);
    todayTasks.appendChild(item);
  });
}

function compareTasksByDueTime(a, b) {
  const aTime = a.dueTime ?? '99:99';
  const bTime = b.dueTime ?? '99:99';

  if (aTime === bTime) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  }

  return aTime.localeCompare(bTime);
}
