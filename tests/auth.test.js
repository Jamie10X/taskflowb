const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // Import your Express app
require('dotenv').config();

describe('Auth Routes', () => {
    const testUser = {
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'Test@12345',
    };
    let token = '';

    beforeAll(async () => {
        await mongoose.connect(process.env.DB);
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('POST /auth/signup - should create a new user', async () => {
        const res = await request(app).post('/auth/signup').send(testUser);
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Signup successful');
    });

    test('POST /auth/signin - should authenticate user and return a token', async () => {
        const res = await request(app).post('/auth/signin').send({
            email: testUser.email,
            password: testUser.password,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('token');
        token = res.body.token;
    });

    test('POST /auth/signin - should return 403 for invalid credentials', async () => {
        const res = await request(app).post('/auth/signin').send({
            email: 'wrong@example.com',
            password: 'wrongpassword',
        });
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe('Invalid credentials');
    });
});
