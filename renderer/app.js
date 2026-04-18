const list = document.getElementById('taskList');
const datePicker = document.getElementById('datePicker');
const timePicker = document.getElementById('timePicker');
const addBtn = document.getElementById('addBtn');
const taskInput = document.getElementById('taskInput');
const taskCount = document.getElementById('taskCount');
const selectedDateLabel = document.getElementById('selectedDateLabel');

const today = new Date().toISOString().split('T')[0];
datePicker.value = today;
updateSelectedDateLabel(today);

window.onload = () => {
  loadTasks();
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

  } catch (err) {
    console.error('Add failed:', err);
  }
}

async function toggle(id) {
  try {
    await window.api.toggleTask(id);
    await loadTasks();
  } catch (err) {
    console.error('Toggle failed:', err);
  }
}

async function removeTask(id) {
  try {
    await window.api.deleteTask(id);
    await loadTasks();
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
