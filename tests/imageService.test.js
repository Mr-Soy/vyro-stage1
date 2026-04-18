// Mock Supabase before requiring the module
jest.mock('../server/config/supabase', () => {
  const mockStorage = {
    from: jest.fn().mockReturnValue({
      getPublicUrl: jest.fn((path) => ({
        data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/event-photos/${path}` },
      })),
    }),
  };
  const mockFrom = jest.fn();
  return {
    storage: mockStorage,
    from: mockFrom,
  };
});

const supabase = require('../server/config/supabase');
const { getImagePublicUrl, getImagesByGrabId } = require('../server/services/imageService');

describe('imageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────
  // getImagePublicUrl()
  // ────────────────────────────────────────────
  describe('getImagePublicUrl()', () => {
    it('should return a valid public URL for a given path', () => {
      const url = getImagePublicUrl('event-photos', 'photo1.jpg');
      expect(url).toBe(
        'https://example.supabase.co/storage/v1/object/public/event-photos/photo1.jpg'
      );
    });

    it('should call supabase.storage.from() with the bucket name', () => {
      getImagePublicUrl('my-bucket', 'test.png');
      expect(supabase.storage.from).toHaveBeenCalledWith('my-bucket');
    });
  });

  // ────────────────────────────────────────────
  // getImagesByGrabId()
  // ────────────────────────────────────────────
  describe('getImagesByGrabId()', () => {
    it('should throw 404 when grab_id does not exist', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      });

      await expect(getImagesByGrabId('non-existent-uuid')).rejects.toThrow(
        'No identity found with the provided grab_id.'
      );
    });

    it('should clamp limit to max 100', async () => {
      // Setup: face exists, but no mappings
      const selectMock = jest.fn();

      // First call: faces table (grab_id lookup)
      const faceSelectChain = {
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { grab_id: 'test-id' }, error: null }),
        }),
      };

      // Second call: face_image_map count
      const countChain = {
        eq: jest.fn().mockResolvedValue({ count: 0 }),
      };

      // Third call: face_image_map select with range
      const rangeChain = {
        eq: jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };

      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { select: () => faceSelectChain };
        if (callCount === 2) return { select: () => countChain };
        return { select: () => rangeChain };
      });

      const result = await getImagesByGrabId('test-id', 1, 999);
      expect(result.limit).toBeLessThanOrEqual(100);
    });

    it('should return empty images array when no mappings exist', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { grab_id: 'test-id' }, error: null }),
              }),
            }),
          };
        }
        if (callCount === 2) {
          return {
            select: () => ({
              eq: () => Promise.resolve({ count: 0 }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              range: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      });

      const result = await getImagesByGrabId('test-id', 1, 20);
      expect(result.grab_id).toBe('test-id');
      expect(result.images).toEqual([]);
      expect(result.total_images).toBe(0);
    });

    it('should enforce minimum page of 1', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { grab_id: 'test-id' }, error: null }),
              }),
            }),
          };
        }
        if (callCount === 2) {
          return {
            select: () => ({
              eq: () => Promise.resolve({ count: 0 }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              range: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      });

      const result = await getImagesByGrabId('test-id', -5, 20);
      expect(result.page).toBe(1);
    });
  });
});
