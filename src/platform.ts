import fs from 'fs';
import path from 'path';
import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {axiosAppliance, axiosAuth} from './services/axios';
import {Appliances, AppliancesInfo} from './definitions/appliances';
import {DEVICES} from './const/devices';
import {ACCOUNTS_API_KEY} from './const/apiKey';
import Gigya from 'gigya';
import {TokenResponse} from './definitions/auth';
import {ElectroluxAccessoryContext} from './accessories/controller';
import {ElectroluxAccessory} from './accessories/accessory';
import {Appliance} from './definitions/appliance';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ElectroluxDevicesPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    public readonly accessories: ElectroluxAccessory[] = [];

    private readonly authFile: string;
    readonly auth = {
        user: {
            accessToken: '',
            refreshToken: '',
            tokenExpirationDate: 0,
        },
    };

    private pollingInterval: NodeJS.Timeout | null = null;

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.authFile = path.join(api.user.storagePath(), '.electroluxDevices.json');
        if (fs.existsSync(this.authFile)) {
            try {
                this.log.debug('Loading auth from cache...');
                const data = fs.readFileSync(this.authFile, 'utf8');
                const auth = JSON.parse(data);
                this.auth = auth;
            } catch (e) {
                this.log.warn('Could not load auth from cache!');
            }
        }

        // When this event is fired it means Homebridge has restored all cached accessories from disk.
        // Dynamic Platform plugins should only register new accessories after this event was fired,
        // in order to ensure they weren't added to homebridge already. This event can also be used
        // to start discovery of new accessories.
        this.api.on('didFinishLaunching', async () => {
            if (this.shouldRefreshAccessToken()) {
                await this.refreshAccessToken();
            } else if (this.auth.user.accessToken === '') {
                await this.signIn();
            } else {
                this.log.info('Using cached access token...');
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
    configureAccessory(accessory: PlatformAccessory<ElectroluxAccessoryContext>) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(new ElectroluxAccessory(accessory));
    }

    async signIn() {
        this.log.info('Signing in to Electrolux...');

        try {
            const gigya = new Gigya(ACCOUNTS_API_KEY, 'eu1');
            const loginResponse = await gigya.accounts.login({
                loginID: this.config.email,
                password: this.config.password,
                targetEnv: 'mobile',
            });

            const jwtResponse = await gigya.accounts.getJWT({
                targetUID: loginResponse.UID,
                fields: 'country',
                oauth_token: loginResponse.sessionInfo?.sessionToken,
                secret: loginResponse.sessionInfo?.sessionSecret,
            });

            const response = await axiosAuth.post<TokenResponse>(
                '/token',
                {
                    grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
                    clientId: 'ElxOneApp',
                    idToken: jwtResponse.id_token,
                    scope: '',
                },
                {
                    headers: {
                        'Origin-Country-Code': 'PL',
                    },
                },
            );

            this.updateUserToken(response.data);

            this.log.info('Signed in to Electrolux!');
        } catch (e) {
            this.log.warn('Could not sign in to Electrolux!');
        }
    }

    shouldRefreshAccessToken() {
        return this.auth.user.refreshToken !== '' && Date.now() >= this.auth.user.tokenExpirationDate;
    }

    async refreshAccessToken() {
        this.log.info('Refreshing access token...');

        const response = await axiosAuth.post<TokenResponse>('/token', {
            grantType: 'refresh_token',
            clientId: 'ElxOneApp',
            refreshToken: this.auth.user.refreshToken,
            scope: '',
        });

        this.updateUserToken(response.data);

        this.log.info('Access token refreshed!');
    }

    private updateUserToken(token: TokenResponse) {
        this.auth.user = {
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            tokenExpirationDate: Date.now() + token.expiresIn * 1000,
        };

        fs.writeFileSync(this.authFile, JSON.stringify(this.auth, null, 2));
    }

    private async getAppliances() {
        if (this.shouldRefreshAccessToken()) {
            await this.refreshAccessToken();
        }

        const response = await axiosAppliance.get<Appliances>('/appliances', {
            headers: {
                Authorization: `Bearer ${this.auth.user.accessToken}`,
            },
        });
        return response.data;
    }

    private async getAppliancesInfo(applianceIds: string[]) {
        if (this.shouldRefreshAccessToken()) {
            await this.refreshAccessToken();
        }

        const response = await axiosAppliance.post<AppliancesInfo>(
            '/appliances/info',
            {
                applianceIds,
            },
            {
                headers: {
                    Authorization: `Bearer ${this.auth.user.accessToken}`,
                },
            },
        );
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
        const newAppliances = appliances
            .map((appliance) => {
                if (!DEVICES[appliance.applianceData.modelName]) {
                    this.log.warn('Accessory not found for model: ', appliance.applianceData.modelName);
                    return;
                }

                const uuid = this.api.hap.uuid.generate(appliance.applianceId);

                const existingAccessory = this.accessories.find(
                    (accessory) => accessory.platformAccessory.UUID === uuid,
                );

                if (existingAccessory) {
                    this.log.info(
                        'Restoring existing accessory from cache:',
                        existingAccessory.platformAccessory.displayName,
                    );
                    existingAccessory.controller = new DEVICES[appliance.applianceData.modelName](
                        this,
                        existingAccessory.platformAccessory,
                        appliance,
                    );
                    return;
                }

                return {uuid, appliance};
            })
            .filter((entry): entry is {uuid: string; appliance: Appliance} => !!entry);

        if (newAppliances.length > 0) {
            const applianceIds = newAppliances.map(({appliance}) => appliance.applianceId);
            const appliancesInfo = await this.getAppliancesInfo(applianceIds);

            for (const {uuid, appliance} of newAppliances) {
                this.log.info('Adding new accessory:', appliance.applianceData.applianceName);

                const info = appliancesInfo.find((info) => info.pnc === pnc(appliance.applianceId));
                const platformAccessory = new this.api.platformAccessory<ElectroluxAccessoryContext>(
                    appliance.applianceData.applianceName,
                    uuid,
                );
                platformAccessory.context.info = info;
                const accessory = new ElectroluxAccessory(
                    platformAccessory,
                    new DEVICES[appliance.applianceData.modelName](this, platformAccessory, appliance),
                );
                this.accessories.push(accessory);

                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
            }
        }

        this.log.info('Devices discovered!');
    }

    async pollStatus() {
        try {
            this.log.info('Polling appliances status...');

            const appliances = await this.getAppliances();

            appliances.map((appliance) => {
                const uuid = this.api.hap.uuid.generate(appliance.applianceId);

                const existingAccessory = this.accessories.find(
                    (accessory) => accessory.platformAccessory.UUID === uuid,
                );
                if (!existingAccessory) {
                    return;
                }

                existingAccessory.controller?.update(appliance);
            });

            this.log.info('Appliances status polled!');
        } catch (err) {
            this.log.warn('Polling error: ', err);
        }
    }
}

function pnc(applianceId: string): string {
    if (applianceId.length < 9) {
        return applianceId;
    }
    // Example: 950011538111111115087076 -> 950011538
    return applianceId.slice(0, 9);
}
