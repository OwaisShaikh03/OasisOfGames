const mongoose = require("mongoose");

const buildSchema = new mongoose.Schema(
  {
    version: { type: String, enum: ["unoptimized", "optimized"], required: true },
    path: { type: String, required: true }, // folder or URL of the WebGL build
    sizeBytes: { type: Number, default: 0 },
    compression: { type: String, enum: ["none", "gzip", "brotli"], default: "none" },
    notes: { type: String, default: "" }, // e.g. "texture compression ASTC, code stripping on"
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    rejectReason: { type: String, default: "" },
    description: { type: String, default: "" },
    category: { type: String, default: "General" },
    dimension: { type: String, enum: ["2D", "3D"], required: true },
    complexity: { type: String, enum: ["light", "medium", "heavy"], default: "light" },
    thumbnail: { type: String, default: "" },
    source: { type: String, default: "" }, // "self-built" or the link/license
    builds: [buildSchema],
    // Performance budget for the optimized build (null = not set)
    budget: {
      maxSizeMB: { type: Number, default: null },
      maxLoadSec: { type: Number, default: null },
    },
    playCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);