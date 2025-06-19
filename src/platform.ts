import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Appliances } from './definitions/appliances';
import { DEVICES } from './const/devices';
import { TokenResponse } from './definitions/auth';
import { ElectroluxAccessory } from './accessories/accessory';
import fs from 'fs';
import path from 'path';
import { API_URL } from './const/url';
import { Appliance } from './definitions/appliance';
import { Context } from './definitions/context';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApplianceState } from './definitions/applianceState';

/*
    HomebridgePlatform
    This class is the main constructor for your plugin, this is where you should
    parse the user config and discover/register accessories with Homebridge.
*/
export class ElectroluxDevicesPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic =
        this.api.hap.Characteristic;

    public readonly accessories: ElectroluxAccessory[] = [];

    accessToken: string | null = null;
    private refreshToken: string | null = null;
    tokenExpirationDate: number | null = null;

    client!: AxiosInstance;

    regionalBaseUrl: string | null = null;

    private devicesDiscovered = false;
    private pollingInterval: NodeJS.Timeout | null = null;

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API
    ) {
        this.log.debug('Finished initializing platform:', this.config.name);

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', async () => {
            try {
                await this.createClient();

                await this.loadAuthData();

                // run the method to discover / register your devices as accessories
                await this.discoverDevices();
            } catch (err) {
                this.log.warn((err as Error).message);
            } finally {
                if (
                    this.config.pollingInterval &&
                    this.config.pollingInterval < 120
                ) {
                    this.log.warn(
                        'Polling interval is less than 120 seconds. This could lead to issues with the Electrolux API rate limiting. Please consider increasing the polling interval.'
                    );
                }

                this.pollingInterval = setInterval(
                    this.pollStatus.bind(this),
                    (this.config.pollingInterval || 120) * 1000
                );
            }
        });

        this.api.on('shutdown', async () => {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
        });
    }

    /*
        This function is invoked when homebridge restores cached accessories from disk at startup.
        It should be used to setup event handlers for characteristics and update respective values.
    */
    configureAccessory(accessory: PlatformAccessory<Context>) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(new ElectroluxAccessory(accessory));
    }

    async createClient() {
        if (!this.config.apiKey) {
            throw new Error(
                'Please make sure the plugin is configured properly. Check https://github.com/tomekkleszcz/homebridge-electrolux-devices?tab=readme-ov-file#-installation for more information.'
            );
        }

        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                Accept: 'application/json',
                'Accept-Charset': 'utf-8',
                'x-api-key': this.config.apiKey
            }
        });
        this.client.interceptors.request.use(this.authInterceptor.bind(this));
    }

    authInterceptor(value: InternalAxiosRequestConfig<unknown>) {
        if (value.url === '/api/v1/token/refresh') {
            return value;
        }

        if (this.accessToken) {
            value.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        return value;
    }

    async loadAuthData() {
        const storagePath = path.format({
            dir: this.api.user.storagePath(),
            base: 'homebridge_electrolux_device_persist.json'
        });

        /* Check if the file exists. */
        const exists = fs.existsSync(storagePath);
        /* If the file does not exist, get the refresh token from the config to get a new access token. */
        if (!exists) {
            this.refreshToken = this.config.refreshToken;
            if (!this.refreshToken) {
                throw new Error('Refresh token not found');
            }

            await this.refreshAccessToken();
            return;
        }

        /* Read the file and parse the JSON. */
        const json = fs.readFileSync(storagePath, 'utf8');
        const data = JSON.parse(json);

        /* If the file version is not 1, get the refresh token from the config to get a new access token. */
        if (data.version !== 1) {
            this.refreshToken = this.config.refreshToken;
            if (!this.refreshToken) {
                throw new Error(
                    'Please make sure the plugin is configured properly. Check https://github.com/tomekkleszcz/homebridge-electrolux-devices?tab=readme-ov-file#-installation for more information.'
                );
            }

            await this.refreshAccessToken();
            return;
        }

        /* Set the auth data from the file. */
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
        this.tokenExpirationDate = data.tokenExpirationDate;

        if (
            !this.tokenExpirationDate ||
            Date.now() >= this.tokenExpirationDate
        ) {
            await this.refreshAccessToken();
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) {
            return;
        }

        this.log.info('Refreshing access token...');

        const response = await this.client.post<TokenResponse>(
            '/api/v1/token/refresh',
            {
                refreshToken: this.refreshToken
            }
        );

        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        this.tokenExpirationDate = Date.now() + response.data.expiresIn * 1000;

        this.log.info('Access token refreshed!');

        const json = JSON.stringify({
            version: 1,
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            tokenExpirationDate: this.tokenExpirationDate
        });

        const storagePath = path.format({
            dir: this.api.user.storagePath(),
            base: 'homebridge_electrolux_device_persist.json'
        });

        fs.writeFile(storagePath, json, 'utf8', (err) => {
            if (err) {
                this.log.error(
                    'An error occurred while saving auth data: ',
                    err.message
                );
            }
        });
    }

    private async getAppliances() {
        const response =
            await this.client.get<Appliances>('/api/v1/appliances');
        return response.data;
    }

    async getApplianceInfo(applianceId: string): Promise<Appliance | null> {
        try {
            const response = await this.client.get<Appliance>(
                `/api/v1/appliances/${applianceId}/info`
            );

            return response.data;
        } catch {
            return null;
        }
    }

    async getApplianceState(
        applianceId: string
    ): Promise<ApplianceState | null> {
        try {
            const response = await this.client.get<ApplianceState>(
                `/api/v1/appliances/${applianceId}/state`
            );

            return response.data;
        } catch {
            return null;
        }
    }

    /*
        Get the appliances from the Electrolux API and register each appliance as an accessory.
    */
    async discoverDevices() {
        if (!this.accessToken) {
            return;
        }

        this.log.info('Discovering devices...');

        const appliances = await this.getAppliances();

        appliances.map(async (applianceItem) => {
            if (!DEVICES[applianceItem.applianceType]) {
                this.log.warn(
                    'Accessory not found for model:',
                    applianceItem.applianceType
                );

                const applianceInfo = await this.getApplianceInfo(
                    applianceItem.applianceId
                );

                const deviceData = {
                    appliance: {
                        type: applianceItem.applianceType,
                        deviceType: applianceInfo?.applianceInfo.deviceType,
                        model: applianceInfo?.applianceInfo.model,
                        variant: applianceInfo?.applianceInfo.variant,
                        colour: applianceInfo?.applianceInfo.colour
                    },
                    capabilities: applianceInfo?.capabilities
                };

                this.log.warn(
                    'It looks like this appliance is not supported by the plugin. Please create a new issue here: https://github.com/tomekkleszcz/homebridge-electrolux-devices/issues and include the log below in the description.'
                );
                this.log.warn(JSON.stringify(deviceData));
                return;
            }

            const state = await this.getApplianceState(
                applianceItem.applianceId
            );

            if (!state) {
                this.log.warn(
                    'State not found for appliance:',
                    applianceItem.applianceId
                );
                return;
            }

            const uuid = this.api.hap.uuid.generate(applianceItem.applianceId);

            const existingAccessory = this.accessories.find(
                (accessory) => accessory.platformAccessory.UUID === uuid
            );

            /* 
                Get the capabilities of the appliance from the context.
                If the capabilities are not in the context, fetch them from the API.
                If the capabilities equals null, that means the appliance capabilities is not supported.
            */
            const appliance =
                existingAccessory?.platformAccessory.context.appliance !==
                undefined
                    ? existingAccessory.platformAccessory.context.appliance
                    : await this.getApplianceInfo(applianceItem.applianceId);

            if (existingAccessory) {
                this.log.info(
                    'Restoring existing accessory from cache:',
                    existingAccessory.platformAccessory.displayName
                );
                existingAccessory.controller = new DEVICES[
                    applianceItem.applianceType
                ](
                    this,
                    existingAccessory.platformAccessory,
                    applianceItem,
                    state,
                    appliance
                );
                return;
            }

            this.log.info('Adding new accessory:', applianceItem.applianceName);

            const platformAccessory = new this.api.platformAccessory(
                applianceItem.applianceName,
                uuid
            );
            const accessory = new ElectroluxAccessory(
                platformAccessory,
                new DEVICES[applianceItem.applianceType](
                    this,
                    platformAccessory,
                    applianceItem,
                    state,
                    appliance
                )
            );
            this.accessories.push(accessory);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
                platformAccessory
            ]);
        });

        this.log.info('Devices discovered!');
        this.devicesDiscovered = true;
    }

    async pollStatus() {
        try {
            if (
                !this.tokenExpirationDate ||
                Date.now() >= this.tokenExpirationDate
            ) {
                await this.refreshAccessToken();
            }

            if (!this.devicesDiscovered) {
                await this.discoverDevices();
                return;
            }

            this.log.debug('Polling appliances status...');

            const appliances = await this.getAppliances();

            appliances.map(async (appliance) => {
                const uuid = this.api.hap.uuid.generate(appliance.applianceId);

                const existingAccessory = this.accessories.find(
                    (accessory) => accessory.platformAccessory.UUID === uuid
                );
                if (!existingAccessory) {
                    return;
                }

                const state = await this.getApplianceState(
                    appliance.applianceId
                );
                if (!state) {
                    return;
                }

                existingAccessory.controller?.update(state);
            });

            this.log.debug('Appliances status polled!');
        } catch (err) {
            const message =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (err as any).response?.data?.message ?? (err as Error).message;

            this.log.warn('Polling error: ', message);
        }
    }
}
