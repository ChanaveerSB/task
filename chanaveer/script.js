const state = {
    allTasks: [],
    search: "",
    status: "all",
    sortField: "id",
    sortDirection: "asc",
    page: 1,
    pageSize: 10,
    isLoading: false,
    error: null
};

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const pageSizeSelect = document.getElementById("pageSizeSelect");

const taskTableBody = document.getElementById("taskTableBody");
const paginationSummary = document.getElementById("paginationSummary");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageButtons = document.getElementById("pageButtons");

const tableContainer = document.getElementById("tableContainer");
const messageContainer = document.getElementById("messageContainer");

const sortableHeaders = document.querySelectorAll(
    ".task-table th[data-field]"
);

async function loadTasks() {
    state.isLoading = true;
    state.error = null;

    render();

    try {
        const response = await fetch("../mock/tasks.json");

        if (!response.ok) {
            throw new Error("Failed to load tasks.");
        }

        const result = await response.json();

        if (!Array.isArray(result.data)) {
            throw new Error("Invalid task data.");
        }

        state.allTasks = result.data;
        state.page = 1;
    } catch (error) {
        console.error("Error loading tasks:", error);
        state.error = "Unable to load tasks. Please try again.";
    } finally {
        state.isLoading = false;
        render();
    }
}

function getFilteredTasks() {
    const searchText = state.search.trim().toLowerCase();

    return state.allTasks.filter(function (task) {
        const title = String(task.title ?? "").toLowerCase();
        const assignee = String(task.assignee ?? "").toLowerCase();

        const matchesSearch =
            title.includes(searchText) ||
            assignee.includes(searchText);

        const matchesStatus =
            state.status === "all" ||
            task.status === state.status;

        return matchesSearch && matchesStatus;
    });
}

function getSortedTasks(tasks) {
    const priorityOrder = {
        low: 1,
        medium: 2,
        high: 3
    };

    const sortedTasks = [...tasks];

    sortedTasks.sort(function (a, b) {
        const field = state.sortField;

        if (field === "assignee") {
            const aUnassigned = !a.assignee;
            const bUnassigned = !b.assignee;

            if (aUnassigned && !bUnassigned) {
                return 1;
            }

            if (!aUnassigned && bUnassigned) {
                return -1;
            }

            if (aUnassigned && bUnassigned) {
                return 0;
            }
        }

        let valueA = a[field] ?? "";
        let valueB = b[field] ?? "";

        if (field === "priority") {
            valueA = priorityOrder[valueA] ?? 0;
            valueB = priorityOrder[valueB] ?? 0;
        } else if (typeof valueA === "string") {
            valueA = valueA.toLowerCase();
            valueB = String(valueB).toLowerCase();
        }

        let result = 0;

        if (valueA < valueB) {
            result = -1;
        } else if (valueA > valueB) {
            result = 1;
        }

        return state.sortDirection === "asc"
            ? result
            : -result;
    });

    return sortedTasks;
}

sortableHeaders.forEach(function (header) {
    header.addEventListener("click", function () {
        const field = header.dataset.field;

        if (state.sortField === field) {
            state.sortDirection =
                state.sortDirection === "asc" ? "desc" : "asc";
        } else {
            state.sortField = field;
            state.sortDirection = "asc";
        }

        state.page = 1;
        render();
    });
});

function getStatusLabel(status) {
    const labels = {
        todo: "To Do",
        in_progress: "In Progress",
        done: "Done"
    };

    return labels[status] ?? status;
}

