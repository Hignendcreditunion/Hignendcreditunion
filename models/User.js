// models/User.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: [
        "Credit",
        "Debit",
        "Zelle",
        "Wire",
        "Bill Pay",
        "External Transfer",
        "Internal Transfer",
        "Admin Transfer",
        "Mobile Deposit",
        "Bitcoin Purchase",
        "Bitcoin Deposit",
        "Bitcoin Transfer",
        "External Transfer - Pending"
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    memo: { type: String, default: "" },
    balanceAfter: { type: Number, required: true },
    category: { type: String, default: "Other" },
    account: { type: String, default: "checking" }
  },
  { _id: false }
);

const accountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, unique: true },
    routingNumber: { type: String, default: "836284645" },
    balance: { type: Number, default: 0 },
    transactions: { type: [transactionSchema], default: [] },
  },
  { _id: false }
);

// Add to your User model
userSchema.methods.addTransaction = function(accountType, transactionData) {
    if (!this.accounts[accountType]) {
        this.accounts[accountType] = {
            accountNumber: this.generateAccountNumber(),
            routingNumber: "836284645",
            balance: 0,
            transactions: []
        };
    }
    
    if (!Array.isArray(this.accounts[accountType].transactions)) {
        this.accounts[accountType].transactions = [];
    }
    
    // Ensure transaction has all required fields
    const transaction = {
        date: new Date(),
        type: transactionData.type,
        amount: parseFloat(transactionData.amount),
        description: transactionData.description,
        memo: transactionData.memo || transactionData.description,
        balanceAfter: transactionData.balanceAfter,
        category: transactionData.category || 'Other',
        account: accountType
    };
    
    this.accounts[accountType].transactions.push(transaction);
    return this.save();
};

const externalAccountSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true },
    accountType: { 
      type: String, 
      enum: ["checking", "savings", "credit", "investment"],
      required: true 
    },
    accountNumber: { type: String, required: true },
    fullAccountNumber: { type: String, required: true },
    routingNumber: { type: String, required: true },
    nickname: { type: String },
    linkedDate: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ["active", "pending", "suspended"],
      default: "active" 
    }
  },
  { _id: true }
);

const pendingTransferSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    memo: { type: String, default: "" },
    balanceAfter: { type: Number, required: true },
    category: { type: String, default: "Transfer" },
    status: { type: String, default: "pending" },
    externalAccount: {
      bankName: String,
      accountNumber: String,
      fullAccountNumber: String,
      routingNumber: String
    }
  },
  { _id: true }
);

const savingsGoalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    currentAmount: { type: Number, default: 0 },
    targetDate: { type: Date, required: true },
    createdDate: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ["active", "completed", "cancelled"],
      default: "active" 
    },
    color: { type: String, default: "#0047AB" },
    icon: { type: String, default: "fas fa-bullseye" }
  },
  { _id: true }
);

const budgetCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    allocated: { type: Number, required: true },
    spent: { type: Number, default: 0 },
    color: { type: String, default: "#0047AB" }
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { 
      type: String, 
      enum: ["info", "success", "warning", "error"],
      default: "info" 
    },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    actionUrl: { type: String }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      match: /.+\@.+\..+/,
    },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true, minlength: 6 },
    status: { 
      type: String, 
      enum: ["active", "suspended", "inactive"],
      default: "active" 
    },
    
    // Core banking accounts
    accounts: {
      checking: accountSchema,
      savings: accountSchema,
      bitcoin: {
        balance: { type: Number, default: 0 },
        walletAddress: { type: String },
        transactions: { type: [transactionSchema], default: [] }
      }
    },
    
    // New features
    externalAccounts: { type: [externalAccountSchema], default: [] },
    pendingTransfers: { type: [pendingTransferSchema], default: [] },
    savingsGoals: { type: [savingsGoalSchema], default: [] },
    budget: {
      monthlyLimit: { type: Number, default: 3000 },
      categories: { type: [budgetCategorySchema], default: [] },
      currentMonth: { 
        month: { type: Number, default: () => new Date().getMonth() + 1 },
        year: { type: Number, default: () => new Date().getFullYear() },
        totalSpent: { type: Number, default: 0 }
      }
    },
    
    // Analytics and preferences
    spendingCategories: {
      type: Map,
      of: Number,
      default: () => new Map([
        ["Shopping", 0],
        ["Bills", 0],
        ["Food & Dining", 0],
        ["Entertainment", 0],
        ["Transportation", 0],
        ["Healthcare", 0],
        ["Education", 0],
        ["Other", 0]
      ])
    },
    
    notifications: { type: [notificationSchema], default: [] },
    
    // User preferences
    preferences: {
      theme: { type: String, default: "light" },
      currency: { type: String, default: "USD" },
      language: { type: String, default: "en" },
      notifications: {
        email: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false }
      },
      dashboardWidgets: {
        type: [String],
        default: ["accounts", "transactions", "budget", "savings", "bitcoin"]
      }
    },
    
    // Security
    lastLogin: { type: Date, default: Date.now },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    twoFactorEnabled: { type: Boolean, default: false },
    
    // Analytics
    totalDeposits: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 },
    averageMonthlySpending: { type: Number, default: 0 },
    
    // Device sync
    devices: [{
      deviceId: String,
      deviceName: String,
      lastSync: Date,
      platform: String
    }]
  },
  { 
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        return ret;
      }
    }
  }
);

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ "accounts.checking.accountNumber": 1 });
userSchema.index({ "accounts.savings.accountNumber": 1 });
userSchema.index({ "accounts.bitcoin.walletAddress": 1 });
userSchema.index({ "externalAccounts.accountNumber": 1 });

// Virtual for total balance
userSchema.virtual('totalBalance').get(function() {
  const checking = this.accounts.checking?.balance || 0;
  const savings = this.accounts.savings?.balance || 0;
  const bitcoin = this.accounts.bitcoin?.balance || 0;
  return checking + savings + bitcoin;
});

// Virtual for account age
userSchema.virtual('accountAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Method to add transaction
userSchema.methods.addTransaction = function(accountType, transactionData) {
  if (!this.accounts[accountType]) {
    throw new Error(`Account type ${accountType} not found`);
  }
  
  this.accounts[accountType].transactions.push(transactionData);
  
  // Update spending categories for analytics
  if (transactionData.amount < 0 && transactionData.category) {
    const spent = Math.abs(transactionData.amount);
    this.spendingCategories.set(
      transactionData.category,
      (this.spendingCategories.get(transactionData.category) || 0) + spent
    );
  }
  
  return this.save();
};

// Method to update budget
userSchema.methods.updateBudgetSpending = function(category, amount) {
  if (amount < 0) {
    this.budget.currentMonth.totalSpent += Math.abs(amount);
    
    const budgetCategory = this.budget.categories.find(cat => cat.name === category);
    if (budgetCategory) {
      budgetCategory.spent += Math.abs(amount);
    }
  }
  
  return this.save();
};

// Method to add notification
userSchema.methods.addNotification = function(notificationData) {
  this.notifications.push(notificationData);
  
  // Keep only last 50 notifications
  if (this.notifications.length > 50) {
    this.notifications = this.notifications.slice(-50);
  }
  
  return this.save();
};

// Static method to generate account number
userSchema.statics.generateAccountNumber = function() {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString();
};

// Pre-save middleware to ensure account numbers
userSchema.pre('save', function(next) {
  // Generate account numbers if they don't exist
  if (this.accounts.checking && !this.accounts.checking.accountNumber) {
    this.accounts.checking.accountNumber = mongoose.model('User').generateAccountNumber();
  }
  
  if (this.accounts.savings && !this.accounts.savings.accountNumber) {
    this.accounts.savings.accountNumber = mongoose.model('User').generateAccountNumber();
  }
  
  // Ensure bitcoin account exists
  if (!this.accounts.bitcoin) {
    this.accounts.bitcoin = {
      balance: 0,
      transactions: []
    };
  }
  
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;