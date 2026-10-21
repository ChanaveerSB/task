"use strict";

const state = {
  allTasks: [],
  search: "",
  status: "all",
  sortField: "id",
  sortDirection: "asc",
  page: 1,
  pageSize: 10,
  loading: true,
  error: false
};

const elements = {
  search: document.getElementById("search"),
  status: document.getElementById("status-filter"),
  pageSize: document.getElementById("page-size"),
  clear: document.getElementById("clear-filters"),
  rows: document.getElementById("task-rows"),
  table: document.getElementById("task-table"),
  statePanel: document.getElementById("table-state"),
  showing: document.getElementById("showing-text"),
  pagination: document.getElementById("pagination"),
  total: document.getElementById("total-count"),
  done: document.getElementById("done-count")
};

const statusLabels = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const priorityRank = { low: 1, medium: 2, high: 3 };

function escapeText(value) {
  // All API values are inserted using textContent, not interpreted as HTML.
  return value == null ? "" : String(value);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeText(value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.dueDate}T00:00:00`);
  return !Number.isNaN(due.getTime()) && due < today;
}

function getFilteredTasks() {
  const query = state.search.trim().toLowerCase();
  return state.allTasks.filter(task => {
    const matchesSearch = !query ||
      String(task.title || "").toLowerCase().includes(query) ||
      String(task.assignee || "").toLowerCase().includes(query);
    const matchesStatus = state.status === "all" || task.status === state.status;
    return matchesSearch && matchesStatus;
  });
}

function getSortedTasks(tasks) {
  const copy = [...tasks];
  copy.sort((a, b) => {
    const field = state.sortField;
    if (field === "assignee") {
      const aMissing = a.assignee == null || a.assignee === "";
      const bMissing = b.assignee == null || b.assignee === "";
      if (aMissing !== bMissing) return aMissing ? 1 : -1;
    }
    let av = a[field];
    let bv = b[field];
    if (field === "priority") {
      av = priorityRank[av] || 0;
      bv = priorityRank[bv] || 0;
    } else if (field === "status") {
      const order = { todo: 1, in_progress: 2, done: 3 };
      av = order[av] || 0;
      bv = order[bv] || 0;
    } else if (field === "id") {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    } else {
      av = String(av ?? "").toLowerCase();
      bv = String(bv ?? "").toLowerCase();
    }
    if (av < bv) return state.sortDirection === "asc" ? -1 : 1;
    if (av > bv) return state.sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  return copy;
}

function makeCell(label, value, className = "") {
  const td = document.createElement("td");
  td.dataset.label = label;
  if (className) td.className = className;
  if (value instanceof Node) td.appendChild(value);
  else td.textContent = escapeText(value);
  return td;
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = text;
  return badge;
}

function buildTaskRow(task) {
  const tr = document.createElement("tr");
  tr.appendChild(makeCell("#", task.id, "task-id"));

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = escapeText(task.title || "Untitled task");
  tr.appendChild(makeCell("Title", title));

  tr.appendChild(makeCell("Project", task.project || "—", "project-name"));

  const assignee = document.createElement("span");
  if (task.assignee == null || task.assignee === "") {
    assignee.className = "unassigned";
    assignee.textContent = "Unassigned";
  } else {
    assignee.textContent = escapeText(task.assignee);
  }
  tr.appendChild(makeCell("Assignee", assignee));

  const status = task.status || "todo";
  tr.appendChild(makeCell("Status", makeBadge(statusLabels[status] || status, `status-badge status-${status}`)));

  const priority = task.priority || "low";
  tr.appendChild(makeCell("Priority", makeBadge(priority.charAt(0).toUpperCase() + priority.slice(1), `priority-badge priority-${priority}`)));

  const due = document.createElement("span");
  due.textContent = formatDate(task.dueDate);
  if (isOverdue(task)) {
    due.className = "due-overdue";
    due.textContent += " (overdue)";
  }
  tr.appendChild(makeCell("Due date", due));
  return tr;
}

function showPanel(title, message, showRetry = false) {
  elements.table.classList.add("d-none");
  elements.statePanel.classList.remove("d-none");
  elements.statePanel.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = title;
  const paragraph = document.createElement("p");
  paragraph.className = "mb-3";
  paragraph.textContent = message;
  elements.statePanel.append(heading, paragraph);
  if (showRetry) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-primary";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadTasks);
    elements.statePanel.appendChild(retry);
  }
}

function showTable() {
  elements.table.classList.remove("d-none");
  elements.statePanel.classList.add("d-none");
}

function renderPagination(totalPages) {
  elements.pagination.replaceChildren();
  const addPage = (label, page, options = {}) => {
    const li = document.createElement("li");
    li.className = `page-item${options.active ? " active" : ""}${options.disabled ? " disabled" : ""}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-link";
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    if (!options.disabled && !options.active) {
      button.addEventListener("click", () => { state.page = page; render(); });
    }
    li.appendChild(button);
    elements.pagination.appendChild(li);
  };
  addPage("Prev", state.page - 1, { disabled: state.page <= 1 });
  for (let page = 1; page <= totalPages; page += 1) {
    addPage(String(page), page, { active: page === state.page });
  }
  addPage("Next", state.page + 1, { disabled: state.page >= totalPages || totalPages === 0 });
}

