import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JsonObject, RootResource } from '../src/api/types';
import { normalizeConfig } from '../src/config/migration';
import { detectCapabilities } from '../src/device/capabilities';
import { deviceObjectId } from '../src/states/StateManager';
import { isWritablePath, stateCommon } from '../src/states/definitions';

function fixture(name: string): JsonObject {
    return JSON.parse(readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')) as JsonObject;
}

describe('capability detection', () => {
    it('distinguishes response-driven 4K and 8K features', () => {
        const fourK: RootResource = {
            device: fixture('device-4k.json') as RootResource['device'],
            behavior: fixture('behavior.json'),
        };
        const eightK: RootResource = { device: fixture('device-8k.json') as RootResource['device'] };
        expect(detectCapabilities(fourK)).toMatchObject({ hdrMode: true, hpdInputPortSwitch: true, undervolt: false });
        expect(detectCapabilities(eightK)).toMatchObject({ undervolt: true, hdrMode: false });
    });

    it('recognizes ambient mode and presets from returned resources', () => {
        expect(
            detectCapabilities({ execution: fixture('execution.json'), presets: fixture('presets.json') }),
        ).toMatchObject({ ambientMode: true, presets: true });
    });
});

describe('configuration and state compatibility', () => {
    it('migrates the historic devices array and bounds intervals', () => {
        const config = normalizeConfig({
            devices: [{ name: 'Wohnzimmer', ip: 'https://192.0.2.2/', token: 'secret', id: 0 }],
            pollExecutionSeconds: 0,
            pollStatusSeconds: 9999,
            pollMetadataMinutes: 5,
        });
        expect(config.devices[0]).toMatchObject({ name: 'Wohnzimmer', ip: '192.0.2.2', token: 'secret' });
        expect(config.pollExecutionMs).toBe(2_000);
        expect(config.pollStatusMs).toBe(300_000);
    });

    it('keeps legacy box IDs and accurate brightness metadata', () => {
        expect(deviceObjectId('Wöhn Zimmer!')).toBe('box_woehn_zimmer_');
        expect(stateCommon('execution.brightness', 100)).toMatchObject({
            type: 'number',
            min: 0,
            max: 200,
            unit: '%',
            write: true,
        });
        expect(isWritablePath('device.overheating')).toBe(false);
    });
});
