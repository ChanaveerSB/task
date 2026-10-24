import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STATUS_NAMES = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
};

const SORT_FIELDS = [
  ["id", "#"],
  ["title", "Title"],
  ["project", "Project"],
  ["assignee", "Assignee"],
  ["status", "Status"],
  ["priority", "Priority"],
  ["dueDate", "Due date"],
];

function formatStatus(status) {
  return STATUS_NAMES[status] || status;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString || "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(task) {
  if (task.status === "done" || !task.dueDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.dueDate}T00:00:00`);

  return !Number.isNaN(dueDate.getTime()) && dueDate < today;
}

function compareTasks(a, b, field) {
  if (field === "assignee") {
    if (!a.assignee && b.assignee) return 1;
    if (a.assignee && !b.assignee) return -1;
  }

  if (field === "priority") {
    return (
      (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0)
    );
  }

  const valueA = a[field] ?? "";
  const valueB = b[field] ?? "";

  return String(valueA).localeCompare(String(valueB), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function TaskTable({ tasks, onSort, sortField, sortDirection }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {SORT_FIELDS.map(([field, label]) => {
              const active = sortField === field;

              const indicator = active
                ? sortDirection === "asc"
                  ? " ↑"
                  : " ↓"
                : "";

              return (
                <th scope="col" key={field}>
                  <button
                    type="button"
                    className="sort-button"
                    onClick={() => onSort(field)}
                    aria-label={`Sort by ${label}`}
                    aria-sort={
                      active
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {label}
                    {indicator}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td data-label="#">{task.id}</td>

              <td data-label="Title">{task.title}</td>

              <td data-label="Project">{task.project}</td>

              <td
                data-label="Assignee"
                className={!task.assignee ? "unassigned" : ""}
              >
                {task.assignee || "Unassigned"}
              </td>

              <td data-label="Status">
                <span className={`badge status-${task.status}`}>
                  {formatStatus(task.status)}
                </span>
              </td>

              <td data-label="Priority" className={`priority-${task.priority}`}>
                {task.priority
                  ? task.priority.charAt(0).toUpperCase() +
                    task.priority.slice(1)
                  : "—"}
              </td>

              <td
                data-label="Due date"
                className={isOverdue(task) ? "overdue" : ""}
              >
                {formatDate(task.dueDate)}
                {isOverdue(task) && " (overdue)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCards({ tasks }) {
  return (
    <div className="mobile-task-list">
      {tasks.map((task) => (
        <article className="mobile-task-card" key={task.id}>
          <div className="mobile-card-heading">
            <span className="task-number">Task #{task.id}</span>

            <span className={`badge status-${task.status}`}>
              {formatStatus(task.status)}
            </span>
          </div>

          <h3>{task.title}</h3>

          <div className="mobile-card-details">
            <div>
              <span>Project</span>
              <strong>{task.project}</strong>
            </div>

            <div>
              <span>Assignee</span>
              <strong className={!task.assignee ? "unassigned" : ""}>
                {task.assignee || "Unassigned"}
              </strong>
            </div>

            <div>
              <span>Priority</span>
              <strong className={`priority-${task.priority}`}>
                {task.priority
                  ? task.priority.charAt(0).toUpperCase() +
                    task.priority.slice(1)
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Due date</span>
              <strong className={isOverdue(task) ? "overdue" : ""}>
                {formatDate(task.dueDate)}
                {isOverdue(task) && " (overdue)"}
              </strong>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <section className="pagination" aria-label="Task pagination">
      <div className="page-size-control">
        <label htmlFor="pageSize">Rows per page</label>

        <select
          id="pageSize"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
        </select>
      </div>

      <div className="page-controls">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (pageNumber) => (
            <button
              type="button"
              key={pageNumber}
              className={pageNumber === page ? "active" : ""}
              aria-current={pageNumber === page ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={totalPages === 0 || page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

function App() {
  const [allTasks, setAllTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortField, setSortField] = useState("id");
  const [sortDirection, setSortDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/mock/tasks.json");

      if (!response.ok) {
        throw new Error("Could not load tasks");
      }

      const result = await response.json();

      if (!Array.isArray(result.data)) {
        throw new Error("Task data is not an array");
      }

      setAllTasks(result.data);
    } catch (err) {
      console.error("Error loading tasks:", err);
      setError("Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];

    const query = search.toLowerCase().trim();

    if (query) {
      tasks = tasks.filter(
        (task) =>
          (task.title || "").toLowerCase().includes(query) ||
          (task.assignee || "").toLowerCase().includes(query),
      );
    }

    if (status !== "all") {
      tasks = tasks.filter((task) => task.status === status);
    }

    tasks.sort((a, b) => {
      const comparison = compareTasks(a, b, sortField);

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return tasks;
  }, [allTasks, search, status, sortField, sortDirection]);

  const totalTasks = filteredTasks.length;
  const totalPages = Math.ceil(totalTasks / pageSize);

  const currentPage = Math.min(page, Math.max(totalPages, 1));

  const start = totalTasks === 0 ? 0 : (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalTasks);

  const pageTasks = filteredTasks.slice(start, end);

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }

    setPage(1);
  }

  function handleSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value) {
    setStatus(value);
    setPage(1);
  }

  function handlePageSizeChange(value) {
    setPageSize(value);
    setPage(1);
  }

  return (
    <div className="app">
      <header className="page-header">
        <h1>Task List</h1>
        <p>Manage and track your team's tasks</p>
      </header>

      <main className="container">
        <section className="toolbar" aria-label="Task controls">
          <label htmlFor="searchInput">Search tasks</label>

          <input
            type="search"
            id="searchInput"
            placeholder="Search by title or assignee..."
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
          />

          <label htmlFor="statusFilter">Filter by status</label>

          <select
            id="statusFilter"
            value={status}
            onChange={(event) => handleStatusChange(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </section>

        <p id="taskSummary" aria-live="polite">
          {loading
            ? "Loading tasks..."
            : error
              ? "Unable to load tasks."
              : totalTasks === 0
                ? "Showing 0 tasks"
                : `Showing ${start + 1}–${end} of ${totalTasks} tasks`}
        </p>

        {error && (
          <div className="error-message" role="alert">
            <p>Unable to load tasks.</p>

            <button type="button" onClick={loadTasks}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <TaskTable
              tasks={pageTasks}
              onSort={handleSort}
              sortField={sortField}
              sortDirection={sortDirection}
            />

            <TaskCards tasks={pageTasks} />

            {totalTasks === 0 && (
              <div className="empty-state">
                <h3>No tasks found</h3>
                <p>Try changing your search or status filter.</p>
              </div>
            )}

            <Pagination
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}

        {loading && <div className="loading-state">Loading tasks...</div>}
      </main>
    </div>
  );
}

export default App;
