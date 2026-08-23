import { Bonjour, type Browser, type Service } from 'bonjour-service';

/**
 *
 */
export interface DiscoveredSyncBox {
    /**
     *
     */
    name: string;
    /**
     *
     */
    host: string;
    /**
     *
     */
    uniqueId?: string;
    /**
     *
     */
    port: number;
}

/**
 *
 */
export class DiscoveryService {
    private bonjour?: Bonjour;
    private browser?: Browser;

    /**
     *
     */
    public async discover(timeoutMs = 5_000, networkInterface?: string): Promise<DiscoveredSyncBox[]> {
        this.stop();
        this.bonjour = new Bonjour({ disableIPv6: true });
        const found = new Map<string, DiscoveredSyncBox>();
        return new Promise(resolve => {
            this.browser = this.bonjour!.find({ type: 'huesync', protocol: 'tcp' }, (service: Service) => {
                const uniqueId = this.readUniqueId(service);
                const ipv4 = service.addresses?.filter(address => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) ?? [];
                const host =
                    (networkInterface ? ipv4.find(address => address.startsWith(networkInterface)) : ipv4[0]) ??
                    service.host?.replace(/\.$/, '');
                if (!host) {
                    return;
                }
                const key = uniqueId ?? host;
                found.set(key, { name: service.name, host, uniqueId, port: service.port || 443 });
            });
            setTimeout(
                () => {
                    this.stop();
                    resolve([...found.values()]);
                },
                Math.min(30_000, Math.max(1_000, timeoutMs)),
            );
        });
    }

    /**
     *
     */
    public stop(): void {
        this.browser?.stop();
        this.browser = undefined;
        this.bonjour?.destroy();
        this.bonjour = undefined;
    }

    private readUniqueId(service: Service): string | undefined {
        const txt = service.txt as Record<string, unknown> | undefined;
        for (const key of ['uniqueId', 'uniqueid', 'id']) {
            if (typeof txt?.[key] === 'string' && txt[key]) {
                return txt[key];
            }
        }
        return undefined;
    }
}
