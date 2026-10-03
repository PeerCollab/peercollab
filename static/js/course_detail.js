const moduleRoot = document.getElementById("course-module");
const courseId = moduleRoot.dataset.courseId;
const token = localStorage.getItem("access_token");
const state = { course: null, tasks: [], notes: [] };

// Shared API helper adds authentication and normalizes request errors.
const api = async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `Request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
};
const el = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const formatDate = (date) => date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`)) : "No due date";
const icon = (name, classes = "h-4 w-4") => `<i data-lucide="${name}" class="${classes}"></i>`;
const statusClass = (status) => ({ "To Do": "border border-blue-700 bg-blue-100 text-blue-800", "In Progress": "border border-yellow-700 bg-yellow-100 text-yellow-800", Done: "border border-green-700 bg-green-100 text-green-800" }[status] || "border border-blue-700 bg-blue-100 text-blue-800");
const priorityClass = (priority) => ({ Low: "border border-blue-700 bg-blue-100 text-blue-800", Medium: "border border-pink-700 bg-pink-100 text-pink-800", High: "border border-red-700 bg-red-100 text-red-800" }[priority] || "border border-blue-700 bg-blue-100 text-blue-800");

// Re-render icons after dynamic HTML is inserted into the page.
function refreshIcons() { if (window.lucide) lucide.createIcons(); }

function showError(error) { el("module-loading").classList.add("hidden"); el("module-error").classList.remove("hidden"); el("module-error-message").textContent = error.message; refreshIcons(); }

let toastTimer;
let confirmationResolver;

// Display temporary feedback for successful or failed actions.
function showToast(message, type = "success") {
    const toast = el("course-toast"); const content = el("course-toast-content"); const toastIcon = el("course-toast-icon");
    content.classList.remove("toast-success", "toast-error"); content.classList.add(`toast-${type}`); toastIcon.setAttribute("data-lucide", type === "success" ? "circle-check" : "circle-alert"); el("course-toast-message").textContent = message; toast.classList.remove("hidden"); refreshIcons();
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.add("hidden"), 4500);
}

function askConfirmation(title, message) {
    return new Promise((resolve) => { confirmationResolver = resolve; el("delete-confirmation-title").textContent = title; el("delete-confirmation-message").textContent = message; el("delete-confirmation").classList.remove("hidden"); el("delete-confirmation").classList.add("flex"); refreshIcons(); });
}

function closeConfirmation(result) { el("delete-confirmation").classList.add("hidden"); el("delete-confirmation").classList.remove("flex"); confirmationResolver?.(result); confirmationResolver = null; }

// Refresh the summary cards and status chart from the current in-memory state.
function updateSummary() {
    const done = state.tasks.filter((task) => task.status === "Done").length;
    const progress = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
    el("course-progress").textContent = `${progress}%`; el("progress-bar").style.width = `${progress}%`; el("completed-tasks").textContent = `${done} of ${state.tasks.length} tasks done`;
    const today = new Date(); today.setHours(0, 0, 0, 0); const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
    const dueThisWeek = state.tasks.filter((task) => { if (!task.due_date || task.status === "Done") return false; const due = new Date(`${task.due_date}T00:00:00`); return due >= today && due <= weekEnd; }).length;
    el("due-week-count").textContent = dueThisWeek; el("note-count").textContent = state.notes.length; el("task-count").textContent = state.tasks.length; el("task-tab-count").textContent = state.tasks.length; el("note-tab-count").textContent = state.notes.length;
    const statusCounts = ["To Do", "In Progress", "Done"].map((status) => ({ status, count: state.tasks.filter((task) => task.status === status).length })); const colors = { "To Do": "#2563eb", "In Progress": "#ca8a04", Done: "#16a34a" }; let angle = 0; const segments = statusCounts.map(({ status, count }) => { const next = state.tasks.length ? angle + (count / state.tasks.length) * 360 : 360; const segment = `${colors[status]} ${angle}deg ${next}deg`; angle = next; return segment; }); el("task-donut").style.background = `conic-gradient(${segments.join(", ")})`; el("donut-total").textContent = state.tasks.length;
    el("task-legend").innerHTML = statusCounts.map(({ status, count }) => `<div class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full" style="background-color: ${colors[status]}"></span><span class="text-slate-500">${status}</span><strong class="ml-auto text-slate-800">${count}</strong></div>`).join("");
}

