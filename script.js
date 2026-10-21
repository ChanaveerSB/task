const DATA_URL = "./tasks.json";

const state = {
  allTasks: [],
  search: "",
  status: "all",
  sortField: "id",
  sortDirection: "asc",
  page: 1,
  pageSize: 10,
  loading: true,
  error: false,
};

const elements = {
  search: document.getElementById("search-input"),
  status: document.getElementById("status-filter"),
  pageSize: document.getElementById("page-size"),
  notice: document.getElementById("notice"),
  region: document.getElementById("table-region"),
  rows: document.getElementById("task-rows"),
  footer: document.getElementById("table-footer"),
  summary: document.getElementById("summary"),
  pagination: document.getElementById("pagination"),
  export: document.getElementById("export-button"),
};

const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const priorityOrder = { low: 1, medium: 2, high: 3 };
let searchTimer;

function getAssignee(task) {
  return task.assigneeName ?? task.assignee ?? null;
}

function getProject(task) {
  return task.project ?? (task.projectId == null ? "Unassigned project" : `Project ${task.projectId}`);
}

function highlightText(text, query) {
  if (!query) return document.createTextNode(text);

  const fragment = document.createDocumentFragment();
  const lower = text.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let from = 0;

  while (from < text.length) {
    const match = lower.indexOf(needle, from);

    if (match === -1) {
      fragment.append(document.createTextNode(text.slice(from)));
      break;
    }

    if (match > from) {
      fragment.append(document.createTextNode(text.slice(from, match)));
    }

    const mark = document.createElement("mark");
    mark.textContent = text.slice(match, match + query.length);
    fragment.append(mark);
    from = match + query.length;
  }

  return fragment;
}

function filteredTasks() {
  const query = state.search.trim().toLocaleLowerCase();

  return state.allTasks.filter((task) => {
    const matchesQuery =
      !query ||
      task.title.toLocaleLowerCase().includes(query) ||
      (getAssignee(task) || "").toLocaleLowerCase().includes(query);

    return (
      matchesQuery && (state.status === "all" || task.status === state.status)
    );
  });
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const field = state.sortField;

    if (field === "assignee" && !getAssignee(a) && getAssignee(b)) return 1;
    if (field === "assignee" && getAssignee(a) && !getAssignee(b)) return -1;

    const first = field === "assignee" ? (getAssignee(a) || "") : field === "project" ? getProject(a) : (a[field] ?? "");
    const second = field === "assignee" ? (getAssignee(b) || "") : field === "project" ? getProject(b) : (b[field] ?? "");
    let comparison;

    if (field === "priority") {
      comparison = (priorityOrder[first] || 0) - (priorityOrder[second] || 0);
    } else if (field === "id") {
      comparison = Number(first) - Number(second);
    } else {
      comparison = String(first).localeCompare(String(second), undefined, {
        sensitivity: "base",
      });
    }

    return comparison * (state.sortDirection === "asc" ? 1 : -1);
  });
}

function formatDate(value) {
  if (!value) return "No due date";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function makeCell(label, className, content, task) {
  const td = document.createElement("td");
  td.dataset.label = label;

  if (className) td.className = className;

  if (content instanceof Node) {
    td.append(content);
  } else {
    td.textContent = content;
  }

  if (label === "Title") td.dataset.id = String(task.id);
  return td;
}

function makeRow(task) {
  const tr = document.createElement("tr");

  tr.append(makeCell("#", "id-cell", String(task.id), task));

  const titleCell = makeCell("Title", "title-cell", "", task);
  titleCell.append(highlightText(String(task.title), state.search.trim()));
  tr.append(titleCell);

  tr.append(makeCell("Project", "project-cell", String(getProject(task)), task));

  const assigneeCell = document.createElement("td");
  assigneeCell.dataset.label = "Assignee";
  assigneeCell.className = "assignee-cell";

  if (getAssignee(task) == null) {
    const unassigned = document.createElement("em");
    unassigned.className = "unassigned";
    unassigned.textContent = "Unassigned";
    assigneeCell.append(unassigned);
  } else {
    assigneeCell.append(
      highlightText(String(getAssignee(task)), state.search.trim()),
    );
  }

  tr.append(assigneeCell);

  const badge = document.createElement("span");
  badge.className = `badge status-${task.status}`;
  badge.textContent = statusLabels[task.status] || String(task.status);
  tr.append(makeCell("Status", "", badge, task));

  const priority = document.createElement("span");
  priority.className = `priority priority-${task.priority}`;
  priority.textContent = String(task.priority);
  tr.append(makeCell("Priority", "", priority, task));

  const due = document.createElement("span");
  const today = new Date().toISOString().slice(0, 10);
  const overdue = Boolean(task.dueDate) && task.status !== "done" && task.dueDate < today;
  due.className = overdue ? "due-date overdue" : "due-date";
  due.textContent = `${formatDate(task.dueDate)}${overdue ? " (overdue)" : ""}`;
  tr.append(makeCell("Due date", "", due, task));

  return tr;
}

function pageNumbers(total, current) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    total,
    current,
    current - 1,
    current + 1,
    current - 2,
    current + 2,
  ]);

  const sorted = [...pages]
    .filter((page) => page > 0 && page <= total)
    .sort((a, b) => a - b);

  const output = [];

  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) output.push("…");
    output.push(page);
  });

  return output;
}

function addPageButton(label, page, disabled = false, current = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-button";
  button.textContent = label;
  button.disabled = disabled;

  if (current) button.setAttribute("aria-current", "page");

  button.addEventListener("click", () => {
    state.page = page;
    updateUrl();
    render();
  });

  elements.pagination.append(button);
}

