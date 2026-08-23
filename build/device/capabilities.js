"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCapabilities = detectCapabilities;
function hasPath(root, ...path) {
    let value = root;
    for (const segment of path) {
        if (!value || typeof value !== 'object' || !(segment in value)) {
            return false;
        }
        value = value[segment];
    }
    return true;
}
/**
 *
 */
function detectCapabilities(root) {
    const behavior = root.behavior;
    return {
        presets: root.presets !== undefined,
        ir: root.ir !== undefined,
        ambientMode: root.execution?.mode === 'ambient',
        bluetooth: hasPath(root.device, 'bluetooth'),
        overheating: hasPath(root.device, 'overheating'),
        undervolt: hasPath(root.device, 'undervolt'),
        hdrMode: ['input1', 'input2', 'input3', 'input4'].some(input => hasPath(behavior, input, 'hdrMode')),
        hpdInputPortSwitch: ['input1', 'input2', 'input3', 'input4'].some(input => hasPath(behavior, input, 'hpdInputPortSwitch')),
    };
}
//# sourceMappingURL=capabilities.js.map