function formatDate(dateString) {
    if (!dateString) {
        return "—";
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

function isOverdue(task) {
    if (task.status === "done" || !task.dueDate) {
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(`${task.dueDate}T00:00:00`);

    return (
        !Number.isNaN(dueDate.getTime()) &&
        dueDate < today
    );
}

function createCell(label, value, className = "") {
    const cell = document.createElement("td");
    cell.dataset.label = label;

    if (className) {
        cell.className = className;
    }

    cell.textContent = value ?? "—";
    return cell;
}

function renderRows(tasks) {
    taskTableBody.replaceChildren();

    tasks.forEach(function (task) {
        const row = document.createElement("tr");

        row.appendChild(
            createCell("#", task.id)
        );

        row.appendChild(
            createCell("Title", task.title, "task-title")
        );

        row.appendChild(
            createCell("Project", task.project)
        );

        const assigneeCell = createCell(
            "Assignee",
            task.assignee || "Unassigned"
        );

        if (!task.assignee) {
            assigneeCell.classList.add("unassigned");
        }

        row.appendChild(assigneeCell);

        const statusCell = document.createElement("td");
        statusCell.dataset.label = "Status";

        const statusBadge = document.createElement("span");
        statusBadge.classList.add("badge");

        const statusClasses = {
            todo: "status-todo",
            in_progress: "status-in-progress",
            done: "status-done"
        };

        statusBadge.classList.add(
            statusClasses[task.status] ?? "status-todo"
        );

        statusBadge.textContent = getStatusLabel(task.status);
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const priorityCell = document.createElement("td");
        priorityCell.dataset.label = "Priority";

        const priorityBadge = document.createElement("span");
        priorityBadge.classList.add("priority");

        const priorityClasses = {
            low: "priority-low",
            medium: "priority-medium",
            high: "priority-high"
        };

        priorityBadge.classList.add(
            priorityClasses[task.priority] ?? "priority-low"
        );

        priorityBadge.textContent = task.priority ?? "—";
        priorityCell.appendChild(priorityBadge);
        row.appendChild(priorityCell);

        const dueDateCell = createCell(
            "Due date",
            formatDate(task.dueDate),
            "due-date"
        );

        if (isOverdue(task)) {
            dueDateCell.classList.add("overdue");

            const overdueLabel = document.createElement("span");
            overdueLabel.classList.add("overdue-label");
            overdueLabel.textContent = "(overdue)";

            dueDateCell.appendChild(overdueLabel);
        }

        row.appendChild(dueDateCell);
        taskTableBody.appendChild(row);
    });
}

function renderSummary(filteredCount, startIndex, visibleCount) {
    const start = visibleCount === 0
        ? 0
        : startIndex + 1;

    const end = startIndex + visibleCount;

    paginationSummary.textContent =
        `Showing ${start}–${end} of ${filteredCount} tasks`;
}

function renderPagination(totalPages) {
    pageButtons.replaceChildren();

    for (
        let pageNumber = 1;
        pageNumber <= totalPages;
        pageNumber++
    ) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "pagination-button";
        button.textContent = pageNumber;

        button.setAttribute(
            "aria-label",
            `Go to page ${pageNumber}`
        );

        if (pageNumber === state.page) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", function () {
            state.page = pageNumber;
            render();
        });

        pageButtons.appendChild(button);
    }

    prevBtn.disabled = state.page <= 1;

    nextBtn.disabled =
        totalPages === 0 || state.page >= totalPages;
}

function updateSortIndicators() {
    sortableHeaders.forEach(function (header) {
        const icon = header.querySelector(".sort-icon");

        if (!icon) {
            return;
        }

        if (header.dataset.field === state.sortField) {
            icon.textContent =
                state.sortDirection === "asc" ? "↑" : "↓";
        } else {
            icon.textContent = "↕";
        }
    });
}

function showMessage(message, type = "") {
    messageContainer.replaceChildren();
    messageContainer.hidden = false;
    messageContainer.className = "message-container";

    if (type) {
        messageContainer.classList.add(type);
    }

    const text = document.createElement("p");
    text.textContent = message;
    messageContainer.appendChild(text);
}

function showError() {
    showMessage(
        "Unable to load tasks. Please try again.",
        "error"
    );

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "Try again";
    retryButton.addEventListener("click", loadTasks);

    messageContainer.appendChild(retryButton);
}

function render() {
    if (state.isLoading) {
        showMessage("Loading tasks...");
        tableContainer.hidden = true;
        paginationSummary.textContent = "Loading tasks...";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pageButtons.replaceChildren();
        return;
    }

    if (state.error) {
        showError();
        tableContainer.hidden = true;
        paginationSummary.textContent = "Unable to load tasks";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pageButtons.replaceChildren();
        return;
    }

    messageContainer.hidden = true;
    tableContainer.hidden = false;

    const filteredTasks = getFilteredTasks();
    const sortedTasks = getSortedTasks(filteredTasks);

    const totalPages = Math.ceil(
        sortedTasks.length / state.pageSize
    );

    if (totalPages === 0) {
        state.page = 1;
    } else if (state.page > totalPages) {
        state.page = totalPages;
    }

    const startIndex = (state.page - 1) * state.pageSize;

    const pageTasks = sortedTasks.slice(
        startIndex,
        startIndex + state.pageSize
    );

    renderRows(pageTasks);

    renderSummary(
        sortedTasks.length,
        startIndex,
        pageTasks.length
    );

    renderPagination(totalPages);
    updateSortIndicators();

    if (filteredTasks.length === 0) {
        showMessage("No tasks match your search.");

        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.className = "clear-filters-button";
        clearButton.textContent = "Clear filters";
        clearButton.addEventListener("click", clearFilters);

        messageContainer.appendChild(clearButton);
        tableContainer.hidden = true;
    }
}

searchInput.addEventListener("input", function () {
    state.search = searchInput.value;
    state.page = 1;
    render();
});

statusFilter.addEventListener("change", function () {
    state.status = statusFilter.value;
    state.page = 1;
    render();
});

pageSizeSelect.addEventListener("change", function () {
    state.pageSize = Number(pageSizeSelect.value);
    state.page = 1;
    render();
});

prevBtn.addEventListener("click", function () {
    if (state.page > 1) {
        state.page--;
        render();
    }
});

nextBtn.addEventListener("click", function () {
    const filteredTasks = getFilteredTasks();

    const totalPages = Math.ceil(
        filteredTasks.length / state.pageSize
    );

    if (state.page < totalPages) {
        state.page++;
        render();
    }
});

function clearFilters() {
    state.search = "";
    state.status = "all";
    state.page = 1;
    searchInput.value = "";
    statusFilter.value = "all";
    render();
}

loadTasks();