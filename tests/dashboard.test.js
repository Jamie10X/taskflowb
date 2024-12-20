const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // Import your Express app
require('dotenv').config();

describe('Dashboard Routes', () => {
    let token = '';
    let taskId = '';
    let subtaskId = '';

    const testUser = {
        email: 'testuser@example.com',
        password: 'Test@12345',
    };

    const testTask = {
        task: 'Test Task',
        desc: 'This is a test task',
        start: new Date(),
        finish: new Date(Date.now() + 1000 * 60 * 60 * 24),
        priority: 'High',
        status: 'Todo',
    };

    beforeAll(async () => {
        await mongoose.connect(process.env.DB);
        const res = await request(app).post('/auth/signin').send(testUser);
        token = res.body.token;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('POST /dashboard/task - should create a new task', async () => {
        const res = await request(app)
            .post('/dashboard/task')
            .set('Authorization', `Bearer ${token}`)
            .send(testTask);
        expect(res.statusCode).toBe(200);
        expect(res.body.task).toHaveProperty('_id');
        taskId = res.body.task._id;
    });

    test('POST /dashboard/task/:id/subtask - should create a subtask', async () => {
        const subtask = { ...testTask, task: 'Test Subtask' };
        const res = await request(app)
            .post(`/dashboard/task/${taskId}/subtask`)
            .set('Authorization', `Bearer ${token}`)
            .send(subtask);
        expect(res.statusCode).toBe(200);
        expect(res.body.subtask).toHaveProperty('_id');
        subtaskId = res.body.subtask._id;
    });

    test('GET /dashboard/task/:id/subtasks - should fetch subtasks', async () => {
        const res = await request(app)
            .get(`/dashboard/task/${taskId}/subtasks`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
        expect(res.body.subtasks.length).toBeGreaterThan(0);
    });

    test('PUT /dashboard/task/:id - should update a task', async () => {
        const updatedTask = { status: 'In Progress' };
        const res = await request(app)
            .put(`/dashboard/task/${taskId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updatedTask);
        expect(res.statusCode).toBe(200);
        expect(res.body.task.status).toBe('In Progress');
    });

    test('DELETE /dashboard/task/:id - should delete a task', async () => {
        const res = await request(app)
            .delete(`/dashboard/task/${taskId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.statusCode).toBe(200);
    });
});
