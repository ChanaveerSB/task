"use strict";

/* =========================================================
   Task List Table
   Flow:  all tasks -> filter -> sort -> one page -> draw rows
   Every event listener: update `state`, then call render().
   ========================================================= */

const DATA_URL = "../mock/tasks.json";

const STATUS_LABELS = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const STATUS_ORDER = { todo: 1, in_progress: 2, done: 3 };
const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COLUMNS = [
  { field: "id", label: "#" },
  { field: "title", label: "Title" },
  { field: "project", label: "Project" },
  { field: "assignee", label: "Assignee" },
  { field: "status", label: "Status" },
  { field: "priority", label: "Priority" },
  { field: "dueDate", label: "Due date" },
];

/* ---------- State (single source of truth) ---------- */
const state = {
  allTasks: [],
  loading: true,
  error: null,
  search: "",
  status: "all",
  sortField: "id",
  sortDirection: "asc",
  page: 1,
  pageSize: 10,
};

/* ---------- DOM references ---------- */
const searchInput = document.getElementById("search");
const statusSelect = document.getElementById("statusFilter");
const pageSizeSelect = document.getElementById("pageSize");
const sortSelect = document.getElementById("sortSelect");
const sortDirBtn = document.getElementById("sortDirBtn");
const exportBtn = document.getElementById("exportBtn");
const stateBox = document.getElementById("stateBox");
const tableWrap = document.getElementById("tableWrap");
const tbody = document.getElementById("taskBody");
const summary = document.getElementById("summary");
const pagination = document.getElementById("pagination");
const sortButtons = document.querySelectorAll(".sort-btn");

/* =========================================================
   Helpers
   ========================================================= */

// "2026-11-05" -> "5 Nov 2026" (parsed by hand to avoid timezone shifts)
function formatDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Today as "YYYY-MM-DD" in the user's local time
function todayString() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function isOverdue(task) {
  // YYYY-MM-DD strings compare correctly as text
  return task.status !== "done" && task.dueDate < todayString();
}

// Put text in an element and wrap matches of `query` in <mark>. Uses text nodes only (no innerHTML).
function setHighlightedText(el, text, query) {
  el.textContent = "";
  const q = query.trim().toLowerCase();
  if (!q) {
    el.textContent = text;
    return;
  }
  const lower = text.toLowerCase();
  let pos = 0;
  let idx = lower.indexOf(q, pos);
  while (idx !== -1) {
    if (idx > pos) el.appendChild(document.createTextNode(text.slice(pos, idx)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(idx, idx + q.length);
    el.appendChild(mark);
    pos = idx + q.length;
    idx = lower.indexOf(q, pos);
  }
  if (pos < text.length) el.appendChild(document.createTextNode(text.slice(pos)));
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* =========================================================
   Data pipeline: filter -> sort -> page
   ========================================================= */

function getFilteredTasks() {
  const q = state.search.trim().toLowerCase();
  return state.allTasks.filter((task) => {
    if (state.status !== "all" && task.status !== state.status) return false;
    if (!q) return true;
    const title = task.title.toLowerCase();
    const assignee = (task.assignee || "").toLowerCase();
    return title.includes(q) || assignee.includes(q);
  });
}

function compareTasks(a, b, field) {
  switch (field) {
    case "id":
      return a.id - b.id;
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "priority":
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    case "dueDate":
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    default: // title, project, assignee
      return String(a[field]).localeCompare(String(b[field]), undefined, { sensitivity: "base" });
  }
}

// Returns a sorted COPY; the original array is never changed
function getSortedTasks(tasks) {
  const dir = state.sortDirection === "asc" ? 1 : -1;
  const field = state.sortField;

  return [...tasks].sort((a, b) => {
    // Unassigned always goes to the end when sorting by assignee
    if (field === "assignee") {
      if (a.assignee === null && b.assignee !== null) return 1;
      if (a.assignee !== null && b.assignee === null) return -1;
      if (a.assignee === null && b.assignee === null) return a.id - b.id;
    }
    const result = compareTasks(a, b, field) * dir;
    return result !== 0 ? result : a.id - b.id; // stable tie-break
  });
}

/* =========================================================
   Rendering
   ========================================================= */

function makeCell(label) {
  const td = document.createElement("td");
  td.dataset.label = label;
  return td;
}

function renderRow(task) {
  const tr = document.createElement("tr");

  const idCell = makeCell("#");
  idCell.textContent = task.id;

  const titleCell = makeCell("Title");
  setHighlightedText(titleCell, task.title, state.search);

  const projectCell = makeCell("Project");
  projectCell.textContent = task.project;

  const assigneeCell = makeCell("Assignee");
  if (task.assignee === null) {
    const span = document.createElement("span");
    span.className = "unassigned";
    span.textContent = "Unassigned";
    assigneeCell.appendChild(span);
  } else {
    setHighlightedText(assigneeCell, task.assignee, state.search);
  }

  const statusCell = makeCell("Status");
  const badge = document.createElement("span");
  badge.className = `badge ${task.status}`;
  badge.textContent = STATUS_LABELS[task.status] || task.status;
  statusCell.appendChild(badge);

  const priorityCell = makeCell("Priority");
  priorityCell.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

  const dueCell = makeCell("Due date");
  if (isOverdue(task)) {
    const span = document.createElement("span");
    span.className = "overdue";
    span.textContent = `${formatDate(task.dueDate)} (overdue)`;
    dueCell.appendChild(span);
  } else {
    dueCell.textContent = formatDate(task.dueDate);
  }

  tr.append(idCell, titleCell, projectCell, assigneeCell, statusCell, priorityCell, dueCell);
  return tr;
}

// Page numbers like: 1 … 4 5 6 … 10
function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push("…");
    items.push(p);
  });
  return items;
}