// Render the most recent tasks and notes shown on the overview tab.
function renderOverview() {
    const tasks = [...state.tasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    el("latest-tasks").innerHTML = tasks.length ? tasks.map((task) => `<div class="flex items-center gap-3 py-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${task.status === "Done" ? "bg-green-50 text-green-600" : task.priority === "High" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}">${icon(task.status === "Done" ? "check" : "calendar", "h-4 w-4")}</span><div class="min-w-0 flex-1"><p class="overview-item-title text-sm font-semibold ${task.status === "Done" ? "text-slate-400 line-through" : "text-slate-700"}">${esc(task.title)}</p><p class="overview-item-copy mt-0.5 text-xs text-slate-400">${task.due_date ? `Due ${formatDate(task.due_date)}` : "No due date"}</p><div class="mt-1.5 flex flex-wrap gap-1.5"><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(task.status)}">${esc(task.status)}</span><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClass(task.priority)}">${esc(task.priority)}</span></div></div></div>`).join("") : `<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center"><p class="text-sm font-medium text-slate-600">No tasks yet</p><p class="mt-1 text-xs text-slate-400">Add a task when you are ready.</p></div>`;
    const notes = [...state.notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
    el("latest-notes").innerHTML = notes.length ? notes.map((note) => `<div class="py-3"><p class="overview-item-title text-sm font-semibold text-slate-700">${esc(note.title)}</p><p class="overview-item-copy mt-1 text-xs leading-5 text-slate-400">${esc(note.content || "No content yet.")}</p><time class="mt-2 block text-[11px] font-medium uppercase tracking-wide text-slate-300">${new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>`).join("") : `<div class="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center"><p class="text-sm font-medium text-slate-600">No notes yet</p><p class="mt-1 text-xs text-slate-400">Start a study note for this course.</p></div>`;
    refreshIcons();
}

// Filter and sort tasks before rendering the task panel.
function renderTasks() {
    const search = el("task-search").value.trim().toLowerCase(); const filter = el("task-filter").value; const priority = el("task-priority-filter").value; const sortBy = el("task-sort").value;
    const tasks = state.tasks.filter((task) => task.title.toLowerCase().includes(search) && (filter === "all" || task.status === filter) && (priority === "all" || task.priority === priority)).sort((left, right) => {
        if (sortBy === "due") {
            if (!left.due_date && !right.due_date) return 0;
            if (!left.due_date) return 1;
            if (!right.due_date) return -1;
            return left.due_date.localeCompare(right.due_date);
        }
        return new Date(right.created_at) - new Date(left.created_at);
    });
    el("task-list").innerHTML = tasks.length ? tasks.map((task) => `<article class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"><button type="button" data-task-status="${task.id}" class="flex h-5 w-5 shrink-0 items-center justify-center rounded border ${task.status === "Done" ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-transparent hover:border-brand-400"}" aria-label="Mark ${esc(task.title)} as ${task.status === "Done" ? "to do" : "done"}">${icon("check", "h-3 w-3")}</button><div class="min-w-0 flex-1"><h3 class="truncate text-sm font-semibold ${task.status === "Done" ? "text-slate-400 line-through" : "text-slate-800"}">${esc(task.title)}</h3><div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>${task.due_date ? `Due ${formatDate(task.due_date)}` : "No due date"}</span><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityClass(task.priority)}">${esc(task.priority)}</span><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(task.status)}">${esc(task.status)}</span></div></div><div class="flex shrink-0 items-center gap-1"><button type="button" data-edit-task="${task.id}" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" aria-label="Edit ${esc(task.title)}">${icon("pencil")}</button><button type="button" data-delete-task="${task.id}" class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete ${esc(task.title)}">${icon("trash-2")}</button></div></article>`).join("") : `<div class="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center"><p class="text-sm font-medium text-slate-600">No matching tasks</p><p class="mt-1 text-xs text-slate-400">Try another filter or add a new task.</p></div>`;
    refreshIcons();
}

// Filter and sort notes before rendering the notes panel.
function renderNotes() {
    const search = el("note-search").value.trim().toLowerCase(); const sortBy = el("note-sort").value; const notes = state.notes.filter((note) => note.title.toLowerCase().includes(search) || (note.content || "").toLowerCase().includes(search)).sort((left, right) => sortBy === "title" ? left.title.localeCompare(right.title) : new Date(right.created_at) - new Date(left.created_at));
    el("note-list").innerHTML = notes.length ? notes.map((note) => `<article class="flex min-h-[190px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div class="flex items-start justify-between gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">${icon("file-text")}</span><div class="flex items-center gap-1"><button type="button" data-edit-note="${note.id}" class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600" aria-label="Edit ${esc(note.title)}">${icon("pencil")}</button><button type="button" data-delete-note="${note.id}" class="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete ${esc(note.title)}">${icon("trash-2")}</button></div></div><h3 class="mt-4 truncate font-semibold text-slate-800">${esc(note.title)}</h3><p class="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-500">${esc(note.content || "No content yet.")}</p><time class="mt-auto pt-4 text-xs text-slate-400">${new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></article>`).join("") : `<div class="col-span-full rounded-xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center"><p class="text-sm font-medium text-slate-600">No notes yet</p><p class="mt-1 text-xs text-slate-400">Start a study note for this course.</p></div>`;
    refreshIcons();
}

// Populate and open the shared task/note editor modal.
function openModal(type, item = null) {
    el("content-type").value = type; el("content-id").value = item?.id || ""; el("modal-title").textContent = `${item ? "Edit" : "Add"} ${type}`; el("content-title").value = item?.title || ""; el("form-error").classList.add("hidden");
    const isTask = type === "task"; el("task-due-field").classList.toggle("hidden", !isTask); el("task-options").classList.toggle("hidden", !isTask); el("note-content-field").classList.toggle("hidden", isTask); el("task-due-date").value = item?.due_date || ""; el("task-priority").value = item?.priority || "Low"; el("task-status").value = item?.status || "To Do"; el("note-content").value = item?.content || "";
    el("content-modal").classList.remove("hidden"); el("content-modal").classList.add("flex"); el("content-title").focus();
}

function closeModal() { el("content-modal").classList.add("hidden"); el("content-modal").classList.remove("flex"); }

// Create or update a task or note, while avoiding no-op saves.
async function saveContent(event) {
    event.preventDefault(); const type = el("content-type").value; const id = el("content-id").value; const payload = { title: el("content-title").value.trim() };
    if (type === "task") { payload.due_date = el("task-due-date").value || null; payload.priority = el("task-priority").value; payload.status = el("task-status").value; } else payload.content = el("note-content").value.trim() || null;
    const existingItem = id ? (type === "task" ? state.tasks : state.notes).find((item) => item.id === Number(id)) : null;
    const unchangedFields = type === "task" ? ["title", "due_date", "priority", "status"] : ["title", "content"];
    const unchanged = existingItem && unchangedFields.every((field) => (existingItem[field] || null) === (payload[field] || null));
    if (unchanged) { closeModal(); showToast("No changes to save."); return; }
    try { el("form-submit").disabled = true; await api(`/courses/${courseId}/${type}s/${id ? `${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) }); closeModal(); await loadContent(); showToast(`${type === "task" ? "Task" : "Note"} ${id ? "updated" : "created"} successfully.`); } catch (error) { el("form-error").textContent = error.message; el("form-error").classList.remove("hidden"); showToast(`Unable to save ${type}. ${error.message}`, "error"); } finally { el("form-submit").disabled = false; }
}

// Load all course data before refreshing each section of the page.
async function loadContent() { [state.course, state.tasks, state.notes] = await Promise.all([api(`/courses/${courseId}`), api(`/courses/${courseId}/tasks/`), api(`/courses/${courseId}/notes/`)]); el("course-title").textContent = state.course.title; el("breadcrumb-course").textContent = state.course.title; el("course-description").textContent = state.course.description || "A focused space for everything you are learning in this course."; updateSummary(); renderOverview(); renderTasks(); renderNotes(); }

// Confirm and delete a task or note, then reload the course data.
async function removeContent(type, id, title) { if (!await askConfirmation(`Delete ${type}?`, `Delete "${title || `this ${type}`}"? This action cannot be undone.`)) return; try { await api(`/courses/${courseId}/${type}s/${id}`, { method: "DELETE" }); await loadContent(); showToast(`${type === "task" ? "Task" : "Note"} deleted successfully.`); } catch (error) { showToast(`Unable to delete ${type}. ${error.message}`, "error"); } }

// Delegate clicks for tabs, modal actions, task status changes, and CRUD controls.
document.addEventListener("click", async (event) => {
    const tab = event.target.closest(".tab-button"); if (tab) { document.querySelectorAll(".tab-button").forEach((button) => { const active = button === tab; button.classList.toggle("active-tab", active); button.classList.toggle("text-brand-600", active); button.classList.toggle("text-slate-400", !active); button.setAttribute("aria-selected", String(active)); }); document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== tab.dataset.tab)); }
    const openTab = event.target.closest("[data-open-tab]"); if (openTab) document.querySelector(`.tab-button[data-tab="${openTab.dataset.openTab}"]`).click();
    const open = event.target.closest("[data-open-modal]"); if (open) openModal(open.dataset.openModal);
    if (event.target.closest("[data-close-modal]")) closeModal();
    const editTask = event.target.closest("[data-edit-task]"); if (editTask) openModal("task", state.tasks.find((task) => task.id === Number(editTask.dataset.editTask)));
    const editNote = event.target.closest("[data-edit-note]"); if (editNote) openModal("note", state.notes.find((note) => note.id === Number(editNote.dataset.editNote)));
    const deleteTask = event.target.closest("[data-delete-task]"); if (deleteTask) { const task = state.tasks.find((item) => item.id === Number(deleteTask.dataset.deleteTask)); removeContent("task", deleteTask.dataset.deleteTask, task?.title); }
    const deleteNote = event.target.closest("[data-delete-note]"); if (deleteNote) { const note = state.notes.find((item) => item.id === Number(deleteNote.dataset.deleteNote)); removeContent("note", deleteNote.dataset.deleteNote, note?.title); }
    const statusButton = event.target.closest("[data-task-status]"); if (statusButton) { const task = state.tasks.find((item) => item.id === Number(statusButton.dataset.taskStatus)); try { await api(`/courses/${courseId}/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: task.status === "Done" ? "To Do" : "Done" }) }); await loadContent(); showToast("Task status updated successfully."); } catch (error) { showToast(`Unable to update task status. ${error.message}`, "error"); } }
});

// Connect search, filters, forms, dialogs, and toast controls to their handlers.
el("content-form").addEventListener("submit", saveContent); el("task-search").addEventListener("input", renderTasks); el("task-filter").addEventListener("change", renderTasks); el("task-priority-filter").addEventListener("change", renderTasks); el("task-sort").addEventListener("change", renderTasks); el("note-search").addEventListener("input", renderNotes); el("note-sort").addEventListener("change", renderNotes); el("content-modal").addEventListener("click", (event) => { if (event.target === el("content-modal")) closeModal(); }); el("course-toast-close").addEventListener("click", () => { clearTimeout(toastTimer); el("course-toast").classList.add("hidden"); }); el("delete-confirm").addEventListener("click", () => closeConfirmation(true)); el("delete-cancel").addEventListener("click", () => closeConfirmation(false)); el("delete-confirmation").addEventListener("click", (event) => { if (event.target.id === "delete-confirmation") closeConfirmation(false); });

// Load the page and reveal the content only after all requests succeed.
loadContent().then(() => { el("module-loading").classList.add("hidden"); el("module-content").classList.remove("hidden"); refreshIcons(); }).catch(showError);