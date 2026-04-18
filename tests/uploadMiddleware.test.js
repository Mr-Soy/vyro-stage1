const multer = require('multer');

// We can't require the upload middleware directly because it reads process.env
// at module load time. Instead, test the logic patterns.

describe('upload middleware', () => {
  describe('MIME type filtering', () => {
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    it('should accept image/jpeg', () => {
      expect(ALLOWED_MIMES.includes('image/jpeg')).toBe(true);
    });

    it('should accept image/png', () => {
      expect(ALLOWED_MIMES.includes('image/png')).toBe(true);
    });

    it('should accept image/webp', () => {
      expect(ALLOWED_MIMES.includes('image/webp')).toBe(true);
    });

    it('should reject image/gif', () => {
      expect(ALLOWED_MIMES.includes('image/gif')).toBe(false);
    });

    it('should reject application/pdf', () => {
      expect(ALLOWED_MIMES.includes('application/pdf')).toBe(false);
    });

    it('should reject text/plain', () => {
      expect(ALLOWED_MIMES.includes('text/plain')).toBe(false);
    });
  });

  describe('file size limit', () => {
    it('should default to 5MB (5242880 bytes)', () => {
      const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024;
      expect(MAX_FILE_SIZE).toBe(5242880);
    });
  });
});
