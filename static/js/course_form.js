const courseForm = document.getElementById("course-form");
const formMode = courseForm.dataset.mode;
const courseId = courseForm.dataset.courseId;
const formToken = localStorage.getItem("access_token");
const titleInput = document.getElementById("course-title");
const descriptionInput = document.getElementById("course-description");
const errorBox = document.getElementById("form-error");
const submitButton = document.getElementById("submit-course");
let toastTimer;
let originalCourse = null;

// Show validation or API errors beside the form.
function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
}

// Display temporary feedback for form actions.
function showToast(message, type = "success") {
    const toast = document.getElementById("course-form-toast");
    const content = document.getElementById("course-form-toast-content");
    const toastIcon = document.getElementById("course-form-toast-icon");
    content.classList.remove("toast-success", "toast-error", "toast-info");
    content.classList.add(`toast-${type}`);
    toastIcon.setAttribute("data-lucide", type === "success" ? "circle-check" : type === "info" ? "info" : "circle-alert");
    document.getElementById("course-form-toast-message").textContent = message;
    toast.classList.remove("hidden");
    if (window.lucide) lucide.createIcons();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 4500);
}

// Send an authenticated request for loading or saving course data.
async function request(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${formToken}`, ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(Array.isArray(data.detail) ? "Please check the course details and try again." : data.detail || "Unable to save this course.");
    return data;
}

// Populate the fields when the page is editing an existing course.
async function loadCourse() {
    if (formMode !== "edit") return;
    try {
        const course = await request(`/courses/${courseId}`);
        titleInput.value = course.title || "";
        descriptionInput.value = course.description || "";
        originalCourse = { title: (course.title || "").trim(), description: (course.description || "").trim() };
        updateDescriptionCount();
    } catch (error) {
        showError(error.message);
        showToast(`Unable to load course. ${error.message}`, "error");
        submitButton.disabled = true;
    }
}

// Keep the description character counter synchronized with the textarea.
function updateDescriptionCount() {
    document.getElementById("description-count").textContent = `${descriptionInput.value.length} / 500`;
}

// Validate and submit either a new course or an edited course.
courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("hidden");
    const title = titleInput.value.trim();
    if (!title) { showError("Course name is required."); titleInput.focus(); return; }
    const description = descriptionInput.value.trim();
    if (formMode === "edit" && originalCourse && title === originalCourse.title && description === originalCourse.description) {
        showToast("No changes were made.", "info");
        return;
    }

    submitButton.disabled = true;
    try {
        const path = formMode === "create" ? "/courses/" : `/courses/${courseId}`;
        const method = formMode === "create" ? "POST" : "PATCH";
        const course = await request(path, { method, body: JSON.stringify({ title, description: description || null }) });
        showToast(formMode === "create" ? "Course created successfully." : "Course updated successfully.");
        window.setTimeout(() => window.location.replace(`/courses/${course.id}/page`), 900);
    } catch (error) {
        showError(error.message);
        showToast(`Unable to save course. ${error.message}`, "error");
        submitButton.disabled = false;
    }
});

// Keep the counter and dismiss control responsive after page load.
descriptionInput.addEventListener("input", updateDescriptionCount);
document.getElementById("course-form-toast-close").addEventListener("click", () => {
    clearTimeout(toastTimer);
    document.getElementById("course-form-toast").classList.add("hidden");
});
loadCourse();