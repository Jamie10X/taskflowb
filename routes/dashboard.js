const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
require('dotenv').config();

const sauce = process.env.sauce;

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(403).json({ message: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'Token missing in authorization header' });
    }

    try {
        const decoded = jwt.verify(token, sauce);
        req.userId = decoded.id;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(403).json({ message: 'Invalid token' });
    }
};

// Create a new task
router.post('/task', verifyToken, async (req, res) => {
    const { task, desc, start, finish, color, status } = req.body;

    // Validate required fields
    if (!task || !start || !finish || !status) {
        return res.status(400).json({ message: 'Missing required fields: task, start, finish, or status' });
    }

    try {
        const newTask = new Task({
            task,
            desc,
            start: new Date(start), // Ensure dates are stored as Date objects
            finish: new Date(finish),
            color,
            status,
            creator: req.userId,
        });

        const savedTask = await newTask.save();
        res.status(200).json({ message: 'Task created successfully', task: savedTask });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get all tasks for the logged-in user
router.get('/tasks', verifyToken, async (req, res) => {
    try {
        const tasks = await Task.find({ creator: req.userId });
        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update a task
router.put('/task/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, creator: req.userId },
            updates,
            { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        res.status(200).json({ message: 'Task updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete a task
router.delete('/task/:id', verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        const deletedTask = await Task.findOneAndDelete({ _id: id, creator: req.userId });

        if (!deletedTask) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        res.status(200).json({ message: 'Task deleted successfully', task: deletedTask });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Search tasks
router.get('/search', verifyToken, async (req, res) => {
    const { status, startDate, endDate, keyword } = req.query;

    const query = { creator: req.userId };
    if (status) query.status = status;
    if (startDate) query.start = { $gte: new Date(startDate) };
    if (endDate) query.finish = { $lte: new Date(endDate) };
    if (keyword) query.task = { $regex: keyword, $options: 'i' };

    try {
        const tasks = await Task.find(query);
        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error searching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;