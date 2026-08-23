import { describe, expect, it } from 'vitest';
import { HueSyncBoxApiError, HueSyncBoxError } from '../src/api/errors';
import { parseApiResponse } from '../src/api/parser';
import { safeResourcePath, validateHost, validateUniqueId } from '../src/api/validation';

describe('Hue Sync Box API parsing', () => {
    it('accepts documented direct resource responses', () => {
        expect(parseApiResponse<{ uniqueId: string }>('{"uniqueId":"box-id"}', 200, '/api/v1/device')).toEqual({
            uniqueId: 'box-id',
        });
    });

    it('accepts legacy data wrappers', () => {
        expect(parseApiResponse<{ mode: string }>('{"data":{"mode":"video"}}', 200, '/api/v1/execution')).toEqual({
            mode: 'video',
        });
    });

    it('preserves API code, status and endpoint', () => {
        expect(() => parseApiResponse('{}', 401, '/api/v1/execution')).toThrowError(HueSyncBoxApiError);
        try {
            parseApiResponse('{"code":15,"message":"Invalid value"}', 400, '/api/v1/execution');
        } catch (error) {
            expect(error).toMatchObject({ apiCode: 15, statusCode: 400, endpoint: '/api/v1/execution' });
        }
    });

    it('rejects malformed response shapes', () => {
        expect(() => parseApiResponse('not-json', 200, '/api/v1/device')).toThrowError(HueSyncBoxError);
        expect(() => parseApiResponse('[]', 200, '/api/v1/device')).toThrowError('must be a JSON object');
    });
});

describe('request input validation', () => {
    it('allows local IPv4 and DNS hosts without URL syntax', () => {
        expect(validateHost('192.168.1.10')).toBe('192.168.1.10');
        expect(validateHost('syncbox.local')).toBe('syncbox.local');
    });

    it.each(['host/path', 'host:443', 'user@host', 'https://host/path'])('rejects unsafe host %s', host => {
        expect(() => validateHost(host)).toThrow();
    });

    it('allows only known resource roots', () => {
        expect(safeResourcePath('execution/video')).toBe('execution/video');
        expect(() => safeResourcePath('registrations/all')).toThrow();
        expect(validateUniqueId('001788fffe123456')).toBe('001788fffe123456');
    });
});
