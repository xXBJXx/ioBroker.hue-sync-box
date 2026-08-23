"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HueSyncBoxApiError = exports.HueSyncBoxError = void 0;
exports.errorMessage = errorMessage;
class HueSyncBoxError extends Error {
    kind;
    statusCode;
    apiErrors;
    endpoint;
    constructor(message, kind, statusCode, apiErrors = [], endpoint) {
        super(message);
        this.kind = kind;
        this.statusCode = statusCode;
        this.apiErrors = apiErrors;
        this.endpoint = endpoint;
        this.name = 'HueSyncBoxError';
    }
}
exports.HueSyncBoxError = HueSyncBoxError;
/** Error returned by the Hue Sync Box API itself. */
class HueSyncBoxApiError extends HueSyncBoxError {
    apiCode;
    constructor(message, statusCode, endpoint, apiErrors) {
        super(message, statusCode === 401 ? 'auth' : statusCode >= 500 ? 'network' : 'api', statusCode, apiErrors, endpoint);
        this.name = 'HueSyncBoxApiError';
        this.apiCode = apiErrors[0]?.code ?? apiErrors[0]?.error;
    }
}
exports.HueSyncBoxApiError = HueSyncBoxApiError;
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=errors.js.map