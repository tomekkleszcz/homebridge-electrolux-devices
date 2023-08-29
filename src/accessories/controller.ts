import {Appliance, ApplianceInfo} from '../definitions/appliance';
import {CharacteristicValue, PlatformAccessory} from 'homebridge';
import {ElectroluxDevicesPlatform} from '../platform';
import {axiosAppliance} from '../services/axios';

export type ElectroluxAccessoryContext = {
    info?: ApplianceInfo;
};

export abstract class ElectroluxAccessoryController {
    platform: ElectroluxDevicesPlatform;
    accessory: PlatformAccessory;
    appliance: Appliance;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryContext>,
        readonly _appliance: Appliance,
    ) {
        this.platform = _platform;
        this.accessory = _accessory;
        this.appliance = _appliance;
    }

    async sendCommand(body: Record<string, CharacteristicValue>): Promise<void> {
        try {
            if (Date.now() >= this.platform.tokenExpirationDate) {
                await this.platform.refreshAccessToken();
            }

            await axiosAppliance.put(`/appliances/${this.appliance.applianceId}/command`, body, {
                headers: {
                    Authorization: `Bearer ${this.platform.accessToken}`,
                },
            });
        } catch (error: unknown) {
            this.platform.log.error('An error occurred while sending command: ', (error as Error).message);
        }
    }

    abstract update(appliance: Appliance): void;

    manufacturer(): string {
        const info = this._accessory.context.info;
        if (info?.brand) {
            return info.brand;
        }
        return 'Electrolux';
    }

    // serial returns the serial number that is part of the given applianceId.
    serial(): string {
        if (this.appliance.applianceId.length < 17) {
            return this.appliance.applianceId;
        }
        // Example: 950011538111111115087076 -> 11111111
        return this.appliance.applianceId.slice(9, 17);
    }
}
