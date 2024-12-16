const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    task: { type: String, required: true },
    desc: { type: String },
    status: {
        type: String,
        enum: ['Todo', 'In Progress', 'Done'], // Updated for consistency
        default: 'Todo',
        required: true
    },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    created_at: { type: Date, default: Date.now },
    start: { type: Date, required: true }, // Ensures start date is provided
    finish: { type: Date, required: true }, // Ensures finish date is provided
    color: { type: String, default: '#000000' }, // Default color value
    finished_at: { type: Date },
});

// Validate that finish date is not earlier than start date
taskSchema.pre('save', function (next) {
    if (this.finish < this.start) {
        const err = new Error('Finish date must be later than start date');
        return next(err);
    }
    next();
});

module.exports = mongoose.model("Task", taskSchema);
