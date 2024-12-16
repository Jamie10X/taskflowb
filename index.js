const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3006; // Define the port, defaulting to 3006
const db = process.env.DB; // MongoDB connection string from environment
const sauce = process.env.sauce; // Secret key for authentication

// Validate environment variables
if (!db || !sauce) {
    // Log specific missing variables for clarity
    if (!db) console.error('Error: Missing environment variable DB. Ensure .env is properly configured.');
    if (!sauce) console.error('Error: Missing environment variable sauce. Ensure .env is properly configured.');
    process.exit(1); // Exit the application if required variables are missing
} else {
    console.log('✅ Environment variables validated successfully.');
}

// Connect to MongoDB with retry mechanism
const connectWithRetry = () => {
    console.log('Attempting to connect to MongoDB...');
    mongoose.connect(db, {
        dbName: 'TaskFlowDB', // Set the database name
        useNewUrlParser: true, // Use new URL parser to handle connection strings
        useUnifiedTopology: true, // Use unified topology engine for better connection handling
    })
        .then(() => console.log('✅ Connected to MongoDB TaskFlowDB')) // Log success message
        .catch(err => {
            console.error('❌ MongoDB connection error:', err); // Log connection error
            console.log('Retrying connection in 5 seconds...');
            setTimeout(connectWithRetry, 5000); // Retry connection after 5 seconds
        });
};

connectWithRetry(); // Initialize MongoDB connection with retry mechanism

// Middleware
console.log('Setting up middleware...');
app.use(express.json()); // Parse incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', // Allow all origins in development; restrict in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    credentials: true // Include credentials (cookies/auth headers) in requests
}));
app.use(morgan('dev')); // Log HTTP requests in development

// Lazy-loaded Routes
console.log('Configuring routes...');
app.use('/auth', (req, res, next) => {
    console.log('Lazy-loading /auth route.');
    import('./routes/auth') // Dynamically import the auth route
        .then(module => module.default(req, res, next)) // Pass request and response to the route
        .catch(next); // Pass errors to the global error handler
});

app.use('/dashboard', (req, res, next) => {
    console.log('Lazy-loading /dashboard route.');
    import('./routes/dashboard') // Dynamically import the dashboard route
        .then(module => module.default(req, res, next)) // Pass request and response to the route
        .catch(next); // Pass errors to the global error handler
});

// Handle undefined routes
app.use((req, res, next) => {
    console.warn(`404 - Resource not found for ${req.method} ${req.originalUrl}`); // Log 404 errors with request details
    res.status(404).json({ message: 'Resource not found' }); // Return a 404 error response
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack || err); // Log the error stack for debugging
    const statusCode = err.status || 500; // Default to 500 if no status is set

    if (statusCode >= 400 && statusCode < 500) {
        console.error('Client error:', err.message); // Log client errors (4xx)
        res.status(statusCode).json({ message: err.message || 'Client error' }); // Return client error response
    } else {
        console.error('Server error:', err.message); // Log server errors (5xx)
        res.status(statusCode).json({ message: err.message || 'Internal server error' }); // Return server error response
    }
});

// Start the server
app.listen(port, () => console.log(`🚀 Server running on port ${port}`)); // Log server start with port
