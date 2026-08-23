import type { JsonObject, JsonPrimitive, JsonValue } from '../api/types';
import { stateCommon } from './definitions';

/**
 *
 */
export function deviceObjectId(name: string): string {
    return `box_${name
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '_')}`;
}

/**
 *
 */
export class StateManager {
    private readonly knownChannels = new Set<string>();
    private readonly knownStates = new Set<string>();

    /**
     *
     */
    public constructor(private readonly adapter: ioBroker.Adapter) {}

    /**
     *
     */
    public async ensureDevice(root: string, name: string): Promise<void> {
        await this.adapter.extendObjectAsync(root, { type: 'device', common: { name }, native: {} });
        await this.writePrimitive(root, 'reachable', false);
        await this.writePrimitive(root, 'json', '{}');
    }

    /**
     *
     */
    public async writeResource(root: string, resource: string, value: JsonObject): Promise<void> {
        await this.writeValue(root, resource, value);
    }

    /**
     *
     */
    public async writeJson(root: string, value: JsonObject): Promise<void> {
        await this.writePrimitive(root, 'json', JSON.stringify(value));
    }

    /**
     *
     */
    public async setReachable(root: string, reachable: boolean): Promise<void> {
        await this.writePrimitive(root, 'reachable', reachable);
    }

    public async setWarning(root: string, warning: boolean): Promise<void> {
        await this.writePrimitive(root, 'warning', warning);
    }

    private async writeValue(root: string, path: string, value: JsonValue | undefined): Promise<void> {
        if (value === undefined) {
            return;
        }
        if (value === null || typeof value !== 'object') {
            await this.writePrimitive(root, path, value);
            return;
        }
        if (Array.isArray(value)) {
            await this.writePrimitive(root, path, JSON.stringify(value));
            return;
        }
        await this.ensureChannel(root, path);
        for (const [key, child] of Object.entries(value)) {
            await this.writeValue(root, `${path}.${key}`, child);
        }
    }

    private async ensureChannel(root: string, path: string): Promise<void> {
        const id = `${root}.${path}`;
        if (this.knownChannels.has(id)) {
            return;
        }
        const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
        if (parent) {
            await this.ensureChannel(root, parent);
        }
        await this.adapter.extendObjectAsync(id, {
            type: 'channel',
            common: { name: path.split('.').at(-1) ?? path },
            native: {},
        });
        this.knownChannels.add(id);
    }

    private async writePrimitive(root: string, path: string, value: JsonPrimitive | string): Promise<void> {
        const id = `${root}.${path}`;
        const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
        if (parent) {
            await this.ensureChannel(root, parent);
        }
        if (!this.knownStates.has(id)) {
            await this.adapter.extendObjectAsync(id, {
                type: 'state',
                common: stateCommon(path, value),
                native: { apiPath: path },
            });
            this.knownStates.add(id);
        }
        await this.adapter.setStateAsync(id, { val: value, ack: true });
    }
}
