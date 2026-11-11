(() => {
  "use strict";

  const board = document.getElementById("kanban-board");
  if (!board) return;

  const projectId = board.dataset.projectId;
  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.replace("/auth/login");
    return;
  }

  const COLUMN_KEYS = { "To Do": "todo", "Doing": "doing", "Done": "done" };
  const PRIORITY_CLASSES = {
    Low: "bg-slate-100 text-slate-600",
    Medium: "bg-amber-50 text-amber-700",
    High: "bg-red-50 text-red-700",
  };

  const state = {
    tasks: [],
    assignees: [],
    me: null,
    projectOwnerId: null,
    filter: { status: "All", assigneeId: "", due: "any" },
  };

  const errorBox = document.getElementById("kanban-error");

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  // ---------- talking to the server ----------
  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      window.location.replace("/auth/login");
      throw new Error("Your session has expired.");
    }
    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && data.detail;
      throw new Error(typeof detail === "string" ? detail : "Something went wrong. Please try again.");
    }
    return data;
  }

  const api = (path, options) =>
    request(`/api/projects/${encodeURIComponent(projectId)}${path}`, options);

  // ---------- small helpers ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, className) {
    const node = document.createElement("i");
    node.setAttribute("data-lucide", name);
    node.className = className;
    return node;
  }

  function startOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  function parseDate(value) {
    return new Date(`${value}T00:00:00`);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = parseDate(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  function initials(name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  function isOverdue(task) {
    return Boolean(task.due_date) && task.status !== "Done" && parseDate(task.due_date) < startOfToday();
  }

  function canDelete(task) {
    return Boolean(state.me) &&
      (task.created_by_id === state.me.id || state.projectOwnerId === state.me.id);
  }

  // ---------- filter ----------
  function matchesFilter(task) {
    const { status, assigneeId, due } = state.filter;
    if (status !== "All" && task.status !== status) return false;

    if (assigneeId === "unassigned") {
      if (task.assignee_id != null) return false;
    } else if (assigneeId) {
      if (String(task.assignee_id) !== String(assigneeId)) return false;
    }

    if (due !== "any") {
      if (!task.due_date) return false;
      const dueDate = parseDate(task.due_date);
      const today = startOfToday();
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (due === "overdue" && !(dueDate < today && task.status !== "Done")) return false;
      if (due === "today" && dueDate.getTime() !== today.getTime()) return false;
      if (due === "week" && !(dueDate >= today && dueDate <= weekEnd)) return false;
    }
    return true;
  }

  // ---------- drawing the board ----------
  function buildCard(task) {
    const card = el(
      "article",
      "task-card cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
    );
    card.dataset.taskId = task.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const top = el("div", "flex items-start justify-between gap-2");
    top.append(el("h3", "min-w-0 break-words text-sm font-semibold text-slate-800", task.title));
    top.append(el("span", "shrink-0 text-[11px] font-medium text-slate-400", `#${task.id}`));
    card.append(top);

    const meta = el("div", "mt-3 flex flex-wrap items-center gap-2");
    meta.append(
      el(
        "span",
        `rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLASSES[task.priority] || PRIORITY_CLASSES.Low}`,
        task.priority
      )
    );
    if (task.due_date) {
      const due = el(
        "span",
        `inline-flex items-center gap-1 text-xs font-medium ${isOverdue(task) ? "text-red-500" : "text-slate-400"}`
      );
      due.append(icon("calendar", "h-3.5 w-3.5"), document.createTextNode(formatDate(task.due_date)));
      meta.append(due);
    }
    if (task.comment_count > 0) {
      const comments = el("span", "inline-flex items-center gap-1 text-xs font-medium text-slate-400");
      comments.append(icon("message-square", "h-3.5 w-3.5"), document.createTextNode(String(task.comment_count)));
      meta.append(comments);
    }
    card.append(meta);

    const footer = el("div", "mt-3 flex items-center gap-2");
    if (task.assignee_name) {
      footer.append(
        el(
          "span",
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-600",
          initials(task.assignee_name)
        ),
        el("span", "truncate text-xs text-slate-500", task.assignee_name)
      );
    } else {
      footer.append(el("span", "text-xs text-slate-400", "Unassigned"));
    }
    card.append(footer);

    const open = () => {
      if (window.Kanban && typeof window.Kanban.openTask === "function") window.Kanban.openTask(task);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") open();
    });
    return card;
  }

  function render() {
    const visible = state.tasks.filter(matchesFilter);
    for (const [status, key] of Object.entries(COLUMN_KEYS)) {
      const list = document.getElementById(`list-${key}`);
      const empty = document.getElementById(`empty-${key}`);
      const count = document.getElementById(`count-${key}`);

      const tasks = visible
        .filter((task) => task.status === status)
        .sort((a, b) => a.position - b.position || a.id - b.id);

      list.replaceChildren(...tasks.map(buildCard));
      count.textContent = tasks.length;
      empty.classList.toggle("hidden", tasks.length > 0);
    }
    if (window.lucide) window.lucide.createIcons();
    document.dispatchEvent(new CustomEvent("kanban:rendered"));
  }

  // ---------- pop-up windows (used by the next steps) ----------
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    const first = modal.querySelector("[data-autofocus]");
    if (first) first.focus();
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  document.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-close-modal]");
    if (closer) {
      closeModal(closer.dataset.closeModal);
      return;
    }
    if (event.target.matches("[data-modal]")) closeModal(event.target.id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-modal]:not(.hidden)").forEach((modal) => closeModal(modal.id));
  });

  // ---------- loading ----------
  async function loadBoard() {
    clearError();
    try {
      const [tasks, assignees, me, project] = await Promise.all([
        api("/tasks"),
        api("/assignees"),
        request("/auth/me"),
        request(`/api/projects/${encodeURIComponent(projectId)}`).catch(() => null),
      ]);
      state.tasks = tasks;
      state.assignees = assignees;
      state.me = me;
      state.projectOwnerId = project ? project.owner_id : null;
      render();
      document.dispatchEvent(new CustomEvent("kanban:loaded"));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load the board. Please try again.");
      console.error("Loading board failed:", error);
    }
  }

  // ---------- shared with the files we add in the next steps ----------
  window.Kanban = {
    state,
    api,
    render,
    loadBoard,
    showError,
    clearError,
    openModal,
    closeModal,
    formatDate,
    initials,
    canDelete,
    openTask: null,
    upsertTask(task) {
      const index = state.tasks.findIndex((item) => item.id === task.id);
      if (index === -1) state.tasks.push(task);
      else state.tasks[index] = task;
      render();
    },
    removeTask(taskId) {
      state.tasks = state.tasks.filter((task) => task.id !== taskId);
      render();
    },
  };

  loadBoard();
})();