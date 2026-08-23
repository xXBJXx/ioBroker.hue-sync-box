import { HueSyncBoxClient } from '../api/HueSyncBoxClient';
import { errorMessage, HueSyncBoxError } from '../api/errors';
import type { JsonObject, RootResource } from '../api/types';
import type { NormalizedConfig } from '../config/migration';
import { deviceObjectId, StateManager } from '../states/StateManager';
import { isWritablePath } from '../states/definitions';
import { detectCapabilities } from './capabilities';

const KNOWN_MODES = new Set(['powersave', 'passthrough', 'video', 'game', 'music', 'ambient']);

type PollGroup = 'execution' | 'metadata' | 'status';

interface ManagedBox {
    config: ioBroker.HueSyncBoxDeviceConfig;
    root: string;
    client: HueSyncBoxClient;
    connected: boolean;
    busy: boolean;
    timers: Partial<Record<PollGroup, ioBroker.Timeout>>;
    lastData: RootResource;
}

/**
 *
 */
export class SyncBoxManager {
    private readonly boxes = new Map<string, ManagedBox>();
    private readonly states: StateManager;
    private stopping = false;
    private readonly warningStates = new Map<string, boolean>();
    private readonly apiLevelWarnings = new Set<string>();
    private readonly unknownModes = new Set<string>();
    private readonly lastErrorLog = new Map<string, number>();

    /**
     *
     */
    public constructor(
        private readonly adapter: ioBroker.Adapter,
        private readonly config: NormalizedConfig,
    ) {
        this.states = new StateManager(adapter);
    }

    /**
     *
     */
    public async start(): Promise<void> {
        this.stopping = false;
        for (const device of this.config.devices.filter(device => !device.disabled)) {
            try {
                const box = await this.createBox(device);
                this.boxes.set(box.root, box);
                await this.states.ensureDevice(box.root, device.name);
                await this.pollAll(box);
                this.schedule(box, 'execution', this.config.pollExecutionMs);
                this.schedule(box, 'status', this.config.pollStatusMs);
                this.schedule(box, 'metadata', this.config.pollMetadataMs);
            } catch (error) {
                this.adapter.log.error(`Cannot initialize ${device.name}: ${errorMessage(error)}`);
            }
        }
        await this.updateConnectionState();
        await this.adapter.subscribeStatesAsync('box_*.*');
    }

    /**
     *
     */
    public stop(): void {
        this.stopping = true;
        for (const box of this.boxes.values()) {
            for (const timer of Object.values(box.timers)) {
                this.adapter.clearTimeout(timer);
            }
            box.client.close();
        }
        this.boxes.clear();
    }

