(() => {
  "use strict";

  const workspace = document.getElementById("project-workspace");
  const errorMessage = document.getElementById("project-error");
  if (!workspace || !errorMessage) return;

  const projectId = workspace.dataset.projectId;
  const token = localStorage.getItem("access_token");
  const editButton = document.getElementById("edit-project-button");
  const editModal = document.getElementById("edit-project-modal");
  const editForm = document.getElementById("edit-project-form");
  const editError = document.getElementById("edit-project-error");
  const saveButton = document.getElementById("save-edit-project");
  const flashMessage = document.getElementById("project-flash");
  let project = null;

  if (!token) {
    window.location.replace("/auth/login");
    return;
  }

  function formatDate(value) {
    if (!value) return "Not set";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function renderProject(details) {
    document.getElementById("project-name").textContent = details.name;
    document.getElementById("project-breadcrumb").textContent = details.name;
    document.getElementById("project-description").textContent = details.description || "No description provided.";

    const type = document.getElementById("project-type");
    type.textContent = details.type;
    type.classList.remove("hidden");

    const status = document.getElementById("project-status");
    status.textContent = details.status;
    status.className = details.status === "Completed"
      ? "rounded-full bg-green-50 px-2.5 py-1 text-green-700"
      : "rounded-full bg-brand-50 px-2.5 py-1 text-brand-700";
    status.classList.remove("hidden");

    const overviewStatus = document.getElementById("overview-status");
    if (overviewStatus) overviewStatus.textContent = details.status;
    const overviewType = document.getElementById("overview-type");
    if (overviewType) overviewType.textContent = details.type;
    const overviewDeadline = document.getElementById("overview-deadline");
    if (overviewDeadline) overviewDeadline.textContent = formatDate(details.deadline);

    const ongoing = details.status === "Ongoing";
    const ongoingCount = document.getElementById("ongoing-project-count");
    const completedCount = document.getElementById("completed-project-count");
    const statusChart = document.getElementById("project-status-chart");
    if (ongoingCount && completedCount && statusChart) {
      ongoingCount.textContent = ongoing ? "1" : "0";
      completedCount.textContent = ongoing ? "0" : "1";
      statusChart.style.background = ongoing
        ? "conic-gradient(#6C4EF5 0deg 360deg)"
        : "conic-gradient(#16a34a 0deg 360deg)";
      statusChart.setAttribute(
        "aria-label",
        `Project status distribution: ${details.status}`
      );
    }

    const collaborationTitle = document.getElementById("collaboration-title");
    const collaborationDescription = document.getElementById("collaboration-description");
    if (details.type === "Group") {
      if (collaborationTitle) collaborationTitle.textContent = "Bring your team together";
      if (collaborationDescription) {
        collaborationDescription.textContent = details.invite_code
          ? "Invite teammates to join this project and collaborate in one shared workspace."
          : "Group project invite details are not available yet.";
      }
    } else {
      if (collaborationTitle) collaborationTitle.textContent = "Your project workspace";
      if (collaborationDescription) {
        collaborationDescription.textContent = "Use the project sections above to organize your work. Invite codes are available for group projects.";
      }
    }

    const invite = document.getElementById("project-invite");
    const inviteCode = document.getElementById("project-invite-code");
    if (invite && inviteCode) {
      invite.classList.toggle("hidden", !details.invite_code);
      if (details.invite_code) inviteCode.textContent = details.invite_code;
    }

    if (editButton) {
      editButton.classList.remove("hidden");
      editButton.classList.add("inline-flex");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function openEditModal() {
    if (!project) return;
    document.getElementById("edit-project-name").value = project.name;
    document.getElementById("edit-project-description").value = project.description || "";
    document.getElementById("edit-project-type").value = project.type;
    document.getElementById("edit-project-status").value = project.status;
    document.getElementById("edit-project-deadline").value = project.deadline || "";
    editError.textContent = "";
    editError.classList.add("hidden");
    editModal.classList.remove("hidden");
    editModal.classList.add("flex");
    document.getElementById("edit-project-name").focus();
  }

  function closeEditModal() {
    editModal.classList.add("hidden");
    editModal.classList.remove("flex");
  }

  if (editButton && editModal && editForm) {
  editButton.addEventListener("click", openEditModal);
  document.getElementById("close-edit-project").addEventListener("click", closeEditModal);
  document.getElementById("cancel-edit-project").addEventListener("click", closeEditModal);
  editModal.addEventListener("click", (event) => {
    if (event.target === editModal) closeEditModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !editModal.classList.contains("hidden")) closeEditModal();
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    editError.textContent = "";
    editError.classList.add("hidden");

    const payload = {
      name: document.getElementById("edit-project-name").value.trim(),
      description: document.getElementById("edit-project-description").value.trim() || null,
      type: document.getElementById("edit-project-type").value,
      status: document.getElementById("edit-project-status").value,
      deadline: document.getElementById("edit-project-deadline").value || null,
    };
    if (!payload.name) {
      editError.textContent = "Please enter a project name.";
      editError.classList.remove("hidden");
      document.getElementById("edit-project-name").focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        window.location.replace("/auth/login");
        return;
      }

      const updatedProject = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = updatedProject && updatedProject.detail;
        throw new Error(typeof detail === "string" ? detail : "Could not update this project. Please try again.");
      }

      project = updatedProject;
      renderProject(project);
      closeEditModal();
      flashMessage.textContent = "Project details updated.";
      flashMessage.classList.remove("hidden");
    } catch (error) {
      editError.textContent = error instanceof Error
        ? error.message
        : "Could not update this project. Please try again.";
      editError.classList.remove("hidden");
      console.error("Updating project failed:", error);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save changes";
    }
  });
  }

  async function loadProject() {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        window.location.replace("/auth/login");
        return;
      }
      if (!response.ok) {
        throw new Error(response.status === 404 || response.status === 403
          ? "This project could not be found or you do not have access to it."
          : "Could not load this project. Please try again.");
      }

      project = await response.json();
      renderProject(project);
    } catch (error) {
      errorMessage.textContent = error instanceof Error
        ? error.message
        : "Could not load this project. Please try again.";
      errorMessage.classList.remove("hidden");
      console.error("Loading project failed:", error);
      document.getElementById("project-name").textContent = "Project unavailable";
    }
  }

  loadProject();
})();
