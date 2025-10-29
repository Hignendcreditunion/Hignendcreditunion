// backup-users.js (CommonJS version)
const mongoose = require("mongoose");
const fs = require("fs");
const dotenv = require("dotenv");
const User = require("./models/User.js"); // your schema

dotenv.config();

const uri = process.env.MONGODB_URI;

async function backupUsers() {
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    const users = await User.find().lean();
    console.log(`📦 Found ${users.length} users in BankCluster`);

    const backupData = {
      timestamp: new Date(),
      users,
    };

    fs.writeFileSync("backup-users.json", JSON.stringify(backupData, null, 2));
    console.log("💾 Backup saved to backup-users.json");

    process.exit(0);
  } catch (err) {
    console.error("❌ Backup failed:", err);
    process.exit(1);
  }
}

backupUsers();
