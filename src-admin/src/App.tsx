import React from 'react';
import type { JSX } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    GenericApp,
    I18n,
    Loader,
    type GenericAppProps,
    type GenericAppSettings,
    type GenericAppState,
} from '@iobroker/gui-components';

interface DeviceConfig {
    name: string;
    ip: string;
    uniqueId?: string;
    disabled?: boolean;
}
interface AppState extends GenericAppState {
    liveStates: Record<string, ioBroker.State>;
    selectedRoot: string;
}

const translations = {
    en: { Settings: 'Settings', Control: 'Control', Polling: 'Polling', Security: 'Security' },
    de: { Settings: 'Einstellungen', Control: 'Steuerung', Polling: 'Abfrageintervalle', Security: 'Sicherheit' },
};
const SYNC_MODES = ['powersave', 'passthrough', 'video', 'game', 'music', 'ambient'];

function rootId(name: string): string {
    return `box_${name
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]/g, '_')}`;
}

export default class App extends GenericApp<GenericAppProps, AppState> {
    private readonly isTab = window.location.pathname.endsWith('/tab.html');
    private readonly statePattern: string;
    private readonly stateHandler = (id: string, state: ioBroker.State | null | undefined): void => {
        this.setState(current => ({ liveStates: { ...current.liveStates, ...(state ? { [id]: state } : {}) } }));
    };

    public constructor(props: GenericAppProps) {
        const settings: GenericAppSettings = {
            ...props,
            adapterName: 'hue-sync-box',
            bottomButtons: !window.location.pathname.endsWith('/tab.html'),
            doNotLoadAllObjects: true,
            translations,
            socket: { port: window.location.port === '3000' ? 8081 : Number(window.location.port) || undefined },
        };
        super(props, settings);
        this.state = { ...this.state, liveStates: {}, selectedRoot: '' };
        this.statePattern = `${this.adapterName}.${this.instance}.box_*.*`;
    }

    public override onConnectionReady(): void {
        super.onConnectionReady();
        if (this.isTab) {
            void this.loadLiveStates(true);
        }
    }

    public override componentWillUnmount(): void {
        if (this.isTab) {
            this.socket.unsubscribeState(this.statePattern, this.stateHandler);
        }
        super.componentWillUnmount();
    }

    private async loadLiveStates(subscribe = false): Promise<void> {
        const liveStates = await this.socket.getStates(this.statePattern);
        const selectedRoot = this.state.selectedRoot || rootId(this.devices[0]?.name ?? '');
        this.setState({ liveStates, selectedRoot });
        if (subscribe) {
            await this.socket.subscribeState(this.statePattern, this.stateHandler);
        }
    }

    private get devices(): DeviceConfig[] {
        return Array.isArray(this.state.native.devices) ? (this.state.native.devices as DeviceConfig[]) : [];
    }

    private value(path: string): ioBroker.StateValue | undefined {
        return this.state.liveStates[`${this.adapterName}.${this.instance}.${this.state.selectedRoot}.${path}`]?.val;
    }

    private async write(path: string, value: ioBroker.StateValue): Promise<void> {
        await this.socket.setState(`${this.adapterName}.${this.instance}.${this.state.selectedRoot}.${path}`, {
            val: value,
            ack: false,
        });
    }

