import {
    DeviceManagement,
    type ActionContext,
    type DeviceDetails,
    type DeviceInfo,
    type DeviceLoadContext,
    type InstanceDetails,
} from '@iobroker/dm-utils';
import type { AdapterInstance } from '@iobroker/adapter-core';
import type { JsonObject } from '../api/types';
import type { DiscoveredSyncBox } from '../discovery/DiscoveryService';
import { deviceObjectId } from '../states/StateManager';

export interface DeviceManagementCallbacks {
    getDevices(): ioBroker.HueSyncBoxDeviceConfig[];
    getDiagnostics(): JsonObject;
    discover(): Promise<DiscoveredSyncBox[]>;
    pair(host: string, uniqueId?: string): Promise<void>;
    refresh(): Promise<void>;
}

export class HueSyncBoxDeviceManagement extends DeviceManagement<AdapterInstance, string> {
    public constructor(
        adapter: AdapterInstance,
        private readonly callbacks: DeviceManagementCallbacks,
    ) {
        super(adapter);
    }

    protected override getInstanceInfo(): InstanceDetails {
        return {
            apiVersion: 'v3',
            identifierLabel: 'Unique ID',
            actions: [
                {
                    id: 'discover',
                    icon: 'search',
                    title: 'Discover Sync Boxes',
                    description: 'Search the local network with mDNS',
                    handler: async context => this.handleDiscover(context),
                },
                {
                    id: 'pair',
                    icon: 'pair',
                    title: 'Pair manually',
                    description: 'Pair by IP address or hostname',
                    handler: async context => this.handlePair(context),
                },
            ],
        };
    }

    protected override loadDevices(context: DeviceLoadContext<string>): void {
        const devices = this.callbacks.getDevices();
        context.setTotalDevices(devices.length);
        for (const device of devices) {
            const root = deviceObjectId(device.name);
            const prefix = `${this.adapter.namespace}.${root}`;
            const diagnostic = (this.callbacks.getDiagnostics().devices as JsonObject | undefined)?.[root] as
                JsonObject | undefined;
            const info: DeviceInfo<string> = {
                id: root,
                identifier: device.uniqueId ?? device.ip,
                name: device.name,
                manufacturer: 'Signify',
                model: { stateId: `${prefix}.device.deviceType` },
                connectionType: 'lan',
                status: {
                    connection: {
                        stateId: `${prefix}.reachable`,
                        mapping: { true: 'connected', false: 'disconnected' },
                    },
                    rssi: { stateId: `${prefix}.device.wifi.strength` },
                    warning: { stateId: `${prefix}.warning` },
                },
                update: {
                    available: diagnostic?.updateAvailable === true,
                    version: typeof diagnostic?.firmwareVersion === 'string' ? diagnostic.firmwareVersion : undefined,
                    newVersion:
                        typeof diagnostic?.updatableFirmwareVersion === 'string'
                            ? diagnostic.updatableFirmwareVersion
                            : undefined,
                },
                hasDetails: true,
                actions: [
                    {
                        id: 'refresh',
                        icon: 'refresh',
                        description: 'Refresh device data',
                        handler: async () => {
                            await this.callbacks.refresh();
                            return { refresh: 'devices' };
                        },
                    },
                ],
            };
            context.addDevice(info);
        }
    }

    protected override getDeviceDetails(id: string): DeviceDetails<string> {
        const diagnostics = this.callbacks.getDiagnostics();
        const data = (diagnostics.devices as JsonObject | undefined)?.[id] as JsonObject | undefined;
        return {
            id,
            schema: {
                type: 'panel',
                items: {
                    diagnostics: {
                        type: 'staticText',
                        text: JSON.stringify(data ?? {}, null, 2),
                        format: 'text',
                        newLine: true,
                    },
                },
            },
        };
    }

    private async handleDiscover(context: ActionContext): Promise<{
        refresh: boolean;
    }> {
        const progress = await context.openProgress('Discovering Hue Sync Boxes', { indeterminate: true });
        let devices: DiscoveredSyncBox[];
        try {
            devices = await this.callbacks.discover();
        } finally {
            await progress.close();
        }
        await context.showMessage(
            devices.length
                ? devices
                      .map(device => `${device.name}: ${device.host} (${device.uniqueId ?? 'unknown ID'})`)
                      .join('\n')
                : 'No Hue Sync Box found. Check mDNS/VLAN routing or use manual pairing.',
        );
        return { refresh: false };
    }

    private async handlePair(context: ActionContext): Promise<{
        refresh: boolean;
    }> {
        const data = await context.showForm(
            {
                type: 'panel',
                items: {
                    instructions: {
                        type: 'staticText',
                        text: 'Hold the button on the Sync Box for three seconds, then enter its IP address or hostname.',
                    },
                    host: { type: 'text', label: 'IP address or hostname', newLine: true },
                    uniqueId: { type: 'text', label: 'Unique ID (optional)', newLine: true },
                },
            },
            { title: 'Pair Hue Sync Box', buttons: ['apply', 'cancel'] },
        );
        if (!data || typeof data.host !== 'string' || !data.host.trim()) {
            return { refresh: false };
        }
        const confirmed = await context.showConfirmation(
            'Is the Sync Box button currently pressed? Pairing sends a registration request now.',
        );
        if (!confirmed) {
            return { refresh: false };
        }
        await this.callbacks.pair(data.host, typeof data.uniqueId === 'string' ? data.uniqueId : undefined);
        await context.showMessage(
            'Pairing succeeded. The adapter instance will use the new box after its next restart.',
        );
        return { refresh: true };
    }
}
