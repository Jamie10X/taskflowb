// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const rateLimit = require('express-rate-limit');

const jwtSecret = process.env.sauce;

// Rate limit middleware for login/signup
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes lockout period
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { message: 'Too many login/signup attempts. Please try again after 15 minutes.' }
});

// Route for user signup
router.post('/signup', authRateLimiter, async (req, res) => {
    const { username, email, password } = req.body;

    console.log('Signup request received:', { username, email });
    try {
        // Check if the username or email already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            console.log('Signup failed: Username or email already exists');
            return res.status(403).json({ message: 'Username or email already exists' });
        }

        // Create user with plain password; pre('save') middleware will handle hashing
        const user = new User({ username, email, password });
        await user.save();

        console.log('User created successfully:', username);
        res.status(200).json({ message: 'Signup successful' });
    } catch (error) {
        console.error('Error during signup process:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route for user signin
router.post('/signin', authRateLimiter, async (req, res) => {
    const { email, password } = req.body;
    console.log('Signin request received:', { email });
    try {
        if (!email || !password) {
            console.log('Signin failed: Email or password missing');
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            console.log('Signin failed: User not found');
            return res.status(403).json({ message: 'Invalid credentials' });
        }

        // Compare raw password with stored hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Signin failed: Password mismatch');
            return res.status(403).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.sauce,
            { expiresIn: '1h' }
        );

        console.log('Signin successful, token generated for:', user.username);
        res.status(200).json({ token, username: user.username });
    } catch (error) {
        console.error('Error during signin:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;