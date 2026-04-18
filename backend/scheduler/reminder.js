import { PrismaClient } from '@prisma/client';
import { Notification } from 'electron';

const prisma = new PrismaClient();

export function startReminderService() {
  setInterval(async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000);
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(windowEnd);
    rangeEnd.setHours(23, 59, 59, 999);

    const tasks = await prisma.task.findMany({
      where: {
        completed: false,
        dueDate: {
          gte: rangeStart,
          lte: rangeEnd
        }
      }
    });

    tasks
      .filter((task) => shouldNotifyForTask(task, now, windowEnd))
      .forEach(task => {
        new Notification({
          title: 'Reminder',
          body: task.title
        }).show();
      });

  }, 60000);
}

function shouldNotifyForTask(task, now, windowEnd) {
  if (!task?.dueDate) {
    return false;
  }

  if (!task.dueTime) {
    return true;
  }

  const dueAt = new Date(task.dueDate);
  const [hours, minutes] = String(task.dueTime).split(':').map(Number);
  dueAt.setHours(hours, minutes, 0, 0);

  return dueAt >= now && dueAt <= windowEnd;
}
