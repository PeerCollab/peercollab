(() => {
  "use strict";

  const form = document.getElementById("edit-task-form");
  if (!form || !window.Kanban) return;

  const K = window.Kanban;
  const EDIT_MODAL = "edit-task-modal";
  const CONFIRM_MODAL = "delete-task-modal";

  const confirmModal = document.getElementById(CONFIRM_MODAL);
  const keyLabel = document.getElementById("edit-task-key");
  const titleInput = document.getElementById("edit-title");
  const titleError = document.getElementById("edit-title-error");
  const formError = document.getElementById("edit-task-error");
  const assigneeSelect = document.getElementById("edit-assignee");
  const saveButton = document.getElementById("edit-task-save");
  const deleteButton = document.getElementById("delete-task-button");
  const confirmText = document.getElementById("delete-task-text");
  const confirmError = document.getElementById("delete-task-error");
  const confirmButton = document.getElementById("confirm-delete-button");

  let currentTask = null;

  function hideErrors() {
    titleError.classList.add("hidden");
    formError.classList.add("hidden");
    formError.textContent = "";
  }

  function fillAssignees(task) {
    assigneeSelect.replaceChildren(new Option("Unassigned", ""));
    K.state.assignees.forEach((person) => {
      assigneeSelect.append(new Option(person.full_name, String(person.id)));
    });
    // keep a former member visible so saving does not silently unassign the task
    if (task.assignee_id != null && !K.state.assignees.some((person) => person.id === task.assignee_id)) {
      assigneeSelect.append(new Option(task.assignee_name || "Former member", String(task.assignee_id)));
    }
    assigneeSelect.value = task.assignee_id == null ? "" : String(task.assignee_id);
  }

  function openEdit(task) {
    currentTask = task;
    hideErrors();
    keyLabel.textContent = `#${task.id}`;
    titleInput.value = task.title;
    form.elements.description.value = task.description || "";
    form.elements.priority.value = task.priority;
    form.elements.status.value = task.status;
    form.elements.due_date.value = task.due_date || "";
    fillAssignees(task);
    deleteButton.classList.toggle("hidden", !K.canDelete(task));
    K.openModal(EDIT_MODAL);
    document.dispatchEvent(new CustomEvent("kanban:task-opened", { detail: { task } }));
  }

  K.openTask = openEdit;
  titleInput.addEventListener("input", () => titleError.classList.add("hidden"));

  // ---------- save ----------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideErrors();

    const title = titleInput.value.trim();
    if (!title) {
      titleError.classList.remove("hidden");
      titleInput.focus();
      return;
    }

    const assigneeValue = assigneeSelect.value;
    const payload = {
      title,
      description: form.elements.description.value.trim() || null,
      priority: form.elements.priority.value,
      status: form.elements.status.value,
      due_date: form.elements.due_date.value || null,
      assignee_id: assigneeValue ? Number(assigneeValue) : null,
    };

    saveButton.disabled = true;
    try {
      const task = await K.api(`/tasks/${currentTask.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      K.upsertTask(task);
      K.closeModal(EDIT_MODAL);
    } catch (error) {
      formError.textContent = error instanceof Error ? error.message : "Could not save the task.";
      formError.classList.remove("hidden");
    } finally {
      saveButton.disabled = false;
    }
  });

  // ---------- delete (with confirmation) ----------
  deleteButton.addEventListener("click", () => {
    confirmText.textContent = `"${currentTask.title}" will be removed from the board. This cannot be undone.`;
    confirmError.classList.add("hidden");
    confirmError.textContent = "";
    K.openModal(CONFIRM_MODAL);
  });

  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    try {
      await K.api(`/tasks/${currentTask.id}`, { method: "DELETE" });
      K.removeTask(currentTask.id);
      K.closeModal(CONFIRM_MODAL);
      K.closeModal(EDIT_MODAL);
    } catch (error) {
      confirmError.textContent = error instanceof Error ? error.message : "Could not delete the task.";
      confirmError.classList.remove("hidden");
    } finally {
      confirmButton.disabled = false;
    }
  });

  // Esc closes only the confirmation, not the edit window behind it
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && !confirmModal.classList.contains("hidden")) {
        event.stopImmediatePropagation();
        K.closeModal(CONFIRM_MODAL);
      }
    },
    true
  );
})();