const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const auth = require('./routes/auth');
const dash = require('./routes/dashboard');

const app = express();
const port = process.env.PORT || 3006;
const db = process.env.DB;
const sauce = process.env.sauce;

// Validate environment variables
if (!db || !sauce) {
    console.error('Error: Missing environment variables. Ensure .env is properly configured.');
    process.exit(1);
}

// Connect to MongoDB
mongoose.connect(db, { dbName: 'TaskFlowDB' })
    .then(() => console.log('Connected to MongoDB TaskFlowDB'))
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*', // Allow all origins during development
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true // Set to false if you don't need cookies/auth headers
}));

app.use(morgan('dev'));

// Routes
app.use('/auth', auth);
app.use('/dashboard', dash);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

// Start the server
app.listen(port, () => console.log(`Server running on port ${port}`));