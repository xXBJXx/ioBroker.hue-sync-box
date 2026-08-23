# ioBroker.hue-sync-box

![Logo](admin/hueSyncBox.png)

[![NPM version](https://img.shields.io/npm/v/iobroker.hue-sync-box.svg)](https://www.npmjs.com/package/iobroker.hue-sync-box)
[![Tests](https://github.com/xXBJXx/ioBroker.hue-sync-box/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/xXBJXx/ioBroker.hue-sync-box/actions/workflows/test-and-release.yml)

Secure local control and monitoring for the Philips Hue Play HDMI Sync Box 4K and 8K.

## Requirements

- Node.js 22.18 or newer
- ioBroker js-controller 7.2.2 or newer
- ioBroker Admin 8.0.0 or newer
- A Sync Box already set up in the official Philips Hue app
- IPv4 connectivity from the ioBroker host to TCP port 443 on the box

Admin 8 is required because the current official `@iobroker/gui-components` package uses the Admin 8 / React 19 UI runtime. This is intentionally higher than the otherwise sufficient Admin 7.8.23.

## Setup and pairing

1. Open ioBroker **Device Manager** and expand the adapter instance.
2. Choose **Discover Sync Boxes**. Discovery uses `_huesync._tcp` over mDNS.
3. If mDNS cannot cross your Docker, LXC or VLAN boundary, choose **Pair manually** and enter an IPv4 address or hostname.
4. Hold the button on the Sync Box for about three seconds, confirm the prompt, and pair.
5. Restart the adapter instance after a newly paired box was saved.

The registration token is stored in `native.devices[].token` using ioBroker's `encryptedNative` and `protectedNative` handling. It is never included in diagnostics or logs. Existing `devices` arrays from adapter 0.3.x remain supported.

## User interfaces

- **Adapter settings:** global polling intervals, optional IPv4 interface prefix and the explicitly unsafe TLS diagnostic switch.
- **Device Manager:** discovery, pairing, reachability, firmware/API information, Wi-Fi strength, warnings and refresh.
- **Adapter tab:** daily control of HDMI power, light sync, mode, input, brightness (0–200; 100 is neutral), Entertainment Area and signal status.

The two operational UIs intentionally do not duplicate each other. Firmware update and software restart are not exposed as ordinary writable states because they require an explicit confirmation workflow.

## States and compatibility

Existing roots remain `box_<sanitized-name>` to avoid breaking scripts. Returned API properties are mapped below their resource names (`device`, `hue`, `execution`, `hdmi`, `behavior`). Features are created only when they occur in the API response, so 4K-only and 8K-only properties do not create misleading objects.

Important writable states include:

- `execution.syncActive`, `execution.hdmiActive`, `execution.mode`
- `execution.hdmiSource`, `execution.hueTarget`, `execution.brightness`
- mode intensity/background settings
- HDMI input name/type and supported behavior settings

`overheating` and `undervolt` are read-only warning indicators. The adapter logs only transitions and exposes an aggregate device warning to Device Manager.

## HTTPS security

Normal requests validate the Sync Box certificate against the Philips Hue Sync Box CA and verify its identity against `device.uniqueId`. HTTPS keep-alive, an 8-second timeout, a one-MiB response limit and bounded retry for transient network failures are enabled.

For old configurations without a stored Unique ID, the adapter obtains it once from the documented unauthenticated `/api/v1/device` endpoint without sending a token. All authenticated traffic then uses verified TLS. `allowInsecureTls` is disabled by default and should only be enabled temporarily while diagnosing certificate problems.

## Polling

- Execution: default 3 seconds
- HDMI and Hue status: default 15 seconds
- Device, behavior and presets: default 5 minutes

Intervals are configurable and bounded. API level 7 is the minimum; lower levels produce a firmware-update error. Unknown future mode strings are retained instead of crashing the adapter.

## Local development

The project uses the pinned hardened ioBroker dev-server revision requested for this adapter.

```bash
npm install
npm run build
npm run dev-server setup -- --symlinks
npm run dev
```

The first setup command creates a local `.dev-server` profile. `npm run dev` starts ioBroker and watches backend plus Admin/Tab assets. Available checks are:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Optional hardware test (never commit these secrets):

```bash
HUE_SYNC_BOX_HOST=192.168.1.20 \
HUE_SYNC_BOX_UNIQUE_ID=001788fffe123456 \
HUE_SYNC_BOX_TOKEN=secret \
npm run test:hardware
```

On PowerShell, assign the three values through `$env:HUE_SYNC_BOX_HOST`, `$env:HUE_SYNC_BOX_UNIQUE_ID` and `$env:HUE_SYNC_BOX_TOKEN` first.

## Troubleshooting

- **Discovery finds nothing:** mDNS often does not cross VLANs and container networks. Permit UDP 5353/multicast or use manual pairing.
- **Certificate identity failure:** verify that the configured IP still belongs to the stored Unique ID. Re-discover the box after DHCP changes.
- **401:** pair again; authentication errors are deliberately not retried.
- **API level below 7:** update the Sync Box firmware using the official app.
- **No HDMI controls:** check `hdmi.contentSpecs`, `videoSyncSupported` and the input status in the adapter tab.

See [the endpoint and state mapping](docs/HUE_SYNC_BOX_API.md) and [the repository audit](docs/REPOSITORY_AUDIT.md) for implementation details.

## Changelog

### 0.4.0

- Complete strict-TypeScript backend and API rewrite
- Verified Hue CA TLS, discovery, modern pairing and Device Manager v3
- React 19/MUI 9 Admin UI and control tab based on `@iobroker/gui-components`
- Capability-based 4K/8K states, API fixtures, unit tests and Node 22/24 CI

Older changes are available in the Git history and published release notes.

## License

MIT License

Copyright (c) 2022-2026 Issi <issi.dev.iobroker@gmail.com>
