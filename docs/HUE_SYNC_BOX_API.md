# Hue HDMI Sync Box API mapping

Primary source: the locally archived Philips Hue Developer Program page supplied for this rewrite. Its resource table describes API level 10; this adapter supports API level 7 and newer. The official documentation wins over behavior observed in third-party projects.

## Transport and response rules

- Base URL: `https://<IPv4-or-host>/api/v1`
- Discovery: DNS-SD service `_huesync._tcp`, normally TCP 443
- Authentication: `Authorization: Bearer <accessToken>` except the two public endpoints below
- Production TLS: Hue Sync Box CA plus certificate identity matching `device.uniqueId`
- Responses are direct JSON resources. The parser also tolerates the historical `{ "data": ... }` wrapper.
- API errors 1–3 and 10–16 are represented by `HueSyncBoxApiError`; deterministic errors and 401 are not retried.

## Endpoints

| Resource          | Endpoint                       | Methods                | Auth         | API level       | State/UI mapping                                             | Notes                                                                                                                                 |
| ----------------- | ------------------------------ | ---------------------- | ------------ | --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Device bootstrap  | `/device`                      | GET                    | No           | 7+              | Pairing/migration                                            | Supplies the Unique ID without exposing a token.                                                                                      |
| Registration      | `/registrations`               | POST                   | No, pushlink | 7+              | Device Manager/Admin action                                  | Request: `appName`, `instanceName`; response: `registrationId`, `accessToken`.                                                        |
| API root          | `/`                            | GET                    | Bearer       | 7+              | Initial capability/state snapshot                            | Read once on connect.                                                                                                                 |
| Device            | `/device`                      | GET, PUT               | Bearer       | 7+              | `device.*`                                                   | Name, firmware, update, Wi-Fi, LED and response-driven health fields. Restart/update commands are deliberately not persistent states. |
| Hue Bridge        | `/hue`                         | GET, PUT               | Bearer       | 7+              | `hue.*`, Tab                                                 | Bridge identity, connection and Entertainment Areas. Credentials are setup-only.                                                      |
| Execution         | `/execution`                   | GET, PUT               | Bearer       | 7+              | `execution.*`, Tab                                           | Power, sync, mode, input, area, brightness and preset. Unknown future modes remain strings.                                           |
| Video mode        | `/execution/video`             | GET, PUT               | Bearer       | 7+              | `execution.video.*`                                          | Intensity and background lighting.                                                                                                    |
| Game mode         | `/execution/game`              | GET, PUT               | Bearer       | 7+              | `execution.game.*`                                           | Intensity and background lighting.                                                                                                    |
| Music mode        | `/execution/music`             | GET, PUT               | Bearer       | 7+              | `execution.music.*`                                          | Intensity and palette.                                                                                                                |
| HDMI              | `/hdmi`                        | GET                    | Bearer       | 7+              | `hdmi.*`, Tab                                                | Content specs and video/audio support.                                                                                                |
| HDMI ports        | `/hdmi/input1` … `/input4`     | GET, PUT               | Bearer       | 7+              | `hdmi.inputN.*`                                              | Name/type writable; status and last mode read-only. Output is read-only.                                                              |
| Behavior          | `/behavior`                    | GET, PUT               | Bearer       | 7+              | `behavior.*`                                                 | Power-save, CEC/USB, HPD and model-dependent Dolby Vision option.                                                                     |
| Input behavior    | `/behavior/input1` … `/input4` | GET, PUT               | Bearer       | response-driven | `behavior.inputN.*`                                          | CEC, link auto-sync, 4K HDR mode and HPD input switch.                                                                                |
| Presets           | `/presets` and `/presets/<id>` | GET, POST, PUT, DELETE | Bearer       | response-driven | Read-only preset metadata plus `execution.preset` activation | CRUD belongs in an interactive UI; no state explosion.                                                                                |
| IR scanning/codes | `/ir/...`                      | interactive methods    | Bearer       | response-driven | Not mapped                                                   | Interactive setup feature; intentionally deferred until hardware-verified.                                                            |

## Capability and model handling

Capabilities are inferred from returned resources/properties, not from a hardcoded model list:

| Property                   | Device generation documented | Handling                                                      |
| -------------------------- | ---------------------------- | ------------------------------------------------------------- |
| `behavior.forceDoviNative` | Sync Box 4K                  | Created only when returned.                                   |
| `behavior.inputN.hdrMode`  | Sync Box 4K                  | Created only when returned.                                   |
| `device.undervolt`         | Sync Box 8K                  | Read-only warning, created only when returned.                |
| `device.overheating`       | Supported responses          | Read-only warning with transition logging.                    |
| `device.bluetooth`         | Supported responses          | Writable only when returned.                                  |
| `execution.mode = ambient` | Newer firmware               | Accepted and shown; unknown future values are also preserved. |
| Presets and IR             | Response-driven              | Presets detected; IR not expanded into states.                |

## State semantics

- Existing `box_<sanitized-name>` IDs are retained for migration compatibility.
- `reachable` means the specific box answered an authenticated request.
- `info.connection` is true only when every enabled configured box is authenticated and reachable.
- `execution.brightness` is 0–200 with 100 neutral; it is not a conventional 0–100 Hue dimmer.
- Command-style toggles/cycles, software restart and firmware update are not exposed as freely writable persistent states.
- `json` retains the last root snapshot for compatibility; secrets are never part of this API response.

## Errors and retry

| API code/status   | Meaning                            | Retry                                      |
| ----------------- | ---------------------------------- | ------------------------------------------ |
| 1                 | Missing token                      | No                                         |
| 2                 | Invalid token                      | No                                         |
| 3                 | Unauthorized scope                 | No                                         |
| 10                | Missing body                       | No                                         |
| 11                | Body too large                     | No                                         |
| 12                | Invalid JSON                       | No                                         |
| 13                | Invalid key                        | No                                         |
| 14                | Invalid type                       | No                                         |
| 15                | Invalid value                      | No                                         |
| 16                | Invalid state                      | No                                         |
| 401               | Authentication rejected            | No                                         |
| Timeout/reset/5xx | Transient transport/server failure | Bounded exponential backoff for safe reads |

## Hardware verification still required

Fixtures cover 4K/8K response differences, but real hardware is required to verify certificate identities across firmware generations, unusual mDNS TXT layouts, preset mutations and interactive IR operations. Use `npm run test:hardware` with environment-only credentials.
