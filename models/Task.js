const mongoose = require('mongoose');
const Joi = require('joi'); // Import Joi for validation
const logger = require('winston'); // Import logging library

// Task schema for MongoDB
const taskSchema = new mongoose.Schema({
    task: { type: String, required: true }, // Name of the task, mandatory field
    desc: { type: String }, // Optional task description for additional details
    status: {
        type: String, // Status of the task to track progress
        enum: ['Todo', 'In Progress', 'Done'], // Allowed values for task status
        default: 'Todo', // Default status when the task is created
        required: true // Ensure status is always provided
    },
    priority: {
        type: String, // Priority of the task to indicate importance
        enum: ['High', 'Medium', 'Low'], // Allowed values for task priority
        default: 'Medium', // Default priority value
        required: true // Ensure priority is always provided
    },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who created the task
    created_at: { type: Date, default: Date.now }, // Automatically record the creation timestamp
    start: { type: Date, required: true }, // Start date of the task, must be specified
    finish: { type: Date, required: true }, // Finish date of the task, must be specified
    color: { type: String, default: '#000000' }, // Optional color tag for visual representation
    finished_at: { type: Date }, // Timestamp for when the task was marked as finished
    subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true }] // Array of references to subtasks with indexing for efficient lookups
});

// Add compound index on creator, status, and priority to optimize frequent queries
taskSchema.index({ creator: 1, status: 1, priority: 1 });
taskSchema.index({ subtasks: 1, status: 1 }); // Add index for optimizing queries on subtasks and status

// Middleware to validate that the finish date is not earlier than the start date
// This ensures data integrity for tasks
taskSchema.pre('save', function (next) {
    if (this.finish < this.start) {
        // Log an error if the finish date is earlier than the start date
        logger.error(`Validation failed for task '${this.task}' (ID: ${this._id}): start date (${this.start}) is later than finish date (${this.finish}).`);
        const err = new Error('Finish date must be later than start date');
        return next(err); // Stop the save operation if validation fails
    }
    if (!['High', 'Medium', 'Low'].includes(this.priority)) {
        // Log an error if the priority is invalid
        logger.error(`Validation failed for task '${this.task}' (ID: ${this._id}): invalid priority value '${this.priority}'.`);
        const err = new Error('Priority must be one of High, Medium, or Low');
        return next(err);
    }
    // Log success for passing validation
    logger.info(`Task '${this.task}' (ID: ${this._id}) passed validation for start, finish dates, and priority.`);
    next(); // Proceed with saving the task
});

// Automatically update parent task status when all subtasks are marked as done
// This ensures that the parent task reflects the correct overall progress
taskSchema.post('save', async function () {
    logger.info(`Post-save hook triggered for task '${this.task}' (ID: ${this._id}) with status '${this.status}'.`);
    if (this.status === 'Done') {
        const session = await mongoose.startSession(); // Start a session for transaction
        session.startTransaction(); // Begin a transaction
        try {
            // Log information about checking parent tasks
            logger.info(`Checking if task '${this.task}' (ID: ${this._id}) is a subtask.`);
            // Query to find the parent task that includes this task as a subtask
            const parentTask = await mongoose.model('Task').findOne({ subtasks: this._id }).session(session).exec();
            if (parentTask) {
                // Log the parent task found
                logger.info(`Parent task found for subtask '${this.task}' (ID: ${this._id}). Parent task ID: ${parentTask._id}`);
                // Count unfinished subtasks to decide if the parent task can be marked as done
                const unfinishedSubtasks = await mongoose.model('Task').countDocuments({ 
                    _id: { $in: parentTask.subtasks }, 
                    status: { $ne: 'Done' } 
                }).session(session).exec();
                // Log the count of unfinished subtasks
                logger.info(`Unfinished subtasks count for parent task (ID: ${parentTask._id}): ${unfinishedSubtasks}`);
                if (unfinishedSubtasks === 0) {
                    // Update the parent task status to 'Done'
                    parentTask.status = 'Done';
                    logger.info(`All subtasks completed. Updating parent task (ID: ${parentTask._id}) status to 'Done'.`);
                    await parentTask.save({ session }); // Save the updated parent task within the transaction
                }
            } else {
                // Log if no parent task is found
                logger.info(`No parent task found for subtask '${this.task}' (ID: ${this._id}).`);
            }
            await session.commitTransaction(); // Commit the transaction if all operations succeed
            logger.info(`Transaction committed successfully for task '${this.task}' (ID: ${this._id}).`);
        } catch (err) {
            // Rollback the transaction on error and log the failure
            await session.abortTransaction();
            logger.error(`Transaction failed while updating parent task for subtask '${this.task}' (ID: ${this._id}):`, err);
        } finally {
            session.endSession(); // End the session
            logger.info(`Session ended for task '${this.task}' (ID: ${this._id}).`);
        }
    }
});

// Joi validation schema for task data
// This schema ensures that all input data adheres to the required format and constraints
const taskValidationSchema = Joi.object({
    task: Joi.string().required(), // Task name is required
    desc: Joi.string().optional(), // Optional description
    start: Joi.date().required(), // Start date is required
    finish: Joi.date().greater(Joi.ref('start')).required(), // Finish date must be after start
    color: Joi.string().optional().default('#000000'), // Optional color with a default value
    status: Joi.string().valid('Todo', 'In Progress', 'Done').required(), // Valid statuses
    priority: Joi.string().valid('High', 'Medium', 'Low').default('Medium').required().custom((value, helpers) => {
        // Custom validation for priority field
        const validPriorities = ['High', 'Medium', 'Low'];
        if (!validPriorities.includes(value)) {
            return helpers.error('any.invalid');
        }
        return value; // Return the validated priority value
    }),
});

module.exports = {
    Task: mongoose.model('Task', taskSchema), // Export the Task model
    validateTask: (data) => taskValidationSchema.validate(data) // Export Joi validation function for task validation
};
