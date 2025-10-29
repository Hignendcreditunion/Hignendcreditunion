console.log("User Data in LocalStorage:", localStorage.getItem("loggedInUser"));
console.log("Token:", localStorage.getItem("jwt"));

// dashboard.js - Professional Banking Dashboard with API Integration
class Dashboard {
    constructor() {
        this.userData = null;
        this.accounts = {
            checking: { balance: 0, accountNumber: '9472' },
            savings: { balance: 0, accountNumber: '8749' },
            bitcoin: { balance: 0, usdValue: 0 }
        };
        this.transactions = [];
        // FIX: Use 'jwt' instead of 'token' to match login.js
        this.token = localStorage.getItem('jwt');
        
        // Get userId from loggedInUser instead of separate userId storage
        const loggedInUser = localStorage.getItem('loggedInUser');
    try {
      const parsedUser = JSON.parse(loggedInUser);
      this.userId = parsedUser._id || parsedUser.id || parsedUser.userId || null;
    } catch {
      this.userId = null;
    }
        this.init();
    }
    
    init() {
        console.log('Dashboard initializing...');
        console.log('Token found:', !!this.token);
        console.log('User ID found:', !!this.userId);
        
        if (!this.token || !this.userId) {
            this.showNotification('Please log in to access your dashboard', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }
        this.setupEventListeners();
        this.loadUserData();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Transfer forms
        const internalTransferForm = document.getElementById('internalTransferForm');
        if (internalTransferForm) {
            internalTransferForm.addEventListener('submit', (e) => this.handleInternalTransfer(e));
        }

        const zelleTransferForm = document.getElementById('zelleTransferForm');
        if (zelleTransferForm) {
            zelleTransferForm.addEventListener('submit', (e) => this.handleZelleTransfer(e));
        }

        // Bitcoin forms
        const buyBitcoinForm = document.getElementById('buyBitcoinForm');
        if (buyBitcoinForm) {
            buyBitcoinForm.addEventListener('submit', (e) => this.handleBuyBitcoin(e));
        }

        // Other forms
        const mobileDepositForm = document.getElementById('mobileDepositForm');
        if (mobileDepositForm) {
            mobileDepositForm.addEventListener('submit', (e) => this.handleMobileDeposit(e));
        }

        const linkAccountForm = document.getElementById('linkAccountForm');
        if (linkAccountForm) {
            linkAccountForm.addEventListener('submit', (e) => this.handleLinkAccount(e));
        }

        const savingsGoalForm = document.getElementById('savingsGoalForm');
        if (savingsGoalForm) {
            savingsGoalForm.addEventListener('submit', (e) => this.handleSavingsGoal(e));
        }

        const billPayForm = document.getElementById('billPayForm');
        if (billPayForm) {
            billPayForm.addEventListener('submit', (e) => this.handleBillPay(e));
        }

        // Real-time BTC price updates
        const usdAmountInput = document.querySelector('input[name="usdAmount"]');
        if (usdAmountInput) {
            usdAmountInput.addEventListener('input', (e) => this.updateBitcoinEstimate(e.target.value));
        }

        // Notification bell
        const notificationBell = document.getElementById('notificationBell');
        if (notificationBell) {
            notificationBell.addEventListener('click', () => this.showNotifications());
        }

        console.log('Event listeners setup complete');
    }

    async loadUserData() {
        try {
            console.log('Loading user data...');
            
            const response = await fetch(`/api/users/${this.userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load user data');
            }

            const data = await response.json();
            
            if (data.success) {
                this.userData = data.user;
                this.accounts = this.userData.accounts;
                
                // Load transactions
                await this.loadTransactions();
                
                console.log('User data loaded successfully');
                this.updateUI();
            } else {
                throw new Error(data.message || 'Failed to load user data');
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            // Fallback to mock data for demo
            this.loadMockData();
        }
    }

    async loadTransactions() {
        try {
            const response = await fetch(`/api/users/${this.userId}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.transactions = data.transactions;
                }
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
            // Use mock transactions as fallback
            this.transactions = [
                { date: '2024-01-15', description: 'Grocery Store', account: 'checking', amount: -85.42 },
                { date: '2024-01-14', description: 'Salary Deposit', account: 'checking', amount: 3200.00 },
                { date: '2024-01-12', description: 'Online Shopping', account: 'checking', amount: -124.99 },
                { date: '2024-01-10', description: 'Savings Transfer', account: 'savings', amount: 500.00 }
            ];
        }
    }

    loadMockData() {
        // Mock data for demo purposes
        this.userData = {
            name: 'Alex Johnson',
            totalBalance: 12570.42,
            accounts: {
                checking: { balance: 5420.75, accountNumber: '9472' },
                savings: { balance: 5300.67, accountNumber: '8749' },
                bitcoin: { balance: 0.0425, usdValue: 1850.00 }
            }
        };
        this.accounts = this.userData.accounts;
        this.transactions = [
            { date: '2024-01-15', description: 'Grocery Store', account: 'checking', amount: -85.42 },
            { date: '2024-01-14', description: 'Salary Deposit', account: 'checking', amount: 3200.00 },
            { date: '2024-01-12', description: 'Online Shopping', account: 'checking', amount: -124.99 },
            { date: '2024-01-10', description: 'Savings Transfer', account: 'savings', amount: 500.00 }
        ];
        this.updateUI();
    }

updateUI() {
    console.log('Updating UI...');
    
    // Update user info
    if (this.userData) {
        document.getElementById('userName').textContent = this.userData.name;

        // ✅ Calculate total balance dynamically
        const totalBalance =
            (this.accounts.checking?.balance || 0) +
            (this.accounts.savings?.balance || 0) +
            (this.accounts.bitcoin?.usdValue || 0);

        // ✅ Update total balance display
        document.getElementById('totalBalance').textContent = this.formatCurrency(totalBalance);

        // Update account balances
        document.getElementById('checkingBalance').textContent = this.formatCurrency(this.accounts.checking.balance);
        document.getElementById('savingsBalance').textContent = this.formatCurrency(this.accounts.savings.balance);
        document.getElementById('bitcoinBalance').textContent = this.accounts.bitcoin.balance.toFixed(6) + ' BTC';
        document.getElementById('bitcoinValue').textContent = this.formatCurrency(this.accounts.bitcoin.usdValue);
        
        // Update Bitcoin price (mock)
        document.getElementById('btcPrice').textContent = this.formatCurrency(43529.41);
        document.getElementById('portfolioValue').textContent = this.formatCurrency(this.accounts.bitcoin.usdValue);
        
        // Update transactions
        this.updateTransactionTable();
    }
    
    console.log('UI update complete');
}

    updateTransactionTable() {
        const tbody = document.getElementById('transactionTableBody');
        if (!tbody) return;

        if (this.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">No transactions found</td></tr>';
            return;
        }

        tbody.innerHTML = this.transactions.map(transaction => `
            <tr>
                <td>${this.formatDate(transaction.date)}</td>
                <td>${transaction.description}</td>
                <td>${transaction.account.charAt(0).toUpperCase() + transaction.account.slice(1)}</td>
                <td class="${transaction.amount >= 0 ? 'text-success' : 'text-danger'}">
                    ${transaction.amount >= 0 ? '+' : ''}${this.formatCurrency(transaction.amount)}
                </td>
            </tr>
        `).join('');
    }

async handleInternalTransfer(event) {
    event.preventDefault();
    console.log('Processing internal transfer...');
    
    const formData = new FormData(event.target);
    const fromAccount = formData.get('fromAccount');
    const toAccount = formData.get('toAccount');
    const amount = parseFloat(formData.get('amount'));

    // Validate transfer
    if (fromAccount === toAccount) {
        this.showNotification('Cannot transfer to the same account', 'error');
        return;
    }

    if (amount <= 0 || isNaN(amount)) {
        this.showNotification('Amount must be greater than 0', 'error');
        return;
    }

    if (amount > this.accounts[fromAccount].balance) {
        this.showNotification('Insufficient funds', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/users/${this.userId}/transfer`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAccount,
                to: toAccount,
                amount: amount,
                memo: `Transfer from ${fromAccount} to ${toAccount}`
            })
        });

        const data = await response.json();
        console.log('Transfer response:', data);

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Transfer failed');
        }

        // ✅ CRITICAL FIX: Reload user data from server to get updated balances
        await this.loadUserData();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('internalTransferModal'));
        if (modal) modal.hide();
        
        // Reset form
        event.target.reset();
        
        // Show success popup
        this.showSuccessPopup(`Successfully transferred ${this.formatCurrency(amount)} from ${fromAccount} to ${toAccount}`);
        
    } catch (error) {
        console.error('Transfer failed:', error);
        this.showNotification(error.message || 'Transfer failed. Please try again.', 'error');
    }
}

    async handleZelleTransfer(event) {
        event.preventDefault();
        console.log('Processing Zelle transfer...');
        
        const formData = new FormData(event.target);
        const recipient = formData.get('recipient');
        const fromAccount = formData.get('fromAccount');
        const amount = parseFloat(formData.get('amount'));
        const memo = formData.get('memo');

        // Validate
        if (amount <= 0) {
            this.showNotification('Amount must be greater than 0', 'error');
            return;
        }

        if (amount > this.accounts[fromAccount].balance) {
            this.showNotification('Insufficient funds', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/users/${this.userId}/zelle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipient: recipient,
                    from: fromAccount,
                    amount: amount,
                    memo: memo || `Zelle to ${recipient}`
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Zelle transfer failed');
            }

            // Update local balance
            this.accounts[fromAccount].balance = data.newBalance;
            
            // Add transaction record
            this.transactions.unshift({
                date: new Date().toISOString().split('T')[0],
                description: `Zelle to ${recipient}`,
                account: fromAccount,
                amount: -amount
            });

            // Update UI
            this.updateUI();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('zelleTransferModal'));
            if (modal) modal.hide();
            
            // Reset form
            event.target.reset();
            
            // Show success popup
            this.showSuccessPopup(`Successfully sent ${this.formatCurrency(amount)} to ${recipient} via Zelle`);
            
        } catch (error) {
            console.error('Zelle transfer failed:', error);
            this.showNotification(error.message || 'Zelle transfer failed. Please try again.', 'error');
        }
    }

    async handleBuyBitcoin(event) {
        event.preventDefault();
        console.log('Processing Bitcoin purchase...');
        
        const formData = new FormData(event.target);
        const usdAmount = parseFloat(formData.get('usdAmount'));

        // Validate
        if (usdAmount <= 0) {
            this.showNotification('Amount must be greater than 0', 'error');
            return;
        }

        if (usdAmount > this.accounts.checking.balance) {
            this.showNotification('Insufficient funds in checking account', 'error');
            return;
        }

        try {
            // Mock BTC price
            const btcPrice = 43529.41;
            const btcAmount = usdAmount / btcPrice;
            
            // Update balances (frontend only for demo)
            this.accounts.checking.balance -= usdAmount;
            this.accounts.bitcoin.balance += btcAmount;
            this.accounts.bitcoin.usdValue += usdAmount;
            
            // Add transaction record
            this.transactions.unshift({
                date: new Date().toISOString().split('T')[0],
                description: 'Bitcoin Purchase',
                account: 'bitcoin',
                amount: usdAmount
            });

            // Update UI
            this.updateUI();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('bitcoinModal'));
            if (modal) modal.hide();
            
            // Reset form
            event.target.reset();
            
            // Show success popup
            this.showSuccessPopup(`Successfully purchased ${btcAmount.toFixed(6)} BTC`);
            
        } catch (error) {
            console.error('Bitcoin purchase failed:', error);
            this.showNotification('Bitcoin purchase failed. Please try again.', 'error');
        }
    }

    updateBitcoinEstimate(usdAmount) {
        const btcPrice = 43529.41;
        const estimatedBtc = usdAmount / btcPrice;
        const estimatedElement = document.getElementById('estimatedBtc');
        if (estimatedElement) {
            estimatedElement.textContent = estimatedBtc.toFixed(6);
        }
    }

    // Other form handlers (simplified for demo)
    async handleMobileDeposit(event) {
        event.preventDefault();
        console.log('Processing mobile deposit...');
        this.showSuccessPopup('Mobile deposit submitted for processing');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
        if (modal) modal.hide();
        event.target.reset();
    }

    async handleLinkAccount(event) {
        event.preventDefault();
        console.log('Processing account linking...');
        this.showSuccessPopup('External account linked successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('linkAccountModal'));
        if (modal) modal.hide();
        event.target.reset();
    }

    async handleSavingsGoal(event) {
        event.preventDefault();
        console.log('Creating savings goal...');
        this.showSuccessPopup('Savings goal created successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('savingsGoalModal'));
        if (modal) modal.hide();
        event.target.reset();
    }

    async handleBillPay(event) {
        event.preventDefault();
        console.log('Processing bill payment...');
        this.showSuccessPopup('Bill payment scheduled successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('billPayModal'));
        if (modal) modal.hide();
        event.target.reset();
    }

    // Utility methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Add to notification container
        const container = document.getElementById('notificationContainer');
        if (container) {
            container.appendChild(notification);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    showSuccessPopup(message) {
        // Create success popup
        const popup = document.createElement('div');
        popup.className = 'alert alert-success alert-dismissible fade show position-fixed';
        popup.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        popup.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-check-circle me-2" style="font-size: 1.2rem;"></i>
                <strong class="me-2">Success!</strong> ${message}
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(popup);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 4000);
    }

    showNotifications() {
        // Simple notifications display
        const notifications = [
            'Your statement is ready for download',
            'New security feature available',
            'Account verification required'
        ];
        
        // Update notification count
        const notificationCount = document.getElementById('notificationCount');
        if (notificationCount) {
            notificationCount.textContent = '0';
        }
        
        // Show notifications
        this.showNotification(`You have ${notifications.length} new notifications`, 'info');
    }
}

// Make utility functions globally available
window.showFullAccountNumbers = function() {
    alert("For security reasons, please contact customer service to view your full account numbers.");
};

window.copyBtcAddress = function() {
    const btcAddress = document.getElementById('btcDepositAddress');
    if (btcAddress) {
        navigator.clipboard.writeText(btcAddress.value)
            .then(() => alert('Bitcoin address copied to clipboard!'))
            .catch(() => alert('Failed to copy address'));
    }
};

window.generateReport = function() {
    alert('Exporting financial report...');
};

window.syncAllDevices = function() {
    alert('Syncing all devices...');
};

// ✅ Safe dashboard initialization
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded, checking auth before starting dashboard...");

  const jwt = localStorage.getItem("jwt");
  const user = localStorage.getItem("loggedInUser");

  if (!jwt || !user) {
    console.warn("No auth data found, redirecting to login...");
    window.location.href = "login.html";
    return;
  }

  // ✅ Ensure valid user ID before launching
  try {
    const parsedUser = JSON.parse(user);
    if (!parsedUser._id && !parsedUser.id && !parsedUser.userId) {
      console.warn("User data missing ID, redirecting to login...");
      window.location.href = "login.html";
      return;
    }
  } catch (err) {
    console.error("Invalid user data format:", err);
    window.location.href = "login.html";
    return;
  }

  console.log("Auth data found, launching dashboard...");
  window.dashboard = new Dashboard();
});
