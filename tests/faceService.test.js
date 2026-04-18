const { compareFaces, findMatchingGrabId } = require('../server/services/faceService');

describe('faceService', () => {
  // ────────────────────────────────────────────
  // compareFaces()
  // ────────────────────────────────────────────
  describe('compareFaces()', () => {
    it('should return 0 for identical descriptors', () => {
      const enc = new Array(128).fill(0.5);
      expect(compareFaces(enc, enc)).toBe(0);
    });

    it('should return a positive distance for different descriptors', () => {
      const enc1 = new Array(128).fill(0);
      const enc2 = new Array(128).fill(1);
      const distance = compareFaces(enc1, enc2);
      expect(distance).toBeGreaterThan(0);
    });

    it('should compute correct Euclidean distance', () => {
      // Two vectors differing by 1 in every dimension → sqrt(128 * 1^2) = sqrt(128)
      const enc1 = new Array(128).fill(0);
      const enc2 = new Array(128).fill(1);
      expect(compareFaces(enc1, enc2)).toBeCloseTo(Math.sqrt(128), 5);
    });

    it('should be commutative (distance(a,b) === distance(b,a))', () => {
      const enc1 = Array.from({ length: 128 }, (_, i) => Math.sin(i));
      const enc2 = Array.from({ length: 128 }, (_, i) => Math.cos(i));
      expect(compareFaces(enc1, enc2)).toBeCloseTo(compareFaces(enc2, enc1), 10);
    });

    it('should work with Float32Array inputs', () => {
      const enc1 = new Float32Array(128).fill(0.1);
      const enc2 = new Float32Array(128).fill(0.2);
      const distance = compareFaces(enc1, enc2);
      expect(distance).toBeGreaterThan(0);
      // Each dim diff = 0.1, sum = 128 * 0.01 = 1.28, sqrt(1.28) ≈ 1.1314
      expect(distance).toBeCloseTo(Math.sqrt(128 * 0.01), 2);
    });

    it('should return 0 for two zero vectors', () => {
      const z = new Array(128).fill(0);
      expect(compareFaces(z, z)).toBe(0);
    });
  });

  // ────────────────────────────────────────────
  // findMatchingGrabId()
  // ────────────────────────────────────────────
  describe('findMatchingGrabId()', () => {
    const makeEncoding = (val) => new Array(128).fill(val);

    it('should return the closest match when distance < threshold', () => {
      const encoding = makeEncoding(0.5);
      const knownFaces = [
        { grab_id: 'id-1', encoding: makeEncoding(0.5) },   // distance 0
        { grab_id: 'id-2', encoding: makeEncoding(10) },     // far away
      ];
      const result = findMatchingGrabId(encoding, knownFaces);
      expect(result).not.toBeNull();
      expect(result.grab_id).toBe('id-1');
      expect(result.distance).toBe(0);
    });

    it('should return null when no face is within threshold', () => {
      const encoding = makeEncoding(0);
      const knownFaces = [
        { grab_id: 'id-1', encoding: makeEncoding(10) }, // very far
      ];
      const result = findMatchingGrabId(encoding, knownFaces);
      expect(result).toBeNull();
    });

    it('should return null for empty knownFaces array', () => {
      const encoding = makeEncoding(0.5);
      const result = findMatchingGrabId(encoding, []);
      expect(result).toBeNull();
    });

    it('should pick the closest match among multiple candidates', () => {
      const encoding = makeEncoding(0.5);
      const knownFaces = [
        { grab_id: 'id-far', encoding: makeEncoding(0.55) },
        { grab_id: 'id-closest', encoding: makeEncoding(0.5) },
        { grab_id: 'id-mid', encoding: makeEncoding(0.52) },
      ];
      const result = findMatchingGrabId(encoding, knownFaces);
      expect(result).not.toBeNull();
      expect(result.grab_id).toBe('id-closest');
    });

    it('should handle string-encoded JSONB encodings from Supabase', () => {
      const encoding = makeEncoding(0.5);
      const knownFaces = [
        { grab_id: 'id-1', encoding: JSON.stringify(makeEncoding(0.5)) },
      ];
      const result = findMatchingGrabId(encoding, knownFaces);
      expect(result).not.toBeNull();
      expect(result.grab_id).toBe('id-1');
      expect(result.distance).toBe(0);
    });

    it('should return distance in the result', () => {
      // Small diff: each dim diff = 0.001, dist = sqrt(128 * 0.000001) ≈ 0.01131
      const encoding = makeEncoding(0.5);
      const knownFaces = [
        { grab_id: 'id-1', encoding: makeEncoding(0.501) },
      ];
      const result = findMatchingGrabId(encoding, knownFaces);
      expect(result).not.toBeNull();
      expect(result.distance).toBeCloseTo(Math.sqrt(128 * 0.000001), 3);
    });
  });
});
