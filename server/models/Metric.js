const mongoose = require("mongoose");

const metricSchema = new mongoose.Schema(
  {
    buildPath: { type: String, required: true, index: true },
    loadTimeMs: Number,
    transferBytes: Number,
    decodedBytes: Number,
    avgFps: Number,
    minFps: Number,
    low1Fps: Number, // average FPS of the slowest 1% of frames (smoothness)
    frameCount: Number, // frames measured in the 10 s sample
    avgFrameMs: Number,
    jsHeapMB: Number,
    browser: String,
    deviceType: String,
    cores: Number,
    screen: String,
    userAgent: String,
    network: { type: String, default: "unspecified" },
    // Set only when the run came from a logged-in tester (verified by the server, never taken from the page)
    tester: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    testerName: { type: String, default: "" },
    verified: { type: Boolean, default: true },
    verifyNote: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Metric", metricSchema);