import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key";

// Utility to generate account numbers
function generateAccountNumber() {
  return Math.floor(Math.random() * 9000000000 + 1000000000).toString();
}

// ---------------- REGISTER ----------------
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("username").notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, username, password, status } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      username,
      password: hashedPassword,
      status: status || "active",
      accounts: {
        checking: {
          accountNumber: generateAccountNumber(),
          balance: 0,
          transactions: [],
        },
        savings: {
          accountNumber: generateAccountNumber(),
          balance: 0,
          transactions: [],
        },
      },
    });

    await user.save();
    const safeUser = user.toObject();
    delete safeUser.password;

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "2h" });

    res.json({ success: true, user: safeUser, token });
  })
);

// ---------------- GET TRANSACTIONS ----------------
router.get(
  "/:id/transactions",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const checking = user.accounts?.checking?.transactions || [];
    const savings = user.accounts?.savings?.transactions || [];

    const combined = [
      ...checking.map((tx) => ({ ...tx, account: "Checking" })),
      ...savings.map((tx) => ({ ...tx, account: "Savings" })),
    ];

    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(combined);
  })
);

// ---------------- INTERNAL TRANSFER ----------------
router.post(
  "/:id/transfer",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { from, to, amount } = req.body;

    if (!from || !to || typeof amount !== "number" || from === to || amount <= 0) {
      return res.status(400).json({ error: "Invalid transfer parameters" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.accounts[from] || !user.accounts[to]) {
      return res.status(400).json({ error: "Invalid account type" });
    }

    if (user.accounts[from].balance < amount) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    user.accounts[from].balance -= amount;
    user.accounts[to].balance += amount;

    user.accounts[from].transactions.push({
      date: new Date(),
      type: "Debit",
      amount,
      description: `Transfer to ${to}`,
      balanceAfter: user.accounts[from].balance,
    });
    user.accounts[to].transactions.push({
      date: new Date(),
      type: "Credit",
      amount,
      description: `Transfer from ${from}`,
      balanceAfter: user.accounts[to].balance,
    });

    await user.save();
    res.json({ success: true, accounts: user.accounts });
  })
);

// ---------------- ZELLE TRANSFER ----------------
router.post(
  "/:id/zelle",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { recipient, amount, from } = req.body;

    if (!recipient || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid Zelle transfer parameters" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.accounts[from]) return res.status(400).json({ error: "Invalid account" });
    if (user.accounts[from].balance < amount) return res.status(400).json({ error: "Insufficient funds" });

    user.accounts[from].balance -= amount;
    user.accounts[from].transactions.push({
      date: new Date(),
      type: "Zelle",
      amount,
      description: `Zelle transfer to ${recipient}`,
      balanceAfter: user.accounts[from].balance,
    });

    await user.save();
    res.json({ success: true, accounts: user.accounts });
  })
);

// ---------------- WIRE TRANSFER ----------------
router.post(
  "/:id/wire",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { recipientName, bankName, accountNumber, routing, amount } = req.body;

    if (!recipientName || !bankName || !accountNumber || !routing || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid wire transfer parameters" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.accounts.checking.balance < amount) return res.status(400).json({ error: "Insufficient funds" });

    user.accounts.checking.balance -= amount;
    user.accounts.checking.transactions.push({
      date: new Date(),
      type: "Wire",
      amount,
      description: `Wire to ${recipientName} (${bankName})`,
      balanceAfter: user.accounts.checking.balance,
    });

    await user.save();
    res.json({ success: true, accounts: user.accounts });
  })
);

// ---------------- BILL PAY ----------------
router.post(
  "/:id/billpay",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { payee, accountNumber, amount } = req.body;

    if (!payee || !accountNumber || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid bill pay parameters" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.accounts.checking.balance < amount) return res.status(400).json({ error: "Insufficient funds" });

    user.accounts.checking.balance -= amount;
    user.accounts.checking.transactions.push({
      date: new Date(),
      type: "Bill Pay",
      amount,
      description: `Bill paid to ${payee}`,
      balanceAfter: user.accounts.checking.balance,
    });

    await user.save();
    res.json({ success: true, accounts: user.accounts });
  })
);

// ---------------- EXTERNAL TRANSFER ----------------
router.post(
  "/:id/external",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { recipientName, bankName, accountNumber, routing, amount } = req.body;

    if (!recipientName || !bankName || !accountNumber || !routing || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Invalid external transfer parameters" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.accounts.checking.balance < amount) return res.status(400).json({ error: "Insufficient funds" });

    user.accounts.checking.balance -= amount;
    user.accounts.checking.transactions.push({
      date: new Date(),
      type: "External Transfer",
      amount,
      description: `External transfer to ${recipientName} (${bankName})`,
      balanceAfter: user.accounts.checking.balance,
    });

    await user.save();
    res.json({ success: true, accounts: user.accounts });
  })
);

export default router;
