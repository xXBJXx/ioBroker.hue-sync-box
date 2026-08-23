// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface HueSyncBoxDeviceConfig {
            name: string;
            ip: string;
            token: string;
            id?: number;
            uniqueId?: string;
            disabled?: boolean;
        }

        interface AdapterConfig {
            devices: HueSyncBoxDeviceConfig[];
            allowInsecureTls?: boolean;
            discoveryInterface?: string;
            pollExecutionSeconds?: number;
            pollStatusSeconds?: number;
            pollMetadataMinutes?: number;
        }
    }
}

export {};
