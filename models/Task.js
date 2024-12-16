const mongoose = require('mongoose');
const Joi = require('joi');

// Task schema for MongoDB
const taskSchema = new mongoose.Schema({
    task: { type: String, required: true }, // Name of the task
    desc: { type: String }, // Optional task description
    status: {
        type: String, // Status of the task
        enum: ['Todo', 'In Progress', 'Done'], // Allowed values for task status
        default: 'Todo',
        required: true
    },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who created the task
    created_at: { type: Date, default: Date.now }, // Timestamp for when the task was created
    start: { type: Date, required: true }, // Start date of the task
    finish: { type: Date, required: true }, // Finish date of the task
    color: { type: String, default: '#000000' }, // Optional color tag for the task
    finished_at: { type: Date }, // Timestamp for when the task was marked as finished
});

// Middleware to validate that the finish date is not earlier than the start date
taskSchema.pre('save', function (next) {
    if (this.finish < this.start) {
        console.log(`Validation failed for task ${this.task}: finish date is earlier than start date.`);
        const err = new Error('Finish date must be later than start date');
        return next(err);
    }
    console.log(`Task ${this.task} passed validation for start and finish dates.`);
    next();
});

module.exports = mongoose.model("Task", taskSchema);