import React from 'react';
import type { JSX } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import {
    GenericApp,
    I18n,
    Loader,
    type GenericAppProps,
    type GenericAppSettings,
    type GenericAppState,
} from '@iobroker/gui-components';
import { translations } from './translations';

interface DeviceConfig {
    name: string;
    ip: string;
    uniqueId?: string;
    disabled?: boolean;
}

interface DiscoveredSyncBox {
    name: string;
    host: string;
    uniqueId?: string;
    port: number;
}

interface AdapterResponse<T> {
    ok: boolean;
    result?: T;
    error?: string;
}

interface AppState extends GenericAppState {
    busy: boolean;
    discovered: DiscoveredSyncBox[];
    manualHost: string;
    manualName: string;
    notice?: { severity: 'success' | 'error' | 'info'; text: string };
}

export default class App extends GenericApp<GenericAppProps, AppState> {
    public constructor(props: GenericAppProps) {
        const settings: GenericAppSettings = {
            ...props,
            adapterName: 'hue-sync-box',
            bottomButtons: true,
            doNotLoadAllObjects: true,
            translations,
            socket: { port: window.location.port === '3000' ? 8081 : Number(window.location.port) || undefined },
        };
        super(props, settings);
        this.state = {
            ...this.state,
            busy: false,
            discovered: [],
            manualHost: '',
            manualName: '',
        };
    }

    private get devices(): DeviceConfig[] {
        return Array.isArray(this.state.native.devices) ? (this.state.native.devices as DeviceConfig[]) : [];
    }

    private async sendCommand<T>(command: string, payload: Record<string, unknown>): Promise<T> {
        const response = await this.socket.sendTo<AdapterResponse<T>>(
            `${this.adapterName}.${this.instance}`,
            command,
            payload,
        );
        if (!response.ok) {
            throw new Error(response.error || I18n.t('The adapter did not complete the request.'));
        }
        return response.result as T;
    }

    private async discover(): Promise<void> {
        this.setState({ busy: true, notice: undefined });
        try {
            const discovered = await this.sendCommand<DiscoveredSyncBox[]>('discover', { timeoutMs: 5_000 });
            this.setState({
                discovered,
                notice: {
                    severity: discovered.length ? 'success' : 'info',
                    text: discovered.length
                        ? discovered.length === 1
                            ? I18n.t('One Sync Box found.')
                            : I18n.t('%s Sync Boxes found.', discovered.length)
                        : I18n.t(
                              'No Sync Box found. Check that ioBroker and the box are in the same network, or pair manually.',
                          ),
                },
            });
        } catch (error) {
            this.setState({ notice: { severity: 'error', text: App.errorText(error) } });
        } finally {
            this.setState({ busy: false });
        }
    }

    private async pair(device?: DiscoveredSyncBox): Promise<void> {
        if (this.state.changed) {
            this.setState({
                notice: {
                    severity: 'info',
                    text: I18n.t('Save pending setting changes before pairing a Sync Box.'),
                },
            });
            return;
        }
        const host = (device?.host ?? this.state.manualHost).trim();
        if (!host) {
            this.setState({
                notice: { severity: 'error', text: I18n.t('Enter an IP address or hostname first.') },
            });
            return;
        }
        this.setState({ busy: true, notice: undefined });
        try {
            await this.sendCommand<{ restartRequired: boolean }>('pairAndSave', {
                host,
                uniqueId: device?.uniqueId,
                name: device?.name || this.state.manualName,
            });
            this.setState({
                notice: {
                    severity: 'success',
                    text: I18n.t('Pairing succeeded and the box was saved. The settings page will reload now.'),
                },
            });
            window.setTimeout(() => window.location.reload(), 1_500);
        } catch (error) {
            this.setState({ notice: { severity: 'error', text: App.errorText(error) } });
        } finally {
            this.setState({ busy: false });
        }
    }

