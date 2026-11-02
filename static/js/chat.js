(() => {
  "use strict";

  const panel = document.getElementById("chat-panel");
  if (!panel) return;
  const projectId = panel.dataset.projectId;
  const token = localStorage.getItem("access_token");
  const messages = document.getElementById("messages");
  const emptyState = document.getElementById("empty-chat");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("message-input");
  const sendButton = document.getElementById("send-message");
  const statusLabel = document.getElementById("connection-label");
  const statusDot = document.getElementById("connection-dot");
  const errorBox = document.getElementById("chat-error");
  const searchInput = document.getElementById("message-search");
  const scrollButton = document.getElementById("scroll-latest");
  const characterCount = document.getElementById("character-count");
  let socket;
  let reconnectTimer;
  let reconnectAttempt = 0;
  let currentUserId = null;
  let shouldReconnect = true;
  let currentDayKey = null;

  if (!token) {
    window.location.replace("/auth/login");
    return;
  }

  function setConnectionState(state) {
    const states = {
      connected: ["Connected", "bg-green-500", true],
      connecting: ["Connecting...", "bg-amber-400", false],
      disconnected: ["Reconnecting...", "bg-slate-300", false],
      blocked: ["Access denied", "bg-red-500", false],
    };
    const [label, dotClass, enabled] = states[state];
    statusLabel.textContent = label;
    statusDot.className = `h-2 w-2 rounded-full ${dotClass}`;
    sendButton.disabled = !enabled;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  function initials(name) {
    return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function getDayKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function formatDayLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.round((startOfToday - startOfMessageDay) / 86400000);
    if (daysAgo === 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "long",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    }).format(date);
  }

  function addDaySeparator(value) {
    const dayKey = getDayKey(value);
    if (!dayKey || dayKey === currentDayKey) return;
    const separator = document.createElement("div");
    separator.className = "date-separator my-5 flex items-center gap-3 text-[11px] font-semibold text-slate-400";
    separator.dataset.dayKey = dayKey;
    const beforeLine = document.createElement("span");
    beforeLine.className = "h-px flex-1 bg-slate-200";
    separator.appendChild(beforeLine);
    const label = document.createElement("span");
    label.className = "rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm";
    label.textContent = formatDayLabel(value);
    separator.appendChild(label);
    const afterLine = document.createElement("span");
    afterLine.className = "h-px flex-1 bg-slate-200";
    separator.appendChild(afterLine);
    messages.appendChild(separator);
    currentDayKey = dayKey;
  }

  function addMessage(message) {
    addDaySeparator(message.created_at);
    const ownMessage = Number(message.user_id) === Number(currentUserId);
    const row = document.createElement("article");
    row.className = `message-row mb-4 flex items-start gap-2 ${ownMessage ? "justify-end" : "justify-start"}`;
    row.dataset.messageText = message.content.toLocaleLowerCase();
    if (!ownMessage) {
      const avatar = document.createElement("span");
      avatar.className = "mt-7 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700";
      avatar.textContent = initials(message.full_name);
      avatar.title = message.full_name || "Project member";
      row.appendChild(avatar);
    }
    const content = document.createElement("div");
    content.className = `max-w-[min(34rem,82%)] ${ownMessage ? "items-end" : "items-start"} flex flex-col`;
    if (!ownMessage) {
      const author = document.createElement("span");
      author.className = "mb-1 px-1 text-xs font-semibold text-slate-500";
      author.textContent = message.full_name || "Project member";
      content.appendChild(author);
    }
    const bubble = document.createElement("div");
    bubble.className = ownMessage
      ? "whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm"
      : "whitespace-pre-wrap rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-6 text-slate-700 shadow-sm";
    bubble.textContent = message.content;
    content.appendChild(bubble);
    const time = document.createElement("time");
    time.className = `mt-1 px-1 text-[11px] text-slate-400 ${ownMessage ? "text-right" : ""}`;
    time.dateTime = message.created_at;
    time.textContent = formatTime(message.created_at);
    content.appendChild(time);
    row.appendChild(content);
    messages.appendChild(row);
    emptyState.classList.add("hidden");
  }

  function scrollToLatest(smooth = false) {
    messages.scrollTo({ top: messages.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    scrollButton.classList.add("hidden");
  }

  function connect() {
    setConnectionState(reconnectAttempt ? "disconnected" : "connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/projects/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`);
    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      errorBox.classList.add("hidden");
      setConnectionState("connected");
    });
    socket.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        showError("The chat returned an invalid response. Please refresh the page.");
        return;
      }
      if (data.type === "history") {
        messages.querySelectorAll(".message-row").forEach((row) => row.remove());
        messages.querySelectorAll(".date-separator").forEach((separator) => separator.remove());
        currentDayKey = null;
        (data.messages || []).forEach(addMessage);
        emptyState.classList.toggle("hidden", Boolean(data.messages?.length));
        scrollToLatest();
      } else if (data.type === "message" && data.message) {
        addMessage(data.message);
        if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120) scrollToLatest(true);
        else scrollButton.classList.remove("hidden");
      }
    });
    socket.addEventListener("error", () => showError("Unable to connect to the project chat. We will keep trying."));
    socket.addEventListener("close", (event) => {
      if (!shouldReconnect) return;
      if (event.code === 1008) {
        setConnectionState("blocked");
        showError("You do not have access to this project chat.");
        shouldReconnect = false;
        return;
      }
      reconnectAttempt += 1;
      setConnectionState("disconnected");
      reconnectTimer = window.setTimeout(connect, Math.min(1000 * 2 ** reconnectAttempt, 10000));
    });
  }

  async function loadCurrentUser() {
    const response = await fetch("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      window.location.replace("/auth/login");
      return;
    }
    if (!response.ok) throw new Error("Could not identify the signed-in user.");
    currentUserId = (await response.json()).id;
  }

  function updateInputState() {
    characterCount.textContent = `${input.value.length} / 2000`;
    input.style.height = "auto";
    const maxHeight = 128;
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(text);
    input.value = "";
    updateInputState();
    input.focus();
  });
  input.addEventListener("input", updateInputState);
  updateInputState();
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    messages.querySelectorAll(".message-row").forEach((row) => row.classList.toggle("hidden", Boolean(query) && !row.dataset.messageText.includes(query)));
  });
  messages.addEventListener("scroll", () => {
    scrollButton.classList.toggle("hidden", messages.scrollHeight - messages.scrollTop - messages.clientHeight <= 120);
  });
  scrollButton.addEventListener("click", () => scrollToLatest(true));

  const projectName = document.getElementById("project-name");
  const chatProjectName = document.getElementById("chat-project-name");
  if (projectName && chatProjectName) {
    const updateProjectName = () => {
      if (projectName.textContent && projectName.textContent !== "Loading project...") {
        chatProjectName.textContent = projectName.textContent;
      }
    };
    updateProjectName();
    new MutationObserver(updateProjectName).observe(projectName, { childList: true, characterData: true, subtree: true });
  }
  loadCurrentUser().then(connect).catch((error) => {
    showError(error instanceof Error ? error.message : "Could not load your chat profile.");
    setConnectionState("blocked");
  });
  window.addEventListener("beforeunload", () => {
    shouldReconnect = false;
    window.clearTimeout(reconnectTimer);
    socket?.close();
  });
})();