function updateSortIndicators() {
  document.querySelectorAll("[data-sort]").forEach(button => {
    const arrow = button.querySelector(".sort-arrow");
    arrow.textContent = button.dataset.sort === state.sortField ? (state.sortDirection === "asc" ? "↑" : "↓") : "";
    button.setAttribute("aria-sort", button.dataset.sort === state.sortField
      ? (state.sortDirection === "asc" ? "ascending" : "descending")
      : "none");
  });
}

function render() {
  if (state.loading) {
    elements.rows.replaceChildren();
    showTable();
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.className = "text-center py-5 text-secondary";
    td.textContent = "Loading tasks...";
    tr.appendChild(td);
    elements.rows.appendChild(tr);
    elements.showing.textContent = "Loading tasks…";
    elements.pagination.replaceChildren();
    return;
  }
  if (state.error) return;
  showTable();

  const filtered = getFilteredTasks();
  const sorted = getSortedTasks(filtered);
  const totalPages = Math.ceil(sorted.length / state.pageSize);
  if (state.page > Math.max(totalPages, 1)) state.page = Math.max(totalPages, 1);
  const startIndex = (state.page - 1) * state.pageSize;
  const pageTasks = sorted.slice(startIndex, startIndex + state.pageSize);

  elements.rows.replaceChildren();
  if (filtered.length === 0) {
    showPanel("No tasks match your search", "Try a different keyword or clear the filters.");
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn btn-outline-primary";
    clear.textContent = "Clear filters";
    clear.addEventListener("click", clearFilters);
    elements.statePanel.appendChild(clear);
  } else {
    pageTasks.forEach(task => elements.rows.appendChild(buildTaskRow(task)));
  }
  const from = filtered.length ? startIndex + 1 : 0;
  const to = Math.min(startIndex + state.pageSize, filtered.length);
  elements.showing.textContent = `Showing ${from}–${to} of ${filtered.length} tasks`;
  elements.total.textContent = String(state.allTasks.length);
  elements.done.textContent = String(state.allTasks.filter(task => task.status === "done").length);
  renderPagination(totalPages);
  updateSortIndicators();
}

function clearFilters() {
  state.search = "";
  state.status = "all";
  state.page = 1;
  elements.search.value = "";
  elements.status.value = "all";
  render();
}

async function loadTasks() {
  state.loading = true;
  state.error = false;
  render();
  try {
    const response = await fetch("../mock/tasks.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const payload = await response.json();
    const tasks = Array.isArray(payload) ? payload : payload.data;
    if (!Array.isArray(tasks)) throw new Error("The API response does not contain a task array.");
    state.allTasks = tasks;
    state.loading = false;
    state.error = false;
    render();
  } catch (error) {
    console.error("Could not load tasks:", error);
    state.loading = false;
    state.error = true;
    elements.table.classList.add("d-none");
    elements.statePanel.classList.remove("d-none");
    showPanel("Could not load tasks", "Check that you are running a local server and that mock/tasks.json exists.", true);
    elements.showing.textContent = "Tasks could not be loaded";
    elements.pagination.replaceChildren();
  }
}

elements.search.addEventListener("input", () => {
  state.search = elements.search.value;
  state.page = 1;
  render();
});
elements.status.addEventListener("change", () => {
  state.status = elements.status.value;
  state.page = 1;
  render();
});
elements.pageSize.addEventListener("change", () => {
  state.pageSize = Number(elements.pageSize.value);
  state.page = 1;
  render();
});
elements.clear.addEventListener("click", clearFilters);
document.querySelectorAll("[data-sort]").forEach(button => {
  button.addEventListener("click", () => {
    const field = button.dataset.sort;
    if (state.sortField === field) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    else {
      state.sortField = field;
      state.sortDirection = "asc";
    }
    state.page = 1;
    render();
  });
});

loadTasks();