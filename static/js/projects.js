(() => {
  "use strict";

  // ==========================================
  // ELEMENTS
  // ==========================================

  const projectGrid = document.getElementById("project-grid");
  const searchInput = document.getElementById("search-input");
  const sortSelect = document.getElementById("sort-select");
  const statusMsg = document.getElementById("status-msg");
  const projectError = document.getElementById("project-error");
  const flash = document.getElementById("flash");

  // Edit modal
  const editModal = document.getElementById("edit-modal");
  const editForm = document.getElementById("edit-form");
  const editName = document.getElementById("edit-name");
  const editDescription = document.getElementById("edit-description");
  const editType = document.getElementById("edit-type");
  const editStatus = document.getElementById("edit-status");
  const editDeadline = document.getElementById("edit-deadline");
  const editError = document.getElementById("edit-error");
  const editSaveBtn = document.getElementById("edit-save-btn");

  // Delete modal
  const deleteModal = document.getElementById("delete-modal");
  const deleteError = document.getElementById("delete-error");
  const deleteCancelBtn = document.getElementById("delete-cancel-btn");
  const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

  // Join modal
  const joinBtn = document.getElementById("join-btn");
  const joinModal = document.getElementById("join-modal");
  const joinForm = document.getElementById("join-form");
  const joinCode = document.getElementById("join-code");
  const joinMsg = document.getElementById("join-msg");
  const joinSubmitBtn = document.getElementById("join-submit-btn");

  // ==========================================
  // STATE
  // ==========================================

  let projects = [];
  let editingProjectId = null;
  let originalEditPayload = null;
  let deletingProjectId = null;
  let lastFocusedElement = null;
  let flashTimeoutId = null;

  // ==========================================
  // AUTHENTICATION HEADERS
  // ==========================================

  function authHeaders() {
    const headers = {
      "Content-Type": "application/json"
    };

    const token = localStorage.getItem("access_token");

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return replacements[character];
    });
  }

  function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("hidden", "text-red-600", "text-green-700");

    if (type === "success") {
      element.classList.add("text-green-700");
    } else {
      element.classList.add("text-red-600");
    }
  }

  function hideMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.classList.add("hidden");
  }

  function showFlash(message) {
    if (!flash) return;

    if (flashTimeoutId !== null) {
      window.clearTimeout(flashTimeoutId);
    }

    showMessage(flash, message, "success");
    flash.classList.remove("hidden");
    flashTimeoutId = window.setTimeout(() => {
      hideMessage(flash);
      flashTimeoutId = null;
    }, 5000);
  }

  async function readResponse(response) {
    const text = await response.text();

    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { detail: text };
    }
  }

  function getErrorMessage(data, fallback) {
    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data?.detail)) {
      return data.detail
        .map(item => item.msg || "Invalid input")
        .join(", ");
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    return fallback;
  }

  function formatDate(value) {
    if (!value) return "No deadline";

    const date = new Date(`${value}`.slice(0, 10) + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
      return escapeHtml(value);
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function getProjectName(project) {
    return project.name || project.title || "Untitled project";
  }

  function getProjectType(project) {
    return project.type || project.project_type || "Group";
  }

  function getProjectStatus(project) {
    return project.status || "Ongoing";
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ==========================================
  // MODAL FUNCTIONS
  // ==========================================

  function openModal(modal) {
    if (!modal) return;

    lastFocusedElement = document.activeElement;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    document.body.classList.add("overflow-hidden");

    refreshIcons();

    const firstInput = modal.querySelector(
      "input:not([type='hidden']), textarea, select, button"
    );

    if (firstInput) {
      firstInput.focus();
    }
  }

  function closeModal(modal) {
    if (!modal) return;

    modal.classList.add("hidden");
    modal.classList.remove("flex");

    const openModalExists = document.querySelector(
      "#edit-modal.flex, #delete-modal.flex, #join-modal.flex"
    );

    if (!openModalExists) {
      document.body.classList.remove("overflow-hidden");

      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
      }
    }
  }

  function closeAllModals() {
    [editModal, deleteModal, joinModal].forEach(modal => {
      if (!modal) return;

      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });

    document.body.classList.remove("overflow-hidden");

    editingProjectId = null;
    deletingProjectId = null;
  }

  document.querySelectorAll(".close-modal").forEach(button => {
    button.addEventListener("click", () => {
      const modal = button.closest(
        "#edit-modal, #delete-modal, #join-modal"
      );

      closeModal(modal);
    });
  });

  [editModal, deleteModal, joinModal].forEach(modal => {
    if (!modal) return;

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });

  // ==========================================
  // PROJECT CARD
  // ==========================================

  function projectCard(project) {
    const id = project.id;
    const name = getProjectName(project);
    const description = project.description || "No description provided.";
    const type = getProjectType(project);
    const status = getProjectStatus(project);
    const deadline = project.deadline || project.due_date || "";

    const safeId = escapeHtml(id);
    const safeName = escapeHtml(name);
    const safeDescription = escapeHtml(description);
    const safeType = escapeHtml(type);
    const safeStatus = escapeHtml(status);

    const statusClass =
      String(status).toLowerCase() === "completed"
        ? "bg-green-50 text-green-700"
        : "bg-blue-50 text-blue-700";

    return `
            <article class="project-card flex min-h-[250px] h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                     role="link"
                     tabindex="0"
                     aria-label="Open project ${safeName}"
                     data-project-id="${safeId}"
                     data-project-name="${safeName}"
                     data-project-deadline="${escapeHtml(deadline)}">

                <div class="flex items-start justify-between gap-4">

                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <i data-lucide="folder-kanban" class="h-5 w-5"></i>
                    </div>

                    <div class="flex items-center gap-1">

                        <button type="button"
                                class="edit-btn flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                                data-id="${safeId}"
                                aria-label="Edit ${safeName}"
                                title="Edit project">

                            <i data-lucide="pencil" class="h-4 w-4"></i>
                        </button>

                        <button type="button"
                                class="delete-btn flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                data-id="${safeId}"
                                aria-label="Delete ${safeName}"
                                title="Delete project">

                            <i data-lucide="trash-2" class="h-4 w-4"></i>
                        </button>

                    </div>
                </div>

                <div class="mt-4 flex-1">

                    <div class="mb-2 flex flex-wrap items-center gap-2">

                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            ${safeType}
                        </span>

                        <span class="rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}">
                            ${safeStatus}
                        </span>

                    </div>

                    <h2 class="break-words text-lg font-semibold tracking-tight text-slate-900">
                        ${safeName}
                    </h2>

                    <p class="mt-2 min-h-[40px] whitespace-pre-line break-words text-sm leading-5 text-slate-500">
                        ${safeDescription}
                    </p>

                </div>

                <div class="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                    <i data-lucide="calendar-days" class="h-4 w-4 text-brand-600"></i>
                    <span>${formatDate(deadline)}</span>
                    <button type="button"
                            class="view-btn ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-600"
                            data-id="${safeId}"
                            aria-label="View ${safeName}"
                            title="View project">
                        <i data-lucide="chevron-right" class="h-5 w-5"></i>
                    </button>
                </div>

            </article>
        `;
  }

  function newProjectCard() {
    return `
            <a href="/projects/new"
               class="flex min-h-[220px] h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-5 text-center transition-colors hover:border-brand-400 hover:bg-brand-100"
               aria-label="Create a new project">
                <span class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-100 text-brand-600 shadow-sm transition-all duration-200 hover:bg-brand-500 hover:text-white hover:shadow-md">
                    <i data-lucide="plus" class="h-6 w-6"></i>
                </span>
                <span class="mt-4 text-lg font-semibold text-slate-900">Create new project</span>
                <span class="mt-2 max-w-[220px] text-sm leading-5 text-slate-700">
                    Start a project to organise your work and collaborate with your team.
                </span>
                <span class="mt-4 flex items-center gap-1 text-sm font-semibold text-brand-700">
                    <i data-lucide="plus" class="h-4 w-4"></i>
                    Create project
                </span>
            </a>
        `;
  }

  // ==========================================
  // SEARCH AND SORT
  // ==========================================

  function getFilteredProjects() {
    const searchTerm = (searchInput?.value || "").trim().toLowerCase();
    const sortBy = sortSelect?.value || "recent";

    let filtered = projects.filter(project => {
      const name = getProjectName(project).toLowerCase();
      const description = String(project.description || "").toLowerCase();

      return (
        name.includes(searchTerm) ||
        description.includes(searchTerm)
      );
    });

    if (sortBy === "name") {
      filtered.sort((a, b) =>
        getProjectName(a).localeCompare(getProjectName(b))
      );
    } else if (sortBy === "deadline") {
      filtered.sort((a, b) => {
        const deadlineA = a.deadline || a.due_date || "9999-12-31";
        const deadlineB = b.deadline || b.due_date || "9999-12-31";

        return String(deadlineA).localeCompare(String(deadlineB));
      });
    } else {
      filtered.sort((a, b) => {
        const dateA = new Date(
          a.created_at || a.created_date || 0
        ).getTime();

        const dateB = new Date(
          b.created_at || b.created_date || 0
        ).getTime();

        return dateB - dateA;
      });
    }

    return filtered;
  }

  function renderProjects() {
    if (!projectGrid) return;

    const filtered = getFilteredProjects();

    projectGrid.innerHTML = "";

    if (filtered.length === 0 && projects.length > 0) {
      projectGrid.innerHTML = `
                <div class="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
                    <p class="mt-4 text-sm font-medium text-slate-700">
                        No projects match your search.
                    </p>
                    <p class="mt-1 text-sm text-slate-500">
                        Try a different search term.
                    </p>
                </div>
            `;
    } else if (filtered.length > 0) {
      projectGrid.innerHTML = filtered.map(projectCard).join("");
    }

    projectGrid.insertAdjacentHTML("beforeend", newProjectCard());

    if (statusMsg) {
      statusMsg.textContent =
        `${filtered.length} project${filtered.length === 1 ? "" : "s"} found`;
    }

    refreshIcons();
  }

  // ==========================================
  // LOAD PROJECTS
  // ==========================================

  async function loadProjects() {
    hideMessage(projectError);

    if (statusMsg) {
      statusMsg.textContent = "Loading your projects...";
    }

    try {
      const response = await fetch("/api/projects", {
        method: "GET",
        headers: authHeaders()
      });

      if (response.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not load projects.")
        );
      }

      projects = Array.isArray(data)
        ? data
        : Array.isArray(data.projects)
          ? data.projects
          : [];

      renderProjects();

    } catch (error) {
      console.error("Loading projects failed:", error);

      projects = [];

      if (projectGrid) {
        projectGrid.innerHTML = newProjectCard();
        refreshIcons();
      }

      if (statusMsg) {
        statusMsg.textContent = "Unable to load projects.";
      }

      showMessage(
        projectError,
        error.message || "Something went wrong while loading projects."
      );
    }
  }

  // ==========================================
  // EDIT PROJECT
  // ==========================================

  function openEdit(id) {
    const project = projects.find(item => String(item.id) === String(id));

    if (!project) {
      showMessage(projectError, "Project not found. Please refresh the page.");
      return;
    }

    editingProjectId = project.id;

    editName.value = getProjectName(project);
    editDescription.value = project.description || "";
    editType.value = getProjectType(project);
    editStatus.value = getProjectStatus(project);

    const deadline = project.deadline || project.due_date || "";
    editDeadline.value = String(deadline).slice(0, 10);
    originalEditPayload = {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
      type: editType.value,
      status: editStatus.value,
      deadline: editDeadline.value || null
    };

    hideMessage(editError);

    openModal(editModal);
  }

  editForm?.addEventListener("submit", async event => {
    event.preventDefault();

    if (editingProjectId === null) return;

    hideMessage(editError);

    const payload = {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
      type: editType.value,
      status: editStatus.value,
      deadline: editDeadline.value || null
    };

    if (!payload.name) {
      showMessage(editError, "Please enter a project name.");
      editName.focus();
      return;
    }

    if (JSON.stringify(payload) === JSON.stringify(originalEditPayload)) {
      closeModal(editModal);
      editingProjectId = null;
      originalEditPayload = null;
      return;
    }

    editSaveBtn.disabled = true;
    editSaveBtn.textContent = "Saving...";

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(editingProjectId)}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(payload)
        }
      );

      if (response.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not update the project.")
        );
      }

      closeModal(editModal);
      editingProjectId = null;
      originalEditPayload = null;
      showFlash("Project updated successfully.");

      await loadProjects();

    } catch (error) {
      console.error("Updating project failed:", error);

      showMessage(
        editError,
        error.message || "Something went wrong while updating the project."
      );
    } finally {
      editSaveBtn.disabled = false;
      editSaveBtn.textContent = "Save changes";
    }
  });

  // ==========================================
  // DELETE PROJECT
  // ==========================================

  function openDelete(id) {
    const project = projects.find(item => String(item.id) === String(id));

    if (!project) {
      showMessage(projectError, "Project not found. Please refresh the page.");
      return;
    }

    deletingProjectId = project.id;

    hideMessage(deleteError);

    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.innerHTML = `
            <i data-lucide="trash-2" class="h-4 w-4"></i>
            Delete project
        `;

    openModal(deleteModal);
  }

  deleteCancelBtn?.addEventListener("click", () => {
    closeModal(deleteModal);
  });

  deleteConfirmBtn?.addEventListener("click", async () => {
    if (deletingProjectId === null) return;

    hideMessage(deleteError);

    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = "Deleting...";

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(deletingProjectId)}`,
        {
          method: "DELETE",
          headers: authHeaders()
        }
      );

      if (response.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Could not delete the project.")
        );
      }

      closeModal(deleteModal);
      showFlash("Project deleted successfully.");

      deletingProjectId = null;

      await loadProjects();

    } catch (error) {
      console.error("Deleting project failed:", error);

      showMessage(
        deleteError,
        error.message || "Something went wrong while deleting the project."
      );
    } finally {
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.innerHTML = `
                <i data-lucide="trash-2" class="h-4 w-4"></i>
                Delete project
            `;

      refreshIcons();
    }
  });

  // ==========================================
  // PROJECT CARD BUTTONS
  // ==========================================

  projectGrid?.addEventListener("click", event => {
    const editButton = event.target.closest(".edit-btn");
    const deleteButton = event.target.closest(".delete-btn");
    const viewButton = event.target.closest(".view-btn");
    const projectCard = event.target.closest(".project-card");

    if (editButton) {
      openEdit(editButton.dataset.id);
      return;
    }

    if (deleteButton) {
      openDelete(deleteButton.dataset.id);
      return;
    }

    if (viewButton) {
      window.location.href = `/projects/${encodeURIComponent(viewButton.dataset.id)}`;
      return;
    }

    if (projectCard && !event.target.closest("button")) {
      window.location.href = `/projects/${encodeURIComponent(projectCard.dataset.projectId)}`;
    }
  });

  projectGrid?.addEventListener("keydown", event => {
    const projectCard = event.target.closest(".project-card");
    if (!projectCard || event.target.closest("button")) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    window.location.href = `/projects/${encodeURIComponent(projectCard.dataset.projectId)}`;
  });

  // ==========================================
  // JOIN PROJECT
  // ==========================================

  joinBtn?.addEventListener("click", () => {
    hideMessage(joinMsg);
    joinCode.value = "";
    openModal(joinModal);
  });

  joinCode?.addEventListener("input", () => {
    joinCode.value = joinCode.value.toUpperCase();
    hideMessage(joinMsg);
  });

  joinForm?.addEventListener("submit", async event => {
    event.preventDefault();

    hideMessage(joinMsg);

    const code = joinCode.value.trim().toUpperCase();

    if (code.length !== 8) {
      showMessage(joinMsg, "Please enter a valid 8-character invite code.");
      return;
    }

    joinSubmitBtn.disabled = true;
    joinSubmitBtn.textContent = "Joining...";

    try {
      const response = await fetch("/api/projects/join", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          invite_code: code
        })
      });

      if (response.status === 401) {
        window.location.href = "/auth/login";
        return;
      }

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Could not join the project. Please check the invite code."
          )
        );
      }

      closeModal(joinModal);
      showFlash("You joined the project successfully.");

      await loadProjects();

    } catch (error) {
      console.error("Joining project failed:", error);

      showMessage(
        joinMsg,
        error.message || "Something went wrong while joining the project."
      );
    } finally {
      joinSubmitBtn.disabled = false;
      joinSubmitBtn.textContent = "Join project";
    }
  });

  // ==========================================
  // SEARCH AND SORT EVENTS
  // ==========================================

  searchInput?.addEventListener("input", renderProjects);
  sortSelect?.addEventListener("change", renderProjects);

  // ==========================================
  // INITIALIZE PAGE
  // ==========================================

  refreshIcons();

  const flashMessage = sessionStorage.getItem("project_flash");

  if (flashMessage) {
    showFlash(flashMessage);
    sessionStorage.removeItem("project_flash");
  }

  loadProjects();

})();