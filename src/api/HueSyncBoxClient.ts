import * as https from 'node:https';
import * as tls from 'node:tls';
import { HUE_SYNC_BOX_CA } from './certificate';
import { HueSyncBoxError } from './errors';
import { parseApiResponse } from './parser';
import type { DeviceResource, HttpMethod, JsonObject, RegistrationResponse, RootResource } from './types';
import { safeResourcePath, validateHost, validateUniqueId } from './validation';

/**
 *
 */
export interface ClientOptions {
    /**
     *
     */
    host: string;
    /**
     *
     */
    uniqueId?: string;
    /**
     *
     */
    accessToken?: string;
    /**
     *
     */
    allowInsecureTls?: boolean;
    /**
     *
     */
    timeoutMs?: number;
    /**
     *
     */
    maxResponseBytes?: number;
}

interface RequestOptions {
    authenticated?: boolean;
    retries?: number;
}

/**
 *
 */
export class HueSyncBoxClient {
    private readonly host: string;
    private readonly uniqueId?: string;
    private readonly accessToken?: string;
    private readonly allowInsecureTls: boolean;
    private readonly timeoutMs: number;
    private readonly maxResponseBytes: number;
    private readonly agent: https.Agent;

    /**
     *
     */
    public constructor(options: ClientOptions) {
        this.host = validateHost(options.host);
        this.uniqueId = options.uniqueId ? validateUniqueId(options.uniqueId) : undefined;
        this.accessToken = options.accessToken?.trim() || undefined;
        this.allowInsecureTls = options.allowInsecureTls === true;
        this.timeoutMs = options.timeoutMs ?? 8_000;
        this.maxResponseBytes = options.maxResponseBytes ?? 1_048_576;
        this.agent = new https.Agent({ keepAlive: true, maxSockets: 2, timeout: 30_000 });
    }

    /**
     *
     */
    public close(): void {
        this.agent.destroy();
    }

    /**
     *
     */
    public getRoot(): Promise<RootResource> {
        return this.request<RootResource>('GET', '', undefined, { retries: 2 });
    }

    /**
     *
     */
    public getResource<T extends JsonObject>(resource: string): Promise<T> {
        return this.request<T>('GET', safeResourcePath(resource), undefined, { retries: 2 });
    }

    /**
     *
     */
    public updateResource<T extends JsonObject>(resource: string, body: JsonObject): Promise<T> {
        return this.request<T>('PUT', safeResourcePath(resource), body);
    }

    /**
     *
     */
    public deleteResource<T extends JsonObject>(resource: string): Promise<T> {
        return this.request<T>('DELETE', safeResourcePath(resource));
    }

    /**
     *
     */
    public getPublicDevice(): Promise<DeviceResource> {
        return this.request<DeviceResource>('GET', 'device', undefined, { authenticated: false, retries: 1 });
    }

    /**
     *
     */
    public register(appName: string, instanceName: string): Promise<RegistrationResponse> {
        return this.request<RegistrationResponse>(
            'POST',
            'registrations',
            { appName, instanceName },
            { authenticated: false },
        );
    }

    private async request<T extends JsonObject>(
        method: HttpMethod,
        resource: string,
        body?: JsonObject,
        options: RequestOptions = {},
    ): Promise<T> {
        const authenticated = options.authenticated !== false;
        if (authenticated && !this.accessToken) {
            throw new HueSyncBoxError('No access token configured', 'auth', 401);
        }
        const attempts = Math.max(1, (options.retries ?? 0) + 1);
        let lastError: unknown;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await this.requestOnce<T>(method, resource, body, authenticated);
            } catch (error) {
                lastError = error;
                if (!this.isRetryable(error) || attempt === attempts) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
            }
        }
        throw lastError;
    }

    private requestOnce<T extends JsonObject>(
        method: HttpMethod,
        resource: string,
        body: JsonObject | undefined,
        authenticated: boolean,
    ): Promise<T> {
        const payload = body ? JSON.stringify(body) : undefined;
        return new Promise<T>((resolve, reject) => {
            const request = https.request(
                {
                    hostname: this.host,
                    port: 443,
                    path: `/api/v1${resource ? `/${resource}` : ''}`,
                    method,
                    agent: this.agent,
                    ca: HUE_SYNC_BOX_CA,
                    servername: this.uniqueId,
                    rejectUnauthorized: !this.allowInsecureTls,
                    checkServerIdentity:
                        this.allowInsecureTls || !this.uniqueId
                            ? undefined
                            : (_hostname, certificate) => tls.checkServerIdentity(this.uniqueId!, certificate),
                    headers: {
                        Accept: 'application/json',
                        ...(authenticated && this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
                        ...(payload
                            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
                            : {}),
                    },
                },
                response => {
                    const chunks: Buffer[] = [];
                    let size = 0;
                    response.on('data', (chunk: Buffer) => {
                        size += chunk.length;
                        if (size > this.maxResponseBytes) {
                            response.destroy(new Error('Response exceeded size limit'));
                        } else {
                            chunks.push(chunk);
                        }
                    });
                    response.on('error', error => reject(new HueSyncBoxError(error.message, 'network')));
                    response.on('end', () => {
                        const status = response.statusCode ?? 0;
                        const endpoint = `/api/v1${resource ? `/${resource}` : ''}`;
                        try {
                            resolve(parseApiResponse<T>(Buffer.concat(chunks).toString('utf8'), status, endpoint));
                        } catch (error) {
                            reject(error instanceof Error ? error : new HueSyncBoxError(String(error), 'http', status));
                        }
                    });
                },
            );
            request.setTimeout(this.timeoutMs, () =>
                request.destroy(new Error(`Request timed out after ${this.timeoutMs} ms`)),
            );
            request.on('error', error => {
                const kind = /certificate|hostname|self.signed|unable to verify/i.test(error.message)
                    ? 'security'
                    : 'network';
                reject(new HueSyncBoxError(error.message, kind));
            });
            if (payload) {
                request.write(payload);
            }
            request.end();
        });
    }

    private isRetryable(error: unknown): boolean {
        return error instanceof HueSyncBoxError && error.kind === 'network' && error.statusCode !== 401;
    }
}
