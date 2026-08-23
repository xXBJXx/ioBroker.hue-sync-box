# Project and development guide

This document describes the implementation and maintenance rules relevant to contributors, reviewers and release maintainers. User setup and state examples are in the English and German READMEs. Protocol details are in [HUE_SYNC_BOX_API.md](HUE_SYNC_BOX_API.md).

## Project scope

The adapter connects ioBroker to Philips Hue Play HDMI Sync Box 4K and 8K devices through their local HTTPS API. It provides:

- local DNS-SD/mDNS discovery;
- pushlink registration and encrypted token storage;
- verified HTTPS communication;
- capability-based objects and states;
- polling, command handling and connection health;
- a Materialize Admin page for setup and pairing;
- state-based control for VIS-2, scripts and other ioBroker frontends.

The project does not provide a separate Admin control tab or Device Manager integration. Setup is kept on one configuration page, while normal operation is exposed through states.

## Runtime components

| Location                            | Responsibility                                                           |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `src/main.ts`                       | Adapter lifecycle, message commands, registration and persistent pairing |
| `src/api/HueSyncBoxClient.ts`       | HTTPS requests, authentication, timeouts, response limits and retries    |
| `src/api/certificate.ts`            | Hue Sync Box certificate authority and device identity verification      |
| `src/api/parser.ts`                 | Direct and legacy wrapped JSON response parsing                          |
| `src/api/validation.ts`             | Runtime validation of required API data                                  |
| `src/config/migration.ts`           | Validation, defaults and migration of existing native configuration      |
| `src/discovery/DiscoveryService.ts` | Bounded `_huesync._tcp` discovery over mDNS                              |
| `src/device/SyncBoxManager.ts`      | Per-device lifecycle, polling schedules and writable-state commands      |
| `src/device/capabilities.ts`        | Response-driven 4K/8K feature detection                                  |
| `src/states/StateManager.ts`        | Object creation and acknowledged state updates                           |
| `src/states/definitions.ts`         | Writable paths, roles, ranges, units and enumerations                    |
| `src-admin/src/App.tsx`             | Discovery, pairing and adapter-wide settings                             |
| `admin/i18n/*.json`                 | User-visible Admin translations                                          |

Compiled backend files are written to `build/`. Vite writes the Materialize configuration to `admin/index_m.html` and hashed files below `admin/assets/`.

## Configuration

The native configuration contains:

| Property               | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `devices`              | Configured boxes with name, address, Unique ID, token and enabled state |
| `allowInsecureTls`     | Temporary diagnostic override; false by default                         |
| `discoveryInterface`   | Optional IPv4 prefix used to select a discovery interface               |
| `pollExecutionSeconds` | Interval for frequently changing execution values                       |
| `pollStatusSeconds`    | Interval for HDMI and Hue connection data                               |
| `pollMetadataMinutes`  | Interval for device, behavior and preset metadata                       |

`normalizeConfig` is the boundary that converts stored native data into runtime configuration. Existing device arrays remain supported. Device roots keep the established `box_<sanitized-name>` form to avoid breaking scripts and visualizations.

Tokens are covered by both `encryptedNative` and `protectedNative` in `io-package.json`. They must never be returned by diagnostics, written to a state or included in logs.

## Pairing and startup lifecycle

1. The Admin page sends `discover` to the adapter instance.
2. Discovery collects `_huesync._tcp` services for a bounded time.
3. The user presses the physical Sync Box button and selects a result or enters an address manually.
4. The Admin page sends `pairAndSave` without receiving the resulting token.
5. The backend reads the public device identity, performs pushlink registration and stores the token in the protected native configuration.
6. The configuration page reloads. The adapter starts one managed client per enabled box.
7. Initial authenticated resources determine capabilities and create only the matching objects.
8. Polling updates states with `ack: true`; user writes with `ack: false` are validated and sent to the API.

Supported Admin message commands are `discover`, `register`, `pairAndSave`, `diagnostics` and `refresh`. `register` exists as a backend boundary, while normal users should use `pairAndSave` so credentials remain server-side.

## State and connection semantics

- `box_<name>.reachable` describes one authenticated device.
- `info.connection` is true only when all enabled configured boxes are connected.
- API responses update states with the Promise-based `adapter.setState(...)` API and `ack: true`.
- Writable values are validated against known ranges and enumerations before they reach the device.
- Unknown future mode strings are retained instead of terminating the adapter.
- Optional states are created only when the corresponding API property is present.
- Temperature and undervoltage warnings are read-only and logged only when their value changes.

## Network and security boundaries

- Authenticated requests use HTTPS on the local network.
- The bundled Hue Sync Box CA validates the certificate chain.
- The stored Unique ID is used for device identity verification.
- Request timeout is eight seconds and response bodies are limited to one MiB.
- Safe reads retry temporary transport failures and server errors with bounded backoff.
- Authentication, validation and deterministic API errors are not retried.
- Discovery is time-bounded and IPv4-only.
- TLS verification is never disabled by default.

The initial public `/device` request may obtain a missing Unique ID. No access token is sent during that request. Authenticated traffic starts only after the client can verify the device identity.

## Admin localization

The Admin interface follows the localization structure used by current ioBroker React adapters:

- English source keys live in `admin/i18n/en.json`.
- German, Spanish, French, Italian, Dutch, Polish, Portuguese, Russian, Ukrainian and Simplified Chinese use matching JSON files.
- `src-admin/src/translations.ts` imports all language files and supplies them to `GenericApp`.
- Every user-visible label, button, helper text, warning and local status message is rendered with `I18n.t(...)`.
- New keys must be added to all eleven files before release.

Device names, addresses and backend error details are runtime data and are therefore not translation keys.

## Build and verification

Required local checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The test suite covers parser compatibility, API errors, retries, capability differences and package metadata. The production build compiles strict TypeScript and the React Admin interface. Package validation checks `package.json`, `io-package.json`, the README and license.

Hardware tests are opt-in:

```bash
npm run test:hardware
```

They require `HUE_SYNC_BOX_HOST`, `HUE_SYNC_BOX_UNIQUE_ID` and `HUE_SYNC_BOX_TOKEN` in the environment. Hardware credentials must never be stored in source files, fixtures or CI configuration.

## Release maintenance

- Add every user-visible or maintenance change to `WORK IN PROGRESS` in both READMEs.
- Prefix new entries for this project with `(xXBJXx)` and preserve historical attribution.
- Keep versions in `package.json` and `io-package.json` identical.
- Move pending changelog entries under the released version and date during release preparation.
- Run all checks and inspect `npm pack --dry-run` before publishing.
- Publish only files listed in the `files` array of `package.json`.

## Compatibility and deferred features

The minimum supported API level is 7. API properties are preferred over model-name assumptions. Preset metadata is exposed, but full preset mutation and interactive IR setup remain deferred until they can be verified on real hardware and represented without unsafe persistent command states.

When adding an endpoint or state:

1. confirm it against the official Hue API documentation;
2. add runtime validation and a sanitized fixture;
3. define correct ioBroker type, role, access flags, range and unit;
4. preserve existing state IDs unless a documented migration is unavoidable;
5. update the API mapping, both READMEs and the changelog;
6. run lint, typecheck, tests and the production build.
