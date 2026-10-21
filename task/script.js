
"use strict";

// ==========================================
// 1. APPLICATION STATE
// ==========================================

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

// ==========================================
// 2. GET HTML ELEMENTS
// ==========================================

const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const pageSizeSelect = document.getElementById("page-size");

const message = document.getElementById("message");
const taskBody = document.getElementById("task-body");
const summary = document.getElementById("summary");

const prevButton = document.getElementById("prev-page");
const nextButton = document.getElementById("next-page");
const pageNumbers = document.getElementById("page-numbers");

const table = document.getElementById("task-table");

// ==========================================
// 3. LOAD TASKS FROM JSON
// ==========================================

async function loadTasks() {
    state.loading = true;
    state.error = false;

    render();

    try {
        const response = await fetch("../mock/tasks.json");

        if (!response.ok) {
            throw new Error("Failed to load tasks");
        }

        const result = await response.json();

        if (!result || !Array.isArray(result.data)) {
            throw new Error("Invalid task data");
        }

        state.allTasks = result.data;
        state.loading = false;
        state.error = false;

        render();

    } catch (error) {
        console.error("Error loading tasks:", error);

        state.loading = false;
        state.error = true;

        render();
    }
}

// ==========================================
// 4. FILTER TASKS
// ==========================================

function getFilteredTasks() {
    const query = state.search.trim().toLowerCase();

    return state.allTasks.filter(function (task) {
        const title = String(task.title ?? "").toLowerCase();
        const assignee = String(task.assignee ?? "").toLowerCase();

        const matchesSearch =
            title.includes(query) ||
            assignee.includes(query);

        const matchesStatus =
            state.status === "all" ||
            task.status === state.status;

        return matchesSearch && matchesStatus;
    });
}

// ==========================================
// 5. SORT TASKS
// ==========================================

function getSortedTasks(tasks) {
    const sorted = [...tasks];

    const priorityOrder = {
        low: 1,
        medium: 2,
        high: 3
    };

    sorted.sort(function (a, b) {
        const field = state.sortField;
        let comparison = 0;

        // Keep unassigned tasks at the end
        // when sorting by assignee.
        if (field === "assignee") {
            const aEmpty = a.assignee == null ||
                a.assignee === "";
            const bEmpty = b.assignee == null ||
                b.assignee === "";

            if (aEmpty && !bEmpty) return 1;
            if (!aEmpty && bEmpty) return -1;
        }

        if (field === "priority") {
            comparison =
                (priorityOrder[a.priority] ?? 0) -
                (priorityOrder[b.priority] ?? 0);

        } else if (field === "id") {
            comparison = Number(a.id) - Number(b.id);

        } else {
            const aValue = String(a[field] ?? "").toLowerCase();
            const bValue = String(b[field] ?? "").toLowerCase();

            comparison = aValue.localeCompare(bValue);
        }

        return state.sortDirection === "asc"
            ? comparison
            : -comparison;
    });

    return sorted;
}

// ==========================================
// 6. CREATE A TABLE CELL SAFELY
// ==========================================

function createCell(label, value) {
    const td = document.createElement("td");

    // Used by the mobile card layout.
    td.dataset.label = label;

    // Use textContent to avoid inserting
    // API data as HTML.
    td.textContent = value;

    return td;
}

// ==========================================
// 7. FORMAT STATUS LABELS
// ==========================================

function formatStatus(status) {
    const labels = {
        todo: "To Do",
        in_progress: "In Progress",
        done: "Done"
    };

    return labels[status] || status || "Unknown";
}

// ==========================================
// 8. FORMAT DUE DATES
// ==========================================

function formatDueDate(task) {
    if (!task.dueDate) {
        return "No due date";
    }

    // Avoid parsing a date-only string as a
    // local time and shifting the calendar day.
    const parts = task.dueDate.split("-").map(Number);

    if (
        parts.length !== 3 ||
        !parts.every(Number.isFinite)
    ) {
        return "Invalid date";
    }

    const [year, month, day] = parts;

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return "Invalid date";
    }

    const formatted = date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isOverdue =
        task.status !== "done" &&
        date < today;

    return isOverdue
        ? formatted + " (overdue)"
        : formatted;
}

// ==========================================
// 9. DISPLAY TASK ROWS
// ==========================================

function displayTasks(tasks) {
    taskBody.replaceChildren();

    tasks.forEach(function (task) {
        const tr = document.createElement("tr");

        tr.appendChild(createCell("#", task.id));
        tr.appendChild(createCell("Title", task.title || "Untitled"));
        tr.appendChild(createCell("Project", task.project || "—"));

        // Assignee
        const assigneeCell = document.createElement("td");
        assigneeCell.dataset.label = "Assignee";

        if (task.assignee == null || task.assignee === "") {
            const span = document.createElement("span");
            span.className = "unassigned";
            span.textContent = "Unassigned";
            assigneeCell.appendChild(span);
        } else {
            assigneeCell.textContent = task.assignee;
        }

        tr.appendChild(assigneeCell);

        // Status badge
        const statusCell = document.createElement("td");
        statusCell.dataset.label = "Status";

        const badge = document.createElement("span");
        badge.className = "badge status-" + task.status;
        badge.textContent = formatStatus(task.status);

        statusCell.appendChild(badge);
        tr.appendChild(statusCell);

        // Priority
        const priorityCell = document.createElement("td");
        priorityCell.dataset.label = "Priority";
        priorityCell.textContent = task.priority || "—";
        tr.appendChild(priorityCell);

        // Due date
        const dueDateCell = document.createElement("td");
        dueDateCell.dataset.label = "Due date";

        const dueDateText = formatDueDate(task);
        const isOverdue = dueDateText.endsWith("(overdue)");

        dueDateCell.textContent = dueDateText;

        if (isOverdue) {
            dueDateCell.classList.add("overdue");
        }

        tr.appendChild(dueDateCell);

        taskBody.appendChild(tr);
    });
}

