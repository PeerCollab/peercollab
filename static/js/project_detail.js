(() => {
  "use strict";

  const workspace = document.getElementById("project-workspace");
  const errorMessage = document.getElementById("project-error");
  if (!workspace || !errorMessage) return;

  const projectId = workspace.dataset.projectId;
  const token = localStorage.getItem("access_token");

  if (!token) {
    window.location.replace("/auth/login");
    return;
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

      const project = await response.json();
      document.getElementById("project-name").textContent = project.name;
      document.getElementById("project-breadcrumb").textContent = project.name;
      document.getElementById("project-description").textContent = project.description || "No description provided.";

      const type = document.getElementById("project-type");
      type.textContent = project.type;
      type.classList.remove("hidden");

      const status = document.getElementById("project-status");
      status.textContent = project.status;
      status.classList.remove("hidden");
      if (project.status === "Completed") {
        status.classList.remove("bg-blue-50", "text-blue-700");
        status.classList.add("bg-green-50", "text-green-700");
      }

      const overviewDescription = document.getElementById("overview-description");
      if (overviewDescription) overviewDescription.textContent = project.description || "No description provided.";

      const overviewStatus = document.getElementById("overview-status");
      if (overviewStatus) overviewStatus.textContent = project.status;

      const overviewType = document.getElementById("overview-type");
      if (overviewType) overviewType.textContent = project.type;

      const overviewDeadline = document.getElementById("overview-deadline");
      if (overviewDeadline) overviewDeadline.textContent = project.deadline || "Not set";

      const collaborationTitle = document.getElementById("collaboration-title");
      const collaborationDescription = document.getElementById("collaboration-description");
      if (project.type === "Group") {
        if (collaborationTitle) collaborationTitle.textContent = "Bring your team together";
        if (collaborationDescription) {
          collaborationDescription.textContent = project.invite_code
            ? "Invite teammates to join this project and collaborate in one shared workspace."
            : "Group project invite details are not available yet.";
        }
      } else {
        if (collaborationTitle) collaborationTitle.textContent = "Your project workspace";
        if (collaborationDescription) {
          collaborationDescription.textContent = "Use the project sections above to organize your work. Invite codes are available for group projects.";
        }
      }

      if (project.invite_code) {
        const invite = document.getElementById("project-invite");
        const inviteCode = document.getElementById("project-invite-code");
        if (invite && inviteCode) {
          inviteCode.textContent = project.invite_code;
          invite.classList.remove("hidden");
        }
      }

      if (window.lucide) window.lucide.createIcons();
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
