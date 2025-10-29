const token = localStorage.getItem("jwt");

function redirectToLogin() {
  window.location.href = "login.html";
}

if (!token) {
  redirectToLogin();
} else {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.isAdmin) {
      redirectToLogin();
    }
  } catch (err) {
    console.error("Invalid token:", err);
    redirectToLogin();
  }
}

let transactions = [];
let currentPage = 1;
const transactionsPerPage = 5;

// Helper: Get JWT token headers
function getAuthHeaders() {
  const token = localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function updatePagination() {
  const totalPages = Math.ceil(transactions.length / transactionsPerPage) || 1;
  const pageInfo = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("previousPage");
  const nextBtn = document.getElementById("nextPage");

  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

function showTransferResult(success, message, details = {}) {
  if (success) {
    alert(`✅ Transfer Successful!\n\n${message}\n\nAccount: ${details.accountNumber || "N/A"} (${details.accountType || "N/A"})\nAmount: $${Number(details.amount || 0).toFixed(2)}\nMemo: ${details.memo || 'N/A'}`);
  } else {
    alert(`❌ Transfer Failed!\n\n${message}\n\nAccount: ${details.accountNumber || "N/A"}\nAmount: $${Number(details.amount || 0).toFixed(2)}`);
  }
}

// Fetch Users and populate tables
async function fetchUsers() {
  try {
    const response = await fetch("/api/users", { 
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" } 
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        alert("Session expired. Please login again.");
        localStorage.removeItem("jwt");
        window.location.href = "login.html";
        return;
      }
      throw new Error(`Failed to fetch users: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || "Failed to load users");
    }

    const users = data.users || [];
    const tbody = document.getElementById("userTable");
    const userTableManage = document.getElementById("user-table");

    if (tbody) tbody.innerHTML = "";
    if (userTableManage) userTableManage.innerHTML = "";

    if (users.length === 0) {
      const noUsersRow = `<tr><td colspan="6" class="text-center">No users found</td></tr>`;
      if (tbody) tbody.innerHTML = noUsersRow;
      if (userTableManage) userTableManage.innerHTML = noUsersRow;
      return;
    }

    users.forEach(user => {
      // User table for dashboard
      if (tbody) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${user.name || ""}</td>
          <td>${user.accounts?.checking?.accountNumber || "N/A"}<br>${user.accounts?.savings?.accountNumber || "N/A"}</td>
          <td>Checking<br>Savings</td>
          <td>$${(user.accounts?.checking?.balance || 0).toLocaleString()}<br>$${(user.accounts?.savings?.balance || 0).toLocaleString()}</td>
          <td>${user.email || ""}</td>
        `;
        tbody.appendChild(row);
      }

      // User table for management
      if (userTableManage) {
        const rowManage = document.createElement("tr");
        rowManage.setAttribute("data-user-id", user._id);
        rowManage.innerHTML = `
          <td class="px-4 py-2">${user.name || ""}</td>
          <td class="px-4 py-2">${user.email || ""}</td>
          <td class="px-4 py-2">Checking: ${user.accounts?.checking?.accountNumber || "N/A"}<br>Savings: ${user.accounts?.savings?.accountNumber || "N/A"}</td>
          <td class="px-4 py-2">Checking: $${(user.accounts?.checking?.balance || 0).toLocaleString()}<br>Savings: $${(user.accounts?.savings?.balance || 0).toLocaleString()}</td>
          <td class="px-4 py-2"><span class="badge ${user.status === 'active' ? 'bg-success' : 'bg-danger'}">${user.status || "unknown"}</span></td>
          <td class="px-4 py-2">
            <button class="btn btn-sm btn-warning mb-1" onclick="editUser('${user.accounts?.checking?.accountNumber || ""}', 'checking')">Edit Checking</button>
            <button class="btn btn-sm btn-secondary mb-1" onclick="editUser('${user.accounts?.savings?.accountNumber || ""}', 'savings')">Edit Savings</button>
            <button class="btn btn-sm btn-info mb-1" onclick="changePasswordPrompt('${user._id}')">Change Password</button>
            <button class="btn btn-sm ${user.status === "suspended" ? "btn-success" : "btn-danger"}" onclick="toggleSuspendUser('${user._id}')">${user.status === "suspended" ? "Unsuspend" : "Suspend"}</button>
          </td>
        `;
        userTableManage.appendChild(rowManage);
      }
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    alert("Could not load users: " + err.message);
  }
}

function editUser(accountNumber, accountType) {
  const accInput = document.getElementById("account-number-action");
  const accType = document.getElementById("account-type-action");
  if (accInput) accInput.value = accountNumber || "";
  if (accType) accType.value = accountType || "checking";
  const node = document.getElementById("user-actions");
  if (node) node.scrollIntoView({ behavior: "smooth" });
}

function changePasswordPrompt(userId) {
  const newPassword = prompt("Enter new password:");
  if (!newPassword) return;
  fetch(`/api/users/${userId}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ newPassword })
  })
    .then(res => res.json())
    .then(data => alert(data.message || "Password updated"))
    .catch(() => alert("Error changing password"));
}

function toggleSuspendUser(userId) {
  if (!confirm("Toggle suspension for this user?")) return;
  fetch(`/api/users/${userId}/toggle-suspend`, {
    method: "POST",
    headers: { ...getAuthHeaders() }
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message || "Done");
      fetchUsers();
    })
    .catch(() => alert("Suspension failed"));
}

function updateTransactionTable() {
  const tbody = document.getElementById("transactionTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const start = (currentPage - 1) * transactionsPerPage;
  const pageTransactions = transactions.slice(start, start + transactionsPerPage);

  if (pageTransactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">No transactions found</td></tr>`;
    return;
  }

  pageTransactions.forEach(trans => {
    const row = document.createElement("tr");
    let dateString = "N/A";
    try {
      dateString = new Date(trans.date).toLocaleString();
    } catch (e) {
      dateString = "Invalid Date";
    }
    const amount = parseFloat(trans.amount) || 0;
    row.innerHTML = `
      <td>${dateString}</td>
      <td>${trans.account || "N/A"}</td>
      <td>${trans.type || "Transaction"}</td>
      <td class="${amount < 0 ? "text-danger" : "text-success"}">$${Math.abs(amount).toLocaleString()}</td>
      <td>${(trans.description || trans.memo || "")}</td>
      <td>${trans.user || "N/A"}</td>
    `;
    tbody.appendChild(row);
  });
}

async function fetchTransactions() {
  try {
    const res = await fetch("/api/admin/transactions", { 
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" } 
    });
    
    if (!res.ok) {
      if (res.status === 401) {
        alert("Session expired. Please login again.");
        localStorage.removeItem("jwt");
        window.location.href = "login.html";
        return;
      }
      throw new Error(`Failed to fetch transactions: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.message || "Failed to load transactions");
    }

    transactions = data.transactions || [];
    currentPage = 1;
    updateTransactionTable();
    updatePagination();
  } catch (err) {
    console.error("Transactions error:", err);
    transactions = [];
    updateTransactionTable();
    updatePagination();
    alert("Could not load transactions: " + err.message);
  }
}

async function findAccountHolder(accountNumber) {
  try {
    const response = await fetch("/api/users", { headers: { ...getAuthHeaders() } });
    if (!response.ok) throw new Error("Failed to fetch users");
    const users = await response.json();
    for (const user of users) {
      if (user.accounts?.checking?.accountNumber === accountNumber || user.accounts?.savings?.accountNumber === accountNumber) {
        return user.name || "Unnamed";
      }
    }
    return "Account not found";
  } catch (err) {
    console.error("Error finding account holder:", err);
    return "Error fetching account";
  }
}

// DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const alertBox = document.getElementById("admin-alert");
  function showAdminAlert(message, type = "success") {
    if (!alertBox) return alert(message);
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.classList.remove("d-none");
    setTimeout(() => alertBox.classList.add("d-none"), 3000);
  }

    // Migration fix button
  const migrationBtn = document.getElementById("runMigration");
  if (migrationBtn) {
    migrationBtn.addEventListener("click", async () => {
      if (!confirm("⚠️ This will fix transaction history for ALL users. Proceed?")) return;

      try {
        const res = await fetch("/api/admin/migrate-accounts", {
          method: "POST",
          headers: { ...getAuthHeaders() }
        });

        const data = await res.json();

        if (res.ok) {
          alert(`✅ ${data.message}\n\nErrors: ${data.errors?.length || 0}`);
          // Refresh UI after migration
          fetchUsers();
          fetchTransactions();
        } else {
          alert(`❌ Migration failed: ${data.message || res.statusText}`);
        }
      } catch (err) {
        console.error("Migration error:", err);
        alert("⚠️ Migration request failed. Check server logs.");
      }
    });
  }

  // User action form handler
  const userActionForm = document.getElementById("user-action-form");
  if (userActionForm) {
    userActionForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const accountNumber = (document.getElementById("account-number-action").value || "").trim();
      const accountType = document.getElementById("account-type-action").value;
      const amount = parseFloat(document.getElementById("balance-amount").value);

      if (!accountNumber || isNaN(amount)) {
        return showAdminAlert("Missing or invalid input", "danger");
      }

      try {
        const res = await fetch("/api/users", { headers: { ...getAuthHeaders() } });
        if (!res.ok) throw new Error("Failed to fetch users");
        const users = await res.json();
        const user = users.find(u => u.accounts?.[accountType]?.accountNumber === accountNumber);

        if (!user) return showAdminAlert("User not found", "danger");

        const updateRes = await fetch(`/api/users/${user._id}/update-balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ account: accountType, amount })
        });

        const result = await updateRes.json();
        if (updateRes.ok) {
          showAdminAlert("Balance updated successfully", "success");
          fetchUsers();
        } else {
          showAdminAlert(result.message || "Error updating balance", "danger");
        }
      } catch (err) {
        showAdminAlert("Server error during balance update", "danger");
        console.error(err);
      }
    });
  }

  // accountNumber input debounce lookup
  const accountNumberInput = document.getElementById("accountNumber");
  if (accountNumberInput) {
    let debounceTimer;
    accountNumberInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const accountNumber = accountNumberInput.value.trim();
        if (accountNumber.length > 5) {
          const accountName = await findAccountHolder(accountNumber);
          const display = document.getElementById("accountNameDisplay");
          if (display) display.textContent = accountName;
        } else {
          const display = document.getElementById("accountNameDisplay");
          if (display) display.textContent = "";
        }
      }, 500);
    });
  }

  // Admin transfer form
  const transferForm = document.getElementById("transferForm");
  if (transferForm) {
    transferForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const accountNumber = (document.getElementById("accountNumber").value || "").trim();
      const accountType = document.getElementById("accountType").value;
      const amount = parseFloat(document.getElementById("transferAmount").value);
      const memo = (document.getElementById("transferMemo").value || "").trim();

      if (!accountNumber || !accountType || isNaN(amount) || amount <= 0) {
        showAdminAlert("Please fill all fields with valid values", "danger");
        return;
      }

      try {
        const res = await fetch("/api/admin/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ accountNumber, accountType, amount, memo })
        });

        const data = await res.json();
        if (res.ok) {
          showTransferResult(true, data.message || "Transfer completed successfully", { accountNumber, accountType, amount, memo });
          fetchTransactions();
          fetchUsers();
          transferForm.reset();
          const display = document.getElementById("accountNameDisplay");
          if (display) display.textContent = "";
        } else {
          showTransferResult(false, data.message || `Transfer failed: ${res.statusText}`, { accountNumber, amount });
        }
      } catch (err) {
        console.error("Transfer error:", err);
        showTransferResult(false, "Network error completing transfer", { accountNumber, amount });
      }
    });
  }

  // Pagination buttons
  const prevBtn = document.getElementById("previousPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      updateTransactionTable();
      updatePagination();
    }
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(transactions.length / transactionsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      updateTransactionTable();
      updatePagination();
    }
  });

  // Initial fetch
  fetchUsers();
  fetchTransactions();
});