const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: String, required: true }, // "1-day", "1-week", "1-month"
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Subscription", SubscriptionSchema);
