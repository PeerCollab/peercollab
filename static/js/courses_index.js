const courseGrid = document.getElementById("course-grid");
const courseSearch = document.getElementById("course-search");
const courseSort = document.getElementById("course-sort");
const courseToken = localStorage.getItem("access_token");
let courses = [];
let toastTimer;
let confirmationResolver;

// Display temporary feedback for course actions.
function showToast(message, type = "success") {
    const toast = document.getElementById("course-toast");
    const content = document.getElementById("course-toast-content");
    const toastIcon = document.getElementById("course-toast-icon");
    content.classList.remove("toast-success", "toast-error");
    content.classList.add(`toast-${type}`);
    toastIcon.setAttribute("data-lucide", type === "success" ? "circle-check" : "circle-alert");
    document.getElementById("course-toast-message").textContent = message;
    toast.classList.remove("hidden");
    lucide.createIcons();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 4500);
}

// Ask the user to confirm a destructive course action.
function askConfirmation(title, message) {
    return new Promise((resolve) => {
        confirmationResolver = resolve;
        document.getElementById("delete-confirmation-title").textContent = title;
        document.getElementById("delete-confirmation-message").textContent = message;
        document.getElementById("delete-confirmation").classList.remove("hidden");
        document.getElementById("delete-confirmation").classList.add("flex");
        lucide.createIcons();
    });
}

// Close the confirmation dialog and resolve the waiting action.
function closeConfirmation(result) {
    document.getElementById("delete-confirmation").classList.add("hidden");
    document.getElementById("delete-confirmation").classList.remove("flex");
    confirmationResolver?.(result);
    confirmationResolver = null;
}

// Build a course card and attach its edit, view, and delete actions.
function courseCard(course) {
    const article = document.createElement("article");
    article.dataset.courseCard = "true";
    article.className = "flex min-h-[250px] flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md";
    const actions = course.is_general
        ? '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">General</span>'
        : `<a class="edit-course flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                   title="Edit course" aria-label="Edit course">
                    <i data-lucide="pencil" class="h-4 w-4"></i>
                </a>
                <button type="button" class="delete-course flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete course" aria-label="Delete course">
                    <i data-lucide="trash-2" class="h-4 w-4"></i>
                </button>`;
    article.innerHTML = `
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
                <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <i data-lucide="book-open" class="h-5 w-5"></i>
                </div>
                <h2 class="truncate text-lg font-semibold tracking-tight text-slate-900"></h2>
                <p class="mt-2 min-h-[40px] text-sm leading-5 text-slate-500"></p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
                ${actions}
            </div>
        </div>
        <div class="mt-auto pt-6">
            <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-slate-600">Progress</span>
                <span class="course-progress font-semibold text-brand-600"></span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="progress-bar h-full rounded-full bg-brand-600 transition-all"></div>
            </div>
        </div>
        <div class="mt-5 flex items-center gap-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span class="flex items-center gap-2"><i data-lucide="check-square" class="h-4 w-4 text-brand-600"></i><span class="task-count"></span></span>
            <span class="flex items-center gap-2"><i data-lucide="file-text" class="h-4 w-4 text-brand-600"></i><span class="note-count"></span></span>
            <a class="view-course ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600" aria-label="View course">
                <i data-lucide="chevron-right" class="h-5 w-5"></i>
            </a>
        </div>`;

    const progress = Math.max(0, Math.min(100, Number(course.progress) || 0));
    article.querySelector("h2").textContent = course.title;
    article.querySelector("p").textContent = course.description || "No description";
    if (!course.is_general) {
        article.querySelector(".edit-course").href = `/courses/${course.id}/edit`;
        article.querySelector(".edit-course").title = `Edit ${course.title}`;
        article.querySelector(".edit-course").ariaLabel = `Edit ${course.title}`;
        article.querySelector(".delete-course").title = `Delete ${course.title}`;
        article.querySelector(".delete-course").ariaLabel = `Delete ${course.title}`;
    }
    article.querySelector(".course-progress").textContent = `${progress}%`;
    article.querySelector(".progress-bar").style.width = `${progress}%`;
    article.querySelector(".task-count").textContent = `${course.task_count} tasks`;
    article.querySelector(".note-count").textContent = `${course.note_count} notes`;
    article.querySelector(".view-course").href = `/courses/${course.id}/page`;
    article.querySelector(".delete-course")?.addEventListener("click", async () => {
        if (!await askConfirmation("Delete course?", `Delete "${course.title}"? This will also remove its tasks and notes.`)) return;
        try {
            const response = await fetch(`/courses/${course.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${courseToken}` } });
            if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `Request failed (${response.status})`);
            article.remove();
            showToast("Course deleted successfully.");
        } catch (error) {
            showToast(`Unable to delete course. ${error.message}`, "error");
        }
    });
    return article;
}

// Fetch the authenticated user's courses before the first render.
async function loadCourses() {
    const response = await fetch("/courses/", {
        headers: { Authorization: `Bearer ${courseToken}` },
    });
    if (!response.ok) throw new Error(`Unable to load courses (${response.status})`);

    courses = await response.json();
    renderCourses();
}

// Apply the search term and selected sort order to the course list.
function renderCourses() {
    const searchTerm = courseSearch.value.trim().toLowerCase();
    const sortBy = courseSort.value;
    const matchesSearch = (course) => [course.title, course.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchTerm));
    const generalCourse = courses.find((course) => course.is_general && matchesSearch(course));
    const visibleCourses = courses
        .filter((course) => !course.is_general)
        .filter(matchesSearch)
        .sort((left, right) => {
            if (sortBy === "title") return left.title.localeCompare(right.title);
            if (sortBy === "progress") return (right.progress || 0) - (left.progress || 0);
            if (sortBy === "tasks") return (right.task_count || 0) - (left.task_count || 0);
            return new Date(right.created_at) - new Date(left.created_at);
        });

    courseGrid.querySelectorAll("[data-course-card]").forEach((card) => card.remove());
    if (generalCourse) courseGrid.insertBefore(courseCard(generalCourse), courseGrid.lastElementChild);
    visibleCourses.forEach((course) => courseGrid.insertBefore(courseCard(course), courseGrid.lastElementChild));
    lucide.createIcons();
}

// Re-render immediately when search or sorting controls change.
courseSearch.addEventListener("input", renderCourses);
courseSort.addEventListener("change", renderCourses);
loadCourses().catch((error) => console.error(error));
document.getElementById("delete-confirm").addEventListener("click", () => closeConfirmation(true));
document.getElementById("delete-cancel").addEventListener("click", () => closeConfirmation(false));
document.getElementById("delete-confirmation").addEventListener("click", (event) => { if (event.target.id === "delete-confirmation") closeConfirmation(false); });
document.getElementById("course-toast-close").addEventListener("click", () => { clearTimeout(toastTimer); document.getElementById("course-toast").classList.add("hidden"); });