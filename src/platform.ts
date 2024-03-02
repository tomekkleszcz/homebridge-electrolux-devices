import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {
    axiosAppliance,
    axiosAuth
} from './services/axios';
import {Appliances} from './definitions/appliances';
import {DEVICES} from './const/devices';
import {ACCOUNTS_API_KEY} from './const/apiKey';
import Gigya from 'gigya';
import { TokenResponse } from './definitions/auth';
import { ElectroluxAccessoryController } from './accessories/controller';
import { ElectroluxAccessory } from './accessories/accessory';
import fs from 'fs';
import path from 'path';
import { Region } from './definitions/region';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ElectroluxDevicesPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic =
        this.api.hap.Characteristic;

    public readonly accessories: ElectroluxAccessory[] = [];

    private gigya: Gigya | null = null;
    private uid: string | null = null;
    private oauthToken: string | null = null;
    private sessionSecret: string | null = null;

    accessToken: string | null = null;
    private refreshToken: string | null = null;
    tokenExpirationDate: number | null = null;

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
                if (!this.config.refreshToken) {
                    await this.signIn();
                } else {
                    this.refreshToken = this.config.refreshToken;
                    await this.refreshAccessToken();
                }

                // run the method to discover / register your devices as accessories
                await this.discoverDevices();

            } catch(err) {
                this.log.warn((err as Error).message);
            } finally {
                this.pollingInterval = setInterval(this.pollStatus.bind(this), (this.config.pollingInterval || 10) * 1000);

            }
        });

        this.api.on('shutdown', async () => {
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory<ElectroluxAccessoryController>) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(new ElectroluxAccessory(accessory));
    }

    async signIn() {
        const region: Region = this.config.region || 'eu';

        this.gigya = new Gigya(ACCOUNTS_API_KEY, `${region}1`);

        const storagePath = path.format({
            dir: this.api.user.storagePath(),
            base: 'homebridge_electrolux_device_persist.json'
        });
        if(fs.existsSync(storagePath)) {
            this.log.info('Restoring auth data from cache...');

            const json = fs.readFileSync(storagePath, 'utf8');
            const data = JSON.parse(json);

            this.uid = data.uid;
            this.oauthToken = data.oauthToken;
            this.sessionSecret = data.sessionSecret;

            this.accessToken = data.accessToken;
            this.refreshToken = data.refreshToken;
            this.tokenExpirationDate = data.tokenExpirationDate;

            this.log.info('Auth data restored from cache!');
            return;
        }

        this.log.info('Signing in to Electrolux...');

        try {
            if(!this.uid || !this.oauthToken) {
                const loginResponse = await this.gigya.accounts.login({
                    loginID: this.config.email,
                    password: this.config.password,
                    targetEnv: 'mobile'
                });
                this.uid = loginResponse.UID;
                this.oauthToken = loginResponse.sessionInfo?.sessionToken ?? null;
                this.sessionSecret = loginResponse.sessionInfo?.sessionSecret ?? null;
            }

            const jwtResponse = await this.gigya.accounts.getJWT({
                targetUID: this.uid,
                fields: 'country',
                oauth_token: this.oauthToken ?? undefined,
                secret: this.sessionSecret ?? undefined
            });

            const tokenResponse = await axiosAuth(region).post<TokenResponse>(
                '/token',
                {
                    grantType:
                        'urn:ietf:params:oauth:grant-type:token-exchange',
                    clientId: 'ElxOneApp',
                    idToken: jwtResponse.id_token,
                    scope: ''
                },
                {
                    headers: {
                        'Origin-Country-Code': 'PL'
                    }
                }
            );

            this.accessToken = tokenResponse.data.accessToken;
            this.refreshToken = tokenResponse.data.refreshToken;
            this.tokenExpirationDate = Date.now() + tokenResponse.data.expiresIn * 1000;

            this.log.info('Signed in to Electrolux!');

            const json = JSON.stringify({
                uid: this.uid,
                oauthToken: this.oauthToken,
                sessionSecret: this.sessionSecret,

                accessToken: this.accessToken,
                refreshToken: this.refreshToken,
                tokenExpirationDate: this.tokenExpirationDate
            });

            fs.writeFile(storagePath, json, 'utf8', (err) => {
                if(err) {
                    this.log.error('An error occurred while saving auth data: ', err.message);
                }
            });
        } catch (err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const message = (err as any).response?.data?.message ?? (err as Error).message;

            throw new Error('Couldn\'t not sign in to Electrolux: ' + message);
        }
    }

    async refreshAccessToken() {
        if(!this.refreshToken) {
            await this.signIn();
            return;
        }

        this.log.info('Refreshing access token...');

        const region: Region = this.config.region || 'eu';

        const response = await axiosAuth(region).post<TokenResponse>('/token', {
            grantType: 'refresh_token',
            clientId: 'ElxOneApp',
            refreshToken: this.refreshToken,
            scope: ''
        });

        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        this.tokenExpirationDate = Date.now() + response.data.expiresIn * 1000;

        this.log.info('Access token refreshed!');
    }

    private async getAppliances() {
        const response = await axiosAppliance.get<Appliances>('/appliances', {
            headers: {
                Authorization: `Bearer ${this.accessToken}`
            }
        });
        return response.data;
    }

    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        this.log.info('Discovering devices...');

        const appliances = await this.getAppliances();

        appliances.map((appliance) => {
            if (!DEVICES[appliance.applianceData.modelName]) {
                this.log.warn(
                    'Accessory not found for model: ',
                    appliance.applianceData.modelName
                );
                return;
            }

            const uuid = this.api.hap.uuid.generate(appliance.applianceId);

            const existingAccessory = this.accessories.find(
                (accessory) => accessory.platformAccessory.UUID === uuid
            );

            if (existingAccessory) {
                this.log.info(
                    'Restoring existing accessory from cache:',
                    existingAccessory.platformAccessory.displayName
                );
                existingAccessory.controller = new DEVICES[appliance.applianceData.modelName](this, existingAccessory.platformAccessory, appliance);
                return;
            }

            this.log.info(
                'Adding new accessory:',
                appliance.applianceData.applianceName
            );

            const platformAccessory = new this.api.platformAccessory(
                appliance.applianceData.applianceName,
                uuid
            );
            const accessory = new ElectroluxAccessory(
                platformAccessory,
                new DEVICES[appliance.applianceData.modelName](this, platformAccessory, appliance)
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
            if(!this.tokenExpirationDate || Date.now() >= this.tokenExpirationDate) {
                await this.refreshAccessToken();
            }

            if(!this.devicesDiscovered) {
                await this.discoverDevices();
                return;
            }

            this.log.debug('Polling appliances status...');

            const appliances = await this.getAppliances();

            appliances.map((appliance) => {
                const uuid = this.api.hap.uuid.generate(appliance.applianceId);

                const existingAccessory = this.accessories.find(
                    (accessory) => accessory.platformAccessory.UUID === uuid
                );
                if(!existingAccessory) {
                    return;
                }

                existingAccessory.controller?.update(appliance);
            });

            this.log.debug('Appliances status polled!');
        } catch(err) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const message = (err as any).response?.data?.message ?? (err as Error).message;

            this.log.warn('Polling error: ', message);
        }
    }

}