function renderPagination(totalPages) {
  elements.pagination.replaceChildren();

  addPageButton("‹", Math.max(1, state.page - 1), state.page === 1);

  for (const page of pageNumbers(totalPages, state.page)) {
    if (page === "…") {
      const dots = document.createElement("span");
      dots.className = "ellipsis";
      dots.textContent = "…";
      elements.pagination.append(dots);
    } else {
      addPageButton(String(page), page, false, page === state.page);
    }
  }

  addPageButton(
    "›",
    Math.min(totalPages, state.page + 1),
    state.page === totalPages,
  );
}

function render() {
  if (state.loading) {
    elements.notice.hidden = false;
    elements.notice.className = "notice";
    elements.notice.textContent = "Loading tasks…";
    elements.region.hidden = true;
    elements.footer.hidden = true;
    return;
  }

  if (state.error) {
    elements.notice.hidden = false;
    elements.notice.className = "notice error";
    elements.notice.replaceChildren();

    elements.notice.append(
      document.createTextNode(
        "Could not load tasks. Check that tasks.json is available, then try again.",
      ),
    );

    const retry = document.createElement("button");
    retry.className = "button button-quiet";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadTasks);
    elements.notice.append(retry);

    elements.region.hidden = true;
    elements.footer.hidden = true;
    return;
  }

  const filtered = sortTasks(filteredTasks());
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));

  state.page = Math.min(state.page, totalPages);
  elements.notice.hidden = total > 0;
  elements.region.hidden = total === 0;
  elements.footer.hidden = total === 0;

  if (!total) {
    elements.notice.className = "notice empty";
    elements.notice.replaceChildren(
      document.createTextNode("No tasks match your search"),
    );

    const clear = document.createElement("button");
    clear.className = "button button-quiet";
    clear.textContent = "Clear filters";
    clear.addEventListener("click", () => {
      state.search = "";
      state.status = "all";
      state.page = 1;
      elements.search.value = "";
      elements.status.value = "all";
      updateUrl();
      render();
    });

    elements.notice.append(clear);
    return;
  }

  const start = (state.page - 1) * state.pageSize;
  const visible = filtered.slice(start, start + state.pageSize);

  elements.rows.replaceChildren(...visible.map(makeRow));
  elements.summary.textContent = `Showing ${start + 1}–${Math.min(start + state.pageSize, total)} of ${total} tasks`;

  renderPagination(totalPages);

  document.querySelectorAll(".sort-button").forEach((button) => {
    const active = button.dataset.sort === state.sortField;
    const th = button.closest("th");

    th.setAttribute(
      "aria-sort",
      active
        ? state.sortDirection === "asc"
          ? "ascending"
          : "descending"
        : "none",
    );

    button.querySelector(".sort-arrow").textContent = active
      ? state.sortDirection === "asc"
        ? "↑"
        : "↓"
      : "";
  });
}

function updateUrl() {
  const url = new URL(window.location.href);

  state.search
    ? url.searchParams.set("q", state.search)
    : url.searchParams.delete("q");

  state.status !== "all"
    ? url.searchParams.set("status", state.status)
    : url.searchParams.delete("status");

  url.searchParams.set("sort", state.sortField);
  url.searchParams.set("direction", state.sortDirection);
  url.searchParams.set("page", String(state.page));
  url.searchParams.set("size", String(state.pageSize));

  history.replaceState(null, "", url);
}

function restoreUrl() {
  const params = new URLSearchParams(location.search);

  state.search = params.get("q") || "";
  state.status = ["todo", "in_progress", "done"].includes(params.get("status"))
    ? params.get("status")
    : "all";

  const fields = [
    "id",
    "title",
    "project",
    "assignee",
    "status",
    "priority",
    "dueDate",
  ];

  state.sortField = fields.includes(params.get("sort"))
    ? params.get("sort")
    : "id";

  state.sortDirection = params.get("direction") === "desc" ? "desc" : "asc";
  state.page = Math.max(1, Number(params.get("page")) || 1);

  state.pageSize = [5, 10, 20].includes(Number(params.get("size")))
    ? Number(params.get("size"))
    : 10;

  elements.search.value = state.search;
  elements.status.value = state.status;
  elements.pageSize.value = String(state.pageSize);
}

async function loadTasks() {
  state.loading = true;
  state.error = false;
  render();

  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const payload = await response.json();

    if (!Array.isArray(payload.data)) {
      throw new Error("Unexpected task data");
    }

    state.allTasks = payload.data;
    state.loading = false;
    state.error = false;
    render();
  } catch (error) {
    console.error("Task loading failed:", error);
    state.loading = false;
    state.error = true;
    render();
  }
}

function exportCsv() {
  const tasks = sortTasks(filteredTasks());
  const headers = [
    "#",
    "Title",
    "Project",
    "Assignee",
    "Status",
    "Priority",
    "Due date",
  ];

  const rows = tasks.map((task) => [
    task.id,
    task.title,
    getProject(task),
    getAssignee(task) || "Unassigned",
    statusLabels[task.status] || task.status,
    task.priority,
    task.dueDate,
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
    )
    .join("\r\n");

  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  link.download = "task-list.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

elements.search.addEventListener("input", () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    state.search = elements.search.value;
    state.page = 1;
    updateUrl();
    render();
  }, 250);
});

elements.status.addEventListener("change", () => {
  state.status = elements.status.value;
  state.page = 1;
  updateUrl();
  render();
});

elements.pageSize.addEventListener("change", () => {
  state.pageSize = Number(elements.pageSize.value);
  state.page = 1;
  updateUrl();
  render();
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
    updateUrl();
    render();
  });
});

elements.export.addEventListener("click", exportCsv);

restoreUrl();
loadTasks();
