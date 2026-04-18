// Mock Supabase before requiring the module
jest.mock('../server/config/supabase', () => {
  const mockStorage = {
    from: jest.fn(),
  };
  return {
    storage: mockStorage,
    from: jest.fn(),
  };
});

// Mock faceService
jest.mock('../server/services/faceService', () => ({
  detectFaces: jest.fn(),
  findMatchingGrabId: jest.fn(),
}));

const supabase = require('../server/config/supabase');
const { detectFaces, findMatchingGrabId } = require('../server/services/faceService');
const { listStorageFiles, processImage, crawlBucket } = require('../server/services/crawlService');

describe('crawlService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────
  // listStorageFiles()
  // ────────────────────────────────────────────
  describe('listStorageFiles()', () => {
    it('should return only image files (jpg, jpeg, png, webp)', async () => {
      supabase.storage.from.mockReturnValue({
        list: jest.fn().mockResolvedValue({
          data: [
            { name: 'photo1.jpg' },
            { name: 'photo2.png' },
            { name: 'document.pdf' },
            { name: 'photo3.webp' },
            { name: 'data.json' },
            { name: 'photo4.JPEG' },
          ],
          error: null,
        }),
      });

      const files = await listStorageFiles('event-photos');
      expect(files).toHaveLength(4);
      expect(files.map((f) => f.name)).toEqual([
        'photo1.jpg',
        'photo2.png',
        'photo3.webp',
        'photo4.JPEG',
      ]);
    });

    it('should throw on Supabase storage error', async () => {
      supabase.storage.from.mockReturnValue({
        list: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Bucket not found' },
        }),
      });

      await expect(listStorageFiles('bad-bucket')).rejects.toThrow(
        'Failed to list files in bucket "bad-bucket"'
      );
    });

    it('should return empty array when bucket is empty', async () => {
      supabase.storage.from.mockReturnValue({
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const files = await listStorageFiles('event-photos');
      expect(files).toEqual([]);
    });

    it('should use default bucket name "event-photos"', async () => {
      supabase.storage.from.mockReturnValue({
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      await listStorageFiles();
      expect(supabase.storage.from).toHaveBeenCalledWith('event-photos');
    });
  });

  // ────────────────────────────────────────────
  // processImage()
  // ────────────────────────────────────────────
  describe('processImage()', () => {
    it('should throw when download fails', async () => {
      supabase.storage.from.mockReturnValue({
        download: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'File not found' },
        }),
      });

      await expect(
        processImage({ name: 'missing.jpg' }, 'event-photos')
      ).rejects.toThrow('Failed to download "missing.jpg"');
    });

    it('should mark image as processed even when face detection fails', async () => {
      // Mock download success
      const mockBlob = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) };
      supabase.storage.from.mockReturnValue({
        download: jest.fn().mockResolvedValue({ data: mockBlob, error: null }),
      });

      // Mock DB: image does not exist yet → insert
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      });

      supabase.from.mockImplementation((table) => {
        if (table === 'images') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'img-1' },
                  error: null,
                }),
              }),
            }),
            update: updateMock,
          };
        }
        return {};
      });

      // Make detectFaces throw
      detectFaces.mockRejectedValue(new Error('Detection failed'));

      const result = await processImage({ name: 'test.jpg' });
      expect(result).toEqual({ newFaces: 0, matchedFaces: 0 });
    });

    it('should handle new faces and matched faces correctly', async () => {
      // Mock download
      const mockBlob = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) };
      supabase.storage.from.mockReturnValue({
        download: jest.fn().mockResolvedValue({ data: mockBlob, error: null }),
      });

      // Track calls per table
      const imageUpdateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      });

      supabase.from.mockImplementation((table) => {
        if (table === 'images') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'img-1' } }),
              }),
            }),
            update: imageUpdateMock,
          };
        }
        if (table === 'faces') {
          return {
            select: jest.fn().mockResolvedValue({
              data: [{ grab_id: 'known-id', encoding: new Array(128).fill(0.5) }],
              error: null,
            }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'face_image_map') {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      // Two faces detected: one matching, one new
      detectFaces.mockResolvedValue([
        {
          descriptor: new Array(128).fill(0.5),
          detection: { box: { x: 10, y: 20, width: 50, height: 50 }, score: 0.95 },
        },
        {
          descriptor: new Array(128).fill(0.9),
          detection: { box: { x: 100, y: 100, width: 60, height: 60 }, score: 0.88 },
        },
      ]);

      // First face matches, second is new
      findMatchingGrabId
        .mockReturnValueOnce({ grab_id: 'known-id', distance: 0.1 })
        .mockReturnValueOnce(null);

      const result = await processImage({ name: 'group.jpg' });
      expect(result.matchedFaces).toBe(1);
      expect(result.newFaces).toBe(1);
    });
  });

  // ────────────────────────────────────────────
  // crawlBucket()
  // ────────────────────────────────────────────
  describe('crawlBucket()', () => {
    it('should skip already-processed images', async () => {
      // List returns 2 files
      supabase.storage.from.mockReturnValue({
        list: jest.fn().mockResolvedValue({
          data: [{ name: 'processed.jpg' }, { name: 'new.jpg' }],
          error: null,
        }),
        download: jest.fn().mockResolvedValue({
          data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)) },
          error: null,
        }),
      });

      // DB says processed.jpg is already done
      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({}),
      });

      supabase.from.mockImplementation((table) => {
        if (table === 'images') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn((col, val) => {
                if (col === 'processed') {
                  return Promise.resolve({
                    data: [{ storage_path: 'processed.jpg' }],
                  });
                }
                return {
                  single: jest.fn().mockResolvedValue({ data: { id: 'img-new' } }),
                };
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'img-new' }, error: null }),
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'faces') {
          return {
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'face_image_map') {
          return { upsert: jest.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      detectFaces.mockResolvedValue([]);

      const result = await crawlBucket('event-photos', 50);
      expect(result.already_processed).toBe(1);
      expect(result.newly_processed).toBe(1);
    });
  });
});
