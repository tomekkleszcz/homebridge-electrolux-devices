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
import {AC} from './accessories/ac';
import { axiosAppliance } from './services/axios';
import { Appliances } from './definitions/appliances';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ElectroluxDevicesPlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic =
        this.api.hap.Characteristic;

    // this is used to track restored cached accessories
    public readonly accessories: PlatformAccessory[] = [];

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
        this.api.on('didFinishLaunching', () => {
            log.debug('Executed didFinishLaunching callback');
            // run the method to discover / register your devices as accessories
            this.discoverDevices();
        });
    }

    /**
     * This function is invoked when homebridge restores cached accessories from disk at startup.
     * It should be used to setup event handlers for characteristics and update respective values.
     */
    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);

        // add the restored accessory to the accessories cache so we can track if it has already been registered
        this.accessories.push(accessory);
    }

    /**
     * This is an example method showing how to register discovered accessories.
     * Accessories must only be registered once, previously created accessories
     * must not be registered again to prevent "duplicate UUID" errors.
     */
    async discoverDevices() {
        const response = await axiosAppliance.get<Appliances>('/appliances', {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`
            }
        });

        response.data.map((appliance) => {
            if(appliance.applianceData.modelName !== 'Azul') {
                return;
            }

            const uuid = this.api.hap.uuid.generate(appliance.applianceId);

            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

            if(existingAccessory) {
                this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                new AC(this, existingAccessory, appliance);
                return;
            }

            this.log.info('Adding new accessory:', appliance.applianceData.applianceName);

            const accessory = new this.api.platformAccessory(
                appliance.applianceData.applianceName,
                uuid
            );

            accessory.context.appliance = appliance;

            new AC(this, accessory, appliance);

            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        });
    }
}
