import type { JsonObject, RootResource } from '../api/types';

/**
 *
 */
export interface SyncBoxCapabilities {
    /**
     *
     */
    presets: boolean;
    /**
     *
     */
    ir: boolean;
    /**
     *
     */
    ambientMode: boolean;
    /**
     *
     */
    bluetooth: boolean;
    /**
     *
     */
    overheating: boolean;
    /**
     *
     */
    undervolt: boolean;
    /**
     *
     */
    hdrMode: boolean;
    /**
     *
     */
    hpdInputPortSwitch: boolean;
}

function hasPath(root: JsonObject | undefined, ...path: string[]): boolean {
    let value: unknown = root;
    for (const segment of path) {
        if (!value || typeof value !== 'object' || !(segment in value)) {
            return false;
        }
        value = (value as JsonObject)[segment];
    }
    return true;
}

/**
 *
 */
export function detectCapabilities(root: RootResource): SyncBoxCapabilities {
    const behavior = root.behavior;
    return {
        presets: root.presets !== undefined,
        ir: root.ir !== undefined,
        ambientMode: root.execution?.mode === 'ambient',
        bluetooth: hasPath(root.device, 'bluetooth'),
        overheating: hasPath(root.device, 'overheating'),
        undervolt: hasPath(root.device, 'undervolt'),
        hdrMode: ['input1', 'input2', 'input3', 'input4'].some(input => hasPath(behavior, input, 'hdrMode')),
        hpdInputPortSwitch: ['input1', 'input2', 'input3', 'input4'].some(input =>
            hasPath(behavior, input, 'hpdInputPortSwitch'),
        ),
    };
}
