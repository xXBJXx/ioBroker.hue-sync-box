// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface Devices {
			name: string;
			ip: string;
			token: string;
			id: number;
		}
		interface AdapterConfig {
			devices: Devices[];
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
