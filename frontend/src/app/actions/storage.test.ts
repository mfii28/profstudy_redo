import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPresignedUploadUrl, getPresignedDownloadUrl, deleteAsset } from './storage';

const mocks = vi.hoisted(() => {
  const apiFetchServerMock = vi.fn();
  return { apiFetchServerMock };
});

vi.mock('@/lib/api-client.server', () => ({
  apiFetchServer: mocks.apiFetchServerMock,
}));

describe('storage actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPresignedUploadUrl', () => {
    it('calls apiFetchServer with correct query params', async () => {
      mocks.apiFetchServerMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/upload' }),
      });

      const result = await getPresignedUploadUrl('user1', 'avatar', 'photo.jpg', 'image/jpeg');
      
      expect(mocks.apiFetchServerMock).toHaveBeenCalledWith(
        '/api/v1/storage/upload-url?type=avatar&fileName=photo.jpg&contentType=image%2Fjpeg'
      );
      expect(result).toEqual({ url: 'https://example.com/upload' });
    });

    it('returns error if apiFetchServer fails', async () => {
      mocks.apiFetchServerMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Bad request' }),
      });

      const result = await getPresignedUploadUrl('user1', 'avatar', 'photo.jpg', 'image/jpeg');
      expect(result).toEqual({ error: 'Bad request' });
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('returns error when key is empty', async () => {
      const result = await getPresignedDownloadUrl('');
      expect(result).toEqual({ error: 'Missing key' });
    });

    it('calls apiFetchServer with correct query params', async () => {
      mocks.apiFetchServerMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/download' }),
      });

      const result = await getPresignedDownloadUrl('public/file.jpg');
      
      expect(mocks.apiFetchServerMock).toHaveBeenCalledWith(
        '/api/v1/storage/download-url?key=public%2Ffile.jpg'
      );
      expect(result).toEqual({ url: 'https://example.com/download' });
    });
  });

  describe('deleteAsset', () => {
    it('returns success for now (dummy implementation)', async () => {
      const result = await deleteAsset('public/file.jpg');
      expect(result).toEqual({ success: true, error: undefined });
    });
  });
});

