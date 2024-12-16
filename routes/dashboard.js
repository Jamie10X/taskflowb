const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const Joi = require('joi');
require('dotenv').config();

const jwtSecret = process.env.sauce; // Secret key for JWT authentication

// Validation schema for task inputs using Joi
const taskValidationSchema = Joi.object({
    task: Joi.string().required(), // Task name is required
    desc: Joi.string().optional(), // Optional description
    start: Joi.date().required(), // Start date is required
    finish: Joi.date().greater(Joi.ref('start')).required(), // Finish date must be later than start date
    color: Joi.string().optional().default('#000000'), // Optional color with a default value
    status: Joi.string().valid('Todo', 'In Progress', 'Done').required(), // Valid statuses for a task
});

// Middleware to verify the token for authentication
const verifyToken = (req, res, next) => {
    console.log('Verifying token for request.');
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        console.error('Authorization header missing.');
        return res.status(403).json({ message: 'Authorization header missing' });
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer' || !tokenParts[1]) {
        console.error('Invalid authorization header format.');
        return res.status(403).json({ message: 'Invalid authorization header format' });
    }

    const token = tokenParts[1];

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.userId = decoded.id; // Attach the decoded user ID to the request
        console.log(`Token verification successful for user ID: ${decoded.id}`);
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Route to create a new task
router.post('/task', verifyToken, async (req, res) => {
    console.log('Received request to create a new task.');
    const { error, value } = taskValidationSchema.validate(req.body);

    if (error) {
        console.error(`Validation error while creating task: ${error.details[0].message}`);
        return res.status(400).json({ message: `Validation error: ${error.details[0].message}` });
    }

    try {
        const newTask = new Task({
            ...value, // Spread the validated fields into the new task
            creator: req.userId, // Attach the user ID to the task
        });

        const savedTask = await newTask.save();
        console.log(`Task '${savedTask.task}' created successfully by user ID: ${req.userId}`);
        res.status(200).json({ message: 'Task created successfully', task: savedTask });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
});

// Route to fetch all tasks for the logged-in user
router.get('/tasks', verifyToken, async (req, res) => {
    console.log(`Fetching tasks for user ID: ${req.userId}`);
    let { page = 1, limit = 10 } = req.query; // Pagination parameters

    // Validate and convert pagination parameters to integers
    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;

    try {
        const tasks = await Task.find({ creator: req.userId })
            .skip((page - 1) * limit) // Skip records for pagination
            .limit(limit); // Limit the number of records returned

        const totalTasks = await Task.countDocuments({ creator: req.userId }); // Count the total number of tasks

        console.log(`Fetched ${tasks.length} tasks out of ${totalTasks} for user ID: ${req.userId}`);
        res.status(200).json({
            tasks,
            total: totalTasks,
            page,
            limit,
            totalPages: Math.ceil(totalTasks / limit),
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to update a task
router.put('/task/:id', verifyToken, async (req, res) => {
    const { id } = req.params; // Extract task ID from request parameters
    console.log(`Request to update task ID: ${id}`);
    const { error, value } = taskValidationSchema.validate(req.body, { allowUnknown: true }); // Validate inputs

    if (error) {
        console.error(`Validation error while updating task ID ${id}: ${error.details[0].message}`);
        return res.status(400).json({ message: `Validation error: ${error.details[0].message}` });
    }

    try {
        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, creator: req.userId }, // Match task by ID and user ID
            value, // Apply the validated updates
            { new: true } // Return the updated task
        );

        if (!updatedTask) {
            console.error(`Task ID ${id} not found or unauthorized for user ID: ${req.userId}`);
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        console.log(`Task ID ${id} updated successfully for user ID: ${req.userId}`);
        res.status(200).json({ message: 'Task updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to delete a task
router.delete('/task/:id', verifyToken, async (req, res) => {
    const { id } = req.params; // Extract task ID from request parameters
    console.log(`Request to delete task ID: ${id}`);

    try {
        const deletedTask = await Task.findOneAndDelete({ _id: id, creator: req.userId }); // Match task by ID and user ID

        if (!deletedTask) {
            console.error(`Task ID ${id} not found or unauthorized for user ID: ${req.userId}`);
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        console.log(`Task ID ${id} deleted successfully for user ID: ${req.userId}`);
        res.status(200).json({ message: 'Task deleted successfully', task: deletedTask });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to search for tasks
router.get('/search', verifyToken, async (req, res) => {
    console.log(`Search request received for user ID: ${req.userId}`);
    const { status, startDate, endDate, keyword } = req.query; // Extract query parameters

    const query = { creator: req.userId }; // Match tasks created by the logged-in user
    if (status) query.status = mongoose.Types.String(status); // Filter by status if provided
    if (startDate) query.start = { $gte: new Date(startDate) }; // Filter by start date
    if (endDate) query.finish = { $lte: new Date(endDate) }; // Filter by finish date
    if (keyword) {
        const sanitizedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special characters
        query.task = { $regex: sanitizedKeyword, $options: 'i' }; // Case-insensitive search by task name
    }

    try {
        const tasks = await Task.find(query); // Perform the search query
        console.log(`Search completed. Found ${tasks.length} tasks for user ID: ${req.userId}`);
        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error searching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
