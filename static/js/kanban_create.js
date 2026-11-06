(() => {
  "use strict";

  const form = document.getElementById("create-task-form");
  if (!form || !window.Kanban) return;

  const K = window.Kanban;
  const MODAL_ID = "create-task-modal";

  const openButton = document.getElementById("open-create-task");
  const titleInput = document.getElementById("create-title");
  const titleError = document.getElementById("create-title-error");
  const formError = document.getElementById("create-task-error");
  const assigneeSelect = document.getElementById("create-assignee");
  const submitButton = document.getElementById("create-task-submit");

  function hideErrors() {
    titleError.classList.add("hidden");
    formError.classList.add("hidden");
    formError.textContent = "";
  }

  function fillAssignees() {
    assigneeSelect.replaceChildren(new Option("Unassigned", ""));
    K.state.assignees.forEach((person) => {
      assigneeSelect.append(new Option(person.full_name, String(person.id)));
    });
  }

  function openCreate() {
    form.reset();
    hideErrors();
    fillAssignees();
    K.openModal(MODAL_ID);
  }

  openButton.addEventListener("click", openCreate);
  titleInput.addEventListener("input", () => titleError.classList.add("hidden"));

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
      due_date: form.elements.due_date.value || null,
      assignee_id: assigneeValue ? Number(assigneeValue) : null,
    };

    submitButton.disabled = true;
    try {
      const task = await K.api("/tasks", { method: "POST", body: JSON.stringify(payload) });
      K.upsertTask(task);
      K.closeModal(MODAL_ID);
    } catch (error) {
      formError.textContent = error instanceof Error ? error.message : "Could not create the task.";
      formError.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
    }
  });
})();