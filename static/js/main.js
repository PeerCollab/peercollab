tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F5F3FF",
          100: "#EFEBFF",
          500: "#7C5CFC",
          600: "#6C4EF5",
          700: "#5A3FE0",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
};

lucide.createIcons();
const menuBtn = document.getElementById("user-menu-btn");
const menu = document.getElementById("user-menu");
menuBtn?.addEventListener("click", () => menu.classList.toggle("hidden"));
document.addEventListener("click", (e) => {
  if (!menuBtn?.contains(e.target) && !menu?.contains(e.target)) {
    menu?.classList.add("hidden");
  }
});
