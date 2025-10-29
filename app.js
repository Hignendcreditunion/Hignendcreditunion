const express = require("express");
const helmet = require("helmet");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

// Load env variables
dotenv.config();

const app = express();

// Middleware setup FIRST
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

// ✅ FIXED: Check required env variables
const requiredEnv = ["MONGODB_URI", "ADMIN_PIN", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(", ")}`);
  console.log("💡 Create a .env file with MONGODB_URI, ADMIN_PIN, and JWT_SECRET");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ FIXED: Enhanced MongoDB connection with PROPER ERROR HANDLING
async function connectDB() {
  try {
    console.log("🔄 Attempting to connect to MongoDB Atlas...");
    
    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    console.log("🔗 Establishing MongoDB connection...");
    await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
    
    console.log("✅ MongoDB connected successfully!");
    
    // Monitor connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected - attempting to reconnect...');
    });

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.log("\n🔧 MongoDB Atlas Connection Troubleshooting:");
      console.log("1. Check MONGODB_URI in .env file");
      console.log("2. Ensure IP is whitelisted in MongoDB Atlas");
      console.log("3. Check internet connection");
      console.log("4. Verify database user credentials");
    }
    
    console.log("\n💡 For development, you can use a local MongoDB:");
    console.log("MONGODB_URI=mongodb://localhost:27017/hecudb");
    
    process.exit(1);
  }
}

// ✅ FIXED: CALL THE DATABASE CONNECTION FUNCTION
connectDB();

// Helmet security headers
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://cdn.jsdelivr.net"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'"]
    }
  })
);

// HTTPS redirect in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Centralized async error wrapper
function dbErrorHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ✅ FIXED: Enhanced rate limiters
const loginLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { success: false, message: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { success: false, message: "Too many registration attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

const transferLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many transfer attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ FIXED: Improved Admin middleware
function adminOnly(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing or invalid token" });
  }
  
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload.isAdmin) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// ✅ FIXED: Improved User auth middleware
function userAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing or invalid token" });
  }
  
  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.userId) {
      throw new Error("Invalid token payload");
    }
    
    // Store userId for use in routes
    req.userId = decoded.userId;
    
    // Only check parameter ID if it exists and doesn't match
    if (req.params.id && req.params.id !== decoded.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// ✅ FIXED: Input validation middleware
function validateTransfer(req, res, next) {
  const { amount, from, to } = req.body;
  const amt = parseFloat(amount);
  
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }
  
  if (from && to && from === to) {
    return res.status(400).json({ success: false, message: "Cannot transfer to same account" });
  }
  
  next();
}

function generateAccountNumber() {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString();
}
// --------------------- Routes ---------------------

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// Verify Admin PIN
app.post("/api/verify-pin", dbErrorHandler(async (req, res) => {
  const { pin } = req.body;
  
  if (!pin) {
    return res.status(400).json({ success: false, message: "PIN is required" });
  }
  
  const ADMIN_PIN = process.env.ADMIN_PIN;
  if (pin === ADMIN_PIN) {
    const token = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ success: true, valid: true, token });
  }
  
  res.json({ success: true, valid: false });
}));

// Register
app.post("/register", registerLimiter, dbErrorHandler(async (req, res) => {
  const { name, email, username, password } = req.body;
  
  if (!name || !email || !username || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
  if (existing) {
    return res.status(409).json({ success: false, message: "User already exists" });
  }

  const hashed = await bcrypt.hash(password, 12);
  const generateAccountNumber = () => Math.floor(Math.random() * 9000000000 + 1000000000).toString();

  const user = new User({
    name,
    email: email.toLowerCase(),
    username,
    password: hashed,
    status: "active",
    accounts: {
      checking: { 
        accountNumber: generateAccountNumber(), 
        routingNumber: "836284645", 
        balance: 0, 
        transactions: [] 
      },
      savings: { 
        accountNumber: generateAccountNumber(), 
        routingNumber: "836284645", 
        balance: 0, 
        transactions: [] 
      }
    }
  });

  await user.save();
  const safeUser = user.toObject();
  delete safeUser.password;
  
  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "2h" });
  
  res.json({ 
    success: true, 
    message: "Registration successful",
    user: safeUser, 
    token 
  });
}));

// Login
app.post("/api/auth/login", loginLimiter, dbErrorHandler(async (req, res) => {
  const { email, username, password } = req.body;
  
  if ((!email && !username) || !password) {
    return res.status(400).json({ success: false, message: "Email/username and password are required" });
  }

  const query = email ? { email: email.trim().toLowerCase() } : { username: username.trim() };
  const user = await User.findOne(query);
  
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

const safeUser = user.toObject();
safeUser._id = user._id; // ✅ Ensure _id is included
delete safeUser.password;

const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "2h" });

res.json({ 
  success: true, 
  message: "Login successful",
  user: safeUser, 
  token 
});
}));

// ------------------ User endpoints ------------------

// Internal transfer - Enhanced version
app.post("/api/users/:id/transfer", userAuth, transferLimiter, validateTransfer, dbErrorHandler(async (req, res) => {
    const { from, to, amount, memo } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.accounts[from] || !user.accounts[to]) {
        return res.status(400).json({ success: false, message: "Invalid account type" });
    }

    const amt = parseFloat(amount);
    if (user.accounts[from].balance < amt) {
        return res.status(400).json({ success: false, message: "Insufficient funds" });
    }

    const now = new Date();
    
    // Ensure accounts have proper structure
    if (!user.accounts[from].transactions) user.accounts[from].transactions = [];
    if (!user.accounts[to].transactions) user.accounts[to].transactions = [];

    // Update balances
    user.accounts[from].balance -= amt;
    user.accounts[to].balance += amt;

    // Add transaction to FROM account
    user.accounts[from].transactions.push({
        date: now,
        type: "Transfer Out",
        amount: -amt,
        description: memo || `Transfer to ${to} account`,
        memo: memo || `Transfer to ${to} account`,
        balanceAfter: user.accounts[from].balance,
        category: "Transfer",
        account: from
    });

    // Add transaction to TO account
    user.accounts[to].transactions.push({
        date: now,
        type: "Transfer In",
        amount: amt,
        description: memo || `Transfer from ${from} account`,
        memo: memo || `Transfer from ${from} account`,
        balanceAfter: user.accounts[to].balance,
        category: "Transfer",
        account: to
    });

    await user.save();
    
    res.json({ 
        success: true, 
        message: "Transfer completed successfully",
        fromBalance: user.accounts[from].balance,
        toBalance: user.accounts[to].balance,
        transactions: [
            ...user.accounts[from].transactions.slice(-1),
            ...user.accounts[to].transactions.slice(-1)
        ]
    });
}));

// Zelle transfer
app.post("/api/users/:id/zelle", userAuth, transferLimiter, validateTransfer, dbErrorHandler(async (req, res) => {
  const { recipient, amount, from, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.accounts[from]) {
    return res.status(400).json({ success: false, message: "Invalid account type" });
  }

  const amt = parseFloat(amount);
  if (user.accounts[from].balance < amt) {
    return res.status(400).json({ success: false, message: "Insufficient funds" });
  }

  user.accounts[from].balance -= amt;
  if (!Array.isArray(user.accounts[from].transactions)) {
    user.accounts[from].transactions = [];
  }

  user.accounts[from].transactions.push({
    date: new Date(),
    type: "Zelle Transfer",
    amount: -amt,
    description: memo || `Zelle to ${recipient}`,
    memo: memo || `Zelle to ${recipient}`,
    balanceAfter: user.accounts[from].balance
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Zelle transfer completed",
    newBalance: user.accounts[from].balance
  });
}));

// Wire transfer
app.post("/api/users/:id/wire", userAuth, transferLimiter, validateTransfer, dbErrorHandler(async (req, res) => {
  const { recipientName, bankName, amount, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.accounts.checking) {
    return res.status(400).json({ success: false, message: "Checking account not found" });
  }

  const amt = parseFloat(amount);
  if (user.accounts.checking.balance < amt) {
    return res.status(400).json({ success: false, message: "Insufficient funds" });
  }

  user.accounts.checking.balance -= amt;
  if (!Array.isArray(user.accounts.checking.transactions)) {
    user.accounts.checking.transactions = [];
  }

  user.accounts.checking.transactions.push({
    date: new Date(),
    type: "Wire Transfer",
    amount: -amt,
    description: memo || `Wire to ${recipientName} at ${bankName}`,
    memo: memo || `Wire to ${recipientName} at ${bankName}`,
    balanceAfter: user.accounts.checking.balance
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Wire transfer completed",
    newBalance: user.accounts.checking.balance
  });
}));

// Bill pay
app.post("/api/users/:id/billpay", userAuth, transferLimiter, validateTransfer, dbErrorHandler(async (req, res) => {
  const { payee, accountNumber, amount, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.accounts.checking) {
    return res.status(400).json({ success: false, message: "Checking account not found" });
  }

  const amt = parseFloat(amount);
  if (user.accounts.checking.balance < amt) {
    return res.status(400).json({ success: false, message: "Insufficient funds" });
  }

  user.accounts.checking.balance -= amt;
  if (!Array.isArray(user.accounts.checking.transactions)) {
    user.accounts.checking.transactions = [];
  }

  user.accounts.checking.transactions.push({
    date: new Date(),
    type: "Bill Payment",
    amount: -amt,
    description: memo || `Payment to ${payee} (Acct: ${accountNumber})`,
    memo: memo || `Payment to ${payee} (Acct: ${accountNumber})`,
    balanceAfter: user.accounts.checking.balance
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Bill payment processed",
    newBalance: user.accounts.checking.balance
  });
}));

// External transfer
app.post("/api/users/:id/external", userAuth, transferLimiter, validateTransfer, dbErrorHandler(async (req, res) => {
  const { recipientName, bankName, amount, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.accounts.checking) {
    return res.status(400).json({ success: false, message: "Checking account not found" });
  }

  const amt = parseFloat(amount);
  if (user.accounts.checking.balance < amt) {
    return res.status(400).json({ success: false, message: "Insufficient funds" });
  }

  user.accounts.checking.balance -= amt;
  if (!Array.isArray(user.accounts.checking.transactions)) {
    user.accounts.checking.transactions = [];
  }

  user.accounts.checking.transactions.push({
    date: new Date(),
    type: "External Transfer",
    amount: -amt,
    description: memo || `Transfer to ${recipientName} at ${bankName}`,
    memo: memo || `Transfer to ${recipientName} at ${bankName}`,
    balanceAfter: user.accounts.checking.balance
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "External transfer completed",
    newBalance: user.accounts.checking.balance
  });
}));

// Link external account with PIN verification
app.post("/api/users/:id/link-external-account", userAuth, dbErrorHandler(async (req, res) => {
  const { bankName, accountType, accountNumber, routingNumber, nickname, pin } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // PIN verification
  if (pin !== "0909") {
    return res.status(400).json({ success: false, message: "Invalid PIN" });
  }

  // Store only last 4 digits for security
  const maskedAccountNumber = accountNumber.slice(-4);

  // Initialize externalAccounts array if it doesn't exist
  if (!user.externalAccounts) {
    user.externalAccounts = [];
  }

  // Add new external account
  user.externalAccounts.push({
    bankName,
    accountType,
    accountNumber: maskedAccountNumber,
    fullAccountNumber: accountNumber, // Store full number for transfers
    routingNumber,
    nickname: nickname || `${bankName} ${accountType}`,
    linkedDate: new Date(),
    status: "active"
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "External account linked successfully",
    externalAccount: {
      bankName,
      accountType, 
      accountNumber: maskedAccountNumber,
      routingNumber,
      nickname: nickname || `${bankName} ${accountType}`
    }
  });
}));

// External transfer to linked account
app.post("/api/users/:id/external-transfer", userAuth, transferLimiter, validateTransfer, dbErrorHandler(async (req, res) => {
  const { externalAccountId, amount, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!user.accounts.checking) {
    return res.status(400).json({ success: false, message: "Checking account not found" });
  }

  const amt = parseFloat(amount);
  if (user.accounts.checking.balance < amt) {
    return res.status(400).json({ success: false, message: "Insufficient funds" });
  }

  // Find the external account
  const externalAccount = user.externalAccounts.id(externalAccountId);
  if (!externalAccount) {
    return res.status(404).json({ success: false, message: "External account not found" });
  }

  // Create pending transfer
  const transfer = {
    date: new Date(),
    type: "External Transfer - Pending",
    amount: -amt,
    description: memo || `Transfer to ${externalAccount.bankName} (${externalAccount.accountNumber})`,
    memo: memo || `Transfer to ${externalAccount.bankName} (${externalAccount.accountNumber})`,
    balanceAfter: user.accounts.checking.balance - amt,
    category: "Transfer",
    status: "pending",
    externalAccount: {
      bankName: externalAccount.bankName,
      accountNumber: externalAccount.accountNumber,
      fullAccountNumber: externalAccount.fullAccountNumber,
      routingNumber: externalAccount.routingNumber
    }
  };

  // Add to pending transfers
  if (!user.pendingTransfers) {
    user.pendingTransfers = [];
  }
  user.pendingTransfers.push(transfer);

  await user.save();

  res.json({
    success: true,
    message: "External transfer initiated - pending approval",
    transfer: transfer,
    newBalance: user.accounts.checking.balance
  });
}));

// ------------------ Admin endpoints ------------------

// Get all users
app.get("/api/users", adminOnly, dbErrorHandler(async (req, res) => {
  const users = await User.find().select("-password");
  res.json({ success: true, users });
}));

// Get single user
app.get("/api/users/:id", userAuth, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({ success: true, user });
}));

// Get user transactions
app.get("/api/users/:id/transactions", userAuth, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("accounts");
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const transactions = [];
  ["checking", "savings"].forEach(accountType => {
    const acc = user.accounts?.[accountType];
    if (acc && Array.isArray(acc.transactions)) {
      acc.transactions.forEach(tx => {
        transactions.push({
          ...tx._doc || tx,
          account: accountType
        });
      });
    }
  });

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.json({ success: true, transactions });
}));

// Toggle suspend
app.post("/api/users/:id/toggle-suspend", adminOnly, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.status = user.status === "suspended" ? "active" : "suspended";
  await user.save();
  
  res.json({ 
    success: true, 
    message: `User ${user.status}`,
    status: user.status 
  });
}));

// Change password
app.post("/api/users/:id/change-password", adminOnly, dbErrorHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();
  
  res.json({ success: true, message: "Password updated successfully" });
}));

// Update balance (admin)
app.post("/api/users/:id/update-balance", adminOnly, dbErrorHandler(async (req, res) => {
  const { account, amount, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user || !["checking", "savings"].includes(account)) {
    return res.status(400).json({ success: false, message: "Invalid user or account type" });
  }

  if (!user.accounts[account]) {
    user.accounts[account] = { balance: 0, transactions: [] };
  }

  const amt = parseFloat(amount);
  if (isNaN(amt)) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  user.accounts[account].balance += amt;
  if (!Array.isArray(user.accounts[account].transactions)) {
    user.accounts[account].transactions = [];
  }

  user.accounts[account].transactions.push({
    date: new Date(),
    type: amt >= 0 ? "Credit" : "Debit",
    amount: amt,
    description: memo || "Admin adjustment",
    memo: memo || "Admin adjustment",
    balanceAfter: user.accounts[account].balance
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Balance updated successfully",
    balance: user.accounts[account].balance 
  });
}));

// Admin transfer
app.post("/api/admin/transfer", adminOnly, transferLimiter, dbErrorHandler(async (req, res) => {
  const { accountNumber, accountType, amount, memo } = req.body;
  
  if (!accountNumber || !accountType || amount == null) {
    return res.status(400).json({ success: false, message: "Account number, type, and amount are required" });
  }

  if (!["checking", "savings"].includes(accountType)) {
    return res.status(400).json({ success: false, message: "Invalid account type" });
  }

  const amt = parseFloat(amount);
  if (isNaN(amt)) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  const query = {};
  query[`accounts.${accountType}.accountNumber`] = accountNumber;
  const recipient = await User.findOne(query);
  
  if (!recipient) {
    return res.status(404).json({ success: false, message: "Recipient account not found" });
  }

  if (!recipient.accounts[accountType]) {
    recipient.accounts[accountType] = { accountNumber, routingNumber: "836284645", balance: 0, transactions: [] };
  }

  // Check for sufficient funds if debiting
  if (amt < 0 && Math.abs(amt) > recipient.accounts[accountType].balance) {
    return res.status(400).json({ success: false, message: "Insufficient funds for debit" });
  }

  const oldBalance = recipient.accounts[accountType].balance;
  recipient.accounts[accountType].balance += amt;

  if (!Array.isArray(recipient.accounts[accountType].transactions)) {
    recipient.accounts[accountType].transactions = [];
  }

  recipient.accounts[accountType].transactions.push({
    date: new Date(),
    type: amt >= 0 ? "Credit" : "Debit",
    amount: amt,
    description: memo || "Admin transfer",
    memo: memo || "Admin transfer",
    balanceAfter: recipient.accounts[accountType].balance
  });

  await recipient.save();

  res.json({
    success: true,
    message: `Transfer of $${Math.abs(amt).toFixed(2)} ${amt >= 0 ? 'to' : 'from'} account completed`,
    recipient: recipient.name,
    account: accountNumber,
    accountType,
    amount: amt,
    oldBalance,
    newBalance: recipient.accounts[accountType].balance
  });
}));

// Admin: view all transactions
app.get("/api/admin/transactions", adminOnly, dbErrorHandler(async (req, res) => {
  const users = await User.find().select("name accounts");
  const allTransactions = [];

  users.forEach(user => {
    ["checking", "savings"].forEach(accountType => {
      if (user.accounts?.[accountType]?.transactions) {
        user.accounts[accountType].transactions.forEach(tx => {
          allTransactions.push({
            ...tx._doc || tx,
            account: accountType,
            user: user.name,
            userId: user._id,
            accountNumber: user.accounts[accountType].accountNumber
          });
        });
      }
    });
  });

  allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  res.json({ success: true, transactions: allTransactions });
}));

// Add this route in app.js after other admin routes
app.post("/api/admin/migrate-accounts", adminOnly, dbErrorHandler(async (req, res) => {
  try {
    const users = await User.find();
    let fixedCount = 0;
    const errors = [];

    for (const user of users) {
      try {
        // Ensure transactions arrays exist
        if (!user.accounts.checking) {
          user.accounts.checking = {
            accountNumber: generateAccountNumber(),
            routingNumber: "836284645",
            balance: 0,
            transactions: []
          };
        }
        if (!user.accounts.savings) {
          user.accounts.savings = {
            accountNumber: generateAccountNumber(),
            routingNumber: "836284645", 
            balance: 0,
            transactions: []
          };
        }

        // Ensure transactions are arrays
        if (!Array.isArray(user.accounts.checking.transactions)) {
          user.accounts.checking.transactions = [];
        }
        if (!Array.isArray(user.accounts.savings.transactions)) {
          user.accounts.savings.transactions = [];
        }

        await user.save();
        fixedCount++;
      } catch (userError) {
        errors.push(`User ${user._id}: ${userError.message}`);
      }
    }

    res.json({
      success: true,
      message: `Migration completed. Fixed ${fixedCount} users.`,
      errors: errors
    });
  } catch (error) {
    console.error("Migration error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Migration failed",
      error: error.message 
    });
  }
}));

app.get("/api/debug/users", async (req, res) => {
  try {
    const users = await User.find().select("email username name");
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add these routes to your app.js after the existing routes

// Mobile Deposit endpoint
app.post("/api/users/:id/deposit", userAuth, dbErrorHandler(async (req, res) => {
  const { amount, type, memo } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  // Add to checking account by default
  user.accounts.checking.balance += amt;
  
  await user.addTransaction('checking', {
    date: new Date(),
    type: "Mobile Deposit",
    amount: amt,
    description: memo || "Mobile check deposit",
    memo: memo || "Mobile check deposit",
    balanceAfter: user.accounts.checking.balance,
    category: "Deposit"
  });

  res.json({ 
    success: true, 
    message: "Deposit submitted for processing",
    newBalance: user.accounts.checking.balance 
  });
}));

// Bitcoin purchase endpoint
app.post("/api/users/:id/bitcoin/buy", userAuth, dbErrorHandler(async (req, res) => {
  const { usdAmount, btcAmount } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const usd = parseFloat(usdAmount);
  const btc = parseFloat(btcAmount);
  
  if (isNaN(usd) || usd <= 0 || isNaN(btc) || btc <= 0) {
    return res.status(400).json({ success: false, message: "Invalid amount" });
  }

  // Check sufficient funds
  if (user.accounts.checking.balance < usd) {
    return res.status(400).json({ success: false, message: "Insufficient funds" });
  }

  // Deduct USD and add Bitcoin
  user.accounts.checking.balance -= usd;
  user.accounts.bitcoin.balance += btc;

  // Record transactions
  await user.addTransaction('checking', {
    date: new Date(),
    type: "Bitcoin Purchase",
    amount: -usd,
    description: `Bitcoin purchase: ${btc} BTC`,
    balanceAfter: user.accounts.checking.balance,
    category: "Investment"
  });

  await user.addTransaction('bitcoin', {
    date: new Date(),
    type: "Purchase",
    amount: btc,
    description: `Bought ${btc} BTC for $${usd}`,
    balanceAfter: user.accounts.bitcoin.balance,
    category: "Investment"
  });

  res.json({ 
    success: true, 
    message: "Bitcoin purchased successfully",
    bitcoinBalance: user.accounts.bitcoin.balance,
    checkingBalance: user.accounts.checking.balance
  });
}));

// External account linking endpoint
app.post("/api/users/:id/link-account", userAuth, dbErrorHandler(async (req, res) => {
  const { bankName, accountType, accountNumber, routingNumber, nickname } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Store only last 4 digits for security
  const maskedAccountNumber = accountNumber.slice(-4);

  // Add new external account
  user.externalAccounts.push({
    bankName,
    accountType,
    accountNumber: maskedAccountNumber,
    routingNumber,
    nickname,
    linkedDate: new Date(),
    status: "active"
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "External account linked successfully",
    externalAccounts: user.externalAccounts
  });
}));

// Savings goals endpoint
app.post("/api/users/:id/savings-goals", userAuth, dbErrorHandler(async (req, res) => {
  const { name, targetAmount, targetDate, color, icon } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.savingsGoals.push({
    name,
    targetAmount: parseFloat(targetAmount),
    currentAmount: 0,
    targetDate: new Date(targetDate),
    color: color || "#0047AB",
    icon: icon || "fas fa-bullseye"
  });

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Savings goal created successfully",
    goals: user.savingsGoals
  });
}));

// Update savings goal
app.post("/api/users/:id/savings-goals/:goalId", userAuth, dbErrorHandler(async (req, res) => {
  const { currentAmount } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const goal = user.savingsGoals.id(req.params.goalId);
  if (!goal) {
    return res.status(404).json({ success: false, message: "Goal not found" });
  }

  goal.currentAmount = parseFloat(currentAmount);
  
  // Check if goal is completed
  if (goal.currentAmount >= goal.targetAmount) {
    goal.status = "completed";
  }

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Savings goal updated successfully",
    goal: goal
  });
}));

// Budget endpoints
app.get("/api/users/:id/budget", userAuth, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({ 
    success: true, 
    budget: user.budget,
    spendingCategories: Object.fromEntries(user.spendingCategories)
  });
}));

app.post("/api/users/:id/budget", userAuth, dbErrorHandler(async (req, res) => {
  const { monthlyLimit, categories } = req.body;
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (monthlyLimit) {
    user.budget.monthlyLimit = parseFloat(monthlyLimit);
  }

  if (categories && Array.isArray(categories)) {
    user.budget.categories = categories;
  }

  await user.save();
  
  res.json({ 
    success: true, 
    message: "Budget updated successfully",
    budget: user.budget
  });
}));

// Analytics endpoint
app.get("/api/users/:id/analytics", userAuth, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const analytics = {
    totalBalance: user.totalBalance,
    accountAge: user.accountAge,
    spendingByCategory: Object.fromEntries(user.spendingCategories),
    monthlySpending: user.budget.currentMonth.totalSpent,
    monthlyLimit: user.budget.monthlyLimit,
    savingsProgress: user.savingsGoals.reduce((acc, goal) => acc + (goal.currentAmount / goal.targetAmount), 0) / user.savingsGoals.length,
    bitcoinValue: user.accounts.bitcoin.balance * (await getCurrentBitcoinPrice()) // You'll need to implement this
  };

  res.json({ 
    success: true, 
    analytics: analytics
  });
}));

// Notifications endpoint
app.get("/api/users/:id/notifications", userAuth, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({ 
    success: true, 
    notifications: user.notifications
  });
}));

// Mark notification as read
app.post("/api/users/:id/notifications/:notificationId/read", userAuth, dbErrorHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const notification = user.notifications.id(req.params.notificationId);
  if (notification) {
    notification.read = true;
    await user.save();
  }

  res.json({ 
    success: true, 
    message: "Notification marked as read"
  });
}));

// Helper function to get Bitcoin price (you'll need to implement this properly)
async function getCurrentBitcoinPrice() {
  // This is a placeholder - implement actual Bitcoin price API
  return 45000; // Example price
}

// ------------------ View routes ------------------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "public/register.html")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public/login.html")));
app.get("/user-dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/user-dashboard.html")));
app.get("/admin-dashboard", (req, res) => res.sendFile(path.join(__dirname, "public/admin-dashboard.html")));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  
  const response = { 
    success: false, 
    message: "Internal server error" 
  };
  
  if (process.env.NODE_ENV !== "production") {
    response.error = err.message;
    response.stack = err.stack;
  }
  
  res.status(500).json(response);
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
});