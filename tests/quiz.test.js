const request = require('supertest');
const app = require('../server');

describe('Quiz API', () => {
  let authCookie;
  let caseId;

  beforeAll(async () => {
    // Register and login to get auth cookie
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'quizuser',
        password: 'TestPass123'
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'quizuser',
        password: 'TestPass123'
      });

    authCookie = loginRes.headers['set-cookie'];

    // Create a case for quiz tests
    const caseRes = await request(app)
      .post('/api/cases')
      .set('Cookie', authCookie)
      .send({
        title: 'Quiz Test Case',
        modality: 'CT',
        diagnosis: 'Test Diagnosis',
        difficulty: 2
      });

    caseId = caseRes.body.id;
  });

  describe('GET /api/quiz/random', () => {
    it('should return a random case', async () => {
      const res = await request(app)
        .get('/api/quiz/random');

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBeDefined();
    });

    it('should filter by modality', async () => {
      const res = await request(app)
        .get('/api/quiz/random?modality=CT');

      // If case exists, it should have CT modality
      if (res.status === 200) {
        expect(res.body.modality).toBe('CT');
      } else {
        expect(res.status).toBe(404);
      }
    });
  });

  describe('POST /api/quiz/attempt', () => {
    it('should record quiz attempt', async () => {
      const res = await request(app)
        .post('/api/quiz/attempt')
        .send({
          case_id: caseId,
          correct: true,
          time_spent_ms: 5000
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBeDefined();
    });

    it('should require case_id', async () => {
      const res = await request(app)
        .post('/api/quiz/attempt')
        .send({
          correct: true
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent case', async () => {
      const res = await request(app)
        .post('/api/quiz/attempt')
        .send({
          case_id: 'non-existent-id',
          correct: false
        });

      expect(res.status).toBe(404);
    });

    it('should update spaced repetition when user is logged in', async () => {
      const res = await request(app)
        .post('/api/quiz/attempt')
        .set('Cookie', authCookie)
        .send({
          case_id: caseId,
          correct: true,
          time_spent_ms: 3000
        });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/quiz/stats', () => {
    it('should return quiz statistics', async () => {
      const res = await request(app)
        .get('/api/quiz/stats');

      expect(res.status).toBe(200);
      expect(res.body.overall).toBeDefined();
      expect(res.body.overall.total_attempts).toBeDefined();
    });

    it('should return personal stats when authenticated', async () => {
      const res = await request(app)
        .get('/api/quiz/stats')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.isPersonal).toBe(true);
    });
  });

  describe('GET /api/review/due', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/review/due');

      expect(res.status).toBe(401);
    });

    it('should return due cases when authenticated', async () => {
      const res = await request(app)
        .get('/api/review/due')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.dueCases).toBeDefined();
      expect(res.body.newCases).toBeDefined();
    });
  });

  describe('GET /api/progress', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/progress');

      expect(res.status).toBe(401);
    });

    it('should return progress summary when authenticated', async () => {
      const res = await request(app)
        .get('/api/progress')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.totalAttempts).toBeDefined();
      expect(res.body.correctCount).toBeDefined();
      expect(res.body.accuracy).toBeDefined();
    });
  });
});
