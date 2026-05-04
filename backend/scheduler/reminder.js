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
        dueAt: {
          gte: rangeStart,
          lte: rangeEnd
        }
      },
      orderBy: {
        dueAt: 'asc'
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
  if (!task?.dueAt) {
    return false;
  }

  const dueAt = new Date(task.dueAt);
  return dueAt >= now && dueAt <= windowEnd;
}
