"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWritablePath = isWritablePath;
exports.stateCommon = stateCommon;
const WRITABLE = new Set([
    'device.name',
    'device.ledMode',
    'device.bluetooth',
    'device.update.autoUpdateEnabled',
    'device.update.autoUpdateTime',
    'execution.syncActive',
    'execution.hdmiActive',
    'execution.mode',
    'execution.hdmiSource',
    'execution.hueTarget',
    'execution.brightness',
    'execution.video.intensity',
    'execution.video.backgroundLighting',
    'execution.game.intensity',
    'execution.game.backgroundLighting',
    'execution.music.intensity',
    'execution.music.palette',
    'execution.preset',
    'hdmi.input1.name',
    'hdmi.input1.type',
    'hdmi.input2.name',
    'hdmi.input2.type',
    'hdmi.input3.name',
    'hdmi.input3.type',
    'hdmi.input4.name',
    'hdmi.input4.type',
    'behavior.inactivePowersave',
    'behavior.cecPowersave',
    'behavior.usbPowersave',
    'behavior.hpdInputSwitch',
    'behavior.forceDoviNative',
    'behavior.input1.cecInputSwitch',
    'behavior.input1.linkAutoSync',
    'behavior.input1.hdrMode',
    'behavior.input1.hpdInputPortSwitch',
    'behavior.input2.cecInputSwitch',
    'behavior.input2.linkAutoSync',
    'behavior.input2.hdrMode',
    'behavior.input2.hpdInputPortSwitch',
    'behavior.input3.cecInputSwitch',
    'behavior.input3.linkAutoSync',
    'behavior.input3.hdrMode',
    'behavior.input3.hpdInputPortSwitch',
    'behavior.input4.cecInputSwitch',
    'behavior.input4.linkAutoSync',
    'behavior.input4.hdrMode',
    'behavior.input4.hpdInputPortSwitch',
]);
const UNITS = {
    'execution.brightness': '%',
    'device.wifi.strength': '%',
    'device.update.autoUpdateTime': 'min',
};
const RANGES = {
    'execution.brightness': { min: 0, max: 200 },
    'device.ledMode': { min: 0, max: 2 },
    'device.wifi.strength': { min: 0, max: 100 },
};
const ENUMS = {
    'execution.mode': {
        powersave: 'Power save',
        passthrough: 'Passthrough',
        video: 'Video',
        game: 'Game',
        music: 'Music',
        ambient: 'Ambient',
    },
    'execution.hdmiSource': { input1: 'HDMI 1', input2: 'HDMI 2', input3: 'HDMI 3', input4: 'HDMI 4' },
    'execution.video.intensity': { subtle: 'Subtle', moderate: 'Moderate', high: 'High', intense: 'Intense' },
    'execution.game.intensity': { subtle: 'Subtle', moderate: 'Moderate', high: 'High', intense: 'Intense' },
    'execution.music.intensity': { subtle: 'Subtle', moderate: 'Moderate', high: 'High', intense: 'Intense' },
};
/**
 *
 */
function isWritablePath(path) {
    return WRITABLE.has(path);
}
/**
 *
 */
function stateCommon(path, value) {
    const type = value === null ? 'mixed' : typeof value;
    const leaf = path.split('.').at(-1) ?? path;
    const warning = /(?:overheating|undervolt)$/i.test(path);
    const connected = /(?:reachable|connectionState)$/i.test(path);
    const common = {
        name: leaf.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase()),
        type: type,
        role: warning
            ? 'indicator.warning'
            : connected
                ? 'indicator.connected'
                : type === 'boolean'
                    ? isWritablePath(path)
                        ? 'switch'
                        : 'indicator'
                    : type === 'number'
                        ? path === 'execution.brightness'
                            ? 'level'
                            : 'value'
                        : 'text',
        read: true,
        write: isWritablePath(path),
    };
    if (UNITS[path]) {
        common.unit = UNITS[path];
    }
    if (RANGES[path]) {
        Object.assign(common, RANGES[path]);
    }
    if (ENUMS[path]) {
        common.states = ENUMS[path];
    }
    return common;
}
//# sourceMappingURL=definitions.js.map