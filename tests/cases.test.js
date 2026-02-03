const request = require('supertest');
const app = require('../server');

describe('Cases API', () => {
  let authCookie;

  beforeAll(async () => {
    // Register and login to get auth cookie
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'casesuser',
        password: 'TestPass123'
      });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'casesuser',
        password: 'TestPass123'
      });

    authCookie = loginRes.headers['set-cookie'];
  });

  describe('GET /api/cases', () => {
    it('should return cases list (public)', async () => {
      const res = await request(app)
        .get('/api/cases');

      expect(res.status).toBe(200);
      expect(res.body.cases).toBeDefined();
      expect(Array.isArray(res.body.cases)).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/cases?limit=5&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(5);
      expect(res.body.offset).toBe(0);
    });
  });

  describe('POST /api/cases', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/cases')
        .send({
          title: 'Test Case',
          modality: 'CT'
        });

      expect(res.status).toBe(401);
    });

    it('should create a case when authenticated', async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Cookie', authCookie)
        .send({
          title: 'Lung Nodule Case',
          modality: 'CT',
          body_part: 'Chest',
          diagnosis: 'Solitary pulmonary nodule',
          difficulty: 3,
          clinical_history: 'Patient with incidental finding',
          teaching_points: 'Key features to observe',
          findings: 'Nodule measurements and characteristics',
          tags: ['ct', 'chest', 'nodule']
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('should require title', async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Cookie', authCookie)
        .send({
          modality: 'CT'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Title');
    });
  });

  describe('GET /api/cases/:id', () => {
    let caseId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Cookie', authCookie)
        .send({
          title: 'Case for GET test',
          modality: 'MRI'
        });

      caseId = res.body.id;
    });

    it('should return case details', async () => {
      const res = await request(app)
        .get(`/api/cases/${caseId}`);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Case for GET test');
      expect(res.body.modality).toBe('MRI');
    });

    it('should return 404 for non-existent case', async () => {
      const res = await request(app)
        .get('/api/cases/non-existent-id');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/cases/:id', () => {
    let caseId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Cookie', authCookie)
        .send({
          title: 'Case for PUT test',
          modality: 'X-Ray'
        });

      caseId = res.body.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .put(`/api/cases/${caseId}`)
        .send({
          title: 'Updated Title'
        });

      expect(res.status).toBe(401);
    });

    it('should update case when authenticated', async () => {
      const res = await request(app)
        .put(`/api/cases/${caseId}`)
        .set('Cookie', authCookie)
        .send({
          title: 'Updated Case Title',
          modality: 'CT',
          diagnosis: 'New diagnosis'
        });

      expect(res.status).toBe(200);

      // Verify update
      const getRes = await request(app)
        .get(`/api/cases/${caseId}`);

      expect(getRes.body.title).toBe('Updated Case Title');
      expect(getRes.body.modality).toBe('CT');
    });

    it('should return 404 for non-existent case', async () => {
      const res = await request(app)
        .put('/api/cases/non-existent-id')
        .set('Cookie', authCookie)
        .send({
          title: 'Updated Title'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/cases/:id', () => {
    let caseId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Cookie', authCookie)
        .send({
          title: 'Case for DELETE test',
          modality: 'US'
        });

      caseId = res.body.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/cases/${caseId}`);

      expect(res.status).toBe(401);
    });

    it('should delete case when authenticated', async () => {
      const res = await request(app)
        .delete(`/api/cases/${caseId}`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);

      // Verify deletion
      const getRes = await request(app)
        .get(`/api/cases/${caseId}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent case', async () => {
      const res = await request(app)
        .delete('/api/cases/non-existent-id')
        .set('Cookie', authCookie);

      expect(res.status).toBe(404);
    });
  });
});
