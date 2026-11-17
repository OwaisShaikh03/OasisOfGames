const mongoose = require("mongoose");

// One review per user per game: a star rating plus an optional comment
const reviewSchema = new mongoose.Schema(
  {
    game: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

reviewSchema.index({ game: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);