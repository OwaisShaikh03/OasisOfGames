const express = require("express");
const mongoose = require("mongoose");
const Game = require("../models/Game");
const Review = require("../models/Review");
const User = require("../models/User");
const audit = require("../utils/audit");
const { protect, optionalAuth } = require("../middleware/auth");

const router = express.Router();
const MAX_TEXT = 500;
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const hiddenStatus = (g) => ["pending", "rejected"].includes(g.status);

// A game whose reviews may be seen: approved ones, or any game for its owner or an admin
async function findVisibleGame(id, user) {
  if (!isId(id)) return null;
  const game = await Game.findById(id).select("status createdBy");
  if (!game) return null;
  const manages = user && (user.role === "admin" || String(game.createdBy) === user.id);
  return hiddenStatus(game) && !manages ? null : game;
}

// Average and number of ratings for every game (used on the game cards)
router.get("/stats", async (req, res) => {
  try {
    const rows = await Review.aggregate([
      { $group: { _id: "$game", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    res.json(Object.fromEntries(rows.map((r) => [String(r._id), { avg: +r.avg.toFixed(1), count: r.count }])));
  } catch {
    res.status(400).json({ message: "Could not load ratings" });
  }
});

// Summary and reviews for one game. Anyone can read; a logged-in user also gets "mine".
router.get("/game/:gameId", optionalAuth, async (req, res) => {
  try {
    const game = await findVisibleGame(req.params.gameId, req.user);
    if (!game) return res.status(404).json({ message: "Game not found" });

    const groups = await Review.aggregate([
      { $match: { game: game._id } },
      { $group: { _id: "$rating", n: { $sum: 1 } } },
    ]);
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    groups.forEach((g) => { breakdown[g._id] = g.n; });
    const count = Object.values(breakdown).reduce((s, n) => s + n, 0);
    const total = Object.entries(breakdown).reduce((s, [stars, n]) => s + Number(stars) * n, 0);

    const rows = await Review.find({ game: game._id })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("user", "username")
      .lean();

    res.json({
      average: count ? +(total / count).toFixed(1) : 0,
      count,
      breakdown,
      reviews: rows.map((r) => ({
        _id: r._id,
        rating: r.rating,
        text: r.text,
        username: r.user?.username || "Former member",
        createdAt: r.createdAt,
        mine: !!(req.user && r.user && String(r.user._id) === req.user.id),
      })),
    });
  } catch {
    res.status(400).json({ message: "Could not load reviews" });
  }
});

// Add or update your own review (login required)
router.post("/game/:gameId", protect, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ message: "Choose a rating from 1 to 5 stars" });
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (text.length > MAX_TEXT)
      return res.status(400).json({ message: `Comments can be up to ${MAX_TEXT} characters` });

    const game = await findVisibleGame(req.params.gameId, req.user);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (hiddenStatus(game))
      return res.status(400).json({ message: "Reviews open once the game is approved" });
    if (String(game.createdBy) === req.user.id)
      return res.status(403).json({ message: "You cannot rate your own game" });

    const review = await Review.findOneAndUpdate(
      { game: game._id, user: req.user.id },
      { rating, text },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({ _id: review._id });
  } catch {
    res.status(400).json({ message: "Could not save your review" });
  }
});

// Delete a review: its author or an admin
router.delete("/:reviewId", protect, async (req, res) => {
  try {
    if (!isId(req.params.reviewId)) return res.status(404).json({ message: "Review not found" });
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (req.user.role !== "admin" && String(review.user) !== req.user.id)
      return res.status(403).json({ message: "Not allowed" });
    await review.deleteOne();
    // Only record moderation (an admin removing someone else's review), not people removing their own
    if (String(review.user) !== req.user.id) {
      const [author, game] = await Promise.all([
        User.findById(review.user).select("username"),
        Game.findById(review.game).select("title"),
      ]);
      await audit.record(req, "review.delete", { type: "review", id: review._id, label: game ? game.title : "deleted game" },
        `review by ${author ? author.username : "a former member"} (${review.rating} stars)`);
    }
    res.json({ message: "Review deleted" });
  } catch {
    res.status(400).json({ message: "Could not delete the review" });
  }
});

module.exports = router;