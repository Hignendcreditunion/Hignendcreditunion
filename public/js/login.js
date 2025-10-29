document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const togglePassword = document.getElementById("togglePassword");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const loginButton = document.getElementById("loginButton");
      const loginText = loginButton?.querySelector(".login-text");
      const spinner = loginButton?.querySelector(".spinner-border");

      // Get input values
      const usernameInput = document.getElementById("usernameInput") ||
        this.querySelector('input[name="username"]');
      const passwordInput = document.getElementById("passwordInput") ||
        this.querySelector('input[name="password"]');

      const username = usernameInput?.value.trim();
      const password = passwordInput?.value.trim();

      console.log("Login attempt with:", { username, password }); // Debug

      if (!username || !password) {
        alert("Please fill in all fields");
        return;
      }

      try {
        // Show loading
        loginText?.classList.add("d-none");
        spinner?.classList.remove("d-none");
        if (loginButton) loginButton.disabled = true;

        // Determine if input is email or username
        const isEmail = username.includes("@");
        const requestBody = isEmail
          ? { email: username.toLowerCase(), password }
          : { username, password };

        console.log("Sending login request:", requestBody); // Debug

        // Send request
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const data = await res.json();
        console.log("Login response:", data); // Debug

        if (!res.ok || !data.success) {
          throw new Error(data.message || `Login failed with status: ${res.status}`);
        }

        // ✅ Ensure ID always exists
        if (!data.user._id) {
          data.user._id = data.user.userId || data.user.id;
        }

        // Save auth data
        localStorage.setItem("jwt", data.token);
        localStorage.setItem("loggedInUser", JSON.stringify(data.user));
        localStorage.setItem("isAdmin", data.user.isAdmin ? "true" : "false");

        console.log("Login successful, redirecting..."); // Debug

        // Show success + redirect
        showSuccess("Login successful! Redirecting...");
        setTimeout(() => {
          window.location.href = data.user.isAdmin
            ? "admin-dashboard.html"
            : "user-dashboard.html";
        }, 1000);
      } catch (err) {
        console.error("Login error details:", err);
        showError(err.message || "Server error. Please try again.");
      } finally {
        loginText?.classList.remove("d-none");
        spinner?.classList.add("d-none");
        if (loginButton) loginButton.disabled = false;
      }
    });
  }

  // Password toggle
  const passwordInput = document.getElementById("passwordInput")
    || document.querySelector('input[name="password"]');
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
      togglePassword.classList.toggle("fa-eye");
      togglePassword.classList.toggle("fa-eye-slash");
    });
  }

  // Helpers
  function showError(message) {
    const errorAlert = document.getElementById("loginError");
    if (errorAlert) {
      errorAlert.textContent = message;
      errorAlert.classList.remove("d-none");
    } else {
      alert(message);
    }
  }

  function showSuccess(message) {
    const successAlert = document.getElementById("loginSuccess");
    if (successAlert) {
      successAlert.textContent = message;
      successAlert.classList.remove("d-none");
    } else {
      console.log(message);
    }
  }
});

// Staff PIN logic
const staffPinInput = document.getElementById("staffPin");
const verifyPinBtn = document.getElementById("submitPinBtn");

if (verifyPinBtn && staffPinInput) {
  verifyPinBtn.addEventListener("click", async () => {
    const pin = staffPinInput.value.trim();

    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (data.valid) {
        localStorage.setItem("jwt", data.token);
        localStorage.setItem("isAdmin", "true");
        window.location.href = "admin-dashboard.html";
      } else {
        staffPinInput.classList.add("is-invalid");
        setTimeout(() => staffPinInput.classList.remove("is-invalid"), 1500);
      }
    } catch (err) {
      console.error("PIN verification error:", err);
      alert("Server error while verifying PIN.");
    }
  });
}
