// ✅ Verified working login form submission handler
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usernameInput = loginForm.querySelector('input[name="username"]');
    const passwordInput = loginForm.querySelector('input[name="password"]');
    const username = usernameInput?.value.trim();
    const password = passwordInput?.value.trim();

    if (!username || !password) {
      alert("Please fill in all fields");
      return;
    }

    const payload = username.includes("@")
      ? { email: username, password }
      : { username, password };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Invalid credentials");
        return;
      }

      localStorage.setItem("jwt", data.token);
      localStorage.setItem("loggedInUser", JSON.stringify(data.user));
      localStorage.setItem("isAdmin", data.user.isAdmin ? "true" : "false");

      window.location.href = data.user.isAdmin
        ? "admin-dashboard.html"
        : "user-dashboard.html";

    } catch (err) {
      console.error("Login error:", err);
      alert("Server error. Please try again.");
    }
  });
});
