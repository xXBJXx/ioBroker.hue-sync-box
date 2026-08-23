"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryService = void 0;
const bonjour_service_1 = require("bonjour-service");
/**
 *
 */
class DiscoveryService {
    bonjour;
    browser;
    /**
     *
     */
    async discover(timeoutMs = 5_000, networkInterface) {
        this.stop();
        this.bonjour = new bonjour_service_1.Bonjour({ disableIPv6: true });
        const found = new Map();
        return new Promise(resolve => {
            this.browser = this.bonjour.find({ type: 'huesync', protocol: 'tcp' }, (service) => {
                const uniqueId = this.readUniqueId(service);
                const ipv4 = service.addresses?.filter(address => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) ?? [];
                const host = (networkInterface ? ipv4.find(address => address.startsWith(networkInterface)) : ipv4[0]) ??
                    service.host?.replace(/\.$/, '');
                if (!host) {
                    return;
                }
                const key = uniqueId ?? host;
                found.set(key, { name: service.name, host, uniqueId, port: service.port || 443 });
            });
            setTimeout(() => {
                this.stop();
                resolve([...found.values()]);
            }, Math.min(30_000, Math.max(1_000, timeoutMs)));
        });
    }
    /**
     *
     */
    stop() {
        this.browser?.stop();
        this.browser = undefined;
        this.bonjour?.destroy();
        this.bonjour = undefined;
    }
    readUniqueId(service) {
        const txt = service.txt;
        for (const key of ['uniqueId', 'uniqueid', 'id']) {
            if (typeof txt?.[key] === 'string' && txt[key]) {
                return txt[key];
            }
        }
        return undefined;
    }
}
exports.DiscoveryService = DiscoveryService;
//# sourceMappingURL=DiscoveryService.js.map