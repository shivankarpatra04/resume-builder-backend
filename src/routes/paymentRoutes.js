const express = require('express');
const dotenv = require('dotenv');
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const User = require("../models/User");  // Assuming this is the User model
const Subscription = require("../models/Subscription");
const crypto = require('crypto');

dotenv.config();

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
});

const subscriptionPlans = {
    "1-day": { amount: 1000, duration: 1 },
    "1-week": { amount: 5000, duration: 7 },
    "1-month": { amount: 15000, duration: 30 }
};

// Middleware to Check Authentication
const authMiddleware = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) {
        return res.status(401).json({ error: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid token." });
    }
};

// Create Order for Subscription
router.post('/create-order', authMiddleware, async (req, res) => {
    const { plan } = req.body;
    if (!plan || !subscriptionPlans[plan]) {
        return res.status(400).json({ error: "Invalid or missing subscription plan." });
    }

    const options = {
        amount: subscriptionPlans[plan].amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1,
        notes: { plan_name: plan }
    };

    try {
        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to create order" });
    }
});

/// ✅ Verify Payment and Activate Subscription
router.post('/verify-payment', authMiddleware, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Payment verification failed." });
    }

    const duration = subscriptionPlans[plan].duration;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + duration);

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Reset download count to unlimited when subscription is activated
    user.subscriptionPlan = plan;
    user.subscriptionExpiresAt = expiresAt;
    user.downloadsLeft = -1;  // Unlimited downloads after subscription
    await user.save();

    res.json({ success: true, message: "Subscription activated! Unlimited downloads unlocked." });
});

// Check User Subscription - updated to query the User model
router.get('/check-subscription', authMiddleware, async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user || !user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) < new Date()) {
        return res.json({ active: false, message: "No active subscription." });
    }

    res.json({
        active: true,
        plan: user.subscriptionPlan,
        expiresAt: user.subscriptionExpiresAt.toISOString(),
    });
});


// ✅ Check User Download Status
router.get('/check-downloads', authMiddleware, async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const isSubscribed = user.subscriptionPlan && new Date(user.subscriptionExpiresAt) > new Date();
    const remainingDownloads = isSubscribed ? -1 : user.downloadsLeft;  // Unlimited downloads if subscribed

    const locked = remainingDownloads <= 0 && !isSubscribed;

    res.json({
        remainingDownloads,
        locked,
        message: isSubscribed
            ? "You have unlimited downloads with an active subscription."
            : `You have ${remainingDownloads} downloads left.`
    });
});




// ✅ Increment Download Count (Decrement when user downloads)
router.post('/increment-download', authMiddleware, async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    if (user.downloadsLeft === -1) {
        // If the user has unlimited downloads, don't decrement the download count
        return res.json({ success: true, remainingDownloads: -1 }); // Unlimited downloads
    }

    if (user.downloadsLeft > 0) {
        user.downloadsLeft -= 1;  // Decrease the download count
        await user.save();
        return res.json({ success: true, remainingDownloads: user.downloadsLeft });
    } else {
        return res.status(400).json({ error: "Download limit reached. Please subscribe." });
    }
});


module.exports = router;
