// User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Unique username for the user
    email: { type: String, required: true, unique: true }, // Unique email for the user
    password: { type: String, required: true }, // Hashed password stored securely
    created_at: { type: Date, default: Date.now } // Timestamp for when the user was created
});

// Define indexes to optimize query performance
userSchema.index({ email: 1 }); // Index on email
userSchema.index({ username: 1 }); // Index on username
userSchema.index({ email: 1, username: 1 }); // Compound index on email and username

// Middleware to hash the password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next(); // Skip if password is not modified
    try {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
        console.log('Hashing password for user:', this.username);
        this.password = await bcrypt.hash(this.password, saltRounds);
        console.log('Password hashed successfully for user:', this.username);
        next();
    } catch (err) {
        console.error('Error hashing password:', err);
        next(err);
    }
});

module.exports = mongoose.model("User", userSchema);