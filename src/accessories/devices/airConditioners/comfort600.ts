import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../../../platform';
import { Appliance } from '../../../definitions/appliance';
import { ElectroluxAccessoryController } from '../../controller';
import { ApplianceItem } from '../../../definitions/appliances';
import { ApplianceState } from '../../../definitions/applianceState';
import { AirConditioner } from './airConditioner';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Comfort600 extends AirConditioner {
    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _item: ApplianceItem,
        readonly _state: ApplianceState,
        readonly _appliance: Appliance
    ) {
        super(_platform, _accessory, _item, _state, _appliance);

        this.service
            .getCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature
            )
            .setValue(this.state.properties.reported.targetTemperatureC)
            .setProps({
                minValue:
                    this.appliance.capabilities.targetTemperatureC?.min ?? 16,
                maxValue:
                    this.appliance.capabilities.targetTemperatureC?.max ?? 32,
                minStep:
                    this.appliance.capabilities.targetTemperatureC?.step ?? 1
            })
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getHeatingThresholdTemperature.bind(this)
                )
            )
            .onSet(
                this.setCharacteristicValueGuard(
                    this.setHeatingThresholdTemperature.bind(this)
                )
            );
    }

    async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
        return this.state.properties.reported.targetTemperatureC;
    }

    async setHeatingThresholdTemperature(value: CharacteristicValue) {
        try {
            await this.setTemperature(value);
            this.state.properties.reported.targetTemperatureC = value as number;
        } catch {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }
    }

    async update(state: ApplianceState) {
        super.update(state);

        if (this.state.properties.reported.mode === 'auto') {
            this.service.updateCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature,
                this.appliance.capabilities.targetTemperatureC?.max ?? 32
            );
            this.service.updateCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature,
                this.state.properties.reported.targetTemperatureC
            );
        } else {
            this.service.updateCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature,
                this.state.properties.reported.targetTemperatureC
            );
            this.service.updateCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature,
                this.state.properties.reported.targetTemperatureC
            );
        }
    }
}
