import type { ApiErrorBody } from './types';

export class HueSyncBoxError extends Error {
    public constructor(
        message: string,
        public readonly kind: 'api' | 'auth' | 'http' | 'network' | 'security' | 'validation',
        public readonly statusCode?: number,
        public readonly apiErrors: readonly ApiErrorBody[] = [],
        public readonly endpoint?: string,
    ) {
        super(message);
        this.name = 'HueSyncBoxError';
    }
}

/** Error returned by the Hue Sync Box API itself. */
export class HueSyncBoxApiError extends HueSyncBoxError {
    public readonly apiCode?: number;

    public constructor(message: string, statusCode: number, endpoint: string, apiErrors: readonly ApiErrorBody[]) {
        super(
            message,
            statusCode === 401 ? 'auth' : statusCode >= 500 ? 'network' : 'api',
            statusCode,
            apiErrors,
            endpoint,
        );
        this.name = 'HueSyncBoxApiError';
        this.apiCode = apiErrors[0]?.code ?? apiErrors[0]?.error;
    }
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
