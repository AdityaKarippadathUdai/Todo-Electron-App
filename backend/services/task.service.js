import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getTasksByDate(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return prisma.task.findMany({
    where: {
      dueDate: {
        gte: start,
        lte: end
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
}

export async function createTask(data) {
  return prisma.task.create({
    data: {
      title: data.title,
      dueDate: new Date(data.dueDate)
    }
  });
}

export async function toggleTask(id) {
  const task = await prisma.task.findUnique({ where: { id } });

  return prisma.task.update({
    where: { id },
    data: { completed: !task.completed }
  });
}

export async function deleteTask(id) {
  return prisma.task.delete({ where: { id } });
}
