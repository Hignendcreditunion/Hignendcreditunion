// routes/admin.js - Keep only if you want separate admin route file
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Admin middleware (you can remove this if using the one from app.js)

// Other admin routes can go here in the future
// For now, the transfer logic is in app.js

module.exports = router;