    private static errorText(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    private renderPairing(): JSX.Element {
        return (
            <Card>
                <CardContent>
                    <Typography
                        variant="h6"
                        gutterBottom
                    >
                        {I18n.t('Find and pair a Sync Box')}
                    </Typography>
                    <Alert
                        severity="info"
                        sx={{ mb: 2 }}
                    >
                        {I18n.t(
                            'Hold the button on the Sync Box for about three seconds. While the light is blinking, start pairing below.',
                        )}
                    </Alert>
                    <Button
                        variant="contained"
                        startIcon={
                            this.state.busy ? (
                                <CircularProgress
                                    size={18}
                                    color="inherit"
                                />
                            ) : (
                                <SearchIcon />
                            )
                        }
                        disabled={this.state.busy}
                        onClick={() => void this.discover()}
                    >
                        {I18n.t('Search local network')}
                    </Button>
                    {this.state.discovered.length > 0 && (
                        <Stack
                            spacing={1}
                            sx={{ mt: 2 }}
                        >
                            {this.state.discovered.map(device => (
                                <Box
                                    key={device.uniqueId ?? device.host}
                                    className="deviceRow"
                                >
                                    <span>{device.name}</span>
                                    <code>{device.host}</code>
                                    <Button
                                        variant="outlined"
                                        startIcon={<LinkIcon />}
                                        disabled={this.state.busy}
                                        onClick={() => void this.pair(device)}
                                    >
                                        {I18n.t('Pair')}
                                    </Button>
                                </Box>
                            ))}
                        </Stack>
                    )}
                    <Typography
                        variant="subtitle1"
                        sx={{ mt: 3, mb: 1 }}
                    >
                        {I18n.t('Manual pairing')}
                    </Typography>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                    >
                        <TextField
                            label={I18n.t('IP address or hostname')}
                            value={this.state.manualHost}
                            onChange={event => this.setState({ manualHost: event.target.value })}
                        />
                        <TextField
                            label={I18n.t('Name (optional)')}
                            value={this.state.manualName}
                            onChange={event => this.setState({ manualName: event.target.value })}
                        />
                        <Button
                            variant="outlined"
                            startIcon={<LinkIcon />}
                            disabled={this.state.busy || !this.state.manualHost.trim()}
                            onClick={() => void this.pair()}
                        >
                            {I18n.t('Pair manually')}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        );
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
                    {this.state.notice && <Alert severity={this.state.notice.severity}>{this.state.notice.text}</Alert>}
                    {this.renderPairing()}
                    <Card>
                        <CardContent>
                            <Typography
                                variant="h6"
                                gutterBottom
                            >
                                {I18n.t('Polling intervals')}
                            </Typography>
                            <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={2}
                            >
                                <TextField
                                    label={I18n.t('Execution (seconds)')}
                                    type="number"
                                    value={this.state.native.pollExecutionSeconds ?? 3}
                                    onChange={event =>
                                        this.updateNativeValue('pollExecutionSeconds', Number(event.target.value))
                                    }
                                    slotProps={{ htmlInput: { min: 2, max: 60 } }}
                                />
                                <TextField
                                    label={I18n.t('Status (seconds)')}
                                    type="number"
                                    value={this.state.native.pollStatusSeconds ?? 15}
                                    onChange={event =>
                                        this.updateNativeValue('pollStatusSeconds', Number(event.target.value))
                                    }
                                    slotProps={{ htmlInput: { min: 5, max: 300 } }}
                                />
                                <TextField
                                    label={I18n.t('Metadata (minutes)')}
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
                                {I18n.t('Network and security')}
                            </Typography>
                            <TextField
                                fullWidth
                                label={I18n.t('IPv4 interface prefix (optional)')}
                                helperText={I18n.t('Example: 192.168.10. — leave empty to search all interfaces')}
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
                                label={I18n.t('Allow insecure TLS (diagnostics only)')}
                            />
                            {this.state.native.allowInsecureTls && (
                                <Alert severity="warning">
                                    {I18n.t(
                                        'Certificate validation is disabled. Never leave this enabled in normal operation.',
                                    )}
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent>
                            <Typography variant="h6">
                                {I18n.t('Configured boxes')} ({devices.length})
                            </Typography>
                            {!devices.length && (
                                <Typography color="text.secondary">{I18n.t('No Sync Box configured yet.')}</Typography>
                            )}
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
                                            label={I18n.t(device.disabled ? 'disabled' : 'configured')}
                                        />
                                    </Box>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                    <Alert severity="info">
                        {I18n.t(
                            'Daily control is provided through the adapter states. Use them in VIS-2, scripts or your own dashboard.',
                        )}
                    </Alert>
                </Stack>
                {this.renderHelperDialogs()}
            </Box>
        );
    }

    public override render(): JSX.Element {
        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    {!this.state.loaded ? <Loader themeType={this.state.themeType} /> : this.renderSettings()}
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
