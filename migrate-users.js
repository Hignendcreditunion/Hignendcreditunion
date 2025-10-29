// migrate-users.js (CommonJS version)
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("./models/User");

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ MONGODB_URI environment variable not set.");
  process.exit(1);
}

const overwrite = process.argv.includes("--overwrite");

async function migrate() {
  try {
    // Connect to BankCluster
    await mongoose.connect(uri);
    console.log("✅ Connected to BankCluster");

    // Create connection to test DB
    const testUri = uri.replace("BankCluster", "test");
    const testConn = await mongoose.createConnection(testUri);
    const TestUser = testConn.model("User", User.schema, "users");

    // Load users from test DB
    const testUsers = await TestUser.find();
    console.log(`📦 Found ${testUsers.length} users in test DB`);

    for (const user of testUsers) {
      try {
        const existing = await User.findOne({ email: user.email });

        // Ensure password hash is preserved
        const password = (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"))
          ? user.password
          : await bcrypt.hash(user.password, 10);

        if (existing) {
          if (overwrite) {
            existing.name = user.name;
            existing.username = user.username;
            existing.password = password;
            existing.status = user.status || "active";
            existing.accounts = user.accounts;
            await existing.save();
            console.log(`🔄 Updated user: ${user.email}`);
          } else {
            console.log(`⏩ Skipped existing user: ${user.email}`);
          }
        } else {
          const newUser = new User({
            name: user.name,
            email: user.email.toLowerCase(),
            username: user.username,
            password,
            status: user.status || "active",
            accounts: user.accounts,
          });
          await newUser.save();
          console.log(`✅ Imported user: ${user.email}`);
        }
      } catch (err) {
        console.error(`❌ Error migrating user ${user.email}:`, err.message);
      }
    }

    console.log("🎉 Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
