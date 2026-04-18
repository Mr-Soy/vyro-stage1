// Mock heavy dependencies to avoid loading real ML models
jest.mock('../server/utils/faceModels', () => ({
  loadModels: jest.fn().mockResolvedValue(undefined),
  areModelsLoaded: jest.fn().mockReturnValue(true),
  faceapi: {},
  tf: {},
}));

jest.mock('../server/config/supabase', () => {
  return {
    storage: { from: jest.fn() },
    from: jest.fn(),
  };
});

// Build a minimal Express app for route testing (no model loading)
const express = require('express');
const request = require('supertest');
const errorHandler = require('../server/middleware/errorHandler');

function createApp() {
  const app = express();
  app.use(express.json());

  // Health check (inline, same as server/index.js)
  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Grabpic API is running' });
  });

  // Mount routes
  app.use('/api', require('../server/routes/images'));
  app.use('/api', require('../server/routes/stats'));

  app.use(errorHandler);
  return app;
}

describe('Route handlers', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  // ────────────────────────────────────────────
  // GET /api/health
  // ────────────────────────────────────────────
  describe('GET /api/health', () => {
    it('should return 200 with success message', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Grabpic API is running');
    });
  });

  // ────────────────────────────────────────────
  // GET /api/images/:grab_id — validation
  // ────────────────────────────────────────────
  describe('GET /api/images/:grab_id', () => {
    it('should reject invalid UUID format with 400', async () => {
      const res = await request(app).get('/api/images/not-a-uuid');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_GRAB_ID');
    });

    it('should accept a valid UUID format', async () => {
      // Mock Supabase to return 404 (grab_id not found in DB)
      const supabase = require('../server/config/supabase');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      });

      const res = await request(app).get(
        '/api/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      );
      // Should not be 400 (validation passed), will be 500 or 404 from service
      expect(res.status).not.toBe(400);
    });
  });

  // ────────────────────────────────────────────
  // GET /api/stats
  // ────────────────────────────────────────────
  describe('GET /api/stats', () => {
    it('should return stats with correct shape', async () => {
      const supabase = require('../server/config/supabase');

      supabase.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 5 }),
        }),
      }));

      // Override for the Promise.all pattern: 4 parallel calls
      let callIdx = 0;
      supabase.from.mockImplementation(() => {
        callIdx++;
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: callIdx * 10 }),
          }),
        };
      });

      const res = await request(app).get('/api/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total_images');
      expect(res.body.data).toHaveProperty('processed_images');
      expect(res.body.data).toHaveProperty('total_unique_faces');
      expect(res.body.data).toHaveProperty('total_face_mappings');
    });
  });
});
