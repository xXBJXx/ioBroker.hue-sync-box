# ioBroker.hue-sync-box

![Logo](admin/hueSyncBox.png)

[![NPM version](https://img.shields.io/npm/v/iobroker.hue-sync-box.svg)](https://www.npmjs.com/package/iobroker.hue-sync-box)
[![Tests](https://github.com/xXBJXx/ioBroker.hue-sync-box/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/xXBJXx/ioBroker.hue-sync-box/actions/workflows/test-and-release.yml)

Control and monitor a Philips Hue Play HDMI Sync Box locally from ioBroker. The adapter supports the 4K and 8K models, discovers boxes in the local network and provides states for VIS-2, scripts and other ioBroker visualizations.

Deutsche Anleitung: [README_DE.md](README_DE.md)

## Disclaimer

All product and company names, logos and trademarks mentioned in this project belong to their respective owners. Philips is a registered trademark of Koninklijke Philips N.V.; Hue is a brand of Signify. Their use is solely for identification and does not imply any affiliation with, sponsorship by or endorsement from Koninklijke Philips N.V., Signify Holding B.V., Signify Netherlands B.V. or their associated companies. This is a private, non-commercial project developed for recreational purposes.

## Error reporting with Sentry

This adapter uses the Sentry integration provided by ioBroker to automatically report unexpected exceptions and code errors to the developers. Error reporting has been available through js-controller since version 3.0 and helps identify and resolve defects that might otherwise go unnoticed.

For details about the transmitted information and instructions for disabling error reporting, see the [official ioBroker Sentry documentation](https://github.com/ioBroker/ioBroker.js-controller#error-reporting-via-iobroker-sentry).

## What the adapter can do

- Turn the HDMI output and light synchronization on or off
- Select HDMI input, synchronization mode and Entertainment Area
- Set brightness and mode-specific intensity
- Read HDMI signal, Hue Bridge connection, Wi-Fi quality and device information
- Report overheating, undervoltage and reachability
- Discover and pair a Sync Box without exposing its access token
- Preserve the established `box_<name>` object IDs when upgrading

The adapter deliberately has no separate control tab or Device Manager page. Those pages are also hidden below ioBroker Admin and would duplicate the same controls. The settings page is used once for setup; daily control is available through states so users can build the interface they actually want in VIS-2 or another ioBroker frontend.

## Requirements

- Node.js 22.18 or newer
- ioBroker js-controller 7.2.2 or newer
- ioBroker Admin 8.0.0 or newer
- A Sync Box already set up with the official Philips Hue app
- Network access from the ioBroker host to TCP port 443 on the box

## First setup

1. Install the adapter and create an instance.
2. Open the instance settings.
3. Hold the button on the Sync Box for about three seconds. The LED must blink while pairing.
4. Select **Search local network** and then **Pair** next to the detected box.
5. If discovery finds nothing, enter the IP address under **Manual pairing**.
6. The adapter saves the box and reloads the settings page. Restart the instance if the new states do not appear automatically.

The box is discovered through mDNS (`_huesync._tcp`). Multicast discovery often cannot cross VLAN, Docker or LXC boundaries; manual pairing by IP address works in that situation.

The access token is stored in ioBroker's encrypted and protected native configuration. It is not written to states, diagnostics or logs.

## Using the states

Every configured box is created below `hue-sync-box.<instance>.box_<name>`. Writing a supported value to a writable state sends the change to the Sync Box.

| State                       | Purpose                            | Values/example                                                  |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| `reachable`                 | Box is reachable and authenticated | `true` / `false`                                                |
| `execution.hdmiActive`      | HDMI output                        | `true` / `false`                                                |
| `execution.syncActive`      | Light synchronization              | `true` / `false`                                                |
| `execution.mode`            | Synchronization mode               | `video`, `game`, `music`, `ambient`, `passthrough`, `powersave` |
| `execution.hdmiSource`      | Active input                       | `input1` to `input4`                                            |
| `execution.brightness`      | Brightness boost                   | 0–200; 100 is neutral                                           |
| `execution.hueTarget`       | Entertainment Area                 | Area ID returned by the box                                     |
| `execution.video.intensity` | Video intensity                    | `subtle`, `moderate`, `high`, `intense`                         |
| `execution.game.intensity`  | Game intensity                     | `subtle`, `moderate`, `high`, `intense`                         |
| `execution.music.intensity` | Music intensity                    | `subtle`, `moderate`, `high`, `intense`                         |
| `hdmi.contentSpecs`         | Current HDMI signal information    | read-only                                                       |
| `device.overheating`        | Temperature warning                | read-only, only if supported                                    |
| `device.undervolt`          | Power supply warning               | read-only, only if supported                                    |

Additional states are created only when the box actually reports the matching capability. This avoids misleading controls on different hardware and firmware generations. See [Hue API and state mapping](docs/HUE_SYNC_BOX_API.md) for the complete technical mapping.

## Settings

- **Execution polling:** updates frequently changing controls; default 3 seconds.
- **Status polling:** updates HDMI and Hue status; default 15 seconds.
- **Metadata polling:** updates device, behavior and preset information; default 5 minutes.
- **IPv4 interface prefix:** optionally limits discovery, for example to `192.168.10.`.
- **Allow insecure TLS:** diagnostic escape hatch only. Leave it disabled during normal use.

## Security

Normal API requests validate the Sync Box certificate against the Hue Sync Box CA and match its identity to the stored device Unique ID. Authenticated HTTPS uses keep-alive, an 8-second timeout, a one-MiB response limit and bounded retries only for temporary network failures.

`allowInsecureTls` is disabled by default. Enabling it turns off certificate verification and should only be used briefly to diagnose a certificate problem.

## Troubleshooting

- **No box found:** check that ioBroker and the box are in the same network, allow mDNS/UDP 5353, or use manual pairing.
- **Pairing fails:** press and hold the box button again and start pairing while its LED is blinking.
- **Certificate identity error:** verify that the configured IP still belongs to the same Sync Box; rediscover it after a DHCP change.
- **401 / authentication rejected:** pair the box again.
- **API level below 7:** update the box firmware in the official Hue app.
- **States do not appear:** restart the adapter after pairing and check the instance log.
- **No HDMI signal:** inspect `hdmi.contentSpecs` and the `hdmi.input1` to `hdmi.input4` states.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Local hardware tests require `HUE_SYNC_BOX_HOST`, `HUE_SYNC_BOX_UNIQUE_ID` and `HUE_SYNC_BOX_TOKEN` as environment variables. Never commit these values.

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (xXBJXx) Reworked the adapter with a secure, strictly typed Hue Sync Box API client and capability-based support for 4K and 8K models.
- (xXBJXx) Added local discovery and guided pairing directly to the adapter settings.
- (xXBJXx) Added complete state-based control for VIS-2, scripts and custom ioBroker interfaces.
- (xXBJXx) Added verified TLS handling, bounded retries, protected credentials and expanded automated tests.
- (xXBJXx) Rewrote the user documentation in English and German.

### 0.3.5 (2023-02-06)

- (xXBJXx) Dependency update

### 0.3.4 (2023-01-15)

- (xXBJXx) fixed Sentry error reporting

### 0.3.3 (2023-01-14)

- (xXBJXx) fixed a bug

### 0.3.2 (2023-01-13)

- (xXBJXx) update dependencies
- (xXBJXx) Log output extended and improved
- (xXBJXx) Added data point for the response JSON
- (xXBJXx) Added data point "Reachable" to check if the box is reachable

### 0.3.1 (2022-12-20)

- (xXBJXx) Fixed error message that occurs after a successful registration.

### 0.3.0 (2022-12-20)

- (xXBJXx) added delete function for objects and Token
- (xXBJXx) added funktion for sync the `execution.intensity` state

### 0.2.1 (2022-12-17)

- (xXBJXx) typo corrected in README
- (xXBJXx) Fixed a bug when sending commands to the box

### 0.2.0 (2022-12-17)

- (xXBJXx) Optimization and improvement of the registration process

### 0.1.0 (2022-12-16)

- (Issi) First release

## License

MIT License

Copyright (c) 2022-2026 Issi <issi.dev.iobroker@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
