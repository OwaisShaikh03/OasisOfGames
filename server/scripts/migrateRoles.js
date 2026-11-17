// One-time: turns every account that has no valid role (the old "user" role) into a player.
// Developers, testers and admins are left exactly as they are. Safe to run more than once.
//   node scripts/migrateRoles.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const valid = ["player", "tester", "developer", "admin"];
    const filter = { role: { $nin: valid } };
    const count = await User.countDocuments(filter);
    console.log(`${count} account(s) with the old role found.`);
    if (count) {
      const result = await User.updateMany(filter, { $set: { role: "player" } });
      console.log(`${result.modifiedCount} account(s) changed to player.`);
    }
    const rows = await User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    console.log("Accounts by role now:", rows.map((r) => `${r._id}: ${r.n}`).join(", "));
  } catch (err) {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();