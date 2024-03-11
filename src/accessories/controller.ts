import { axiosAppliance } from './../services/axios';
import { Appliance } from '../definitions/appliance';
import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../platform';
import { Capabilities } from '../definitions/capabilities';

export abstract class ElectroluxAccessoryController {
    platform: ElectroluxDevicesPlatform;
    accessory: PlatformAccessory;
    appliance: Appliance;
    capabilities: Capabilities | undefined;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory,
        readonly _appliance: Appliance,
        readonly _capabilities: Capabilities | undefined
    ) {
        this.platform = _platform;
        this.accessory = _accessory;
        this.appliance = _appliance;
        this.capabilities = _capabilities;

        this.accessory.context.capabilities = this.capabilities;
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

    getCharacteristicValueGuard(
        getter: () => Promise<CharacteristicValue>
    ): () => Promise<CharacteristicValue> {
        return async () => {
            if (this.appliance.connectionState === 'Disconnected') {
                throw new this.platform.api.hap.HapStatusError(
                    this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
                );
            }

            return await getter();
        };
    }

    setCharacteristicValueGuard(
        setter: (value: CharacteristicValue) => Promise<void>
    ): (value: CharacteristicValue) => Promise<void> {
        return async (value: CharacteristicValue) => {
            if (this.appliance.connectionState === 'Disconnected') {
                throw new this.platform.api.hap.HapStatusError(
                    this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
                );
            }

            return setter(value);
        };
    }

    abstract update(appliance: Appliance): void;
}
