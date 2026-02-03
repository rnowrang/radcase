const request = require('supertest');
const app = require('../server');

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const uniqueUsername = `testuser_${Date.now()}`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: uniqueUsername,
          password: 'TestPass123',
          displayName: 'Test User'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(uniqueUsername.toLowerCase());
    });

    it('should reject registration with missing username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'TestPass123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject registration with short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'shortpw',
          password: 'Test1'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('8 characters');
    });

    it('should reject registration with password missing uppercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'nouppercase',
          password: 'testpass123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('uppercase');
    });

    it('should reject registration with password missing lowercase', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'nolowercase',
          password: 'TESTPASS123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('lowercase');
    });

    it('should reject registration with password missing number', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'nonumber',
          password: 'TestPassAbc'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('number');
    });

    it('should reject duplicate username', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          password: 'TestPass123'
        });

      // Second registration with same username
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicate',
          password: 'TestPass456'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already taken');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Create a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'loginuser',
          password: 'TestPass123'
        });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'TestPass123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'WrongPass123'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPass123'
        });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return null user when not authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it('should return user when authenticated', async () => {
      // First login to get cookie
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'loginuser',
          password: 'TestPass123'
        });

      const cookie = loginRes.headers['set-cookie'];

      // Then check /me with cookie
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('loginuser');
    });
  });
});
