const taskTableBody = document.getElementById("taskTableBody");
const taskSummary = document.getElementById("taskSummary");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const pageSizeSelect = document.getElementById("pageSize");

const state = {
  allTasks: [],
  search: "",
  status: "all",
  sortField: "id",
  sortDirection: "asc",
  page: 1,
  pageSize: 10,
};

// Convert the stored status into readable text
function formatStatus(status) {
  const statusNames = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };

  return statusNames[status] || status;
}

// Display a date like 5 Nov 2026
function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Check whether a task is overdue
function isOverdue(task) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.dueDate}T00:00:00`);

  return (
    task.status !== "done" &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate < today
  );
}

// Create a table cell safely
function createCell(value, label) {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;

  return cell;
}

// Create and display one task row
function createTaskRow(task) {
  const row = document.createElement("tr");

  row.appendChild(createCell(task.id, "#"));
  row.appendChild(createCell(task.title, "Title"));
  row.appendChild(createCell(task.project, "Project"));

  const assigneeCell = createCell(task.assignee || "Unassigned", "Assignee");

  if (!task.assignee) {
    assigneeCell.classList.add("unassigned");
  }

  row.appendChild(assigneeCell);

  const statusCell = createCell(formatStatus(task.status), "Status");

  const badge = document.createElement("span");
  badge.classList.add("badge", `status-${task.status}`);
  badge.textContent = formatStatus(task.status);

  statusCell.textContent = "";
  statusCell.appendChild(badge);
  row.appendChild(statusCell);

  const priorityCell = createCell(task.priority, "Priority");

  priorityCell.classList.add(`priority-${task.priority}`);
  row.appendChild(priorityCell);

  const dueDateCell = createCell(formatDate(task.dueDate), "Due date");

  if (isOverdue(task)) {
    dueDateCell.classList.add("overdue");
    dueDateCell.textContent += " (overdue)";
  }

  row.appendChild(dueDateCell);

  return row;
}

// Display the tasks in the table

function renderTasks() {
  // 1. Start with all tasks
  let tasks = [...state.allTasks];

  // 2. Apply search
  const query = state.search.toLowerCase().trim();

  if (query) {
    tasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        (task.assignee || "").toLowerCase().includes(query),
    );
  }

  // 3. Apply status filter
  if (state.status !== "all") {
    tasks = tasks.filter((task) => task.status === state.status);
  }

  const priorityOrder = {
    low: 1,
    medium: 2,
    high: 3,
  };

  tasks.sort((a, b) => {
    const field = state.sortField;
    let comparison = 0;

    // Keep unassigned tasks at the end
    if (field === "assignee") {
      if (!a.assignee && b.assignee) return 1;
      if (a.assignee && !b.assignee) return -1;
    }

    if (field === "priority") {
      comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
    } else {
      const valueA = a[field] ?? "";
      const valueB = b[field] ?? "";

      comparison = String(valueA).localeCompare(String(valueB), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    }

    return state.sortDirection === "asc" ? comparison : -comparison;
  });

  // 4. Calculate pagination
  const totalTasks = tasks.length;
  const totalPages = Math.ceil(totalTasks / state.pageSize);

  // Keep the current page valid if results change
  if (totalPages === 0) {
    state.page = 1;
  } else if (state.page > totalPages) {
    state.page = totalPages;
  }

  const start = (state.page - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, totalTasks);

  // 5. Select only the tasks for this page
  const pageTasks = tasks.slice(start, end);

  // 6. Draw the rows
  taskTableBody.replaceChildren();

  pageTasks.forEach((task) => {
    taskTableBody.appendChild(createTaskRow(task));
  });

  // 7. Update the summary
  if (totalTasks === 0) {
    taskSummary.textContent = "Showing 0 tasks";
  } else {
    taskSummary.textContent = `Showing ${start + 1}–${end} of ${totalTasks} tasks`;
  }

  // 8. Draw the page buttons
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pageControls = document.getElementById("pageControls");
  pageControls.replaceChildren();

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.textContent = "Prev";
  prevButton.type = "button";
  prevButton.disabled = state.page === 1;

  prevButton.addEventListener("click", () => {
    if (state.page > 1) {
      state.page--;
      renderTasks();
    }
  });

  pageControls.appendChild(prevButton);

  // Numbered page buttons
  for (let page = 1; page <= totalPages; page++) {
    const pageButton = document.createElement("button");

    pageButton.textContent = page;
    pageButton.type = "button";

    if (page === state.page) {
      pageButton.classList.add("active");
      pageButton.setAttribute("aria-current", "page");
    }

    pageButton.addEventListener("click", () => {
      state.page = page;
      renderTasks();
    });

    pageControls.appendChild(pageButton);
  }

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.type = "button";
  nextButton.disabled = totalPages === 0 || state.page === totalPages;

  nextButton.addEventListener("click", () => {
    if (state.page < totalPages) {
      state.page++;
      renderTasks();
    }
  });

  pageControls.appendChild(nextButton);
}

// Load the JSON file
async function loadTasks() {
  taskSummary.textContent = "Loading tasks...";
  errorMessage.hidden = true;

  try {
    const response = await fetch("../mock/tasks.json");

    if (!response.ok) {
      throw new Error("Could not load tasks");
    }

    const result = await response.json();

    state.allTasks = result.data;
    renderTasks();
    updateSortIndicators();
  } catch (error) {
    console.error("Error loading tasks:", error);

    taskSummary.textContent = "Unable to load tasks.";
    errorMessage.hidden = false;
  }
}

// Retry if loading fails
retryButton.addEventListener("click", loadTasks);

searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  state.page = 1;
  renderTasks();
});

statusFilter.addEventListener("change", () => {
  state.status = statusFilter.value;
  state.page = 1;
  renderTasks();
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  renderTasks();
});

document.querySelectorAll(".sort-button").forEach((button) => {
  button.addEventListener("click", () => {
    const field = button.dataset.sort;

    if (state.sortField === field) {
      state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.sortField = field;
      state.sortDirection = "asc";
    }

    state.page = 1;
    updateSortIndicators();
    renderTasks();
  });
});

function updateSortIndicators() {
  document.querySelectorAll(".sort-button").forEach((button) => {
    const field = button.dataset.sort;
    const originalText = {
      id: "#",
      title: "Title",
      project: "Project",
      assignee: "Assignee",
      status: "Status",
      priority: "Priority",
      dueDate: "Due date",
    };

    let label = originalText[field];

    if (state.sortField === field) {
      label += state.sortDirection === "asc" ? " ↑" : " ↓";
    }

    button.textContent = label;
  });
}

// Start the application
loadTasks();
