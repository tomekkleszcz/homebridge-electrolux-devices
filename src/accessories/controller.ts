import { Appliance } from '../definitions/appliance';
import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../platform';
import { axiosAppliance } from '../services/axios';

export abstract class ElectroluxAccessoryController {
    platform: ElectroluxDevicesPlatform;
    accessory: PlatformAccessory;
    appliance: Appliance;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory,
        readonly _appliance: Appliance
    ) {
        this.platform = _platform;
        this.accessory = _accessory;
        this.appliance = _appliance;
    }

    async sendCommand(
        body: Record<string, CharacteristicValue>
    ): Promise<void> {
        try {
            if (
                this.platform.tokenExpirationDate &&
                Date.now() >= this.platform.tokenExpirationDate
            ) {
                await this.platform.refreshAccessToken();
            }

            await axiosAppliance.put(
                `/appliances/${this.appliance.applianceId}/command`,
                body,
                {
                    baseURL: `${this.platform.regionalBaseUrl}/appliance/api/v2`,
                    headers: {
                        Authorization: `Bearer ${this.platform.accessToken}`
                    }
                }
            );
        } catch (error: unknown) {
            this.platform.log.error(
                'An error occurred while sending command: ',
                (error as Error).message
            );
        }
    }

    abstract update(appliance: Appliance): void;
}
