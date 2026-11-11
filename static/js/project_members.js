
document.addEventListener("DOMContentLoaded", function () {
    const workspace = document.getElementById("project-workspace");

    if (!workspace) {
        return;
    }

    const projectId = workspace.dataset.projectId;
    const token = localStorage.getItem("access_token");

    const memberCount = document.getElementById("member-count");
    const membersList = document.getElementById("members-list");
    const membersLoading = document.getElementById("members-loading");
    const membersEmpty = document.getElementById("members-empty");
    const membersError = document.getElementById("members-error");
    const refreshButton = document.getElementById("refresh-members");
    // Add member controls
    const addMemberSection = document.getElementById("add-member-section");
    const addMemberForm = document.getElementById("add-member-form");
    const addMemberEmail = document.getElementById("add-member-email");
    const addMemberButton = document.getElementById("add-member-button");
    const addMemberMessage = document.getElementById("add-member-message");

    // Invitation code display
    const inviteCodeSection = document.getElementById("invite-code-section");
    const inviteCodeText = document.getElementById("invite-code-text");
    const copyInviteCodeButton = document.getElementById("copy-invite-code");

    const allowedRoles = [
        "Developer",
        "Designer",
        "Researcher",
        "Tester",
        "Project Manager",
        "Other"
    ];

    let currentUserId = null;
    let projectOwnerId = null;
    let members = [];

    if (!token) {
        window.location.href = "/auth/login";
        return;
    }

    function showError(message) {
        membersError.textContent = message;
        membersError.classList.remove("hidden");
    }

    function hideError() {
        membersError.textContent = "";
        membersError.classList.add("hidden");
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (character) {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return entities[character];
        });
    }

    function getInitials(name) {
        return String(name || "U")
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("");
    }

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        if (response.status === 401) {
            window.location.href = "/auth/login";
            throw new Error("Your session has expired. Please log in again.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.detail || "Something went wrong.");
        }

        return data;
    }

    function createMemberCard(member) {
        const isOwner = member.is_owner === true;
        const isCurrentUser = member.user_id === currentUserId;
        const isProjectOwner = currentUserId === projectOwnerId;

        const initials = escapeHTML(getInitials(member.full_name));

        const roleOptions = allowedRoles.map(role => `
            <option value="${escapeHTML(role)}"
                ${member.role === role ? "selected" : ""}>
                ${escapeHTML(role)}
            </option>
        `).join("");

        let actions = "";


        if (!isOwner && (isCurrentUser || isProjectOwner)) {
            actions = `
                <div class="mt-4 flex flex-wrap items-center gap-2">
                    <label for="member-role-${member.user_id}"
                           class="text-sm font-medium text-slate-600">
                        ${isCurrentUser ? "My role" : "Member role"}
                    </label>

                    <select id="member-role-${member.user_id}"
                            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        ${roleOptions}
                    </select>

                    <button type="button"
                            data-action="${isCurrentUser ? "save-role" : "save-member-role"}"
                            data-user-id="${member.user_id}"
                            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                        Save role
                    </button>
                </div>
            `;
        }


        if (!isOwner && isProjectOwner) {
            actions += `
                <div class="mt-4 flex flex-wrap gap-2">
                    <button type="button"
                            data-action="transfer-owner"
                            data-user-id="${member.user_id}"
                            class="rounded-lg border border-brand-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
                        Change Group Leader
                    </button>

                    <button type="button"
                            data-action="remove-member"
                            data-user-id="${member.user_id}"
                            class="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                        Remove member
                    </button>
                </div>
            `;
        }

        return `
            <article class="rounded-xl border border-slate-200 p-4 transition hover:border-brand-200 hover:shadow-sm">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                            ${initials}
                        </div>

                        <div class="min-w-0">
                            <h4 class="truncate font-semibold text-slate-900">
                                ${escapeHTML(member.full_name)}
                                ${isCurrentUser ? '<span class="text-xs font-normal text-slate-500">(You)</span>' : ""}
                            </h4>

                            <p class="truncate text-sm text-slate-500">
                                ${escapeHTML(member.email)}
                            </p>
                        </div>
                    </div>

                    <span class="inline-flex self-start rounded-full ${isOwner
                ? "bg-purple-100 text-purple-700"
                : "bg-slate-100 text-slate-700"} px-3 py-1 text-xs font-semibold">
                        ${isOwner ? "Group Leader" : escapeHTML(member.role)}
                    </span>
                </div>

                ${actions}
            </article>
        `;
    }

    function renderMembers() {
        const allMembers = [
            {
                ...members.owner,
                is_owner: true
            },
            ...members.members
        ];

        memberCount.textContent = `${allMembers.length} ${allMembers.length === 1 ? "member" : "members"}`;

        membersList.innerHTML = allMembers.map(createMemberCard).join("");

        membersEmpty.classList.toggle("hidden", allMembers.length > 0);
        membersList.classList.toggle("hidden", allMembers.length === 0);
    }

    async function loadMembers() {
        hideError();

        membersLoading.classList.remove("hidden");
        membersList.classList.add("hidden");
        membersEmpty.classList.add("hidden");

        try {
            const data = await apiRequest(
                `/api/projects/${encodeURIComponent(projectId)}/members`
            );

            currentUserId = data.current_user_id;
            members = data;
            projectOwnerId = data.owner.user_id;

            // Show Add Member controls only to the Group Leader
            const isGroupLeader = currentUserId === projectOwnerId;
            const isGroupProject = data.project_type === "Group";

            addMemberSection.classList.toggle(
                "hidden",
                !(isGroupLeader && isGroupProject)
            );

            // Display the invitation code only to the Group Leader
            if (isGroupLeader && isGroupProject && data.invite_code) {
                inviteCodeSection.classList.remove("hidden");
                inviteCodeText.textContent = data.invite_code;
            } else {
                inviteCodeSection.classList.add("hidden");
            }

            renderMembers();
        } catch (error) {
            showError(error.message);
        } finally {
            membersLoading.classList.add("hidden");
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    async function handleMemberAction(button) {
        const action = button.dataset.action;
        const userId = Number(button.dataset.userId);

        try {
            button.disabled = true;

            
            if (action === "save-role" || action === "save-member-role") {
                const select = document.getElementById(`member-role-${userId}`);
                const newRole = select.value;

                let endpoint;

                if (action === "save-member-role") {
                    endpoint = `/api/projects/${encodeURIComponent(projectId)}/members/${userId}/role?new_role=${encodeURIComponent(newRole)}`;
                } else {
                    endpoint = `/api/projects/${encodeURIComponent(projectId)}/members/me/role?new_role=${encodeURIComponent(newRole)}`;
                }

                await apiRequest(endpoint, { method: "PUT" });

                await loadMembers();
            }


            if (action === "remove-member") {
                const confirmed = window.confirm(
                    "Are you sure you want to remove this member from the project?"
                );

                if (!confirmed) {
                    button.disabled = false;
                    return;
                }

                await apiRequest(
                    `/api/projects/${encodeURIComponent(projectId)}/members/${userId}`,
                    { method: "DELETE" }
                );

                await loadMembers();
            }

            if (action === "transfer-owner") {
                const confirmed = window.confirm(
                    "Are you sure you want to make this member the new Group Leader? You will become a regular member."
                );

                if (!confirmed) {
                    button.disabled = false;
                    return;
                }

                await apiRequest(
                    `/api/projects/${encodeURIComponent(projectId)}/transfer-ownership/${userId}`,
                    { method: "PUT" }
                );

                await loadMembers();
            }
        } catch (error) {
            showError(error.message);
            button.disabled = false;
        }
    }

    membersList.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");

        if (button) {
            handleMemberAction(button);
        }
    });

    refreshButton.addEventListener("click", loadMembers);

    // Add a registered user to the group
    addMemberForm?.addEventListener("submit", async function (event) {
        event.preventDefault();

        hideError();
        addMemberMessage.classList.add("hidden");

        const email = addMemberEmail.value.trim().toLowerCase();

        if (!email) {
            addMemberMessage.textContent = "Please enter an email address.";
            addMemberMessage.className = "mt-3 text-sm font-medium text-red-600";
            return;
        }

        addMemberButton.disabled = true;
        addMemberButton.textContent = "Adding...";

        try {
            const data = await apiRequest(
                `/api/projects/${encodeURIComponent(projectId)}/members`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ email: email })
                }
            );

            addMemberEmail.value = "";

            addMemberMessage.textContent =
                `${data.full_name} was added successfully as ${data.role}.`;

            addMemberMessage.className =
                "mt-3 text-sm font-medium text-green-700";

            addMemberMessage.classList.remove("hidden");

            await loadMembers();

        } catch (error) {
            addMemberMessage.textContent = error.message;
            addMemberMessage.className =
                "mt-3 text-sm font-medium text-red-600";

            addMemberMessage.classList.remove("hidden");

        } finally {
            addMemberButton.disabled = false;
            addMemberButton.textContent = "Add Member";
        }
    });

    // Copy the group invitation code
    copyInviteCodeButton?.addEventListener("click", async function () {
        try {
            await navigator.clipboard.writeText(inviteCodeText.textContent.trim());

            copyInviteCodeButton.textContent = "Copied!";

        } catch (error) {
            addMemberMessage.textContent =
                "Unable to copy the code. Please copy it manually.";

            addMemberMessage.className =
                "mt-3 text-sm font-medium text-red-600";

            addMemberMessage.classList.remove("hidden");
        }
    });

    loadMembers();
});
