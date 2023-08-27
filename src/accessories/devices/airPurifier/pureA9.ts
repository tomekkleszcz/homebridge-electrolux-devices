import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';
import {AirPurifier} from './airPurifier';
import {ElectroluxDevicesPlatform} from '../../../platform';
import {ElectroluxAccessoryController} from '../../controller';
import {Appliance} from '../../../definitions/appliance';

export class PureA9 extends AirPurifier {
    private carbonDioxideSensorService: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _appliance: Appliance,
    ) {
        super(_platform, _accessory, _appliance);

        this.carbonDioxideSensorService =
            this.accessory.getService(this.platform.Service.CarbonDioxideSensor) ||
            this.accessory.addService(this.platform.Service.CarbonDioxideSensor);

        this.carbonDioxideSensorService
            .getCharacteristic(this.platform.Characteristic.CarbonDioxideDetected)
            .onGet(() => this.getCarbonDioxideDetected());

        this.carbonDioxideSensorService
            .getCharacteristic(this.platform.Characteristic.CarbonDioxideLevel)
            .onGet(() => this.getCarbonDioxideLevel());
    }

    async getCarbonDioxideDetected(): Promise<CharacteristicValue> {
        return (await this.getCarbonDioxideLevel()) > this.platform.config.carbonDioxideSensorAlarmValue
            ? this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL
            : this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
    }

    async update(appliance: Appliance) {
        this.appliance = appliance;

        this.carbonDioxideSensorService.updateCharacteristic(
            this.platform.Characteristic.CarbonDioxideDetected,
            await this.getCarbonDioxideDetected(),
        );
        this.carbonDioxideSensorService.updateCharacteristic(
            this.platform.Characteristic.CarbonDioxideLevel,
            await this.getCarbonDioxideLevel(),
        );
    }
}
