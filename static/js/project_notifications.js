(() => {
  "use strict";

  const workspace = document.getElementById("project-workspace");
  const list = document.getElementById("project-notifications-list");
  const errorBox = document.getElementById("project-notifications-error");
  const markAllButton = document.getElementById("mark-all-project-notifications-read");
  if (!workspace || !list || !errorBox || !markAllButton) return;

  const projectId = encodeURIComponent(workspace.dataset.projectId);
  const token = localStorage.getItem("access_token");
  const endpoint = `/api/projects/${projectId}/notifications`;

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (response.status === 401) {
      window.location.replace("/auth/login");
      throw new Error("Please sign in again.");
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body && typeof body.detail === "string"
        ? body.detail
        : "Could not update project notifications.");
    }
    return response.status === 204 ? null : response.json();
  }

  function updateUnreadCount(count) {
    const badge = document.getElementById("project-notification-count");
    if (!badge) return;
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count < 1);
  }

  function renderNotifications(notifications, unreadCount) {
    list.replaceChildren();
    updateUnreadCount(unreadCount);
    markAllButton.classList.toggle("hidden", unreadCount < 1);

    if (notifications.length === 0) {
      const empty = document.createElement("p");
      empty.className = "p-10 text-center text-sm text-slate-500";
      empty.textContent = "You're all caught up. Project updates will appear here.";
      list.append(empty);
      return;
    }

    notifications.forEach((notification) => {
      const row = document.createElement("article");
      row.className = `flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between ${
        notification.is_read ? "bg-white" : "bg-brand-50/50"
      }`;

      const content = document.createElement("div");
      content.className = "flex min-w-0 items-start gap-3";
      const icon = document.createElement("span");
      icon.className = `mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        notification.is_read ? "bg-slate-100 text-slate-500" : "bg-brand-100 text-brand-700"
      }`;
      const iconElement = document.createElement("i");
      iconElement.dataset.lucide = notification.type === "task_commented" ? "message-square" : "list-checks";
      iconElement.className = "h-4 w-4";
      icon.append(iconElement);

      const message = document.createElement("p");
      message.className = "text-sm font-medium text-slate-800";
      message.textContent = notification.message;
      const date = document.createElement("time");
      date.className = "mt-1 block text-xs text-slate-400";
      date.dateTime = notification.created_at || "";
      date.textContent = notification.created_at
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
          .format(new Date(notification.created_at))
        : "";
      const messageBlock = document.createElement("div");
      messageBlock.append(message, date);
      content.append(icon, messageBlock);

      const actions = document.createElement("div");
      actions.className = "flex shrink-0 items-center gap-3 pl-12 sm:pl-0";
      const boardLink = document.createElement("a");
      boardLink.href = `/projects/${projectId}?tab=kanban`;
      boardLink.className = "text-sm font-semibold text-brand-600 hover:text-brand-700";
      boardLink.textContent = "Open board";
      actions.append(boardLink);

      if (!notification.is_read) {
        const readButton = document.createElement("button");
        readButton.type = "button";
        readButton.className = "text-sm font-medium text-slate-500 hover:text-slate-800";
        readButton.textContent = "Mark read";
        readButton.addEventListener("click", async () => {
          readButton.disabled = true;
          try {
            await request(`${endpoint}/${notification.id}/read`, { method: "PATCH" });
            await loadNotifications();
          } catch (error) {
            readButton.disabled = false;
            showError(error instanceof Error ? error.message : "Could not mark notification as read.");
          }
        });
        actions.append(readButton);
      } else {
        const readLabel = document.createElement("span");
        readLabel.className = "text-xs font-medium text-slate-400";
        readLabel.textContent = "Read";
        actions.append(readLabel);
      }

      row.append(content, actions);
      list.append(row);
    });
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadNotifications() {
    errorBox.classList.add("hidden");
    try {
      const data = await request(endpoint);
      renderNotifications(data.notifications, data.unread_count);
    } catch (error) {
      list.replaceChildren();
      showError(error instanceof Error ? error.message : "Could not load project notifications.");
      console.error("Loading project notifications failed:", error);
    }
  }

  markAllButton.addEventListener("click", async () => {
    markAllButton.disabled = true;
    try {
      await request(`${endpoint}/read-all`, { method: "PATCH" });
      await loadNotifications();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not mark notifications as read.");
    } finally {
      markAllButton.disabled = false;
    }
  });

  if (!token) {
    window.location.replace("/auth/login");
    return;
  }
  loadNotifications();
})();
