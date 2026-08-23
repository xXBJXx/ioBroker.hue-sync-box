import { HueSyncBoxApiError, HueSyncBoxError } from './errors';
import type { ApiResponse, JsonObject } from './types';

/** Parse both the documented direct resource response and legacy `{ data }` wrappers. */
export function parseApiResponse<T extends JsonObject>(body: string, statusCode: number, endpoint: string): T {
    let parsed: ApiResponse<T> & T;
    try {
        parsed = (body ? JSON.parse(body) : {}) as ApiResponse<T> & T;
    } catch {
        throw new HueSyncBoxError(
            `Sync Box returned invalid JSON (HTTP ${statusCode})`,
            'http',
            statusCode,
            [],
            endpoint,
        );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new HueSyncBoxError('Sync Box response must be a JSON object', 'http', statusCode, [], endpoint);
    }
    const directError =
        typeof parsed.code === 'number' || typeof parsed.error === 'number'
            ? [
                  {
                      code: typeof parsed.code === 'number' ? parsed.code : undefined,
                      error: typeof parsed.error === 'number' ? parsed.error : undefined,
                      message: typeof parsed.message === 'string' ? parsed.message : undefined,
                  },
              ]
            : [];
    const errors = Array.isArray(parsed.errors) ? parsed.errors : directError;
    if (statusCode === 401) {
        throw new HueSyncBoxApiError('Sync Box rejected the access token', statusCode, endpoint, errors);
    }
    if (statusCode < 200 || statusCode >= 300) {
        throw new HueSyncBoxApiError(`Sync Box request failed (HTTP ${statusCode})`, statusCode, endpoint, errors);
    }
    if (errors.length) {
        const message = errors.map(error => error.message ?? `API error ${error.code ?? error.error}`).join('; ');
        throw new HueSyncBoxApiError(message, statusCode, endpoint, errors);
    }
    const data = Object.prototype.hasOwnProperty.call(parsed, 'data') ? parsed.data : parsed;
    if (data === undefined) {
        throw new HueSyncBoxError('Sync Box response contains no data', 'http', statusCode, [], endpoint);
    }
    return data;
}
