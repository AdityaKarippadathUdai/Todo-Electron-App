import {
  createTaskCollectionSelector,
  formatTaskSchedule,
  formatTimeLabel,
  formatTaskDate,
  getGreeting,
  getTasksForDate,
  getTodayProgress,
  REMINDER_HIGHLIGHT_MS,
  SNOOZE_MINUTES
} from './task-utils.js';

export function createUIController(store) {
  const refs = {
    addBtn: document.getElementById('addBtn'),
    datePicker: document.getElementById('datePicker'),
    timePicker: document.getElementById('timePicker'),
    taskInput: document.getElementById('taskInput'),
    taskCount: document.getElementById('taskCount'),
    selectedDateLabel: document.getElementById('selectedDateLabel'),
    overdueCount: document.getElementById('overdueCount'),
    upcomingCount: document.getElementById('upcomingCount'),
    reminderBanner: document.getElementById('reminderBanner'),
    toast: document.getElementById('toast'),
    taskList: document.getElementById('taskList'),
    todayTasks: document.getElementById('todayTasks'),
    sidebarGreeting: document.getElementById('sidebarGreeting'),
    todayTaskInsightCount: document.getElementById('todayTaskInsightCount'),
    todayProgressLabel: document.getElementById('todayProgressLabel'),
    todayProgressPercent: document.getElementById('todayProgressPercent'),
    todayProgressBar: document.getElementById('todayProgressBar')
  };

  const selectCollections = createTaskCollectionSelector();
  let lastHandledScrollToken = null;

  bindEvents();
  store.subscribe(render);

  function bindEvents() {
    refs.addBtn.addEventListener('click', handleAddTask);
    refs.datePicker.addEventListener('change', (event) => {
      store.actions.setSelectedDate(event.target.value);
    });
    refs.timePicker.addEventListener('input', (event) => {
      store.actions.setFormTime(event.target.value);
    });
    refs.taskInput.addEventListener('input', (event) => {
      store.actions.setFormTitle(event.target.value);
    });
    refs.taskInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleAddTask();
      }
    });

    refs.taskList.addEventListener('change', (event) => {
      const checkbox = event.target.closest('.task-checkbox');

      if (checkbox?.dataset.taskId) {
        handleToggleTask(checkbox.dataset.taskId);
      }
    });

    refs.taskList.addEventListener('click', (event) => {
      const deleteButton = event.target.closest('.delete-btn');

      if (deleteButton?.dataset.taskId) {
        handleDeleteTask(deleteButton.dataset.taskId);
      }
    });

    refs.todayTasks.addEventListener('change', (event) => {
      const checkbox = event.target.closest('.widget-checkbox');

      if (checkbox?.dataset.taskId) {
        handleToggleTask(checkbox.dataset.taskId);
      }
    });

    refs.todayTasks.addEventListener('click', (event) => {
      const snoozeButton = event.target.closest('.widget-snooze');

      if (snoozeButton?.dataset.taskId) {
        event.stopPropagation();
        handleSnoozeTask(snoozeButton.dataset.taskId);
        return;
      }

      const widgetItem = event.target.closest('.widget-item');

      if (widgetItem?.dataset.taskId) {
        store.actions.focusTask(widgetItem.dataset.taskId, {
          scroll: true,
          durationMs: REMINDER_HIGHLIGHT_MS
        });
      }
    });
  }

  async function handleAddTask() {
    try {
      await store.actions.addTaskFromForm();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleToggleTask(taskId) {
    try {
      await store.actions.toggleTask(taskId);
    } catch (error) {
      console.error('Toggle failed:', error);
      store.actions.showToast('Unable to update that task.');
    }
  }

  async function handleDeleteTask(taskId) {
    try {
      await store.actions.removeTask(taskId);
    } catch (error) {
      console.error('Delete failed:', error);
      store.actions.showToast('Unable to delete that task.');
    }
  }

  async function handleSnoozeTask(taskId) {
    try {
      await store.actions.snoozeTask(taskId, SNOOZE_MINUTES);
      const task = store.getState().tasks.items.find((item) => item.id === taskId);

      if (task) {
        store.actions.showToast(`⏰ Task Reminder: ${task.title} snoozed for ${SNOOZE_MINUTES} minutes`);
      }
    } catch (error) {
      console.error('Snooze failed:', error);
      store.actions.showToast('Unable to snooze that task.');
    }
  }

  function render(state) {
    const todayKey = state.ui.selectedDate ? state.ui.selectedDate : formatTaskDate(new Date());
    const collections = selectCollections(state.tasks.items);
    const visibleTasks = getTasksForDate(state.tasks.items, state.ui.selectedDate);
    const todayProgress = getTodayProgress(state.tasks.items);

    refs.datePicker.value = state.ui.selectedDate;
    refs.timePicker.value = state.ui.formTime;
    refs.taskInput.value = state.ui.formTitle;
    refs.selectedDateLabel.textContent = formatTaskDate(state.ui.selectedDate);
    refs.overdueCount.textContent = `${collections.overdueTasks.length} overdue`;
    refs.upcomingCount.textContent = `${collections.upcomingTasks.length} upcoming`;

    renderAlerts(state);
    renderMainTaskList(visibleTasks, state.ui.highlightedTaskId);
    renderTodayWidget(collections.todayTasks, state.ui.highlightedTaskId);
    renderInsights(todayProgress);
    handleScrollRequest(state.ui.scrollRequest);
  }

  function renderAlerts(state) {
    if (state.ui.banner) {
      refs.reminderBanner.textContent = state.ui.banner;
      refs.reminderBanner.hidden = false;
      refs.reminderBanner.classList.add('is-visible');
    } else {
      refs.reminderBanner.classList.remove('is-visible');
      refs.reminderBanner.hidden = true;
      refs.reminderBanner.textContent = '';
    }

    if (state.ui.toast) {
      refs.toast.textContent = state.ui.toast;
      refs.toast.hidden = false;
      refs.toast.classList.add('is-visible');
    } else {
      refs.toast.classList.remove('is-visible');
      refs.toast.hidden = true;
      refs.toast.textContent = '';
    }
  }

  function renderMainTaskList(tasks, highlightedTaskId) {
    refs.taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;

    if (!tasks.length) {
      refs.taskList.innerHTML = '<li class="empty-state">No tasks scheduled for this date yet.</li>';
      return;
    }

    refs.taskList.innerHTML = tasks.map((task) => `
      <li class="task-item${task.id === highlightedTaskId ? ' is-reminded' : ''}" data-task-id="${escapeHtml(task.id)}">
        <div class="task-main">
          <input
            type="checkbox"
            class="task-checkbox"
            data-task-id="${escapeHtml(task.id)}"
            ${task.completed ? 'checked' : ''}
          />
          <div class="task-copy">
            <span class="task-text${task.completed ? ' is-complete' : ''}">${escapeHtml(task.title)}</span>
            <span class="task-date">${escapeHtml(formatTaskSchedule(task))}</span>
          </div>
        </div>
        <button
          class="delete-btn"
          type="button"
          data-task-id="${escapeHtml(task.id)}"
          aria-label="Delete ${escapeHtml(task.title)}"
        >&times;</button>
      </li>
    `).join('');
  }

  function renderTodayWidget(tasks, highlightedTaskId) {
    if (!tasks.length) {
      refs.todayTasks.innerHTML = '<div class="widget-empty">No tasks for today 🎉</div>';
      return;
    }

    refs.todayTasks.innerHTML = tasks.map((task) => `
      <article class="widget-item${task.id === highlightedTaskId ? ' is-reminded' : ''}" data-task-id="${escapeHtml(task.id)}">
        <div class="widget-copy">
          <div class="widget-title">${escapeHtml(task.title)}</div>
          <div class="widget-time">${escapeHtml(task.dueTime ? formatTimeLabel(task.dueTime) : 'Any time')}</div>
        </div>
        <div class="widget-actions">
          <input
            type="checkbox"
            class="widget-checkbox"
            data-task-id="${escapeHtml(task.id)}"
            aria-label="Mark ${escapeHtml(task.title)} complete"
            ${task.completed ? 'checked' : ''}
          />
          <button type="button" class="widget-snooze" data-task-id="${escapeHtml(task.id)}">Snooze</button>
          <span class="widget-status" aria-hidden="true"></span>
        </div>
      </article>
    `).join('');
  }

  function renderInsights(todayProgress) {
    refs.sidebarGreeting.textContent = getGreeting();
    refs.todayTaskInsightCount.textContent = `${todayProgress.total} ${todayProgress.total === 1 ? 'task' : 'tasks'} today`;
    refs.todayProgressLabel.textContent = `${todayProgress.completed} of ${todayProgress.total} completed`;
    refs.todayProgressPercent.textContent = `${Math.round(todayProgress.ratio * 100)}%`;
    refs.todayProgressBar.style.width = `${todayProgress.ratio * 100}%`;
  }

  function handleScrollRequest(scrollRequest) {
    if (!scrollRequest || scrollRequest.token === lastHandledScrollToken) {
      return;
    }

    lastHandledScrollToken = scrollRequest.token;

    requestAnimationFrame(() => {
      const escapedTaskId = CSS.escape(scrollRequest.taskId);
      const taskItem = document.querySelector(`.task-item[data-task-id="${escapedTaskId}"]`);

      if (taskItem) {
        taskItem.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
