// User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

// Hash the password before saving
userSchema.pre('save', async function (next) {
    console.log('Hashing password for user:', this.username);
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        console.log('Generated salt for password hashing');
        this.password = await bcrypt.hash(this.password, salt);
        console.log('Password hashed successfully');
        next();
    } catch (err) {
        console.error('Error hashing password:', err);
        next(err);
    }
});

module.exports = mongoose.model("User", userSchema);