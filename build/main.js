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
exports.HueSyncBox = void 0;
const utils = __importStar(require("@iobroker/adapter-core"));
const HueSyncBoxClient_1 = require("./api/HueSyncBoxClient");
const errors_1 = require("./api/errors");
const migration_1 = require("./config/migration");
const SyncBoxManager_1 = require("./device/SyncBoxManager");
const DiscoveryService_1 = require("./discovery/DiscoveryService");
/**
 *
 */
class HueSyncBox extends utils.Adapter {
    manager;
    discovery = new DiscoveryService_1.DiscoveryService();
    normalizedConfig;
    /**
     *
     */
    constructor(options = {}) {
        super({ ...options, name: 'hue-sync-box' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    async onReady() {
        await this.setStateAsync('info.connection', false, true);
        this.normalizedConfig = (0, migration_1.normalizeConfig)(this.config);
        if (this.normalizedConfig.allowInsecureTls) {
            this.log.warn('TLS certificate validation is disabled by configuration. This should only be used temporarily for diagnostics.');
        }
        if (!this.normalizedConfig.devices.length) {
            this.log.info('No Hue Sync Box configured. Open the adapter settings to discover and pair a box.');
            return;
        }
        this.manager = new SyncBoxManager_1.SyncBoxManager(this, this.normalizedConfig);
        await this.manager.start();
    }
    async onStateChange(id, state) {
        await this.manager?.handleStateChange(id, state);
    }
    async onMessage(message) {
        if (!message.command || !message.callback) {
            return;
        }
        const payload = (message.message && typeof message.message === 'object' ? message.message : {});
        try {
            let result;
            switch (message.command) {
                case 'discover':
                    result = await this.discovery.discover(payload.timeoutMs, this.normalizedConfig?.discoveryInterface);
                    break;
                case 'register':
                    result = await this.register(payload);
                    break;
                case 'pairAndSave':
                    if (!payload.host) {
                        throw new Error('Missing host');
                    }
                    await this.pairAndSave(payload.host, payload.uniqueId, payload.name);
                    result = { restartRequired: true };
                    break;
                case 'diagnostics':
                    result = this.manager?.diagnostics() ?? { devices: {} };
                    break;
                case 'refresh':
                    await this.manager?.refresh();
                    result = { ok: true };
                    break;
                default:
                    throw new Error(`Unknown command: ${message.command}`);
            }
            this.sendTo(message.from, message.command, { ok: true, result }, message.callback);
        }
        catch (error) {
            this.sendTo(message.from, message.command, { ok: false, error: (0, errors_1.errorMessage)(error) }, message.callback);
        }
    }
    async register(payload) {
        if (!payload.host) {
            throw new Error('Missing host');
        }
        let uniqueId = payload.uniqueId;
        if (!uniqueId) {
            const bootstrap = new HueSyncBoxClient_1.HueSyncBoxClient({ host: payload.host, allowInsecureTls: true });
            try {
                uniqueId = (await bootstrap.getPublicDevice()).uniqueId;
            }
            finally {
                bootstrap.close();
            }
        }
        const client = new HueSyncBoxClient_1.HueSyncBoxClient({
            host: payload.host,
            uniqueId,
            allowInsecureTls: this.normalizedConfig?.allowInsecureTls,
        });
        try {
            const registration = await client.register(payload.appName ?? 'ioBroker Hue Sync Box', payload.instanceName ?? this.namespace);
            return { ...registration, uniqueId };
        }
        finally {
            client.close();
        }
    }
    async pairAndSave(host, uniqueId, name) {
        const registration = (await this.register({ host, uniqueId }));
        const instanceId = `system.adapter.${this.namespace}`;
        const instance = await this.getForeignObjectAsync(instanceId);
        if (!instance || instance.type !== 'instance') {
            throw new Error('Cannot read adapter instance configuration');
        }
        const devices = (0, migration_1.normalizeConfig)(instance.native).devices;
        if (devices.some(device => device.uniqueId === registration.uniqueId || device.ip === host)) {
            throw new Error('This Sync Box is already configured');
        }
        devices.push({
            name: name?.trim() || `Hue Sync Box ${devices.length + 1}`,
            ip: host,
            token: registration.accessToken,
            uniqueId: registration.uniqueId,
            id: devices.length,
        });
        await this.extendForeignObjectAsync(instanceId, { native: { ...instance.native, devices } });
        this.normalizedConfig = { ...(0, migration_1.normalizeConfig)(instance.native), devices };
    }
    onUnload(callback) {
        this.discovery.stop();
        this.manager?.stop();
        callback();
    }
}
exports.HueSyncBox = HueSyncBox;
if (require.main !== module) {
    module.exports = (options) => new HueSyncBox(options);
}
else {
    new HueSyncBox();
}
//# sourceMappingURL=main.js.map