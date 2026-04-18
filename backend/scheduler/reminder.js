import { PrismaClient } from '@prisma/client';
import { Notification } from 'electron';

const prisma = new PrismaClient();

export function startReminderService() {
  setInterval(async () => {
    const now = new Date();

    const tasks = await prisma.task.findMany({
      where: {
        completed: false,
        dueDate: {
          lte: new Date(now.getTime() + 5 * 60 * 1000),
          gte: now
        }
      }
    });

    tasks.forEach(task => {
      new Notification({
        title: "Reminder",
        body: task.title
      }).show();
    });

  }, 60000);
}