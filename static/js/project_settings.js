(() => {
  "use strict";

  const form = document.getElementById("project-settings-form");
  if (!form) return;

  const projectId = form.dataset.projectId;
  const token = localStorage.getItem("access_token");
  const errorBox = document.getElementById("project-settings-error");
  const saveButton = document.getElementById("save-project-settings");
  const nameInput = document.getElementById("settings-project-name");
  const descriptionInput = document.getElementById("settings-project-description");
  const typeInput = document.getElementById("settings-project-type");
  const statusInput = document.getElementById("settings-project-status");
  const deadlineInput = document.getElementById("settings-project-deadline");
  let originalProject = null;

  if (!token) {
    window.location.replace("/auth/login");
    return;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  function readPayload() {
    return {
      name: nameInput.value.trim(),
      description: descriptionInput.value.trim() || null,
      type: typeInput.value,
      status: statusInput.value,
      deadline: deadlineInput.value || null,
    };
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (response.status === 401) {
      window.location.replace("/auth/login");
      throw new Error("Your session has expired. Please sign in again.");
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && data.detail;
      throw new Error(typeof detail === "string" ? detail : "Unable to save project settings.");
    }
    return data;
  }

  async function loadProject() {
    try {
      const project = await request(`/api/projects/${encodeURIComponent(projectId)}`);
      nameInput.value = project.name || "";
      descriptionInput.value = project.description || "";
      typeInput.value = project.type || "Solo";
      statusInput.value = project.status || "Ongoing";
      deadlineInput.value = project.deadline || "";
      originalProject = readPayload();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to load project settings.");
      saveButton.disabled = true;
      console.error("Loading project settings failed:", error);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("hidden");

    const payload = readPayload();
    if (!payload.name) {
      showError("Project name is required.");
      nameInput.focus();
      return;
    }
    if (originalProject && JSON.stringify(payload) === JSON.stringify(originalProject)) {
      showError("No changes were made.");
      errorBox.classList.remove("border-red-200", "bg-red-50", "text-red-700");
      errorBox.classList.add("border-blue-200", "bg-blue-50", "text-blue-700");
      return;
    }

    errorBox.classList.remove("border-blue-200", "bg-blue-50", "text-blue-700");
    errorBox.classList.add("border-red-200", "bg-red-50", "text-red-700");
    saveButton.disabled = true;
    saveButton.querySelector("span").textContent = "Saving...";

    try {
      await request(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      errorBox.textContent = "Project settings saved.";
      errorBox.classList.remove("hidden", "border-red-200", "bg-red-50", "text-red-700");
      errorBox.classList.add("border-green-200", "bg-green-50", "text-green-700");
      window.setTimeout(() => window.location.replace(`/projects/${encodeURIComponent(projectId)}`), 700);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Unable to save project settings.");
      console.error("Saving project settings failed:", error);
      saveButton.disabled = false;
      saveButton.querySelector("span").textContent = "Save changes";
    }
  });

  loadProject();
})();
