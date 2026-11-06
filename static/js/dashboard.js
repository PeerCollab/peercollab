
document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".task-tab");
    const panels = document.querySelectorAll(".task-panel");

    function showTaskTab(tabName) {
        panels.forEach(function (panel) {
            panel.hidden = panel.id !== "task-panel-" + tabName;
        });

        tabs.forEach(function (button) {
            const selected = button.dataset.taskTab === tabName;

            button.classList.toggle("bg-purple-600", selected);
            button.classList.toggle("text-white", selected);
            button.classList.toggle("rounded-t-lg", selected);
            button.classList.toggle("font-semibold", selected);
            button.classList.toggle("text-purple-700", !selected);
        });
    }

    tabs.forEach(function (button) {
        button.addEventListener("click", function () {
            showTaskTab(button.dataset.taskTab);
        });
    });

    showTaskTab("upcoming");

    async function loadDashboard() {
        const token = localStorage.getItem("access_token");

        if (!token) {
            console.warn("Login token not found.");
            return;
        }

        try {
            const response = await fetch("/api/dashboard", {
                headers: {
                    Authorization: "Bearer " + token
                }
            });

            if (!response.ok) {
                console.error("Dashboard API error:", response.status);
                return;
            }

            const data = await response.json();

            // Update summary cards
            setText("upcoming-tasks-count", data.upcoming_tasks_count ?? 0);
            setText("total-projects-count", data.projects.length);
            setText("active-projects-count",
                data.projects.filter(p => p.status === "Ongoing").length);
            setText("total-notifications-count",
                data.total_notifications_count ?? 0);

            // Update task panels
            renderTasks("upcoming", data.upcoming_tasks, "No upcoming tasks");
            renderTasks("today", data.due_today_tasks, "No tasks due today");
            renderTasks("week", data.this_week_tasks, "No tasks this week");
            renderTasks("overdue", data.overdue_tasks, "No overdue tasks");

            // Update Task Overview chart
            updateBar("todo-bar", "todo-percentage", data.todo_percentage);
            updateBar("in-progress-bar", "in-progress-percentage",
                data.in_progress_percentage);
            updateBar("done-bar", "done-percentage", data.done_percentage);

            // Update My Projects
            renderProjects(data.projects);

        } catch (error) {
            console.error("Could not load dashboard:", error);
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function renderTasks(tabName, tasks, emptyMessage) {
        const panel = document.getElementById("task-panel-" + tabName);
        if (!panel) return;

        panel.replaceChildren();

        if (!tasks || tasks.length === 0) {
            const empty = document.createElement("div");
            empty.className = "px-5 py-8 text-center";

            const heading = document.createElement("p");
            heading.className = "text-sm font-semibold text-slate-700";
            heading.textContent = emptyMessage;

            const description = document.createElement("p");
            description.className = "text-xs text-slate-400 mt-1";
            description.textContent = "Your tasks will appear here when available.";

            empty.append(heading, description);
            panel.appendChild(empty);
            return;
        }

        tasks.forEach(function (task) {
            const row = document.createElement("div");
            row.className = "grid grid-cols-12 gap-4 px-5 py-4 items-center";

            const details = document.createElement("div");
            details.className = "col-span-6";

            const title = document.createElement("p");
            title.className = "text-sm font-medium text-slate-800";
            title.textContent = task.title || "Untitled task";

            const course = document.createElement("p");
            course.className = "text-xs text-slate-400 mt-1";
            course.textContent = task.course_title || "General";

            details.append(title, course);

            const priority = document.createElement("div");
            priority.className = "col-span-3 text-sm text-purple-700";
            priority.textContent = task.priority || "Normal";

            const dueDate = document.createElement("div");
            dueDate.className = "col-span-3 text-right text-xs text-slate-600";
            dueDate.textContent = task.due_date || "No due date";

            row.append(details, priority, dueDate);
            panel.appendChild(row);
        });
    }

    function updateBar(barId, percentageId, value) {
        const percentage = Number(value) || 0;
        const bar = document.getElementById(barId);

        if (bar) {
            bar.style.height = percentage + "%";
        }

        setText(percentageId, percentage + "%");
    }

    function renderProjects(projects) {
        const container = document.getElementById("project-cards");
        if (!container) return;

        container.replaceChildren();

        if (!projects || projects.length === 0) {
            const empty = document.createElement("div");
            empty.className = "col-span-full px-5 py-8 text-center";

            const message = document.createElement("p");
            message.className = "text-sm font-semibold text-slate-700";
            message.textContent = "No projects yet";

            empty.appendChild(message);
            container.appendChild(empty);
            return;
        }

        projects.forEach(function (project) {
            const card = document.createElement("div");
            card.className =
                "bg-white border border-purple-100 rounded-lg p-4 flex flex-col gap-3";

            const title = document.createElement("h3");
            title.className = "text-base font-bold text-slate-900";
            title.textContent = project.name || "Untitled project";

            const description = document.createElement("p");
            description.className = "text-sm text-slate-500";
            description.textContent =
                project.description || "No description available.";

            const status = document.createElement("span");
            status.className =
                "text-xs font-semibold text-purple-700 bg-purple-100 rounded-full px-3 py-1 self-start";
            status.textContent = project.status || "No status";

            card.append(title, description, status);
            container.appendChild(card);
        });
    }

    loadDashboard();
});
