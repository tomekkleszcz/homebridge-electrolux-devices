import { ApplianceItem } from '../definitions/appliances';
import { CharacteristicValue, PlatformAccessory } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../platform';
import { Appliance } from '../definitions/appliance';
import { ApplianceState } from '../definitions/applianceState';

export abstract class ElectroluxAccessoryController {
    platform: ElectroluxDevicesPlatform;
    accessory: PlatformAccessory;
    item: ApplianceItem;
    state: ApplianceState;
    appliance: Appliance;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory,
        readonly _item: ApplianceItem,
        readonly _state: ApplianceState,
        readonly _appliance: Appliance
    ) {
        this.platform = _platform;
        this.accessory = _accessory;
        this.item = _item;
        this.appliance = _appliance;
        this.state = _state;

        this.accessory.context.appliance = this.appliance;
        this.accessory.context.applianceType = this.item.applianceType;
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

            await this.platform.client.put(
                `/api/v1/appliances/${this.item.applianceId}/command`,
                body
            );
        } catch (error: unknown) {
            this.platform.log.error(
                'An error occurred while sending command: ',
                (error as Error).message,
                'url: ',
                `/api/v1/appliances/${this.item.applianceId}/command`,
                'body: ',
                body
            );
        }
    }

    getCharacteristicValueGuard(
        getter: () => Promise<CharacteristicValue>
    ): () => Promise<CharacteristicValue> {
        return async () => {
            if (this.state.connectionState === 'Disconnected') {
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
            if (this.state.connectionState === 'Disconnected') {
                throw new this.platform.api.hap.HapStatusError(
                    this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
                );
            }

            return setter(value);
        };
    }

    abstract update(state: ApplianceState): void;
}
