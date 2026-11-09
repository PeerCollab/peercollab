(() => {
  "use strict";

  const K = window.Kanban;
  const slot = document.getElementById("task-comments-slot");
  if (!K || !slot) return;

  slot.className = "border-t border-slate-100 px-5 py-4";
  slot.innerHTML = `
    <div class="mb-3 flex items-center gap-2">
      <h4 class="text-sm font-semibold text-slate-800">Comments</h4>
      <span id="comments-count" class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">0</span>
    </div>
    <div id="comments-error" role="alert" class="mb-2 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
    <ul id="comments-list" class="max-h-56 space-y-3 overflow-y-auto pr-1"></ul>
    <p id="comments-empty" class="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400"></p>
    <form id="comment-form" class="mt-3 flex items-end gap-2">
      <textarea id="comment-input" rows="1" maxlength="1000" placeholder="Write a comment..."
        class="max-h-28 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"></textarea>
      <button id="comment-send" type="submit" disabled aria-label="Post comment"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        <i data-lucide="send" class="h-4 w-4"></i>
      </button>
    </form>
    <p class="mt-1 text-[11px] text-slate-400">Enter to send, Shift+Enter for a new line</p>
  `;
  if (window.lucide) window.lucide.createIcons();

  const list = document.getElementById("comments-list");
  const empty = document.getElementById("comments-empty");
  const count = document.getElementById("comments-count");
  const errorBox = document.getElementById("comments-error");
  const form = document.getElementById("comment-form");
  const input = document.getElementById("comment-input");
  const sendButton = document.getElementById("comment-send");

  let currentTaskId = null;
  let loadId = 0;
  let posting = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function timeAgo(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  function updateSendButton() {
    sendButton.disabled = posting || !input.value.trim();
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  }

  function refreshState(emptyText) {
    const total = list.children.length;
    count.textContent = total;
    empty.textContent = emptyText || "No comments yet. Start the discussion.";
    empty.classList.toggle("hidden", total > 0);
  }

  function buildComment(comment) {
    const item = el("li", "flex gap-3");
    item.append(
      el(
        "span",
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-600",
        K.initials(comment.full_name)
      )
    );

    const body = el("div", "min-w-0 flex-1");
    const head = el("div", "flex items-baseline gap-2");
    head.append(el("span", "text-sm font-semibold text-slate-800", comment.full_name));
    const time = el("span", "text-xs text-slate-400", timeAgo(comment.created_at));
    time.title = new Date(comment.created_at).toLocaleString();
    head.append(time);
    body.append(head, el("p", "mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600", comment.content));
    item.append(body);
    return item;
  }

  function scrollToEnd() {
    list.scrollTop = list.scrollHeight;
  }

  async function openFor(task) {
    currentTaskId = task.id;
    const myLoad = ++loadId;
    hideError();
    list.replaceChildren();
    refreshState("Loading comments...");
    input.value = "";
    resizeInput();
    updateSendButton();

    try {
      const comments = await K.api(`/tasks/${task.id}/comments`);
      if (myLoad !== loadId) return; // another task was opened in the meantime
      list.replaceChildren(...comments.map(buildComment));
      refreshState();
      scrollToEnd();
    } catch (error) {
      if (myLoad !== loadId) return;
      showError(error instanceof Error ? error.message : "Could not load comments.");
      refreshState("Comments could not be loaded.");
    }
  }

  document.addEventListener("kanban:task-opened", (event) => openFor(event.detail.task));

  input.addEventListener("input", () => {
    resizeInput();
    updateSendButton();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || posting || currentTaskId == null) return;

    const taskId = currentTaskId;
    posting = true;
    updateSendButton();
    hideError();
    try {
      const comment = await K.api(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });

      if (taskId === currentTaskId) {
        list.append(buildComment(comment));
        refreshState();
        scrollToEnd();
        input.value = "";
        resizeInput();
      }

      const task = K.state.tasks.find((item) => item.id === taskId);
      if (task) {
        task.comment_count += 1;
        K.render();
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not post the comment.");
    } finally {
      posting = false;
      updateSendButton();
    }
  });
})();