    private renderSettings(): JSX.Element {
        const devices = this.devices;
        return (
            <Box className="page">
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h4">Hue Sync Box</Typography>
                        <Typography color="text.secondary">{I18n.t('Settings')}</Typography>
                    </Box>
                    <Alert severity="info">
                        Use ioBroker Device Manager to discover and pair boxes. This page only contains adapter-wide
                        settings.
                    </Alert>
                    <Card>
                        <CardContent>
                            <Typography
                                variant="h6"
                                gutterBottom
                            >
                                {I18n.t('Polling')}
                            </Typography>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={2}
                            >
                                <TextField
                                    label="Execution (seconds)"
                                    type="number"
                                    value={this.state.native.pollExecutionSeconds ?? 3}
                                    onChange={event =>
                                        this.updateNativeValue('pollExecutionSeconds', Number(event.target.value))
                                    }
                                    slotProps={{ htmlInput: { min: 2, max: 60 } }}
                                />
                                <TextField
                                    label="Status (seconds)"
                                    type="number"
                                    value={this.state.native.pollStatusSeconds ?? 15}
                                    onChange={event =>
                                        this.updateNativeValue('pollStatusSeconds', Number(event.target.value))
                                    }
                                    slotProps={{ htmlInput: { min: 5, max: 300 } }}
                                />
                                <TextField
                                    label="Metadata (minutes)"
                                    type="number"
                                    value={this.state.native.pollMetadataMinutes ?? 5}
                                    onChange={event =>
                                        this.updateNativeValue('pollMetadataMinutes', Number(event.target.value))
                                    }
                                    slotProps={{ htmlInput: { min: 1, max: 1440 } }}
                                />
                            </Stack>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent>
                            <Typography
                                variant="h6"
                                gutterBottom
                            >
                                Network
                            </Typography>
                            <TextField
                                fullWidth
                                label="IPv4 interface prefix (optional)"
                                helperText="Example: 192.168.10. — leave empty to search all interfaces"
                                value={this.state.native.discoveryInterface ?? ''}
                                onChange={event => this.updateNativeValue('discoveryInterface', event.target.value)}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={this.state.native.allowInsecureTls === true}
                                        onChange={event =>
                                            this.updateNativeValue('allowInsecureTls', event.target.checked)
                                        }
                                    />
                                }
                                label="Allow insecure TLS (diagnostics only)"
                            />
                            {this.state.native.allowInsecureTls && (
                                <Alert severity="warning">
                                    Certificate validation is disabled. Never leave this enabled in normal operation.
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent>
                            <Typography variant="h6">Configured boxes ({devices.length})</Typography>
                            <Stack
                                spacing={1}
                                sx={{ mt: 1 }}
                            >
                                {devices.map(device => (
                                    <Box
                                        key={`${device.ip}-${device.name}`}
                                        className="deviceRow"
                                    >
                                        <span>{device.name}</span>
                                        <code>{device.ip}</code>
                                        <Chip
                                            size="small"
                                            label={device.disabled ? 'disabled' : 'managed in Device Manager'}
                                        />
                                    </Box>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
                {this.renderHelperDialogs()}
            </Box>
        );
    }

    private renderControl(): JSX.Element {
        if (!this.devices.length) {
            return (
                <Box className="page">
                    <Alert severity="info">No Sync Box configured. Pair one in Device Manager.</Alert>
                </Box>
            );
        }
        const reachable = this.value('reachable') === true;
        const brightness = Number(this.value('execution.brightness') ?? 100);
        const currentMode = String(this.value('execution.mode') ?? '');
        const modes = [...SYNC_MODES];
        if (currentMode && !modes.includes(currentMode)) {
            modes.push(currentMode);
        }
        return (
            <Box className="page">
                <Stack spacing={3}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        sx={{ justifyContent: 'space-between', gap: 2 }}
                    >
                        <Box>
                            <Typography variant="h4">Hue Sync Box</Typography>
                            <Stack
                                direction="row"
                                spacing={1}
                            >
                                <Chip
                                    color={reachable ? 'success' : 'error'}
                                    label={reachable ? 'Connected' : 'Disconnected'}
                                />
                                <Chip label={String(this.value('hdmi.contentSpecs') ?? 'No HDMI signal')} />
                            </Stack>
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1}
                        >
                            <FormControl sx={{ minWidth: 220 }}>
                                <InputLabel>Sync Box</InputLabel>
                                <Select
                                    label="Sync Box"
                                    value={this.state.selectedRoot}
                                    onChange={event => this.setState({ selectedRoot: event.target.value })}
                                >
                                    {this.devices.map(device => (
                                        <MenuItem
                                            key={device.ip}
                                            value={rootId(device.name)}
                                        >
                                            {device.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Button
                                aria-label="Refresh"
                                variant="outlined"
                                onClick={() => void this.loadLiveStates()}
                            >
                                <RefreshIcon />
                            </Button>
                        </Stack>
                    </Stack>
                    {(this.value('device.overheating') === true || this.value('device.undervolt') === true) && (
                        <Alert severity="error">
                            The Sync Box reports{' '}
                            {this.value('device.overheating') === true ? 'overheating' : 'undervoltage'}. Check the
                            device immediately.
                        </Alert>
                    )}
                    <Box className="grid">
                        <Card>
                            <CardContent>
                                <Typography variant="h6">Power & sync</Typography>
                                <Stack>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={this.value('execution.hdmiActive') === true}
                                                onChange={event =>
                                                    this.write('execution.hdmiActive', event.target.checked)
                                                }
                                            />
                                        }
                                        label="HDMI active"
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={this.value('execution.syncActive') === true}
                                                onChange={event =>
                                                    this.write('execution.syncActive', event.target.checked)
                                                }
                                            />
                                        }
                                        label="Light sync active"
                                    />
                                </Stack>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography variant="h6">Mode</Typography>
                                <FormControl fullWidth>
                                    <InputLabel>Sync mode</InputLabel>
                                    <Select
                                        label="Sync mode"
                                        value={currentMode}
                                        onChange={event => this.write('execution.mode', event.target.value)}
                                    >
                                        {modes.map(mode => (
                                            <MenuItem
                                                key={mode}
                                                value={mode}
                                            >
                                                {mode}
                                                {!SYNC_MODES.includes(mode) ? ' (new)' : ''}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography variant="h6">HDMI source</Typography>
                                <FormControl fullWidth>
                                    <InputLabel>Input</InputLabel>
                                    <Select
                                        label="Input"
                                        value={String(this.value('execution.hdmiSource') ?? '')}
                                        onChange={event => this.write('execution.hdmiSource', event.target.value)}
                                    >
                                        {[1, 2, 3, 4].map(input => (
                                            <MenuItem
                                                key={input}
                                                value={`input${input}`}
                                            >
                                                HDMI {input}: {String(this.value(`hdmi.input${input}.name`) ?? '')}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography variant="h6">Brightness boost</Typography>
                                <Typography color="text.secondary">0–200%, 100% is neutral</Typography>
                                <Slider
                                    value={brightness}
                                    min={0}
                                    max={200}
                                    valueLabelDisplay="auto"
                                    onChangeCommitted={(_, value) => this.write('execution.brightness', value)}
                                />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography variant="h6">Entertainment area</Typography>
                                <FormControl fullWidth>
                                    <InputLabel>Area</InputLabel>
                                    <Select
                                        label="Area"
                                        value={String(this.value('execution.hueTarget') ?? '')}
                                        onChange={event => this.write('execution.hueTarget', event.target.value)}
                                    >
                                        {this.groupOptions()}
                                    </Select>
                                </FormControl>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography variant="h6">Signal</Typography>
                                <Typography>
                                    Video sync:{' '}
                                    {this.value('hdmi.videoSyncSupported') === true ? 'supported' : 'not supported'}
                                </Typography>
                                <Typography>
                                    Audio sync:{' '}
                                    {this.value('hdmi.audioSyncSupported') === true ? 'supported' : 'not supported'}
                                </Typography>
                                <Typography>Hue: {String(this.value('hue.connectionState') ?? 'unknown')}</Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Stack>
            </Box>
        );
    }

    private groupOptions(): JSX.Element[] {
        const prefix = `${this.adapterName}.${this.instance}.${this.state.selectedRoot}.hue.groups.`;
        return Object.entries(this.state.liveStates)
            .filter(([id]) => id.startsWith(prefix) && id.endsWith('.name'))
            .map(([id, state]) => {
                const groupId = id.slice(prefix.length, -'.name'.length);
                return (
                    <MenuItem
                        key={groupId}
                        value={groupId}
                    >
                        {String(state.val ?? groupId)}
                    </MenuItem>
                );
            });
    }

    public override render(): JSX.Element {
        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    {!this.state.loaded ? (
                        <Loader themeType={this.state.themeType} />
                    ) : this.isTab ? (
                        this.renderControl()
                    ) : (
                        this.renderSettings()
                    )}
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
