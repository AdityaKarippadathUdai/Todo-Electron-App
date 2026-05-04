import {
  createTaskCollectionSelector,
  getCountdownInfo,
  getNextTask,
  getTimelineTasks,
  formatTaskSchedule,
  formatTimeLabel,
  formatTaskDate,
  getPriorityLabel,
  getGreeting,
  getTaskDateKey,
  getTasksForDate,
  getTodayProgress,
  getTodayKey,
  isAllDaySchedule,
  REMINDER_HIGHLIGHT_MS,
  SNOOZE_MINUTES
} from './task-utils.js';

export function createUIController(store) {
  const refs = {
    addBtn: document.getElementById('addBtn'),
    datePicker: document.getElementById('datePicker'),
    timePicker: document.getElementById('timePicker'),
    priorityField: document.querySelector('.priority-field'),
    prioritySelector: document.querySelector('.priority-selector'),
    priorityButtons: Array.from(document.querySelectorAll('.priority-pill')),
    taskInput: document.getElementById('taskInput'),
    quickTaskInput: document.getElementById('quickTaskInput'),
    quickAddBtn: document.getElementById('quickAddBtn'),
    taskCount: document.getElementById('taskCount'),
    selectedDateLabel: document.getElementById('selectedDateLabel'),
    overdueCount: document.getElementById('overdueCount'),
    upcomingCount: document.getElementById('upcomingCount'),
    reminderBanner: document.getElementById('reminderBanner'),
    toast: document.getElementById('toast'),
    taskList: document.getElementById('taskList'),
    sidebarGreeting: document.getElementById('sidebarGreeting'),
    todayTaskInsightCount: document.getElementById('todayTaskInsightCount'),
    todayDueCount: document.getElementById('todayDueCount'),
    todayOverdueCount: document.getElementById('todayOverdueCount'),
    todayProgressLabel: document.getElementById('todayProgressLabel'),
    todayProgressPercent: document.getElementById('todayProgressPercent'),
    todayProgressBar: document.getElementById('todayProgressBar'),
    nextTaskCard: document.getElementById('nextTaskCard'),
    nextTaskTitle: document.getElementById('nextTaskTitle'),
    nextTaskMeta: document.getElementById('nextTaskMeta'),
    nextTaskCountdown: document.getElementById('nextTaskCountdown'),
    nextTaskFocusBtn: document.getElementById('nextTaskFocusBtn'),
    timelineList: document.getElementById('timelineList')
  };

  const selectCollections = createTaskCollectionSelector();
  let clockTimer = null;
  let lastHandledScrollToken = null;

  bindEvents();
  startClock();
  store.subscribe(render);

  function bindEvents() {
    refs.addBtn.addEventListener('click', handleAddTask);
    refs.datePicker.addEventListener('change', (event) => {
      store.actions.setSelectedDate(event.target.value);
    });
    refs.timePicker.addEventListener('input', (event) => {
      store.actions.setFormTime(event.target.value);
    });
    refs.prioritySelector.addEventListener('click', (event) => {
      const button = event.target.closest('.priority-pill');

      if (!button?.dataset.priority) {
        return;
      }

      store.actions.setFormPriority(button.dataset.priority);
    });
    refs.taskInput.addEventListener('input', (event) => {
      store.actions.setFormTitle(event.target.value);
    });
    refs.quickTaskInput.addEventListener('input', (event) => {
      store.actions.setQuickTitle(event.target.value);
    });
    refs.quickAddBtn.addEventListener('click', handleQuickAddTask);
    refs.taskInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleAddTask();
      }
    });
    refs.quickTaskInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        handleQuickAddTask();
      }
    });

    refs.taskList.addEventListener('change', (event) => {
      const checkbox = event.target.closest('.task-checkbox');

      if (checkbox?.dataset.taskId) {
        handleToggleTask(checkbox.dataset.taskId);
      }
    });

    refs.taskList.addEventListener('click', (event) => {
      const emptyCta = event.target.closest('.empty-state-cta');

      if (emptyCta) {
        event.preventDefault();
        focusTaskComposer();
        return;
      }

      const suggestion = event.target.closest('.empty-state-suggestion');

      if (suggestion?.dataset.suggestion) {
        event.preventDefault();
        store.actions.setFormTitle(suggestion.dataset.suggestion);
        focusTaskComposer();
        refs.taskInput.select();
        return;
      }

      const snoozeButton = event.target.closest('.snooze-btn');

      if (snoozeButton?.dataset.taskId) {
        event.preventDefault();
        handleSnoozeTask(snoozeButton.dataset.taskId, snoozeButton.dataset.minutes);
        return;
      }

      const deleteButton = event.target.closest('.delete-btn');

      if (deleteButton?.dataset.taskId) {
        handleDeleteTask(deleteButton.dataset.taskId);
      }
    });

    refs.timelineList.addEventListener('click', (event) => {
      const focusButton = event.target.closest('.timeline-focus-btn');

      if (focusButton?.dataset.taskId) {
        event.preventDefault();
        handleFocusTask(focusButton.dataset.taskId);
        return;
      }

      const snoozeButton = event.target.closest('.timeline-snooze-btn');

      if (snoozeButton?.dataset.taskId) {
        event.stopPropagation();
        handleSnoozeTask(snoozeButton.dataset.taskId, snoozeButton.dataset.minutes);
        return;
      }

      const timelineItem = event.target.closest('.timeline-item');

      if (timelineItem?.dataset.taskId) {
        handleFocusTask(timelineItem.dataset.taskId);
      }
    });

    refs.nextTaskFocusBtn.addEventListener('click', (event) => {
      event.preventDefault();
      const nextTask = getNextTask(store.getState().tasks.items, new Date(store.getState().ui.nowAt));
      if (nextTask) {
        handleFocusTask(nextTask.id);
      }
    });
  }

  function startClock() {
    const tick = () => {
      store.actions.setNow(new Date().toISOString());
    };

    tick();
    clockTimer = window.setInterval(tick, 60_000);
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

  async function handleQuickAddTask() {
    try {
      await store.actions.quickAddTask();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleSnoozeTask(taskId, minutes = SNOOZE_MINUTES) {
    try {
      const snoozeMinutes = Number(minutes) || SNOOZE_MINUTES;
      await store.actions.snoozeTask(taskId, snoozeMinutes);
      const task = store.getState().tasks.items.find((item) => item.id === taskId);

      if (task) {
        store.actions.showToast(`⏰ Task Reminder: ${task.title} snoozed for ${snoozeMinutes} minutes`);
      }
    } catch (error) {
      console.error('Snooze failed:', error);
      store.actions.showToast('Unable to snooze that task.');
    }
  }

  function handleFocusTask(taskId) {
    store.actions.focusTask(taskId, {
      scroll: true,
      durationMs: REMINDER_HIGHLIGHT_MS
    });
  }

  function render(state) {
    const now = new Date(state.ui.nowAt);
    const collections = selectCollections(state.tasks.items);
    const visibleTasks = getTasksForDate(state.tasks.items, state.ui.selectedDate);
    const todayProgress = getTodayProgress(state.tasks.items);
    const nextTask = getNextTask(state.tasks.items, now);
    const timelineTasks = getTimelineTasks(state.tasks.items, now, 5);
    const dueTodayCount = state.tasks.items.filter((task) => getTaskDateKey(task) === getTodayKey(now)).length;
    const overdueCount = collections.overdueTasks.length;

    refs.datePicker.value = state.ui.selectedDate;
    refs.timePicker.value = state.ui.formTime;
    refs.priorityField?.setAttribute('data-priority', state.ui.formPriority || 'medium');
    refs.priorityButtons.forEach((button) => {
      const isSelected = button.dataset.priority === state.ui.formPriority;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
    refs.taskInput.value = state.ui.formTitle;
    refs.quickTaskInput.value = state.ui.quickTitle;
    refs.selectedDateLabel.textContent = formatTaskDate(state.ui.selectedDate);
    refs.overdueCount.textContent = `${collections.overdueTasks.length} overdue`;
    refs.upcomingCount.textContent = `${collections.upcomingTasks.length} upcoming`;

    renderAlerts(state);
    renderMainTaskList(visibleTasks, state.ui.highlightedTaskId, now);
    renderSidebarSummary(todayProgress, dueTodayCount, overdueCount, nextTask, timelineTasks, now);
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

  function renderMainTaskList(tasks, highlightedTaskId, now) {
    refs.taskCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;

    if (!tasks.length) {
      refs.taskList.innerHTML = renderEmptyTaskState();
      return;
    }

    refs.taskList.innerHTML = tasks.map((task) => {
      const countdown = getCountdownInfo(task, now);

      return `
      <li class="task-item${task.id === highlightedTaskId ? ' is-reminded' : ''}" data-task-id="${escapeHtml(task.id)}" data-priority="${escapeHtml(task.priority ?? 'medium')}" data-urgency="${escapeHtml(countdown.tone)}">
        <div class="task-main">
          <input
            type="checkbox"
            class="task-checkbox"
            data-task-id="${escapeHtml(task.id)}"
            ${task.completed ? 'checked' : ''}
          />
          <div class="task-copy">
            <div class="task-title-row">
              <span class="task-text${task.completed ? ' is-complete' : ''}">${escapeHtml(task.title)}</span>
              <span class="task-priority-chip">${escapeHtml(getPriorityLabel(task.priority))}</span>
            </div>
            <span class="task-date">${escapeHtml(formatTaskSchedule(task))}</span>
            <span class="task-countdown" data-tone="${escapeHtml(countdown.tone)}">${escapeHtml(countdown.label)}</span>
          </div>
        </div>
        <div class="task-actions">
          <button type="button" class="snooze-btn" data-task-id="${escapeHtml(task.id)}" data-minutes="5">+5m</button>
          <button type="button" class="snooze-btn" data-task-id="${escapeHtml(task.id)}" data-minutes="10">+10m</button>
          <button
            class="delete-btn"
            type="button"
            data-task-id="${escapeHtml(task.id)}"
            aria-label="Delete ${escapeHtml(task.title)}"
          >&times;</button>
        </div>
      </li>
    `;
    }).join('');
  }

  function renderSidebarSummary(todayProgress, dueTodayCount, overdueCount, nextTask, timelineTasks, now) {
    refs.sidebarGreeting.textContent = getGreeting(now);
    refs.todayTaskInsightCount.textContent = `${dueTodayCount} ${dueTodayCount === 1 ? 'task' : 'tasks'} due today`;
    refs.todayDueCount.textContent = String(dueTodayCount);
    refs.todayOverdueCount.textContent = String(overdueCount);
    refs.todayProgressLabel.textContent = `${todayProgress.completed} of ${todayProgress.total} completed`;
    refs.todayProgressPercent.textContent = `${Math.round(todayProgress.ratio * 100)}%`;
    refs.todayProgressBar.style.width = `${todayProgress.ratio * 100}%`;

    renderNextTaskCard(nextTask, now);
    renderTimeline(timelineTasks, now);
  }

  function renderNextTaskCard(nextTask, now) {
    if (!nextTask) {
      refs.nextTaskCard.classList.add('is-empty');
      delete refs.nextTaskCard.dataset.urgency;
      refs.nextTaskTitle.textContent = 'No upcoming tasks';
      refs.nextTaskMeta.textContent = 'You’re clear for now.';
      refs.nextTaskCountdown.textContent = 'Take a breath or add something new.';
      refs.nextTaskFocusBtn.disabled = true;
      delete refs.nextTaskFocusBtn.dataset.taskId;
      return;
    }

    const countdown = getCountdownInfo(nextTask, now);

    refs.nextTaskCard.classList.remove('is-empty');
    refs.nextTaskCard.dataset.urgency = countdown.tone;
    refs.nextTaskTitle.textContent = nextTask.title;
    refs.nextTaskMeta.textContent = `${formatTaskSchedule(nextTask)} • ${getPriorityLabel(nextTask.priority)} priority`;
    refs.nextTaskCountdown.textContent = countdown.label;
    refs.nextTaskFocusBtn.disabled = false;
    refs.nextTaskFocusBtn.dataset.taskId = nextTask.id;
  }

  function renderTimeline(tasks, now) {
    if (!tasks.length) {
      refs.timelineList.innerHTML = '<div class="widget-empty">No upcoming tasks right now.</div>';
      return;
    }

    refs.timelineList.innerHTML = tasks.map((task) => {
      const countdown = getCountdownInfo(task, now);
      const dueTimeLabel = isAllDaySchedule(task.dueAt) ? 'Any time' : formatTimeLabel(task.dueAt);

      return `
        <article class="timeline-item" data-task-id="${escapeHtml(task.id)}" data-urgency="${escapeHtml(countdown.tone)}">
          <span class="timeline-dot" aria-hidden="true"></span>
          <span class="timeline-content">
            <span class="timeline-title">${escapeHtml(task.title)}</span>
            <span class="timeline-meta">${escapeHtml(dueTimeLabel)} • ${escapeHtml(countdown.label)}</span>
          </span>
          <span class="timeline-actions">
            <button type="button" class="timeline-focus-btn" data-task-id="${escapeHtml(task.id)}">Focus on this</button>
            <button type="button" class="timeline-snooze-btn" data-task-id="${escapeHtml(task.id)}" data-minutes="5">+5m</button>
          </span>
        </article>
      `;
    }).join('');
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

  function renderEmptyTaskState() {
    return `
      <li class="empty-state-card">
        <div class="empty-state-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="presentation" focusable="false">
            <path d="M16 38.5C16 27.2 24.9 18 36 18s20 9.2 20 20.5S47.1 59 36 59 16 49.8 16 38.5Z" fill="currentColor" opacity="0.08"></path>
            <path d="M22 31l7 7 13-13" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M10 16l3-3M9 25h4M48 8l3-3M54 16h4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
          </svg>
        </div>
        <div class="empty-state-copy">
          <h3>You're all clear for today 🎉</h3>
          <p>Add a task to stay productive</p>
        </div>
        <div class="empty-state-actions">
          <button type="button" class="empty-state-cta">➕ Add your first task</button>
          <div class="empty-state-suggestions" aria-label="Quick suggestions">
            <button type="button" class="empty-state-suggestion" data-suggestion="Plan your day">Plan your day</button>
            <button type="button" class="empty-state-suggestion" data-suggestion="Set a reminder">Set a reminder</button>
          </div>
        </div>
      </li>
    `;
  }

  function focusTaskComposer() {
    refs.taskInput.focus();
    refs.taskInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
