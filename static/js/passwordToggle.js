document.querySelectorAll("[data-toggle-password]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.querySelector(".icon-show").classList.toggle("hidden", show);
    btn.querySelector(".icon-hide").classList.toggle("hidden", !show);
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
  });
});