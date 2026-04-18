import { createAppStore } from './store.js';
import { createReminderController } from './reminders.js';
import { createUIController } from './ui.js';

const store = createAppStore(window.api);
const reminders = createReminderController(store);

createUIController(store);

async function bootstrap() {
  try {
    await store.actions.initialize();
    await reminders.start();
  } catch (error) {
    console.error('App initialization failed:', error);
    store.actions.showToast('Unable to load tasks right now.');
  }
}

bootstrap();
