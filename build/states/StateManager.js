"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateManager = void 0;
exports.deviceObjectId = deviceObjectId;
const definitions_1 = require("./definitions");
/**
 *
 */
function deviceObjectId(name) {
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
class StateManager {
    adapter;
    knownChannels = new Set();
    knownStates = new Set();
    /**
     *
     */
    constructor(adapter) {
        this.adapter = adapter;
    }
    /**
     *
     */
    async ensureDevice(root, name) {
        await this.adapter.extendObject(root, { type: 'device', common: { name }, native: {} });
        await this.writePrimitive(root, 'reachable', false);
        await this.writePrimitive(root, 'json', '{}');
    }
    /**
     *
     */
    async writeResource(root, resource, value) {
        await this.writeValue(root, resource, value);
    }
    /**
     *
     */
    async writeJson(root, value) {
        await this.writePrimitive(root, 'json', JSON.stringify(value));
    }
    /**
     *
     */
    async setReachable(root, reachable) {
        await this.writePrimitive(root, 'reachable', reachable);
    }
    async setWarning(root, warning) {
        await this.writePrimitive(root, 'warning', warning);
    }
    async writeValue(root, path, value) {
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
    async ensureChannel(root, path) {
        const id = `${root}.${path}`;
        if (this.knownChannels.has(id)) {
            return;
        }
        const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
        if (parent) {
            await this.ensureChannel(root, parent);
        }
        await this.adapter.extendObject(id, {
            type: 'channel',
            common: { name: path.split('.').at(-1) ?? path },
            native: {},
        });
        this.knownChannels.add(id);
    }
    async writePrimitive(root, path, value) {
        const id = `${root}.${path}`;
        const parent = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : '';
        if (parent) {
            await this.ensureChannel(root, parent);
        }
        if (!this.knownStates.has(id)) {
            await this.adapter.extendObject(id, {
                type: 'state',
                common: (0, definitions_1.stateCommon)(path, value),
                native: { apiPath: path },
            });
            this.knownStates.add(id);
        }
        await this.adapter.setState(id, { val: value, ack: true });
    }
}
exports.StateManager = StateManager;
//# sourceMappingURL=StateManager.js.map