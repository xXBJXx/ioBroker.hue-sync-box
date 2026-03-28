// hue-sync-box API https://developers.meethue.com/develop/hue-entertainment/hue-hdmi-sync-box-api/#Device%20Discovery

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';

import {
	behaviorChannelObj,
	behaviorInputObj,
	behaviorObj,
	capabilitiesObj,
	deviceChannelObj,
	deviceStateObj,
	executionChannelObj,
	executionObj,
	groupsObj,
	hdmiChannelObj,
	hdmiInputObj,
	hdmiObj,
	hueChannelObj,
	hueObj,
	musicObj,
	networkObj,
	updateObj,
	video_gameObj,
} from './lib/object_definition';
import * as https from 'node:https';
import axios from 'axios';
// Load your modules here, e.g.:
import { replaceFunktion } from './lib/replaceFunktion';
import { ApiResult } from './interface/apiResult';

import sourceMapSupport from 'source-map-support';

sourceMapSupport.install();
// Global variables here

class HueSyncBox extends utils.Adapter {
	private requestTimer: ioBroker.Timeout | null;
	private subscribedStates: string[];
	private readonly hueTarget: { id: string; name: string }[];
	private readonly hdmiSource: { id: string; name: string }[];
	private registrationTimer: ioBroker.Timeout | null;
	private requestCounter: number;
	private messageHandler: any[];
	private messageHandlerTimer: ioBroker.Timeout | null;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'hue-sync-box',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		this.requestTimer = null;
		this.registrationTimer = null;
		this.messageHandlerTimer = null;
		this.subscribedStates = [];
		this.hueTarget = [];
		this.hdmiSource = [];
		this.requestCounter = 0;
		this.messageHandler = [];
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here
		this.messageHandler = [];
		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);
		this.writeLog(`[Adapter v.${this.version} onReady] create data`, `debug`);
		await this.createStates();
		this.writeLog(`[Adapter v.${this.version} onReady] request data`, `debug`);
		await this.request();
	}

	private async request(): Promise<void> {
		for (const devicesKey in this.config.devices) {
			if (Object.prototype.hasOwnProperty.call(this.config.devices, devicesKey)) {
				const device = this.config.devices[devicesKey];
				const result = await this.apiCall(`https://${device.ip}/api/v1`, device, 'GET');
				if (!result) {
					this.writeLog(
						`[Adapter v.${this.version} request] no result found for ${device.ip} request is aborted`,
						'error',
					);
					await this.setStateAsync(
						`box_${await replaceFunktion(this.config.devices[devicesKey].name)}.reachable`,
						false,
						true,
					);
					break;
				}
				if (result && result.status === 200) {
					this.writeLog(`[Adapter v.${this.version} request] result found for ${device.ip}`, 'debug');
					this.setState('info.connection', true, true);
					await this.writeState(result, parseInt(devicesKey));
					// set reachable to true
					await this.setStateAsync(
						`box_${await replaceFunktion(this.config.devices[devicesKey].name)}.reachable`,
						true,
						true,
					);
				} else {
					this.writeLog(
						`[Adapter v.${this.version} request] no result found for ${device.ip} request is aborted`,
						'error',
					);
					await this.setStateAsync(
						`box_${await replaceFunktion(this.config.devices[devicesKey].name)}.reachable`,
						false,
						true,
					);
					break;
				}
			}
		}

		// timer for request of 10 seconds
		if (this.requestTimer) this.clearTimeout(this.requestTimer);
		this.requestTimer = this.setTimeout(async () => {
			await this.request();
		}, 15000);
	}

	private async writeState(result: { data: ApiResult }, key: number): Promise<void> {
		const data = result.data as ApiResult;
		if (data === undefined) {
			this.writeLog(`[Adapter v.${this.version} writeState] no data received`, `error`);
			return;
		}
		// write state of device
		this.writeLog(
			`[Adapter v.${this.version} writeState] prepare to write the data for ${this.config.devices[key].name}`,
			'debug',
		);

		// write the result data to the json state
		await this.setStateAsync(
			`box_${await replaceFunktion(this.config.devices[key].name)}.json`,
			JSON.stringify(data),
			true,
		);

		for (const [resultKey, resultValue] of Object.entries(data)) {
			if (typeof resultValue === 'object') {
				for (const [valueKey, value] of Object.entries(resultValue)) {
					if (typeof value !== 'object') {
						if (resultKey !== 'ir' && resultKey !== 'registrations' && resultKey !== 'presets') {
							await this.setStateAsync(
								`box_${await replaceFunktion(this.config.devices[key].name)}.${resultKey}.${valueKey}`,
								{
									val: value as any,
									ack: true,
								},
							);
						}
					} else {
						if (resultKey !== 'ir' && resultKey !== 'registrations' && resultKey !== 'presets') {
							for (const value1Key in value) {
								const valueObjKey = value1Key as keyof typeof value;

								if (Object.prototype.hasOwnProperty.call(value, valueObjKey)) {
									if (resultKey === 'hue') {
										for (const [hueGroupKey, hueGroupValue] of Object.entries(value[valueObjKey])) {
											await this.setStateAsync(
												`box_${await replaceFunktion(
													this.config.devices[key].name,
												)}.${resultKey}.${valueKey}.${valueObjKey}.${hueGroupKey}`,
												{
													val: hueGroupValue as any,
													ack: true,
												},
											);
										}
									} else {
										if (
											resultKey === 'execution' &&
											valueObjKey === 'intensity' &&
											valueKey === data.execution.lastSyncMode
										) {
											this.writeLog(
												`[Adapter v.${this.version} writeState] write state for ${resultKey}.${valueObjKey} with value ${value[valueObjKey]} from ${resultKey}.${valueKey}.${valueObjKey}`,
												'debug',
											);
											const mode = data.execution
												.lastSyncMode as ApiResult['execution']['lastSyncMode'];
											await this.setStateAsync(
												`box_${await replaceFunktion(
													this.config.devices[key].name,
												)}.${resultKey}.${valueObjKey}`,
												{
													val: data.execution[mode].intensity,
													ack: true,
												},
											);
										}
										await this.setStateAsync(
											`box_${await replaceFunktion(
												this.config.devices[key].name,
											)}.${resultKey}.${valueKey}.${valueObjKey}`,
											{
												val: value[valueObjKey] as any,
												ack: true,
											},
										);
									}
								}
							}
						}
					}
				}
			}
		}
		this.writeLog(
			`[Adapter v.${this.version} writeState] all data for ${this.config.devices[key].name} written`,
			'debug',
		);
	}

	private async apiCall(url: string, device: ioBroker.Devices, method: string, data?: any): Promise<any> {
		try {
			// create config for axios
			const config = {
				method: method,
				url: url,
				headers: {
					Authorization: `Bearer ${this.decrypt(device.token)}`,
					'Content-Type': 'application/json',
				},
				httpsAgent: new https.Agent({ rejectUnauthorized: false }),
				data: data,
			};

			// send request
			const response = await axios(config);
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] response: ${JSON.stringify(
					response.data,
				)}`,
				'debug',
			);
			return response;
		} catch (error) {
			if (error.response) {
				if (error.response.status === 400) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.response.status} ${error.message} - Body malformed.`,
						'error',
					);
				} else if (error.response.status === 401) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.response.status} ${error.message} - Authentication failed`,
						'error',
					);
					if (error.response.data.code === 2) {
						this.writeLog(
							`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.response.status} ${error.message} - Invalid Token`,
							'error',
						);
					}
					return error.response;
				} else if (error.response.status === 404) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.response.status} ${error.message} - Invalid URL Path`,
						'error',
					);
					return error.response;
				} else if (error.response.status === 500) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.response.status} ${error.message} - internal server error`,
						'error',
					);
					return;
				} else {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error}`,
						'error',
					);
					return error.response;
				}
			} else {
				if (error.code === 'ECONNREFUSED') {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.code} - Connection refused Message: ${error.message}`,
						'error',
					);
					return error;
				}
				if (error.code === 'ECONNRESET') {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.code} - Connection reset by peer Message: ${error.message}`,
						'error',
					);
					return error;
				}
				if (error.code === 'ETIMEDOUT') {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.code} - Connection timed out Message: ${error.message}`,
						'error',
					);
					return error;
				}
				if (error.code === 'ENOTFOUND') {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.code} - DNS lookup failed Message: ${error.message}`,
						'error',
					);
					return error;
				}
				if (error.code === 'EHOSTUNREACH') {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error: ${error.code} - Host is unreachable Message: ${error.message}`,
						'error',
					);
					return error;
				}
				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} apiCall] error Code: ${error.code} Message: ${error.message}`,
					'error',
				);
			}
		}
	}

	private async sendCommand(id: string, state: ioBroker.State): Promise<void> {
		this.writeLog(`[Adapter v.${this.version} sendCommand] prepare to send the command for ${id}`, 'debug');

		// get the room from the id
		const name = id.split('.')[0].replace('box_', '');
		// get the channel from the id
		const channel = id.split('.')[1];
		// get the channel2 from the id
		const channel2 = id.split('.')[2];
		// get the command from the id
		const commandWord = id.split('.').pop();

		let boxConfig = null;
		for (const devicesKey in this.config.devices) {
			// find the config for the name in this.config.devices
			if ((await replaceFunktion(this.config.devices[devicesKey].name)) === name) {
				boxConfig = this.config.devices[devicesKey];
			}
		}
		this.writeLog(
			`[Adapter v.${this.version} sendCommand] get the boxConfig: ${JSON.stringify(boxConfig)}`,
			'debug',
		);

		// if no config was found, return
		if (!boxConfig) {
			this.writeLog(`[Adapter v.${this.version} sendCommand] no boxConfig found for ${name}`, 'error');
			return;
		}

		// create the Url for the request
		let url: string;
		// check if the commandWord same as the channel2
		if (commandWord === channel2) {
			url = `https://${boxConfig.ip}/api/v1/${channel}`;
		} else {
			// if not, add the channel2 to the url
			url = `https://${boxConfig.ip}/api/v1/${channel}/${channel2}`;
		}
		this.writeLog(`[Adapter v.${this.version} sendCommand] assemble the url ${url}`, 'debug');

		// send the request
		this.writeLog(`[Adapter v.${this.version} sendCommand] send the request to ${url}`, 'debug');
		const response = await this.apiCall(url, boxConfig, 'put', {
			[commandWord as string]: state.val,
		});

		if (response) {
			// check if the request was successful
			if (response.status === 200) {
				if (this.requestTimer) this.clearTimeout(this.requestTimer);
				this.writeLog(`[Adapter v.${this.version} sendCommand] ${id} was changed to ${state.val}`, 'debug');
				await this.setStateAsync(id, state.val, true);
				// start call all the states to update the values
				await this.request();
			} else {
				if (response.code === 'ETIMEDOUT') {
					this.writeLog(
						`[Adapter v.${this.version} sendCommand] ${id} was not changed to ${state.val} because of timeout => massage: ${response.message} => try again`,
						'error',
					);
					return;
				} else {
					this.writeLog(
						`[Adapter v.${this.version} sendCommand] ${id} was not changed to ${state.val} because of error ${response.code} => massage: ${response.message}`,
						'error',
					);
					return;
				}
			}
		} else {
			this.writeLog(`[Adapter v.${this.version} sendCommand] no response => ${response}`, 'error');
		}
	}

	private async createStates(): Promise<void> {
		if (this.config.devices) {
			for (const key in this.config.devices) {
				if (Object.prototype.hasOwnProperty.call(this.config.devices, key)) {
					const result = await this.apiCall(
						`https://${this.config.devices[key].ip}/api/v1`,
						this.config.devices[key],
						'GET',
					);
					if (!result) {
						this.writeLog(
							`[Adapter v.${this.version} createObjects]  no result found for ${this.config.devices[key].ip} createStates is aborted`,
							'error',
						);
						return;
					}
					const data = result.data as ApiResult;
					if (data === undefined) {
						this.writeLog(`[Adapter v.${this.version} createObjects] no data received`, `error`);
						return;
					}
					if (result.status === 401) {
						if (result.data.code === 2) {
							this.writeLog(`[Adapter v.${this.version} createObjects] invalid token`, `error`);
							return;
						}
						this.writeLog(`[Adapter v.${this.version} createObjects] Authentication failed`, `error`);
					}
					this.writeLog(`[Adapter v.${this.version} createObjects] initializing Object creation`, 'debug');

					// create the states for the devices
					if (!this.config.devices) return this.writeLog(`No devices configured`, 'warn');

					// get the current space and replace all special characters, so it can be used as id
					const name = await replaceFunktion(this.config.devices[key].name);

					// create the device
					this.writeLog(
						`[Adapter v.${this.version} createObjects] creating device with Name  box_${name}`,
						'debug',
					);

					await this.extendObjectAsync(`box_${name}`, {
						type: 'device',
						common: {
							name: this.config.devices[key].name,
							// eslint-disable-next-line @typescript-eslint/ban-ts-comment
							// @ts-ignore
							statusStates: {
								onlineId: `${this.namespace}.box_${name}.reachable`,
							},
						},
						native: {
							id: this.config.devices[key].id ? this.config.devices[key].id : 'no id',
						},
					});

					// create the info JSON state
					await this.setObjectNotExistsAsync(`box_${name}.json`, {
						type: 'state',
						common: {
							name: 'response JSON',
							desc: 'The data JSON from the request',
							type: 'string',
							role: 'json',
							def: '',
							read: true,
							write: false,
						},
						native: {},
					});

					// create a state for the Accessibility
					await this.setObjectNotExistsAsync(`box_${name}.reachable`, {
						type: 'state',
						common: {
							name: 'reachable',
							desc: 'Is the box reachable',
							type: 'boolean',
							role: 'indicator.reachable',
							def: false,
							read: true,
							write: false,
						},
						native: {},
					});

					this.writeLog(
						`[Adapter v.${this.version} createObjects] creating channel and states for device`,
						'debug',
					);
					// create the channels and states for the device
					await this.setObjectNotExistsAsync(`box_${name}.device`, {
						type: 'channel',
						common: {
							name: 'device',
						},
						native: {},
					});

					for (const key in deviceChannelObj) {
						if (deviceChannelObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.device.${key}`, deviceChannelObj[key]);
						}
					}

					for (const key in deviceStateObj) {
						if (deviceStateObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.device.${key}`, deviceStateObj[key]);
							// check if the state may be described
							if (deviceStateObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.device.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.device.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.device.${key}`);
									this.subscribedStates.push(`box_${name}.device.${key}`);
								}
							}
						}
					}

					for (const key in networkObj) {
						if (networkObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.device.wifi.${key}`, networkObj[key]);
							// check if the state may be described
							if (networkObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.device.wifi.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.device.wifi.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.device.wifi.${key}`);
									this.subscribedStates.push(`box_${name}.device.wifi.${key}`);
								}
							}
						}
					}
					for (const key in updateObj) {
						if (updateObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.device.update.${key}`, updateObj[key]);
							// check if the state may be described
							if (updateObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.device.update.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.device.update.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.device.update.${key}`);
									this.subscribedStates.push(`box_${name}.device.update.${key}`);
								}
							}
						}
					}
					for (const key in capabilitiesObj) {
						if (capabilitiesObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(
								`box_${name}.device.capabilities.${key}`,
								capabilitiesObj[key],
							);
							// check if the state may be described
							if (capabilitiesObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.device.capabilities.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.device.capabilities.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.device.capabilities.${key}`);
									this.subscribedStates.push(`box_${name}.device.capabilities.${key}`);
								}
							}
						}
					}

					this.writeLog(
						`[Adapter v.${this.version} createObjects] creating channel and states for hue`,
						'debug',
					);
					await this.setObjectNotExistsAsync(`box_${name}.hue`, {
						type: 'channel',
						common: {
							name: 'hue',
						},
						native: {},
					});

					for (const key in hueChannelObj) {
						if (hueChannelObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.hue.${key}`, hueChannelObj[key]);
						}
					}

					for (const key in hueObj) {
						if (hueObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.hue.${key}`, hueObj[key]);
							// check if the state may be described
							if (hueObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.hue.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.hue.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.hue.${key}`);
									this.subscribedStates.push(`box_${name}.hue.${key}`);
								}
							}
						}
					}
					for (const groupKey in data.hue.groups) {
						for (const key in groupsObj) {
							if (groupsObj.hasOwnProperty(key)) {
								await this.setObjectNotExistsAsync(
									`box_${name}.hue.groups.${groupKey}.${key}`,
									groupsObj[key],
								);
								// check if the state may be described
								if (groupsObj[key].common.write) {
									// check if the state is in subscribedStates
									if (!this.subscribedStates.includes(`box_${name}.hue.groups.${groupKey}.${key}`)) {
										this.writeLog(
											`[Adapter v.${this.version} createObjects] subscribe state box_${name}.hue.groups.${groupKey}.${key}`,
											'debug',
										);
										this.subscribeStates(`box_${name}.hue.groups.${groupKey}.${key}`);
										this.subscribedStates.push(`box_${name}.hue.groups.${groupKey}.${key}`);
									}
								}
							}
						}
					}

					this.writeLog(
						`[Adapter v.${this.version} createObjects] creating channel and states for execution`,
						'debug',
					);
					await this.setObjectNotExistsAsync(`box_${name}.execution`, {
						type: 'channel',
						common: {
							name: 'execution',
						},
						native: {},
					});

					for (const key in executionChannelObj) {
						if (executionChannelObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(
								`box_${name}.execution.${key}`,
								executionChannelObj[key],
							);
						}
					}

					for (const key in executionObj) {
						if (executionObj.hasOwnProperty(key)) {
							// check if the key is hueTarget
							if (key === 'hueTarget') {
								const hueTargetObj: { [key: string]: string } = {};
								for (const dataKey in data.hue.groups) {
									if (data.hue.groups.hasOwnProperty(dataKey)) {
										if (!this.hueTarget.some((element) => element.id === dataKey)) {
											this.hueTarget.push({ id: dataKey, name: data.hue.groups[dataKey].name });
										}
									}
								}
								for (const hueTargetKey in this.hueTarget) {
									if (this.hueTarget.hasOwnProperty(hueTargetKey)) {
										//
										hueTargetObj[this.hueTarget[hueTargetKey].id] =
											this.hueTarget[hueTargetKey].name;
									}
								}

								// get the oldObject from execution.hueTarget
								const oldObj = await this.getObjectAsync(`box_${name}.execution.${key}`);
								if (oldObj) {
									// change the common.states of the oldObject to the new states
									oldObj.common.states = hueTargetObj;
									await this.setObjectAsync(`box_${name}.execution.${key}`, oldObj);
								} else {
									// create a new object if it does not exist yet and set the states
									await this.setObjectNotExistsAsync(`box_${name}.execution.${key}`, {
										...executionObj[key],
										common: {
											...executionObj[key].common,
											states: hueTargetObj,
										},
									});
								}
								if (!this.subscribedStates.includes(`box_${name}.execution.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} axios v.${axios.VERSION} createObjects] subscribe state box_${name}.execution.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.execution.${key}`);
									this.subscribedStates.push(`box_${name}.execution.${key}`);
								}
							} else if (key === 'hdmiSource') {
								const hdmiSourceObj: { [key: string]: string } = {};
								for (const dataKey in data.hdmi) {
									if (data.hdmi.hasOwnProperty(dataKey)) {
										if (
											dataKey === 'input1' ||
											dataKey === 'input2' ||
											dataKey === 'input3' ||
											dataKey === 'input4'
										) {
											if (!this.hdmiSource.some((element) => element.id === dataKey)) {
												this.hdmiSource.push({ id: dataKey, name: data.hdmi[dataKey].name });
											} else {
											}
										}
									}
								}
								for (const hdmiSourceKey in this.hdmiSource) {
									if (this.hdmiSource.hasOwnProperty(hdmiSourceKey)) {
										//
										hdmiSourceObj[this.hdmiSource[hdmiSourceKey].id] =
											this.hdmiSource[hdmiSourceKey].name;
									}
								}
								// get the oldObject from hue-sync-box.0.box_dev.execution.hdmiSource
								const oldObj = await this.getObjectAsync(`box_${name}.execution.${key}`);
								if (oldObj) {
									// change the common.states of the oldObject to the new states
									oldObj.common.states = hdmiSourceObj;
									await this.setObjectAsync(`box_${name}.execution.${key}`, oldObj);
								} else {
									// create a new object if it does not exist yet and set the states
									await this.setObjectNotExistsAsync(`box_${name}.execution.${key}`, {
										...executionObj[key],
										common: {
											...executionObj[key].common,
											states: hdmiSourceObj,
										},
									});
								}
								if (!this.subscribedStates.includes(`box_${name}.execution.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.execution.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.execution.${key}`);
									this.subscribedStates.push(`box_${name}.execution.${key}`);
								}
								//
							} else {
								await this.setObjectNotExistsAsync(`box_${name}.execution.${key}`, executionObj[key]);
								// check if the state may be described
								if (executionObj[key].common.write) {
									// check if the state is in subscribedStates
									if (!this.subscribedStates.includes(`box_${name}.execution.${key}`)) {
										this.writeLog(
											`[Adapter v.${this.version} createObjects] subscribe state box_${name}.execution.${key}`,
											'debug',
										);
										this.subscribeStates(`box_${name}.execution.${key}`);
										this.subscribedStates.push(`box_${name}.execution.${key}`);
									}
								}
							}
						}
					}
					const array = ['game', 'music', 'video'];
					for (const arrayKey in array) {
						if (array.hasOwnProperty(arrayKey)) {
							if (array[arrayKey] !== 'music') {
								for (const key in video_gameObj) {
									if (video_gameObj.hasOwnProperty(key)) {
										await this.setObjectNotExistsAsync(
											`box_${name}.execution.${array[arrayKey]}.${key}`,
											video_gameObj[key],
										);
										// check if the state may be described
										if (video_gameObj[key].common.write) {
											// check if the state is in subscribedStates
											if (
												!this.subscribedStates.includes(
													`box_${name}.execution.${array[arrayKey]}.${key}`,
												)
											) {
												this.writeLog(
													`[Adapter v.${this.version} createObjects] subscribe state box_${name}.execution.${array[arrayKey]}.${key}`,
													'debug',
												);
												this.subscribeStates(`box_${name}.execution.${array[arrayKey]}.${key}`);
												this.subscribedStates.push(
													`box_${name}.execution.${array[arrayKey]}.${key}`,
												);
											}
										}
									}
								}
							} else {
								for (const key in musicObj) {
									if (musicObj.hasOwnProperty(key)) {
										await this.setObjectNotExistsAsync(
											`box_${name}.execution.${array[arrayKey]}.${key}`,
											musicObj[key],
										);
										// check if the state may be described
										if (musicObj[key].common.write) {
											// check if the state is in subscribedStates
											if (
												!this.subscribedStates.includes(
													`box_${name}.execution.${array[arrayKey]}.${key}`,
												)
											) {
												this.writeLog(
													`[Adapter v.${this.version} createObjects] subscribe state box_${name}.execution.${array[arrayKey]}.${key}`,
													'debug',
												);
												this.subscribeStates(`box_${name}.execution.${array[arrayKey]}.${key}`);
												this.subscribedStates.push(
													`box_${name}.execution.${array[arrayKey]}.${key}`,
												);
											}
										}
									}
								}
							}
						}
					}

					this.writeLog(
						`[Adapter v.${this.version} createObjects] creating channel and states for hdmi`,
						'debug',
					);
					await this.setObjectNotExistsAsync(`box_${name}.hdmi`, {
						type: 'channel',
						common: {
							name: 'hdmi',
						},
						native: {},
					});

					for (const key in hdmiChannelObj) {
						if (hdmiChannelObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.hdmi.${key}`, hdmiChannelObj[key]);
						}
					}

					for (const key in hdmiObj) {
						if (hdmiObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.hdmi.${key}`, hdmiObj[key]);
							// check if the state may be described
							if (hdmiObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.hdmi.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.hdmi.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.hdmi.${key}`);
									this.subscribedStates.push(`box_${name}.hdmi.${key}`);
								}
							}
						}
					}

					for (const key in hdmiInputObj) {
						if (hdmiInputObj.hasOwnProperty(key)) {
							for (let i = 1; i < 5; i++) {
								await this.setObjectNotExistsAsync(
									`box_${name}.hdmi.input${i}.${key}`,
									hdmiInputObj[key],
								);
								// check if the state may be described
								if (hdmiInputObj[key].common.write) {
									// check if the state is in subscribedStates
									if (!this.subscribedStates.includes(`box_${name}.hdmi.input${i}.${key}`)) {
										this.writeLog(
											`[Adapter v.${this.version} createObjects] subscribe state box_${name}.hdmi.input${i}.${key}`,
											'debug',
										);
										this.subscribeStates(`box_${name}.hdmi.input${i}.${key}`);
										this.subscribedStates.push(`box_${name}.hdmi.input${i}.${key}`);
									}
								}
							}
						}
						await this.setObjectNotExistsAsync(`box_${name}.hdmi.output.${key}`, hdmiInputObj[key]);
						// check if the state may be described
						if (hdmiInputObj[key].common.write) {
							// check if the state is in subscribedStates
							if (!this.subscribedStates.includes(`box_${name}.hdmi.output.${key}`)) {
								this.writeLog(
									`[Adapter v.${this.version} createObjects] subscribe state box_${name}.hdmi.output.${key}`,
									'debug',
								);
								this.subscribeStates(`box_${name}.hdmi.output.${key}`);
								this.subscribedStates.push(`box_${name}.hdmi.output.${key}`);
							}
						}
					}

					this.writeLog(
						`[Adapter v.${this.version} createObjects] creating channel and states for behavior`,
						'debug',
					);
					await this.setObjectNotExistsAsync(`box_${name}.behavior`, {
						type: 'channel',
						common: {
							name: 'behavior',
						},
						native: {},
					});

					for (const key in behaviorChannelObj) {
						if (behaviorChannelObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.behavior.${key}`, behaviorChannelObj[key]);
						}
					}

					for (const key in behaviorObj) {
						if (behaviorObj.hasOwnProperty(key)) {
							await this.setObjectNotExistsAsync(`box_${name}.behavior.${key}`, behaviorObj[key]);
							// check if the state may be described
							if (behaviorObj[key].common.write) {
								// check if the state is in subscribedStates
								if (!this.subscribedStates.includes(`box_${name}.behavior.${key}`)) {
									this.writeLog(
										`[Adapter v.${this.version} createObjects] subscribe state box_${name}.behavior.${key}`,
										'debug',
									);
									this.subscribeStates(`box_${name}.behavior.${key}`);
									this.subscribedStates.push(`box_${name}.behavior.${key}`);
								}
							}
						}
					}

					for (const key in behaviorInputObj) {
						if (behaviorInputObj.hasOwnProperty(key)) {
							for (let i = 1; i < 5; i++) {
								await this.setObjectNotExistsAsync(
									`box_${name}.behavior.input${i}.${key}`,
									behaviorInputObj[key],
								);
								// check if the state may be described
								if (behaviorInputObj[key].common.write) {
									// check if the state is in subscribedStates
									if (!this.subscribedStates.includes(`box_${name}.behavior.input${i}.${key}`)) {
										this.writeLog(
											`[Adapter v.${this.version} createObjects] subscribe state box_${name}.behavior.input${i}.${key}`,
											'debug',
										);
										this.subscribeStates(`box_${name}.behavior.input${i}.${key}`);
										this.subscribedStates.push(`box_${name}.behavior.input${i}.${key}`);
									}
								}
							}
						}
					}

					this.writeLog(
						`[Adapter v.${this.version} createObjects] all device / channel and states were created for ${name}`,
						'debug',
					);
				}
			}
		} else {
			this.writeLog(
				`[Adapter v.${this.version} createObjects] no devices configured, please configure the adapter`,
				'warn',
			);
		}
	}

	/**
	 * @description a function for log output
	 */
	private writeLog(logText: string, logType: 'silly' | 'info' | 'debug' | 'warn' | 'error'): void {
		if (logType === 'warn' || logType === 'error') {
			if (this.messageHandler.length > 0) {
				// check if the logText is not in the messageHandler
				if (!this.messageHandler.find((message) => message.message === logText)) {
					// push the logText to the messageHandler
					this.messageHandler.push({
						severity: logType,
						clearTimer: false,
						message: logText,
					});
					if (logType === 'warn') this.log.warn(logText);
					if (logType === 'error') this.log.error(logText);
					this.log.debug(
						`[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler),
					);
				} else {
					if (!this.messageHandler.find((message) => message.message === logText).clearTimer) {
						// set the clearTimer to true
						this.messageHandler.find((message) => message.message === logText).clearTimer = true;
						// set the clearTimer to false and clear the messageHandler for the logText after 5 min
						this.messageHandlerTimer = this.setTimeout(() => {
							this.messageHandler.find((message) => message.message === logText).clearTimer = false;
							this.messageHandler = this.messageHandler.filter((message) => message.message !== logText);
							this.log.debug(`[Adapter v.${this.version} writeLog] clear messageHandler for ${logText}`);
						}, 300000);
					}
					this.log.debug(
						`[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler),
					);
				}
			} else {
				// push the logText to the messageHandler
				this.messageHandler.push({
					severity: logType,
					clearTimer: false,
					message: logText,
				});
				if (logType === 'warn') this.log.warn(logText);
				if (logType === 'error') this.log.error(logText);
				this.log.debug(
					`[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler),
				);
			}
		} else {
			if (logType === 'silly') this.log.silly(logText);
			if (logType === 'info') this.log.info(logText);
			if (logType === 'debug') this.log.debug(logText);
		}
	}

	private async registration(obj: ioBroker.Message): Promise<any> {
		this.requestCounter++;
		try {
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} registration] start registrations`,
				`info`,
			);
			const device = obj.message as { ip: string; name: string };
			const registrationsUrl = `https://${device.ip}/api/v1/registrations`;

			// create agent for https request
			const agent = new https.Agent({
				rejectUnauthorized: false,
			});
			// create the request with the agent and data
			const registrations = await axios.post(
				registrationsUrl,
				{
					appName: 'ioBroker',
					instanceName: `hue_sync_box_${device.name}`,
				},
				{
					httpsAgent: agent,
				},
			);
			if (registrations) {
				if (registrations.status === 200) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} was successful`,
						'info',
					);

					if (registrations.data.accessToken) {
						if (obj.callback) this.sendTo(obj.from, obj.command, registrations.data, obj.callback);
						this.requestCounter = 5;
						return;
					}
				}
			} else {
				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} was not successful - no response ${registrations}`,
					'error',
				);
			}
		} catch (error) {
			const device = obj.message as { ip: string; name: string };

			if (error.code === 'ETIMEDOUT') {
				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, timeout. > message => ${error.message} Stack: ${error.stack} <`,
					'error',
				);
				const response = {
					code: error.code,
					message: error.message,
				};
				if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
				this.requestCounter = 5;
				return;
			}

			if (error.response) {
				if (error.response.status === 400) {
					if (error.response.data.code === 16) {
						const response = error.response.data;
						console.log(
							`[Adapter v.${this.version} axios v.${
								axios.VERSION
							} registration] Code: 16 => ${JSON.stringify(response)}`,
						);

						this.writeLog(
							`[Adapter v.${this.version} axios v.${
								axios.VERSION
							} registration] Code: 16 => ${JSON.stringify(response)}`,
							'debug',
						);
					} else {
						console.log(
							`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, error: ${error.response.statusText} > message => ${error.message} Stack: ${error.stack} <`,
						);

						this.writeLog(
							`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, error: ${error.response.statusText} > message => ${error.message} Stack: ${error.stack} <`,
							'error',
						);
						const response = {
							code: error.response.status,
							codeString: error.code,
							message: error.message,
							responseMessage: error.response.statusText,
						};
						if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
						this.requestCounter = 5;
						return;
					}
				} else {
					console.log(
						`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, error: ${error.response.statusText} > message => ${error.message} Stack: ${error.stack} <`,
					);

					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, error: ${error.response.statusText} > message => ${error.message} Stack: ${error.stack} <`,
						'error',
					);
					const response = {
						code: error.response.status,
						codeString: error.code,
						message: error.message,
						responseMessage: error.response.statusText,
					};
					if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
					this.requestCounter = 5;
					return;
				}
			} else {
				console.log(
					`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, error: ${error.message} > message => ${error.message} Stack: ${error.stack} <`,
				);

				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} registration] registration for ${device.name} failed, error: ${error.message} > message => ${error.message} Stack: ${error.stack} <`,
					'error',
				);
				const response = {
					code: error.code,
					message: error.message,
				};
				if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
				this.requestCounter = 5;
				return;
			}
		}

		// create a new timer that runs until the box is registered or the requestCounter is 5
		if (this.requestCounter < 5) {
			this.registrationTimer = this.setTimeout(async () => {
				await this.registration(obj);
			}, 4000);
		} else {
			if (this.registrationTimer) this.clearTimeout(this.registrationTimer);
			this.requestCounter = 0;
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} registrations] registration failed`,
				`error`,
			);
			const response = {
				code: 500,
				message: 'registration failed',
			};
			if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
		}
	}

	private async requestRegistrationsId(obj: ioBroker.Message): Promise<number | null> {
		try {
			const device = obj.message as { ip: string; name: string; token: string; id: number };
			let registrationsId = null;
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} requestRegistrationsId] request registrations id for ${device.name}`,
				'info',
			);
			const registrationsUrl = `https://${device.ip}/api/v1/registrations`;
			const agent = new https.Agent({ rejectUnauthorized: false });
			const registrations = await axios.get(registrationsUrl, {
				headers: {
					Authorization: `Bearer ${this.decrypt(device.token)}`,
					'Content-Type': 'application/json',
				},
				httpsAgent: agent,
			});
			if (registrations) {
				if (registrations.status === 200) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} requestRegistrationsId] request registrations id for ${device.name} was successful`,
						'info',
					);
					for (const index in registrations.data) {
						const instanceName = `hue_sync_box_${device.name}`;

						if (registrations.data[index].instanceName === instanceName) {
							this.writeLog(
								`[Adapter v.${this.version} axios v.${axios.VERSION} requestRegistrationsId] registrations id for ${device.name} is ${index}`,
								'info',
							);
							registrationsId = parseInt(index, 10);
						}
					}
				}
			} else {
				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} requestRegistrationsId] request registrations id for ${device.name} failed no response => ${registrations}`,
					'error',
				);
			}
			return registrationsId;
		} catch (error) {
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} requestRegistrationsId] ${error.message} Stack: ${error.stack}`,
				'error',
			);
			return null;
		}
	}

	private async deleteRegistrations(obj: ioBroker.Message): Promise<any> {
		try {
			const device = obj.message as { ip: string; name: string; token: string; id: number };
			if (device.id == 0 || device.id == undefined || device.id == null) {
				const id = await this.requestRegistrationsId(obj);
				if (id != null) {
					console.log(
						`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] deleteRegistrations new id`,
						id,
					);
					device.id = id;
				} else {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] no id found`,
						`error`,
					);
					const response = {
						code: 500,
						message: 'no id found',
					};
					if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
					return;
				}
			}
			if (!device.id) {
				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] no id found`,
					`error`,
				);
				const response = {
					code: 500,
					message: 'no id found',
				};
				if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
				return;
			}
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] delete registrations for ${device.name}`,
				'info',
			);
			const deleteUrl = `https://${device.ip}/api/v1/registrations/${device.id}`;
			const deleteConfig = {
				method: 'delete',
				url: deleteUrl,
				headers: {
					Authorization: `Bearer ${this.decrypt(device.token)}`,
					'Content-Type': 'application/json',
				},
				httpsAgent: new https.Agent({ rejectUnauthorized: false }),
			};
			const deleteResponse = await axios(deleteConfig);
			if (deleteResponse) {
				if (deleteResponse.status === 200) {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] registration for ${device.name} was deleted`,
						'info',
					);
					if (obj.command === 'deleteObjectsAndLogOut') {
						const status = { delete: true, logOut: true };
						if (obj.callback) this.sendTo(obj.from, obj.command, status, obj.callback);
					} else {
						const status = { delete: false, logOut: true };
						if (obj.callback) this.sendTo(obj.from, obj.command, status, obj.callback);
					}
				} else {
					this.writeLog(
						`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] delete registration for ${device.name} failed with status ${deleteResponse.status}`,
						'error',
					);
				}
			} else {
				this.writeLog(
					`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] delete registration for ${device.name} failed => no response => ${deleteResponse}`,
					'error',
				);
			}
		} catch (error) {
			this.writeLog(
				`[Adapter v.${this.version} axios v.${axios.VERSION} deleteRegistrations] ${error.message} Stack: ${error.stack}`,
				'error',
			);
		}
	}

	private async deleteObjects(obj: ioBroker.Message): Promise<any> {
		const device = obj.message as { ip: string; name: string; token: string; id: number };
		if (device.id == 0 || device.id == undefined || device.id == null) {
			const id = await this.requestRegistrationsId(obj);
			if (id != null) {
				device.id = id;
			} else {
				this.writeLog(`[Adapter v.${this.version} deleteObjects] no id found`, `error`);
				const response = {
					code: 500,
					message: 'no id found',
				};
				if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
				return;
			}
		}
		if (!device.id) {
			this.writeLog(`[Adapter v.${this.version} deleteObjects] no id found`, `error`);
			const response = {
				code: 500,
				message: 'no id found',
			};
			if (obj.callback) this.sendTo(obj.from, obj.command, response, obj.callback);
			return;
		}
		this.writeLog(`[Adapter v.${this.version} deleteObjects] delete objects for ${device.name}`, 'info');
		const objects = await this.getAdapterObjectsAsync();
		const deviceObjects: ioBroker.AdapterScopedObject[] = [];
		if (objects) {
			this.writeLog(`[Adapter v.${this.version} deleteObjects] search for all device objects`, 'debug');
			Object.keys(objects).filter((key) => {
				if (objects[key].type === 'device') {
					deviceObjects.push(objects[key]);
				}
			});
			if (deviceObjects.length > 0) {
				const deviceObject = deviceObjects.find((obj) => {
					this.writeLog(
						`[Adapter v.${this.version} deleteObjects] check if the native id ${device.id} is present`,
						'info',
					);
					if ((obj.native && obj.native.id === 'no id') || !obj.native.id) {
						this.writeLog(`[Adapter v.${this.version} deleteObjects] no id in native available`, 'info');
						this.writeLog(
							`[Adapter v.${this.version} deleteObjects] search for the names ${device.name}`,
							'info',
						);
						if (obj.common.name === device.name) {
							this.writeLog(`[Adapter v.${this.version} deleteObjects] Name found`, 'info');
							return obj;
						}
					}
					if (obj.native && obj.native.id === device.id) {
						this.writeLog(`[Adapter v.${this.version} deleteObjects] id found`, 'info');
						return obj;
					}
				});
				if (deviceObject) {
					// // delete the device object
					await this.delObjectAsync(deviceObject._id, { recursive: true });
					this.writeLog(
						`[Adapter v.${this.version} deleteObjects] device object for ${device.name} was deleted`,
						'info',
					);
					if (obj.command === 'deleteObjectsAndLogOut') {
						this.writeLog(
							`[Adapter v.${this.version} deleteObjects] delete registration for ${device.name}`,
							'info',
						);
						await this.deleteRegistrations(obj);
					} else {
						this.writeLog(
							`[Adapter v.${this.version} deleteObjects] delete objects for ${device.name} was finished send status to the Frontend`,
							'info',
						);
						const status = { delete: true, logOut: false };
						if (obj.callback) this.sendTo(obj.from, obj.command, status, obj.callback);
					}
				}
			}
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (typeof obj === 'object' && obj.message) {
			if (obj.command === 'registrations') {
				if (this.requestCounter === 0) {
					this.requestCounter = 0;
					await this.registration(obj);
				} else {
					if (this.registrationTimer) this.clearTimeout(this.registrationTimer);
					this.requestCounter = 0;
				}
			}
			if (obj.command === 'deleteObjects') {
				await this.deleteObjects(obj);
			}
			if (obj.command === 'logOut') {
				await this.deleteRegistrations(obj);
			}
			if (obj.command === 'deleteObjectsAndLogOut') {
				await this.deleteObjects(obj);
			}
		}
	}

	/**
	 * Is called if a subscribed state changes
	 */
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (state) {
			if (state.from === 'system.adapter.' + this.namespace) {
				// ignore the state change from the adapter itself
				return;
			} else {
				this.writeLog(
					`[Adapter v.${this.version} onStateChange] state ${id} changed: ${state.val} (ack = ${state.ack})`,
					'debug',
				);
				if (state.ack) return; // ignore the state change from the adapter itself
				// remove the adapter name from the id
				const idWithoutAdapterName = id.replace(this.namespace + '.', '');
				// check if the state is in subscribedStates
				if (this.subscribedStates.includes(idWithoutAdapterName)) {
					// send the command to the box
					await this.sendCommand(idWithoutAdapterName, state);
				}
			}
		} else {
			return;
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private async onUnload(callback: () => void): Promise<void> {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			if (this.requestTimer) this.clearTimeout(this.requestTimer);
			if (this.registrationTimer) this.clearTimeout(this.registrationTimer);
			if (this.messageHandlerTimer) this.clearTimeout(this.messageHandlerTimer);
			this.setState('info.connection', false, true);
			for (const devicesKey in this.config.devices) {
				this.setState(
					`box_${await replaceFunktion(this.config.devices[devicesKey].name)}.reachable`,
					false,
					true,
				);
			}

			callback();
		} catch (e) {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new HueSyncBox(options);
} else {
	// otherwise start the instance directly
	(() => new HueSyncBox())();
}
