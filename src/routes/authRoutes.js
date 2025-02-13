const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

const router = express.Router();


// Token verification endpoint
router.get('/verify', require('../middleware/authMiddleware'), async (req, res) => {
    try {
        // Since your middleware adds the verified user to req.user, we can use it
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            valid: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Server error while verifying token" });
    }
});
// **🔹 User Registration Route**
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required." });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: "Email is already registered." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: "Registration successful. Please log in." });
    } catch (error) {
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// **🔹 User Login Route**
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Incorrect password." });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" });

        res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// **🔹 Forgot Password Route**
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User with this email does not exist." });
        }

        const resetToken = user.generateResetToken();
        await user.save();

        const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        const message = `Click the link to reset your password: ${resetLink}\n\nThis link is valid for 10 minutes.`;

        await sendEmail(user.email, "Password Reset Request", message);

        res.json({ message: "Password reset link sent to your email." });
    } catch (error) {
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

// **🔹 Reset Password Route**
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password } = req.body;
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        if (!password) {
            return res.status(400).json({ error: "New password is required." });
        }

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired token." });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: "Password reset successful. You can now log in." });
    } catch (error) {
        res.status(500).json({ error: "Server error. Please try again later." });
    }
});

module.exports = router;
