require("dotenv").config();
console.log("Script started");
const mongoose = require("mongoose");
const Metric = require("../models/Metric");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    const prefix = process.argv[2];
    const unlabeled = { $or: [{ network: { $exists: false } }, { network: "unspecified" }] };

    if (!prefix) {
      const rows = await Metric.aggregate([
        {
          $group: {
            _id: "$buildPath",
            runs: { $sum: 1 },
            unlabeled: {
              $sum: { $cond: [{ $eq: [{ $ifNull: ["$network", "unspecified"] }, "unspecified"] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      if (!rows.length) console.log("No runs found in the database");
      rows.forEach((r) => console.log(r._id, "| runs:", r.runs, "| unlabeled:", r.unlabeled));
      console.log("\nTo label one game: node scripts/labelMetrics.js /builds/flap-runner/");
    } else {
      const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const a = await Metric.updateMany(
        { buildPath: re, ...unlabeled, loadTimeMs: { $gte: 5000 } },
        { $set: { network: "Fast 4G" } }
      );
      const b = await Metric.updateMany(
        { buildPath: re, ...unlabeled, loadTimeMs: { $lt: 5000 } },
        { $set: { network: "no throttle" } }
      );
      console.log("Fast 4G:", a.modifiedCount, " no throttle:", b.modifiedCount);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("Done");
  }
})();