function makePageButton(label, page, { disabled = false, active = false, ariaLabel = "" } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "page-btn" + (active ? " active" : "");
  btn.textContent = label;
  btn.disabled = disabled;
  if (ariaLabel) btn.setAttribute("aria-label", ariaLabel);
  if (active) btn.setAttribute("aria-current", "page");
  btn.addEventListener("click", () => {
    state.page = page;
    render();
  });
  return btn;
}

function renderPagination(totalPages) {
  pagination.replaceChildren();
  if (totalPages === 0) return;

  pagination.appendChild(
    makePageButton("Prev", state.page - 1, { disabled: state.page === 1, ariaLabel: "Previous page" })
  );

  getPageItems(state.page, totalPages).forEach((item) => {
    if (item === "…") {
      const span = document.createElement("span");
      span.className = "ellipsis";
      span.textContent = "…";
      pagination.appendChild(span);
    } else {
      pagination.appendChild(
        makePageButton(String(item), item, { active: item === state.page, ariaLabel: `Page ${item}` })
      );
    }
  });

  pagination.appendChild(
    makePageButton("Next", state.page + 1, { disabled: state.page === totalPages, ariaLabel: "Next page" })
  );
}

function showStateMessage(text, buttonLabel, onClick, extraClass = "") {
  const box = document.createElement("div");
  box.className = `state-message ${extraClass}`.trim();
  const p = document.createElement("p");
  p.textContent = text;
  box.appendChild(p);
  if (buttonLabel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary";
    btn.textContent = buttonLabel;
    btn.addEventListener("click", onClick);
    box.appendChild(btn);
  }
  stateBox.replaceChildren(box);
}

function updateSortIndicators() {
  sortButtons.forEach((btn) => {
    const active = btn.dataset.field === state.sortField;
    btn.querySelector(".arrow").textContent = active ? (state.sortDirection === "asc" ? "↑" : "↓") : "";
    btn.closest("th").setAttribute(
      "aria-sort",
      active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none"
    );
  });
  sortSelect.value = state.sortField;
  sortDirBtn.textContent = state.sortDirection === "asc" ? "↑" : "↓";
}

