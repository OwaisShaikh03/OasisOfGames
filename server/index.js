require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const security = require("./middleware/security");
const path = require("path");
const fs = require("fs");

const app = express();
app.disable("x-powered-by");
// Behind Render's proxy, use the real visitor address (needed for rate limits and the bandwidth simulation)
if (process.env.RENDER || process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(security.cors());
app.use(express.json({ limit: "100kb" }));
app.use("/api", security.apiHeaders, security.noOperatorKeys, security.apiLimiter);
app.use("/api/auth/login", security.loginLimiter);
app.use("/api/auth/register", security.registerLimiter);
app.use("/api/upload", security.uploadLimiter);
app.use("/api/reviews", security.reviewLimiter);

const { plain, simulated } = require("./middleware/builds");
app.use("/builds", plain());
app.use("/sim/fresh/builds", plain({ fresh: true }));
app.use("/sim/fast4g/builds", simulated({ mbps: 8, latencyMs: 170 }));
app.use("/sim/slow4g/builds", simulated({ mbps: 1.6, latencyMs: 400 }));
app.use("/thumbnails", express.static(path.join(__dirname, "public", "thumbnails")));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/games", require("./routes/games"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/metrics", require("./routes/metrics"));
app.use("/api/tests", require("./routes/tests"));
app.use("/api/analysis", require("./routes/analysis"));
app.use("/api/reviews", require("./routes/reviews"));

app.get("/", (req, res) => res.send("API is running"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("DB connection error:", err.message));