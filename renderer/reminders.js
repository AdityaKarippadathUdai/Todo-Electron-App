import { REMINDER_HIGHLIGHT_MS } from './task-utils.js';

const REMINDER_POLL_MS = 60_000;

export function createReminderController(store) {
  let intervalId = null;

  async function requestDesktopNotificationPermission() {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.error('Notification permission request failed:', error);
      }
    }
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

  function notifyReminder(task) {
    const message = `⏰ Task Due: ${task.title}`;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Task Due', {
        body: task.title,
        silent: true
      });
    } else {
      store.actions.showBanner(message);
    }

    store.actions.showToast(message, 5_000);
    playReminderSound();
    store.actions.focusTask(task.id, {
      scroll: true,
      durationMs: REMINDER_HIGHLIGHT_MS * 2
    });
  }

  async function checkDueReminders() {
    const currentTimestamp = new Date().toISOString();
    const lastCheckAt = store.getState().reminders.lastCheckAt;

    try {
      const reminders = await window.api.getDueReminders(lastCheckAt, currentTimestamp);

      if (Array.isArray(reminders) && reminders.length > 0) {
        await window.api.acknowledgeReminders(reminders.map((task) => task.id));
        reminders.forEach(notifyReminder);
      }
    } catch (error) {
      console.error('Reminder check failed:', error);
    } finally {
      store.actions.setReminderCheckpoint(currentTimestamp);
    }
  }

  return {
    async start() {
      await requestDesktopNotificationPermission();
      await checkDueReminders();
      intervalId = window.setInterval(checkDueReminders, REMINDER_POLL_MS);
    },

    stop() {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    }
  };
}
