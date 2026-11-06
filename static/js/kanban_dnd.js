(() => {
  "use strict";

  const K = window.Kanban;
  if (!K) return;
  if (!window.Sortable) {
    console.warn("SortableJS did not load, so drag and drop is switched off.");
    return;
  }

  const lists = Array.from(document.querySelectorAll('[id^="list-"][data-status]'));
  if (!lists.length) return;

  // look of the card being dragged and of the places it can be dropped
  const style = document.createElement("style");
  style.textContent = `
    .task-card { cursor: grab !important; }
    .kanban-chosen { cursor: grabbing !important; box-shadow: 0 10px 25px rgba(76, 29, 149, 0.18); }
    .kanban-ghost { opacity: 0.5; border: 2px dashed #7C5CFC !important; background: #F5F3FF !important; }
    .kanban-droppable { outline: 2px dashed #C4B5FD; outline-offset: 4px; border-radius: 0.75rem; }
  `;
  document.head.append(style);

  const sortables = [];
  let moving = false;

  function isFiltered() {
    const filter = K.state.filter;
    return filter.status !== "All" || Boolean(filter.assigneeId) || filter.due !== "any";
  }

  // dragging is paused while a filter is on (the visible order is not the full order)
  // and while a move is being saved
  function refreshDisabled() {
    const disabled = moving || isFiltered();
    sortables.forEach((sortable) => sortable.option("disabled", disabled));
  }

  function flashError(message) {
    K.showError(message);
    setTimeout(() => {
      const box = document.getElementById("kanban-error");
      if (box && box.textContent === message) K.clearError();
    }, 6000);
  }

  function applyOrderFromDom(...changedLists) {
    changedLists.forEach((list) => {
      Array.from(list.children).forEach((card, index) => {
        const task = K.state.tasks.find((item) => item.id === Number(card.dataset.taskId));
        if (task) {
          task.position = index;
          task.status = list.dataset.status;
        }
      });
    });
  }

  async function onEnd(event) {
    lists.forEach((list) => list.classList.remove("kanban-droppable"));

    const { item, from, to, oldIndex, newIndex } = event;
    if (from === to && oldIndex === newIndex) return;

    const taskId = Number(item.dataset.taskId);
    moving = true;
    refreshDisabled();
    try {
      await K.api(`/tasks/${taskId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ status: to.dataset.status, position: newIndex }),
      });
      applyOrderFromDom(from, to);
      K.clearError();
    } catch (error) {
      console.error("Moving the task failed:", error);
      flashError("Could not move the task. It was put back in its original place.");
    } finally {
      moving = false;
      K.render(); // success: redraw from the new order; failure: the card snaps back
      refreshDisabled();
    }
  }

  lists.forEach((list) => {
    sortables.push(
      window.Sortable.create(list, {
        group: "kanban-tasks",
        animation: 150,
        ghostClass: "kanban-ghost",
        chosenClass: "kanban-chosen",
        emptyInsertThreshold: 24,
        delay: 120,
        delayOnTouchOnly: true,
        touchStartThreshold: 4,
        onStart: () => lists.forEach((item) => item.classList.add("kanban-droppable")),
        onEnd,
      })
    );
  });

  document.addEventListener("kanban:rendered", refreshDisabled);
  refreshDisabled();
})();