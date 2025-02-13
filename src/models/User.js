const mongoose = require('mongoose');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    downloadsLeft: { type: Number, default: 2 }, // Default to 2 downloads
    subscriptionPlan: { type: String, default: null }, // "1-day", "1-week", "1-month"
    subscriptionExpiresAt: { type: Date, default: null }, // Expiry date of subscription
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
}, { timestamps: true });

UserSchema.methods.generateResetToken = function () {
    const resetToken = crypto.randomBytes(20).toString('hex');
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpires = Date.now() + Number(process.env.RESET_TOKEN_EXPIRY); // 10 min expiry
    return resetToken;
};

module.exports = mongoose.model("User", UserSchema);