// ==========================================
// 10. UPDATE SORT ARROWS
// ==========================================

function updateSortHeaders() {
    const headers = table.querySelectorAll("th[data-sort]");

    headers.forEach(function (header) {
        const field = header.dataset.sort;
        const originalText =
            header.dataset.originalText ||
            header.textContent.replace(/[ ↑↓]$/, "");

        header.dataset.originalText = originalText;

        header.textContent = field === state.sortField
            ? originalText +
                (state.sortDirection === "asc" ? " ↑" : " ↓")
            : originalText;

        header.setAttribute(
            "aria-sort",
            field === state.sortField
                ? state.sortDirection === "asc"
                    ? "ascending"
                    : "descending"
                : "none"
        );
    });
}

// ==========================================
// 11. DISPLAY PAGINATION
// ==========================================

function displayPagination(totalPages) {
    pageNumbers.replaceChildren();

    prevButton.disabled =
        state.page <= 1 || totalPages === 0;

    nextButton.disabled =
        state.page >= totalPages || totalPages === 0;

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = i;
        button.setAttribute(
            "aria-label",
            "Page " + i
        );

        if (i === state.page) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", function () {
            state.page = i;
            render();
        });

        pageNumbers.appendChild(button);
    }
}

// ==========================================
// 12. MAIN RENDER FUNCTION
// ==========================================

function render() {
    taskBody.replaceChildren();
    pageNumbers.replaceChildren();

    if (state.loading) {
        message.textContent = "Loading tasks...";
        summary.textContent = "Showing 0 tasks";

        prevButton.disabled = true;
        nextButton.disabled = true;

        return;
    }

    if (state.error) {
        message.replaceChildren();

        const errorText = document.createElement("span");
        errorText.className = "error-message";
        errorText.textContent = "Unable to load tasks. ";

        const retryButton = document.createElement("button");
        retryButton.type = "button";
        retryButton.textContent = "Try again";

        retryButton.addEventListener("click", loadTasks);

        message.append(errorText, retryButton);

        summary.textContent = "Showing 0 tasks";
        prevButton.disabled = true;
        nextButton.disabled = true;

        return;
    }

    // Filter first, then sort.
    const filteredTasks = getFilteredTasks();
    const sortedTasks = getSortedTasks(filteredTasks);

    const totalTasks = sortedTasks.length;

    const totalPages = Math.ceil(
        totalTasks / state.pageSize
    );

    // Keep the current page valid after filtering.
    if (totalPages === 0) {
        state.page = 1;
    } else if (state.page > totalPages) {
        state.page = totalPages;
    }

    const start = (state.page - 1) * state.pageSize;

    const pageTasks = sortedTasks.slice(
        start,
        start + state.pageSize
    );

    if (totalTasks === 0) {
        message.replaceChildren();

        const emptyText = document.createElement("span");
        emptyText.textContent = "No tasks match your search. ";

        const clearButton = document.createElement("button");
        clearButton.type = "button";
        clearButton.textContent = "Clear filters";

        clearButton.addEventListener("click", function () {
            state.search = "";
            state.status = "all";
            state.page = 1;

            searchInput.value = "";
            statusFilter.value = "all";

            render();
        });

        message.append(emptyText, clearButton);

    } else {
        message.textContent = "";
    }

    displayTasks(pageTasks);
    displayPagination(totalPages);
    updateSortHeaders();

    const firstRow = totalTasks === 0 ? 0 : start + 1;
    const lastRow = Math.min(
        start + state.pageSize,
        totalTasks
    );

    summary.textContent =
        `Showing ${firstRow}–${lastRow} of ${totalTasks} tasks`;
}

// ==========================================
// 13. SEARCH EVENTS
// ==========================================

searchInput.addEventListener("input", function () {
    state.search = searchInput.value;
    state.page = 1;

    render();
});

// ==========================================
// 14. STATUS FILTER EVENT
// ==========================================

statusFilter.addEventListener("change", function () {
    state.status = statusFilter.value;
    state.page = 1;

    render();
});

// ==========================================
// 15. ROWS PER PAGE EVENT
// ==========================================

pageSizeSelect.addEventListener("change", function () {
    state.pageSize = Number(pageSizeSelect.value);
    state.page = 1;

    render();
});

// ==========================================
// 16. PREVIOUS AND NEXT BUTTONS
// ==========================================

prevButton.addEventListener("click", function () {
    if (state.page > 1) {
        state.page--;
        render();
    }
});

nextButton.addEventListener("click", function () {
    const filteredTasks = getFilteredTasks();

    const totalPages = Math.ceil(
        filteredTasks.length / state.pageSize
    );

    if (state.page < totalPages) {
        state.page++;
        render();
    }
});

// ==========================================
// 17. COLUMN SORTING
// ==========================================

table.querySelectorAll("th[data-sort]").forEach(function (header) {
    header.addEventListener("click", function () {
        const field = header.dataset.sort;

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

// ==========================================
// 18. START THE APPLICATION
// ==========================================

loadTasks();
