document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("darkModeToggle");
  const body = document.querySelector("body");

  // Check for saved preference
  const currentTheme = localStorage.getItem("theme");
  if (currentTheme) {
    body.classList.add(currentTheme);
    if (currentTheme === "dark-mode") {
      toggleSwitch.checked = true;
    }
  }

  // Switch between light and dark mode
  toggleSwitch.addEventListener("change", function () {
    if (this.checked) {
      body.classList.remove("light-mode");
      body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark-mode");
    } else {
      body.classList.remove("dark-mode");
      body.classList.add("light-mode");
      localStorage.setItem("theme", "light-mode");
    }
  });
});
