/**
 * Unit tests for API client
 */
import { ApiClient } from '../../src/background/api-client.js';
import { ErrorCodes } from '../../src/shared/types.js';

describe('ApiClient', () => {
  let apiClient;
  let mockSecureStorage;

  beforeEach(() => {
    // Mock secure storage
    mockSecureStorage = {
      getApiKey: jest.fn().mockResolvedValue('test-api-key-12345678901234567890123456789012')
    };

    // Mock the import
    jest.doMock('../../src/utils/storage.js', () => ({
      secureStorage: mockSecureStorage
    }));

    apiClient = new ApiClient();
  });

  describe('makeRequest', () => {
    it('should make authenticated request successfully', async () => {
      const mockResponse = { success: true, data: 'test' };
      testUtils.mockFetchResponse(mockResponse);

      const result = await apiClient.makeRequest('/test');

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sentio.com/v1/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should throw error when API key is missing', async () => {
      mockSecureStorage.getApiKey.mockResolvedValue(null);

      await expect(apiClient.makeRequest('/test')).rejects.toThrow(ErrorCodes.INVALID_API_KEY);
    });

    it('should handle 401 unauthorized error', async () => {
      testUtils.mockFetchResponse({ error: 'Unauthorized' }, { status: 401 });

      await expect(apiClient.makeRequest('/test')).rejects.toThrow();
    });

    it('should retry on network error', async () => {
      // First call fails, second succeeds
      fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(testUtils.createMockApiResponse({ success: true }));

      const result = await apiClient.makeRequest('/test');

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout error', async () => {
      const abortError = new Error('Timeout');
      abortError.name = 'AbortError';
      fetch.mockRejectedValue(abortError);

      await expect(apiClient.makeRequest('/test')).rejects.toThrow(ErrorCodes.TIMEOUT);
    });
  });

  describe('validateApiKey', () => {
    it('should validate API key format first', async () => {
      const result = await apiClient.validateApiKey('invalid-key');

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should validate with server for valid format', async () => {
      const validKey = 'valid-api-key-12345678901234567890123456789012';
      testUtils.mockFetchResponse({ valid: true });

      const result = await apiClient.validateApiKey(validKey);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sentio.com/v1/auth/validate',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should return false for server rejection', async () => {
      const validKey = 'valid-api-key-12345678901234567890123456789012';
      testUtils.mockFetchResponse({ valid: false });

      const result = await apiClient.validateApiKey(validKey);

      expect(result).toBe(false);
    });
  });

  describe('fetchPendingJobs', () => {
    it('should fetch and return jobs array', async () => {
      const mockJobs = [testUtils.createMockJob()];
      testUtils.mockFetchResponse({ jobs: mockJobs });

      const result = await apiClient.fetchPendingJobs();

      expect(result).toEqual(mockJobs);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sentio.com/v1/jobs/pending',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should return empty array when no jobs', async () => {
      testUtils.mockFetchResponse({ jobs: [] });

      const result = await apiClient.fetchPendingJobs();

      expect(result).toEqual([]);
    });

    it('should clear API key on invalid key error', async () => {
      const error = new Error('Invalid API key');
      error.code = ErrorCodes.INVALID_API_KEY;
      fetch.mockRejectedValue(error);

      await expect(apiClient.fetchPendingJobs()).rejects.toThrow();
      expect(mockSecureStorage.clearApiKey).toHaveBeenCalled();
    });
  });

  describe('submitJobResult', () => {
    it('should submit result successfully', async () => {
      const mockResult = {
        jobId: 'test-job-123',
        token: 'test-token',
        status: 'completed',
        data: []
      };
      const mockResponse = { success: true };
      testUtils.mockFetchResponse(mockResponse);

      const result = await apiClient.submitJobResult(mockResult);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sentio.com/v1/jobs/results',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockResult)
        })
      );
    });

    it('should handle submission error', async () => {
      const mockResult = { jobId: 'test-job-123' };
      const error = new Error('Submission failed');
      fetch.mockRejectedValue(error);

      await expect(apiClient.submitJobResult(mockResult)).rejects.toThrow('Submission failed');
    });
  });

  describe('checkHealth', () => {
    it('should return true for healthy status', async () => {
      testUtils.mockFetchResponse({ status: 'healthy' });

      const result = await apiClient.checkHealth();

      expect(result).toBe(true);
    });

    it('should return false for unhealthy status', async () => {
      testUtils.mockFetchResponse({ status: 'unhealthy' });

      const result = await apiClient.checkHealth();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const result = await apiClient.checkHealth();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should map HTTP status codes to error codes', async () => {
      const testCases = [
        { status: 401, expectedError: ErrorCodes.INVALID_API_KEY },
        { status: 429, expectedError: ErrorCodes.RATE_LIMITED },
        { status: 408, expectedError: ErrorCodes.TIMEOUT },
        { status: 500, expectedError: ErrorCodes.NETWORK_ERROR }
      ];

      for (const { status, expectedError } of testCases) {
        testUtils.mockFetchResponse({ error: 'Test error' }, { status });

        try {
          await apiClient.makeRequest('/test');
        } catch (error) {
          expect(error.code).toBe(expectedError);
        }
      }
    });

    it('should include response status in error', async () => {
      testUtils.mockFetchResponse({ error: 'Server error' }, { status: 500 });

      try {
        await apiClient.makeRequest('/test');
      } catch (error) {
        expect(error.status).toBe(500);
      }
    });
  });

  describe('request configuration', () => {
    it('should allow timeout configuration', () => {
      const newTimeout = 5000;
      apiClient.setTimeout(newTimeout);

      expect(apiClient.requestTimeout).toBe(newTimeout);
    });

    it('should allow base URL configuration', () => {
      const newBaseUrl = 'https://api.example.com/v2';
      apiClient.setBaseUrl(newBaseUrl);

      expect(apiClient.baseUrl).toBe(newBaseUrl);
    });

    it('should return connection statistics', () => {
      const stats = apiClient.getStats();

      expect(stats).toMatchObject({
        baseUrl: expect.any(String),
        timeout: expect.any(Number),
        maxRetries: expect.any(Number)
      });
    });
  });
});