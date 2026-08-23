"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HueSyncBoxClient = void 0;
const https = __importStar(require("node:https"));
const tls = __importStar(require("node:tls"));
const certificate_1 = require("./certificate");
const errors_1 = require("./errors");
const parser_1 = require("./parser");
const validation_1 = require("./validation");
/**
 *
 */
class HueSyncBoxClient {
    host;
    uniqueId;
    accessToken;
    allowInsecureTls;
    timeoutMs;
    maxResponseBytes;
    agent;
    /**
     *
     */
    constructor(options) {
        this.host = (0, validation_1.validateHost)(options.host);
        this.uniqueId = options.uniqueId ? (0, validation_1.validateUniqueId)(options.uniqueId) : undefined;
        this.accessToken = options.accessToken?.trim() || undefined;
        this.allowInsecureTls = options.allowInsecureTls === true;
        this.timeoutMs = options.timeoutMs ?? 8_000;
        this.maxResponseBytes = options.maxResponseBytes ?? 1_048_576;
        this.agent = new https.Agent({ keepAlive: true, maxSockets: 2, timeout: 30_000 });
    }
    /**
     *
     */
    close() {
        this.agent.destroy();
    }
    /**
     *
     */
    getRoot() {
        return this.request('GET', '', undefined, { retries: 2 });
    }
    /**
     *
     */
    getResource(resource) {
        return this.request('GET', (0, validation_1.safeResourcePath)(resource), undefined, { retries: 2 });
    }
    /**
     *
     */
    updateResource(resource, body) {
        return this.request('PUT', (0, validation_1.safeResourcePath)(resource), body);
    }
    /**
     *
     */
    deleteResource(resource) {
        return this.request('DELETE', (0, validation_1.safeResourcePath)(resource));
    }
    /**
     *
     */
    getPublicDevice() {
        return this.request('GET', 'device', undefined, { authenticated: false, retries: 1 });
    }
    /**
     *
     */
    register(appName, instanceName) {
        return this.request('POST', 'registrations', { appName, instanceName }, { authenticated: false });
    }
    async request(method, resource, body, options = {}) {
        const authenticated = options.authenticated !== false;
        if (authenticated && !this.accessToken) {
            throw new errors_1.HueSyncBoxError('No access token configured', 'auth', 401);
        }
        const attempts = Math.max(1, (options.retries ?? 0) + 1);
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                return await this.requestOnce(method, resource, body, authenticated);
            }
            catch (error) {
                lastError = error;
                if (!this.isRetryable(error) || attempt === attempts) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 200 * 2 ** (attempt - 1)));
            }
        }
        throw lastError;
    }
    requestOnce(method, resource, body, authenticated) {
        const payload = body ? JSON.stringify(body) : undefined;
        return new Promise((resolve, reject) => {
            const request = https.request({
                hostname: this.host,
                port: 443,
                path: `/api/v1${resource ? `/${resource}` : ''}`,
                method,
                agent: this.agent,
                ca: certificate_1.HUE_SYNC_BOX_CA,
                servername: this.uniqueId,
                rejectUnauthorized: !this.allowInsecureTls,
                checkServerIdentity: this.allowInsecureTls || !this.uniqueId
                    ? undefined
                    : (_hostname, certificate) => tls.checkServerIdentity(this.uniqueId, certificate),
                headers: {
                    Accept: 'application/json',
                    ...(authenticated && this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
                    ...(payload
                        ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
                        : {}),
                },
            }, response => {
                const chunks = [];
                let size = 0;
                response.on('data', (chunk) => {
                    size += chunk.length;
                    if (size > this.maxResponseBytes) {
                        response.destroy(new Error('Response exceeded size limit'));
                    }
                    else {
                        chunks.push(chunk);
                    }
                });
                response.on('error', error => reject(new errors_1.HueSyncBoxError(error.message, 'network')));
                response.on('end', () => {
                    const status = response.statusCode ?? 0;
                    const endpoint = `/api/v1${resource ? `/${resource}` : ''}`;
                    try {
                        resolve((0, parser_1.parseApiResponse)(Buffer.concat(chunks).toString('utf8'), status, endpoint));
                    }
                    catch (error) {
                        reject(error instanceof Error ? error : new errors_1.HueSyncBoxError(String(error), 'http', status));
                    }
                });
            });
            request.setTimeout(this.timeoutMs, () => request.destroy(new Error(`Request timed out after ${this.timeoutMs} ms`)));
            request.on('error', error => {
                const kind = /certificate|hostname|self.signed|unable to verify/i.test(error.message)
                    ? 'security'
                    : 'network';
                reject(new errors_1.HueSyncBoxError(error.message, kind));
            });
            if (payload) {
                request.write(payload);
            }
            request.end();
        });
    }
    isRetryable(error) {
        return error instanceof errors_1.HueSyncBoxError && error.kind === 'network' && error.statusCode !== 401;
    }
}
exports.HueSyncBoxClient = HueSyncBoxClient;
//# sourceMappingURL=HueSyncBoxClient.js.map