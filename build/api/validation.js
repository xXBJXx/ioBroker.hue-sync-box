"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateHost = validateHost;
exports.validateUniqueId = validateUniqueId;
exports.safeResourcePath = safeResourcePath;
const node_net_1 = require("node:net");
const errors_1 = require("./errors");
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i;
const UNIQUE_ID = /^[a-z\d][a-z\d._-]{2,127}$/i;
function validateHost(value) {
    const host = value
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/$/, '');
    if (!host ||
        host.includes('/') ||
        host.includes('@') ||
        host.includes(':') ||
        (!(0, node_net_1.isIP)(host) && !HOSTNAME.test(host))) {
        throw new errors_1.HueSyncBoxError(`Invalid Sync Box host: ${value}`, 'validation');
    }
    return host;
}
function validateUniqueId(value) {
    const id = value.trim();
    if (!UNIQUE_ID.test(id)) {
        throw new errors_1.HueSyncBoxError('Invalid Sync Box unique ID', 'validation');
    }
    return id;
}
function safeResourcePath(path) {
    const clean = path.replace(/^\/+|\/+$/g, '');
    if (!/^(?:device|hue|execution|hdmi|behavior|presets)(?:\/[a-zA-Z\d._-]+){0,3}$/.test(clean)) {
        throw new errors_1.HueSyncBoxError(`Unsupported API resource: ${path}`, 'validation');
    }
    return clean;
}
//# sourceMappingURL=validation.js.map