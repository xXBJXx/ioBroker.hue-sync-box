"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeConfig = normalizeConfig;
function bounded(value, fallback, minimum, maximum) {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
function normalizeConfig(config) {
    const devices = Array.isArray(config.devices)
        ? config.devices
            .filter(device => device && typeof device === 'object')
            .map((device, index) => ({
            name: String(device.name || `Hue Sync Box ${index + 1}`).trim(),
            ip: String(device.ip || '')
                .trim()
                .replace(/^https?:\/\//i, '')
                .replace(/\/$/, ''),
            token: String(device.token || '').trim(),
            id: typeof device.id === 'number' ? device.id : index,
            uniqueId: device.uniqueId ? String(device.uniqueId).trim() : undefined,
            disabled: device.disabled === true,
        }))
            .filter(device => device.ip)
        : [];
    return {
        devices,
        allowInsecureTls: config.allowInsecureTls === true,
        discoveryInterface: config.discoveryInterface?.trim() || undefined,
        pollExecutionMs: bounded(config.pollExecutionSeconds, 3, 2, 60) * 1_000,
        pollStatusMs: bounded(config.pollStatusSeconds, 15, 5, 300) * 1_000,
        pollMetadataMs: bounded(config.pollMetadataMinutes, 5, 1, 1_440) * 60_000,
    };
}
//# sourceMappingURL=migration.js.map