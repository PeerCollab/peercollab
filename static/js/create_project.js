(() => {
  "use strict";

  const form = document.getElementById("create-project-form");
  const errorBox = document.getElementById("form-error");

  if (!form || !errorBox) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    errorBox.classList.add("hidden");

    const payload = {
      name: document.getElementById("name").value.trim(),
      description: document.getElementById("description").value.trim() || null,
      type: document.getElementById("type").value,
      deadline: document.getElementById("deadline").value || null
    };

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        window.location.replace("/auth/login");
        return;
      }

      const responseText = await response.text();
      let data = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          if (response.ok) {
            throw new Error("The server returned an invalid response.");
          }
        }
      }

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail[0]?.msg
          : data.detail;
        errorBox.textContent = detail || (
          response.status >= 500
            ? `The server encountered an error (${response.status}). Check the server logs.`
            : "Something went wrong."
        );
        errorBox.classList.remove("hidden");
        return;
      }

      let message = "Project created!";
      if (data.invite_code) message += ` Invite code: ${data.invite_code}`;
      sessionStorage.setItem("project_flash", message);
      window.location.href = "/projects";
    } catch (error) {
      console.error("Creating project failed:", error);
      errorBox.textContent = error instanceof TypeError
        ? "Could not connect to PeerCollab. Check that the server is running."
        : error.message || "Could not create the project.";
      errorBox.classList.remove("hidden");
    }
  });
})();