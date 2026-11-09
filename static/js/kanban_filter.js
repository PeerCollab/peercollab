(() => {
  "use strict";

  const K = window.Kanban;
  const openButton = document.getElementById("open-filter");
  const errorBox = document.getElementById("kanban-error");
  if (!K || !openButton || !errorBox) return;

  const DEFAULT_FILTER = { status: "All", assigneeId: "", due: "any" };
  const ACTIVE_CLASSES = ["border-brand-500", "bg-brand-50", "text-brand-700"];
  const IDLE_CLASSES = ["border-slate-200", "bg-white", "text-slate-700"];

  // ---------- the filter panel ----------
  const panel = document.createElement("div");
  panel.id = "filter-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Filter tasks");
  panel.className = "fixed z-40 hidden w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl";
  panel.innerHTML = `
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-slate-900">Filter Tasks</h3>
      <button type="button" id="filter-close" aria-label="Close" class="text-slate-400 transition-colors hover:text-slate-600">
        <i data-lucide="x" class="h-4 w-4"></i>
      </button>
    </div>

    <fieldset class="mb-4">
      <legend class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</legend>
      <div class="space-y-1.5 text-sm text-slate-700">
        <label class="flex items-center gap-2"><input type="radio" name="filter-status" value="All" class="accent-violet-600" checked /> All</label>
        <label class="flex items-center gap-2"><input type="radio" name="filter-status" value="To Do" class="accent-violet-600" /> To Do</label>
        <label class="flex items-center gap-2"><input type="radio" name="filter-status" value="Doing" class="accent-violet-600" /> Doing</label>
        <label class="flex items-center gap-2"><input type="radio" name="filter-status" value="Done" class="accent-violet-600" /> Done</label>
      </div>
    </fieldset>

    <div class="mb-4">
      <label for="filter-assignee" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Assignee</label>
      <select id="filter-assignee" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"></select>
    </div>

    <div class="mb-4">
      <label for="filter-due" class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Due date</label>
      <select id="filter-due" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
        <option value="any">Any time</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="week">Due in the next 7 days</option>
      </select>
    </div>

    <div class="flex items-center justify-end gap-2">
      <button type="button" id="filter-clear" class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">Clear</button>
      <button type="button" id="filter-apply" class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">Apply</button>
    </div>
  `;
  document.body.append(panel);

  // ---------- badge on the button and the note above the board ----------
  const badge = document.createElement("span");
  badge.className = "hidden h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white";
  openButton.append(badge);

  const note = document.createElement("div");
  note.className = "mt-4 hidden items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm text-brand-700";
  note.innerHTML = `
    <span>Showing filtered tasks. Dragging is paused until you clear the filters.</span>
    <button type="button" id="filter-note-clear" class="shrink-0 font-semibold underline">Clear filters</button>
  `;
  errorBox.before(note);

  if (window.lucide) window.lucide.createIcons();

  const assigneeSelect = document.getElementById("filter-assignee");
  const dueSelect = document.getElementById("filter-due");

  function activeCount() {
    const filter = K.state.filter;
    return Number(filter.status !== "All") + Number(Boolean(filter.assigneeId)) + Number(filter.due !== "any");
  }

  function updateIndicators() {
    const count = activeCount();
    const active = count > 0;
    badge.textContent = count;
    badge.classList.toggle("hidden", !active);
    badge.classList.toggle("inline-flex", active);
    openButton.classList.remove(...(active ? IDLE_CLASSES : ACTIVE_CLASSES));
    openButton.classList.add(...(active ? ACTIVE_CLASSES : IDLE_CLASSES));
    note.classList.toggle("hidden", !active);
    note.classList.toggle("flex", active);
  }

  function fillAssignees() {
    assigneeSelect.replaceChildren(new Option("All members", ""), new Option("Unassigned", "unassigned"));
    K.state.assignees.forEach((person) => {
      assigneeSelect.append(new Option(person.full_name, String(person.id)));
    });
  }

  function syncControls() {
    fillAssignees();
    const filter = K.state.filter;
    panel.querySelector(`input[name="filter-status"][value="${filter.status}"]`).checked = true;
    assigneeSelect.value = filter.assigneeId;
    dueSelect.value = filter.due;
  }

  // ---------- open, close, apply, clear ----------
  function isOpen() {
    return !panel.classList.contains("hidden");
  }

  function closePanel() {
    panel.classList.add("hidden");
  }

  function openPanel() {
    syncControls();
    const rect = openButton.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    panel.classList.remove("hidden");
  }

  function applyFilter() {
    K.state.filter = {
      status: panel.querySelector('input[name="filter-status"]:checked').value,
      assigneeId: assigneeSelect.value,
      due: dueSelect.value,
    };
    K.render();
    updateIndicators();
    closePanel();
  }

  function clearFilter() {
    K.state.filter = { ...DEFAULT_FILTER };
    K.render();
    updateIndicators();
    closePanel();
  }

  openButton.addEventListener("click", () => (isOpen() ? closePanel() : openPanel()));
  document.getElementById("filter-close").addEventListener("click", closePanel);
  document.getElementById("filter-apply").addEventListener("click", applyFilter);
  document.getElementById("filter-clear").addEventListener("click", clearFilter);
  document.getElementById("filter-note-clear").addEventListener("click", clearFilter);

  document.addEventListener("click", (event) => {
    if (isOpen() && !panel.contains(event.target) && !openButton.contains(event.target)) closePanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) closePanel();
  });
  window.addEventListener("resize", closePanel);
  document.addEventListener("scroll", closePanel, true);

  updateIndicators();
})();