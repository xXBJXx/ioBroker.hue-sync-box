import { isIP } from 'node:net';
import { HueSyncBoxError } from './errors';

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;
const UNIQUE_ID = /^[a-z\d][a-z\d._-]{2,127}$/i;

export function validateHost(value: string): string {
    const host = value
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/$/, '');
    if (
        !host ||
        host.includes('/') ||
        host.includes('@') ||
        host.includes(':') ||
        (!isIP(host) && !HOSTNAME.test(host))
    ) {
        throw new HueSyncBoxError(`Invalid Sync Box host: ${value}`, 'validation');
    }
    return host;
}

export function validateUniqueId(value: string): string {
    const id = value.trim();
    if (!UNIQUE_ID.test(id)) {
        throw new HueSyncBoxError('Invalid Sync Box unique ID', 'validation');
    }
    return id;
}

export function safeResourcePath(path: string): string {
    const clean = path.replace(/^\/+|\/+$/g, '');
    if (!/^(?:device|hue|execution|hdmi|behavior|presets)(?:\/[a-zA-Z\d._-]+){0,3}$/.test(clean)) {
        throw new HueSyncBoxError(`Unsupported API resource: ${path}`, 'validation');
    }
    return clean;
}
