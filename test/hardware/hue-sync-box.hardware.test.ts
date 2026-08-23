import { describe, expect, it } from 'vitest';
import { HueSyncBoxClient } from '../../src/api/HueSyncBoxClient';

const host = process.env.HUE_SYNC_BOX_HOST;
const token = process.env.HUE_SYNC_BOX_TOKEN;
const uniqueId = process.env.HUE_SYNC_BOX_UNIQUE_ID;

describe.skipIf(!host || !token || !uniqueId)('Hue Sync Box hardware', () => {
    it('reads the device through verified TLS', async () => {
        const client = new HueSyncBoxClient({ host: host!, accessToken: token!, uniqueId: uniqueId! });
        try {
            const device = await client.getResource('device');
            expect(device.apiLevel).toBeGreaterThanOrEqual(7);
        } finally {
            client.close();
        }
    });
});
