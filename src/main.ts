import * as utils from '@iobroker/adapter-core';
import { HueSyncBoxClient } from './api/HueSyncBoxClient';
import { errorMessage } from './api/errors';
import { normalizeConfig, type NormalizedConfig } from './config/migration';
import { SyncBoxManager } from './device/SyncBoxManager';
import { DiscoveryService } from './discovery/DiscoveryService';

interface MessagePayload {
    host?: string;
    uniqueId?: string;
    timeoutMs?: number;
    appName?: string;
    instanceName?: string;
    name?: string;
}

/**
 *
 */
export class HueSyncBox extends utils.Adapter {
    private manager?: SyncBoxManager;
    private readonly discovery = new DiscoveryService();
    private normalizedConfig?: NormalizedConfig;

    /**
     *
     */
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'hue-sync-box' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        await this.setStateAsync('info.connection', false, true);
        this.normalizedConfig = normalizeConfig(this.config);
        if (this.normalizedConfig.allowInsecureTls) {
            this.log.warn(
                'TLS certificate validation is disabled by configuration. This should only be used temporarily for diagnostics.',
            );
        }
        if (!this.normalizedConfig.devices.length) {
            this.log.info('No Hue Sync Box configured. Open the adapter settings to discover and pair a box.');
            return;
        }
        this.manager = new SyncBoxManager(this, this.normalizedConfig);
        await this.manager.start();
    }

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        await this.manager?.handleStateChange(id, state);
    }

    private async onMessage(message: ioBroker.Message): Promise<void> {
        if (!message.command || !message.callback) {
            return;
        }
        const payload = (
            message.message && typeof message.message === 'object' ? message.message : {}
        ) as MessagePayload;
        try {
            let result: unknown;
            switch (message.command) {
                case 'discover':
                    result = await this.discovery.discover(
                        payload.timeoutMs,
                        this.normalizedConfig?.discoveryInterface,
                    );
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
        } catch (error) {
            this.sendTo(message.from, message.command, { ok: false, error: errorMessage(error) }, message.callback);
        }
    }

    private async register(payload: MessagePayload): Promise<unknown> {
        if (!payload.host) {
            throw new Error('Missing host');
        }
        let uniqueId = payload.uniqueId;
        if (!uniqueId) {
            const bootstrap = new HueSyncBoxClient({ host: payload.host, allowInsecureTls: true });
            try {
                uniqueId = (await bootstrap.getPublicDevice()).uniqueId;
            } finally {
                bootstrap.close();
            }
        }
        const client = new HueSyncBoxClient({
            host: payload.host,
            uniqueId,
            allowInsecureTls: this.normalizedConfig?.allowInsecureTls,
        });
        try {
            const registration = await client.register(
                payload.appName ?? 'ioBroker Hue Sync Box',
                payload.instanceName ?? this.namespace,
            );
            return { ...registration, uniqueId };
        } finally {
            client.close();
        }
    }

    private async pairAndSave(host: string, uniqueId?: string, name?: string): Promise<void> {
        const registration = (await this.register({ host, uniqueId })) as {
            /**
             *
             */
            accessToken: string;
            /**
             *
             */
            uniqueId: string;
            [key: string]: unknown;
        };
        const instanceId = `system.adapter.${this.namespace}`;
        const instance = await this.getForeignObjectAsync(instanceId);
        if (!instance || instance.type !== 'instance') {
            throw new Error('Cannot read adapter instance configuration');
        }
        const devices = normalizeConfig(instance.native as ioBroker.AdapterConfig).devices;
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
        this.normalizedConfig = { ...normalizeConfig(instance.native as ioBroker.AdapterConfig), devices };
    }

    private onUnload(callback: () => void): void {
        this.discovery.stop();
        this.manager?.stop();
        callback();
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new HueSyncBox(options);
} else {
    new HueSyncBox();
}
