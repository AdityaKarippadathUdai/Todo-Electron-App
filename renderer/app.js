const list = document.getElementById('taskList');
const datePicker = document.getElementById('datePicker');
const addBtn = document.getElementById('addBtn');

// ✅ Set today's date
const today = new Date().toISOString().split('T')[0];
datePicker.value = today;

// ✅ Load tasks on startup
window.onload = () => {
  loadTasks();
};

// ✅ Attach event listener (IMPORTANT FIX)
addBtn.addEventListener('click', addTask);

async function loadTasks() {
  const date = datePicker.value;

  console.log("Loading tasks for:", date);

  try {
    const tasks = await window.api.getTasks(date);

    console.log("Tasks:", tasks);

    list.innerHTML = '';

    tasks.forEach(t => {
      const li = document.createElement('li');

      // ⚠️ Avoid inline onclick here too
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = t.completed;
      checkbox.addEventListener('change', () => toggle(t.id));

      const text = document.createElement('span');
      text.textContent = " " + t.title + " ";

      const delBtn = document.createElement('button');
      delBtn.textContent = "X";
      delBtn.addEventListener('click', () => removeTask(t.id));

      li.appendChild(checkbox);
      li.appendChild(text);
      li.appendChild(delBtn);

      list.appendChild(li);
    });

  } catch (err) {
    console.error("Load failed:", err);
  }
}

async function addTask() {
  const title = document.getElementById('taskInput').value;
  const dueDate = datePicker.value;

  console.log("Add clicked:", title, dueDate);

  if (!title) {
    alert("Enter a task");
    return;
  }

  if (!dueDate) {
    alert("Select a date");
    return;
  }

  try {
    await window.api.addTask({
      title,
      dueDate: new Date(dueDate)
    });

    console.log("Task added");

    document.getElementById('taskInput').value = '';

    await loadTasks();

  } catch (err) {
    console.error("Add failed:", err);
  }
}

async function toggle(id) {
  try {
    await window.api.toggleTask(id);
    await loadTasks();
  } catch (err) {
    console.error("Toggle failed:", err);
  }
}

async function removeTask(id) {
  try {
    await window.api.deleteTask(id);
    await loadTasks();
  } catch (err) {
    console.error("Delete failed:", err);
  }
}

datePicker.addEventListener('change', loadTasks);