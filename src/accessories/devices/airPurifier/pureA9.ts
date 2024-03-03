import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { AirPurifier } from './airPurifier';
import { ElectroluxDevicesPlatform } from '../../../platform';
import { ElectroluxAccessoryController } from '../../controller';
import { Appliance } from '../../../definitions/appliance';

export class PureA9 extends AirPurifier {
    private carbonDioxideSensorService: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _appliance: Appliance
    ) {
        super(_platform, _accessory, _appliance);

        this.carbonDioxideSensorService =
            this.accessory.getService(
                this.platform.Service.CarbonDioxideSensor
            ) ||
            this.accessory.addService(
                this.platform.Service.CarbonDioxideSensor
            );

        this.carbonDioxideSensorService
            .getCharacteristic(
                this.platform.Characteristic.CarbonDioxideDetected
            )
            .onGet(this.getCarbonDioxideDetected.bind(this));

        this.carbonDioxideSensorService
            .getCharacteristic(this.platform.Characteristic.CarbonDioxideLevel)
            .onGet(this.getCarbonDioxideLevel.bind(this));
    }

    async getCarbonDioxideDetected(): Promise<CharacteristicValue> {
        if (this.appliance.connectionState === 'Disconnected') {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }

        return this.appliance.properties.reported.ECO2 >
            this.platform.config.carbonDioxideSensorAlarmValue
            ? this.platform.Characteristic.CarbonDioxideDetected
                  .CO2_LEVELS_ABNORMAL
            : this.platform.Characteristic.CarbonDioxideDetected
                  .CO2_LEVELS_NORMAL;
    }

    async getCarbonDioxideLevel(): Promise<CharacteristicValue> {
        if (this.appliance.connectionState === 'Disconnected') {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }

        return this.appliance.properties.reported.ECO2;
    }

    async update(appliance: Appliance) {
        super.update(appliance);

        this.carbonDioxideSensorService.updateCharacteristic(
            this.platform.Characteristic.CarbonDioxideDetected,
            this.appliance.properties.reported.CO2 >
                this.platform.config.carbonDioxideSensorAlarmValue
                ? this.platform.Characteristic.CarbonDioxideDetected
                      .CO2_LEVELS_ABNORMAL
                : this.platform.Characteristic.CarbonDioxideDetected
                      .CO2_LEVELS_NORMAL
        );
        this.carbonDioxideSensorService.updateCharacteristic(
            this.platform.Characteristic.CarbonDioxideLevel,
            this.appliance.properties.reported.CO2
        );
    }
}
