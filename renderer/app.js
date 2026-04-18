const list = document.getElementById('taskList');
const datePicker = document.getElementById('datePicker');
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
      li.className = 'task-item';

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
      date.textContent = formatTaskDate(t.dueDate);

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
    });

  } catch (err) {
    console.error('Load failed:', err);
  }
}

async function addTask() {
  const title = taskInput.value.trim();
  const dueDate = datePicker.value;

  if (!title) {
    alert('Enter a task');
    return;
  }

  if (!dueDate) {
    alert('Select a date');
    return;
  }

  try {
    await window.api.addTask({
      title,
      dueDate: new Date(dueDate)
    });
    taskInput.value = '';

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