function render() {
  // Keep the controls in sync with state (needed after URL restore / clear filters)
  if (searchInput.value !== state.search) searchInput.value = state.search;
  statusSelect.value = state.status;
  pageSizeSelect.value = String(state.pageSize);
  updateSortIndicators();

  tbody.replaceChildren();
  summary.textContent = "";
  pagination.replaceChildren();

  // 1) Loading state
  if (state.loading) {
    tableWrap.hidden = true;
    showStateMessage("Loading tasks...");
    return;
  }

  // 2) Error state
  if (state.error) {
    tableWrap.hidden = true;
    showStateMessage(`Could not load tasks: ${state.error}`, "Try again", loadTasks, "error");
    return;
  }

  // 3) Filter -> sort -> page
  const filtered = getFilteredTasks();
  const sorted = getSortedTasks(filtered);
  const total = sorted.length;

  // 4) Empty state
  if (total === 0) {
    tableWrap.hidden = true;
    showStateMessage("No tasks match your search", "Clear filters", clearFilters);
    summary.textContent = "Showing 0 of 0 tasks";
    saveToUrl();
    return;
  }

  const totalPages = Math.ceil(total / state.pageSize);
  if (state.page > totalPages) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const start = (state.page - 1) * state.pageSize;
  const pageTasks = sorted.slice(start, start + state.pageSize);

  stateBox.replaceChildren();
  tableWrap.hidden = false;
  tbody.append(...pageTasks.map(renderRow));

  summary.textContent = `Showing ${start + 1}–${start + pageTasks.length} of ${total} tasks`;
  renderPagination(totalPages);
  saveToUrl();
}

/* =========================================================
   URL state (bonus): ?q=ravi&status=done&sort=title&dir=desc&page=2&size=20
   ========================================================= */

function saveToUrl() {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  if (state.status !== "all") params.set("status", state.status);
  if (state.sortField !== "id") params.set("sort", state.sortField);
  if (state.sortDirection !== "asc") params.set("dir", state.sortDirection);
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("size", String(state.pageSize));
  const query = params.toString();
  history.replaceState(null, "", query ? `?${query}` : location.pathname);
}

function loadFromUrl() {
  const params = new URLSearchParams(location.search);

  state.search = params.get("q") || "";

  const status = params.get("status");
  state.status = status === "all" || STATUS_LABELS[status] ? status : "all";
  if (!status) state.status = "all";

  const sort = params.get("sort");
  if (COLUMNS.some((c) => c.field === sort)) state.sortField = sort;

  state.sortDirection = params.get("dir") === "desc" ? "desc" : "asc";

  const size = Number(params.get("size"));
  if ([5, 10, 20].includes(size)) state.pageSize = size;

  const page = parseInt(params.get("page"), 10);
  state.page = page > 0 ? page : 1;
}

/* =========================================================
   Actions
   ========================================================= */

function clearFilters() {
  state.search = "";
  state.status = "all";
  state.page = 1;
  render();
}

function exportCsv() {
  const rows = getSortedTasks(getFilteredTasks());
  const header = ["ID", "Title", "Project", "Assignee", "Status", "Priority", "Due date"];

  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text; // stop spreadsheet formula injection
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [header.map(escape).join(",")];
  rows.forEach((t) => {
    lines.push(
      [t.id, t.title, t.project, t.assignee || "Unassigned", STATUS_LABELS[t.status], t.priority, t.dueDate]
        .map(escape)
        .join(",")
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tasks.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Load data ONCE (called on start and by the "Try again" button)
async function loadTasks() {
  state.loading = true;
  state.error = null;
  render();

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const json = await response.json();
    if (!json || !Array.isArray(json.data)) throw new Error("Unexpected data format");
    state.allTasks = json.data;
  } catch (err) {
    state.error = err.message;
  } finally {
    state.loading = false;
    render();
  }
}

/* =========================================================
   Events
   ========================================================= */

const onSearch = debounce(() => {
  state.search = searchInput.value;
  state.page = 1;
  render();
}, 250);

searchInput.addEventListener("input", onSearch);

statusSelect.addEventListener("change", () => {
  state.status = statusSelect.value;
  state.page = 1;
  render();
});

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  render();
});

function sortBy(field) {
  if (state.sortField === field) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortField = field;
    state.sortDirection = "asc";
  }
  render();
}

sortButtons.forEach((btn) => btn.addEventListener("click", () => sortBy(btn.dataset.field)));

// Mobile sort controls
COLUMNS.forEach((col) => {
  const option = document.createElement("option");
  option.value = col.field;
  option.textContent = col.label === "#" ? "ID" : col.label;
  sortSelect.appendChild(option);
});

sortSelect.addEventListener("change", () => {
  state.sortField = sortSelect.value;
  state.sortDirection = "asc";
  render();
});

sortDirBtn.addEventListener("click", () => {
  state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  render();
});

exportBtn.addEventListener("click", exportCsv);

/* ---------- Start ---------- */
loadFromUrl();
loadTasks();
