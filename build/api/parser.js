"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseApiResponse = parseApiResponse;
const errors_1 = require("./errors");
/** Parse both the documented direct resource response and legacy `{ data }` wrappers. */
function parseApiResponse(body, statusCode, endpoint) {
    let parsed;
    try {
        parsed = (body ? JSON.parse(body) : {});
    }
    catch {
        throw new errors_1.HueSyncBoxError(`Sync Box returned invalid JSON (HTTP ${statusCode})`, 'http', statusCode, [], endpoint);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new errors_1.HueSyncBoxError('Sync Box response must be a JSON object', 'http', statusCode, [], endpoint);
    }
    const directError = typeof parsed.code === 'number' || typeof parsed.error === 'number'
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
        throw new errors_1.HueSyncBoxApiError('Sync Box rejected the access token', statusCode, endpoint, errors);
    }
    if (statusCode < 200 || statusCode >= 300) {
        throw new errors_1.HueSyncBoxApiError(`Sync Box request failed (HTTP ${statusCode})`, statusCode, endpoint, errors);
    }
    if (errors.length) {
        const message = errors.map(error => error.message ?? `API error ${error.code ?? error.error}`).join('; ');
        throw new errors_1.HueSyncBoxApiError(message, statusCode, endpoint, errors);
    }
    const data = Object.prototype.hasOwnProperty.call(parsed, 'data') ? parsed.data : parsed;
    if (data === undefined) {
        throw new errors_1.HueSyncBoxError('Sync Box response contains no data', 'http', statusCode, [], endpoint);
    }
    return data;
}
//# sourceMappingURL=parser.js.map