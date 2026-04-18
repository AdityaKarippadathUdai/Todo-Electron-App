import {
  getSnoozedPreview,
  getTaskDateKey,
  getTodayKey,
  isPastSchedule,
  REMINDER_HIGHLIGHT_MS,
  SNOOZE_MINUTES
} from './task-utils.js';

export function createAppStore(api) {
  const listeners = new Set();
  let bannerTimer = null;
  let toastTimer = null;
  let highlightTimer = null;

  const state = {
    ui: {
      selectedDate: getTodayKey(),
      formTitle: '',
      formTime: '',
      banner: null,
      toast: null,
      highlightedTaskId: null,
      scrollRequest: null,
      highlightToken: 0
    },
    tasks: {
      items: []
    },
    reminders: {
      lastCheckAt: new Date().toISOString()
    }
  };

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function mutate(recipe) {
    recipe(state);
    emit();
  }

  function getState() {
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    listener(state);

    return () => {
      listeners.delete(listener);
    };
  }

  function replaceTask(updatedTask) {
    const index = state.tasks.items.findIndex((task) => task.id === updatedTask.id);

    if (index === -1) {
      state.tasks.items.push(updatedTask);
      return;
    }

    state.tasks.items[index] = updatedTask;
  }

  function findTask(taskId) {
    return state.tasks.items.find((task) => task.id === taskId) ?? null;
  }

  function scheduleBannerClear(durationMs) {
    if (bannerTimer) {
      window.clearTimeout(bannerTimer);
    }

    bannerTimer = window.setTimeout(() => {
      mutate((draft) => {
        draft.ui.banner = null;
      });
    }, durationMs);
  }

  function scheduleToastClear(durationMs) {
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
      mutate((draft) => {
        draft.ui.toast = null;
      });
    }, durationMs);
  }

  function scheduleHighlightClear(durationMs) {
    if (highlightTimer) {
      window.clearTimeout(highlightTimer);
    }

    highlightTimer = window.setTimeout(() => {
      mutate((draft) => {
        draft.ui.highlightedTaskId = null;
      });
    }, durationMs);
  }

  async function refreshTasks() {
    const items = await api.getAllTasks();

    mutate((draft) => {
      draft.tasks.items = items;
    });

    return items;
  }

  const actions = {
    async initialize() {
      await refreshTasks();
    },

    setSelectedDate(value) {
      mutate((draft) => {
        draft.ui.selectedDate = value;
      });
    },

    setFormTitle(value) {
      mutate((draft) => {
        draft.ui.formTitle = value;
      });
    },

    setFormTime(value) {
      mutate((draft) => {
        draft.ui.formTime = value;
      });
    },

    async addTaskFromForm() {
      const title = state.ui.formTitle.trim();
      const dueDate = state.ui.selectedDate;
      const dueTime = state.ui.formTime || null;

      if (!title) {
        throw new Error('Enter a task');
      }

      if (!dueDate) {
        throw new Error('Select a date');
      }

      if (isPastSchedule(dueDate, dueTime)) {
        throw new Error('Choose a due date and time that is not in the past');
      }

      await api.addTask({
        title,
        dueDate,
        dueTime
      });

      mutate((draft) => {
        draft.ui.formTitle = '';
        draft.ui.formTime = '';
      });

      await refreshTasks();
    },

    async toggleTask(taskId) {
      const previousTask = findTask(taskId);

      if (!previousTask) {
        return;
      }

      mutate((draft) => {
        const task = draft.tasks.items.find((item) => item.id === taskId);

        if (task) {
          task.completed = !task.completed;
        }
      });

      try {
        const updatedTask = await api.toggleTask(taskId);

        mutate((draft) => {
          const index = draft.tasks.items.findIndex((item) => item.id === taskId);

          if (index !== -1) {
            draft.tasks.items[index] = updatedTask;
          }
        });
      } catch (error) {
        mutate((draft) => {
          const index = draft.tasks.items.findIndex((item) => item.id === taskId);

          if (index !== -1) {
            draft.tasks.items[index] = previousTask;
          }
        });

        throw error;
      }
    },

    async removeTask(taskId) {
      const previousItems = state.tasks.items.slice();

      mutate((draft) => {
        draft.tasks.items = draft.tasks.items.filter((task) => task.id !== taskId);
      });

      try {
        await api.deleteTask(taskId);
      } catch (error) {
        mutate((draft) => {
          draft.tasks.items = previousItems;
        });

        throw error;
      }
    },

    async snoozeTask(taskId, minutes = SNOOZE_MINUTES) {
      const previousTask = findTask(taskId);

      if (!previousTask) {
        return;
      }

      const optimisticTask = {
        ...previousTask,
        ...getSnoozedPreview(previousTask, minutes),
        notified: false
      };

      mutate((draft) => {
        const index = draft.tasks.items.findIndex((item) => item.id === taskId);

        if (index !== -1) {
          draft.tasks.items[index] = optimisticTask;
        }
      });

      try {
        const updatedTask = await api.snoozeTask(taskId, minutes);

        mutate((draft) => {
          const index = draft.tasks.items.findIndex((item) => item.id === taskId);

          if (index !== -1) {
            draft.tasks.items[index] = updatedTask;
          }
        });
      } catch (error) {
        mutate((draft) => {
          const index = draft.tasks.items.findIndex((item) => item.id === taskId);

          if (index !== -1) {
            draft.tasks.items[index] = previousTask;
          }
        });

        throw error;
      }
    },

    showBanner(message, durationMs = 5_000) {
      mutate((draft) => {
        draft.ui.banner = message;
      });
      scheduleBannerClear(durationMs);
    },

    showToast(message, durationMs = 3_600) {
      mutate((draft) => {
        draft.ui.toast = message;
      });
      scheduleToastClear(durationMs);
    },

    focusTask(taskId, options = {}) {
      const task = findTask(taskId);
      const { scroll = false, durationMs = REMINDER_HIGHLIGHT_MS } = options;

      mutate((draft) => {
        draft.ui.highlightedTaskId = taskId;
        draft.ui.highlightToken += 1;
        draft.ui.scrollRequest = scroll ? { taskId, token: draft.ui.highlightToken } : null;

        if (task) {
          draft.ui.selectedDate = getTaskDateKey(task);
        }
      });

      scheduleHighlightClear(durationMs);
    },

    setReminderCheckpoint(timestamp) {
      mutate((draft) => {
        draft.reminders.lastCheckAt = timestamp;
      });
    }
  };

  return {
    getState,
    subscribe,
    actions
  };
}
