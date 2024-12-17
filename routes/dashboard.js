const mongoose = require('mongoose');
const Joi = require('joi'); // Import Joi for validation
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Task, validateTask } = require('../models/Task'); // Import Task model and validation
require('dotenv').config();

const jwtSecret = process.env.sauce; // Secret key for JWT authentication

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
    const { error, value } = validateTask(req.body);

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

// Route to fetch all tasks for the logged-in user, sorted by priority
router.get('/tasks', verifyToken, async (req, res) => {
    console.log(`Fetching tasks for user ID: ${req.userId}`);
    let { page = 1, limit = 10 } = req.query; // Pagination parameters

    page = parseInt(page);
    limit = parseInt(limit);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;

    try {
        const tasks = await Task.find({ creator: req.userId })
            .sort({ priority: -1, created_at: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalTasks = await Task.countDocuments({ creator: req.userId });
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

// Route to create a subtask
router.post('/task/:id/subtask', verifyToken, async (req, res) => {
    const { id } = req.params;
    console.log(`Request to create subtask for parent task ID: ${id}`);
    const { error, value } = validateTask(req.body);

    if (error) {
        console.error(`Validation error while creating subtask: ${error.details[0].message}`);
        return res.status(400).json({ message: `Validation error: ${error.details[0].message}` });
    }

    try {
        const parentTask = await Task.findById(id);
        if (!parentTask) {
            console.error(`Parent task ID ${id} not found.`);
            return res.status(404).json({ message: 'Parent task not found' });
        }

        const subtask = new Task({
            ...value,
            creator: req.userId,
        });
        const savedSubtask = await subtask.save();

        parentTask.subtasks.push(savedSubtask._id);
        await parentTask.save();

        console.log(`Subtask '${savedSubtask.task}' created and added to parent task ID: ${id}`);
        res.status(200).json({ message: 'Subtask created successfully', subtask: savedSubtask });
    } catch (error) {
        console.error('Error creating subtask:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to fetch subtasks for a specific task
router.get('/task/:id/subtasks', verifyToken, async (req, res) => {
    const { id } = req.params;
    console.log(`Fetching subtasks for parent task ID: ${id}`);

    try {
        const task = await Task.findById(id).populate('subtasks');
        if (!task) {
            console.error(`Task ID ${id} not found.`);
            return res.status(404).json({ message: 'Task not found' });
        }

        console.log(`Fetched ${task.subtasks.length} subtasks for task ID: ${id}`);
        res.status(200).json({ subtasks: task.subtasks });
    } catch (error) {
        console.error('Error fetching subtasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to update a task
router.put('/task/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    console.log(`Request to update task ID: ${id}`);

    const { error, value } = validateTask(req.body);
    if (error) {
        console.error(`Validation error: ${error.details[0].message}`);
        return res.status(400).json({ message: `Validation error: ${error.details[0].message}` });
    }

    try {
        const updatedTask = await Task.findOneAndUpdate(
            { _id: id, creator: req.userId },
            value,
            { new: true }
        );

        if (!updatedTask) {
            console.error(`Task not found or unauthorized: ${id}`);
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        console.log(`Task ID ${id} updated successfully.`);
        res.status(200).json({ message: 'Task updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to delete a task
router.delete('/task/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    console.log(`Request to delete task ID: ${id}`);

    try {
        const deletedTask = await Task.findOneAndDelete({ _id: id, creator: req.userId });
        if (!deletedTask) {
            console.error(`Task not found or unauthorized: ${id}`);
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }

        console.log(`Task ID ${id} deleted successfully.`);
        res.status(200).json({ message: 'Task deleted successfully', task: deletedTask });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to delete a subtask
router.delete('/task/:parentId/subtask/:subtaskId', verifyToken, async (req, res) => {
    const { parentId, subtaskId } = req.params;
    console.log(`Request to delete subtask ID: ${subtaskId} from parent task ID: ${parentId}`);

    try {
        const parentTask = await Task.findById(parentId);
        if (!parentTask) {
            console.error(`Parent task ID ${parentId} not found.`);
            return res.status(404).json({ message: 'Parent task not found' });
        }

        const subtaskIndex = parentTask.subtasks.indexOf(subtaskId);
        if (subtaskIndex === -1) {
            console.error(`Subtask ID ${subtaskId} not found in parent task ID: ${parentId}`);
            return res.status(404).json({ message: 'Subtask not found in parent task' });
        }

        parentTask.subtasks.splice(subtaskIndex, 1); // Remove the subtask reference
        await parentTask.save();

        const deletedSubtask = await Task.findOneAndDelete({ _id: subtaskId, creator: req.userId });
        if (!deletedSubtask) {
            console.error(`Subtask ID ${subtaskId} not found or unauthorized.`);
            return res.status(404).json({ message: 'Subtask not found or unauthorized' });
        }

        console.log(`Subtask ID ${subtaskId} deleted successfully from parent task ID: ${parentId}`);
        res.status(200).json({ message: 'Subtask deleted successfully', subtask: deletedSubtask });
    } catch (error) {
        console.error('Error deleting subtask:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to search for tasks with priority filtering
router.get('/search', verifyToken, async (req, res) => {
    console.log(`Search request received for user ID: ${req.userId}`);
    const { status, startDate, endDate, keyword, priority } = req.query;

    const query = { creator: req.userId };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (startDate) query.start = { $gte: new Date(startDate) };
    if (endDate) query.finish = { $lte: new Date(endDate) };
    if (keyword) query.task = { $regex: keyword, $options: 'i' };

    try {
        const tasks = await Task.find(query).sort({ priority: -1, created_at: -1 });
        console.log(`Search completed. Found ${tasks.length} tasks.`);
        res.status(200).json({ tasks });
    } catch (error) {
        console.error('Error searching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;

