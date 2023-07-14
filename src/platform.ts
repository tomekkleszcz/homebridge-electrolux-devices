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

    accessToken = '';
    private refreshToken = '';
    tokenExpirationDate = 0;

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
            if (!this.config.refreshToken) {
                await this.signIn();
            } else {
                this.refreshToken = this.config.refreshToken;
                await this.refreshAccessToken();
            }

            // run the method to discover / register your devices as accessories
            await this.discoverDevices();

            this.pollingInterval = setInterval(this.pollStatus.bind(this), (this.config.pollingInterval || 10) * 1000);
        });

        this.api.on('shutdown', () => {
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
        this.log.info('Signing in to Electrolux...');

        const region: Region = this.config.region || 'eu';

        try {
            const gigya = new Gigya(ACCOUNTS_API_KEY, `${region}1`);
            const loginResponse = await gigya.accounts.login({
                loginID: this.config.email,
                password: this.config.password,
                targetEnv: 'mobile'
            });

            const jwtResponse = await gigya.accounts.getJWT({
                targetUID: loginResponse.UID,
                fields: 'country',
                oauth_token: loginResponse.sessionInfo?.sessionToken,
                secret: loginResponse.sessionInfo?.sessionSecret
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
        } catch (e) {
            this.log.warn('Couldn\'t not sign in to Electrolux!');
        }
    }

    async refreshAccessToken() {
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
    }

    async pollStatus() {
        try {
            this.log.info('Polling appliances status...');

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

            this.log.info('Appliances status polled!');
        } catch(err) {
            this.log.warn('Polling error: ', err);
        }
    }

}