    /**
     *
     */
    public async handleStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack) {
            return;
        }
        const relative = id.startsWith(`${this.adapter.namespace}.`) ? id.slice(this.adapter.namespace.length + 1) : id;
        const box = [...this.boxes.values()].find(candidate => relative.startsWith(`${candidate.root}.`));
        if (!box) {
            return;
        }
        const path = relative.slice(box.root.length + 1);
        if (!isWritablePath(path)) {
            this.adapter.log.warn(`Rejected write to read-only state ${relative}`);
            return;
        }
        try {
            const segments = path.split('.');
            const property = segments.pop()!;
            await box.client.updateResource<JsonObject>(segments.join('/'), { [property]: state.val });
            await this.adapter.setStateAsync(relative, { val: state.val, ack: true });
            await this.pollResource(box, segments[0]!);
        } catch (error) {
            this.adapter.log.warn(`Write to ${relative} failed: ${errorMessage(error)}`);
            await this.pollResource(box, path.split('.')[0]!);
        }
    }

    /**
     *
     */
    public diagnostics(): JsonObject {
        const devices: JsonObject = {};
        for (const box of this.boxes.values()) {
            devices[box.root] = {
                name: box.config.name,
                host: box.config.ip,
                uniqueId: box.config.uniqueId ?? null,
                connected: box.connected,
                apiLevel: box.lastData.device?.apiLevel ?? null,
                firmwareVersion: box.lastData.device?.firmwareVersion ?? null,
                updatableFirmwareVersion: box.lastData.device?.updatableFirmwareVersion ?? null,
                updateAvailable: typeof box.lastData.device?.updatableFirmwareVersion === 'string',
                capabilities: detectCapabilities(box.lastData) as unknown as JsonObject,
            };
        }
        return { devices, insecureTls: this.config.allowInsecureTls };
    }

    /**
     *
     */
    public async refresh(): Promise<void> {
        await Promise.all([...this.boxes.values()].map(box => this.pollAll(box)));
    }

    private async createBox(config: ioBroker.HueSyncBoxDeviceConfig): Promise<ManagedBox> {
        let uniqueId = config.uniqueId;
        if (!uniqueId) {
            const bootstrap = new HueSyncBoxClient({ host: config.ip, allowInsecureTls: true });
            try {
                uniqueId = (await bootstrap.getPublicDevice()).uniqueId;
                config.uniqueId = uniqueId;
            } finally {
                bootstrap.close();
            }
        }
        return {
            config,
            root: deviceObjectId(config.name),
            client: new HueSyncBoxClient({
                host: config.ip,
                uniqueId,
                accessToken: config.token,
                allowInsecureTls: this.config.allowInsecureTls,
            }),
            connected: false,
            busy: false,
            timers: {},
            lastData: {},
        };
    }

    private schedule(box: ManagedBox, group: PollGroup, delay: number): void {
        const timer = this.adapter.setTimeout(async () => {
            if (this.stopping) {
                return;
            }
            try {
                if (group === 'execution') {
                    await this.pollResource(box, 'execution');
                } else if (group === 'status') {
                    for (const resource of ['hue', 'hdmi']) {
                        await this.pollResource(box, resource);
                    }
                } else {
                    for (const resource of ['device', 'behavior', 'presets']) {
                        await this.pollResource(box, resource);
                    }
                }
            } finally {
                if (!this.stopping) {
                    this.schedule(box, group, delay);
                }
            }
        }, delay);
        if (timer) {
            box.timers[group] = timer;
        }
    }

    private async pollAll(box: ManagedBox): Promise<void> {
        if (box.busy) {
            return;
        }
        box.busy = true;
        try {
            const root = await box.client.getRoot();
            box.lastData = root;
            this.validateApiLevel(box, root);
            await this.logHealthTransitions(box, root.device);
            this.logUnknownMode(box, root.execution?.mode);
            for (const [resource, value] of Object.entries(root)) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    await this.states.writeResource(box.root, resource, value);
                }
            }
            await this.states.writeJson(box.root, root);
            await this.setConnected(box, true);
        } catch (error) {
            this.logPollError(box, error);
            await this.setConnected(box, false);
        } finally {
            box.busy = false;
        }
    }

    private validateApiLevel(box: ManagedBox, root: RootResource): void {
        const level = root.device?.apiLevel;
        if (typeof level === 'number' && level < 7 && !this.apiLevelWarnings.has(box.root)) {
            this.apiLevelWarnings.add(box.root);
            this.adapter.log.error(
                `${box.config.name} reports API level ${level}; API level 7 or newer is required. Update the Sync Box firmware.`,
            );
        }
    }

    private async logHealthTransitions(box: ManagedBox, device: JsonObject | undefined): Promise<void> {
        for (const field of ['overheating', 'undervolt']) {
            if (typeof device?.[field] !== 'boolean') {
                continue;
            }
            const key = `${box.root}.${field}`;
            const active = device[field];
            if (this.warningStates.get(key) === active) {
                continue;
            }
            this.warningStates.set(key, active);
            if (active) {
                this.adapter.log.warn(
                    `${box.config.name} reports ${field}. Check the device and its power supply immediately.`,
                );
            } else {
                this.adapter.log.info(`${box.config.name}: ${field} warning cleared.`);
            }
        }
        await this.states.setWarning(box.root, device?.overheating === true || device?.undervolt === true);
    }

    private async pollResource(box: ManagedBox, resource: string): Promise<void> {
        if (box.busy || this.stopping) {
            return;
        }
        box.busy = true;
        try {
            const value = await box.client.getResource<JsonObject>(resource);
            box.lastData[resource] = value;
            if (resource === 'device') {
                this.validateApiLevel(box, box.lastData);
                await this.logHealthTransitions(box, value);
            }
            if (resource === 'execution') {
                this.logUnknownMode(box, value.mode);
            }
            await this.states.writeResource(box.root, resource, value);
            await this.setConnected(box, true);
        } catch (error) {
            this.logPollError(box, error);
            await this.setConnected(box, false);
        } finally {
            box.busy = false;
        }
    }

    private logPollError(box: ManagedBox, error: unknown): void {
        const message = errorMessage(error);
        const key = `${box.root}:${message}`;
        const now = Date.now();
        if (!box.connected && now - (this.lastErrorLog.get(key) ?? 0) < 300_000) {
            return;
        }
        this.lastErrorLog.set(key, now);
        const level = error instanceof HueSyncBoxError && error.kind === 'auth' ? 'error' : 'warn';
        this.adapter.log[level](`Request to ${box.config.name} failed: ${message}`);
    }

    private logUnknownMode(box: ManagedBox, mode: unknown): void {
        if (typeof mode !== 'string' || KNOWN_MODES.has(mode) || this.unknownModes.has(`${box.root}:${mode}`)) {
            return;
        }
        this.unknownModes.add(`${box.root}:${mode}`);
        this.adapter.log.info(
            `${box.config.name} reports the new, unknown sync mode "${mode}"; its value is preserved.`,
        );
    }

    private async setConnected(box: ManagedBox, connected: boolean): Promise<void> {
        if (box.connected !== connected) {
            this.adapter.log.info(`${box.config.name} is ${connected ? 'connected' : 'disconnected'}`);
        }
        box.connected = connected;
        await this.states.setReachable(box.root, connected);
        await this.updateConnectionState();
    }

    private async updateConnectionState(): Promise<void> {
        const boxes = [...this.boxes.values()];
        await this.adapter.setStateAsync(
            'info.connection',
            boxes.length > 0 && boxes.every(box => box.connected),
            true,
        );
    }
}
