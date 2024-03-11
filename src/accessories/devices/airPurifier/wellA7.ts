import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../../../platform';
import { AirPurifier } from './airPurifier';
import { ElectroluxAccessoryController } from '../../controller';
import { Appliance } from '../../../definitions/appliance';
import { tvocPPBToVocDensity } from '../../../util/voc';
import { Capabilities } from '../../../definitions/capabilities';

export class WellA7 extends AirPurifier {
    private ionizerService: Service;
    private airQualityService: Service;
    private humiditySensorService: Service;
    private temperatureSensorService: Service;
    private carbonDioxideSensorService: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _appliance: Appliance,
        readonly _capabilities: Capabilities
    ) {
        super(_platform, _accessory, _appliance, _capabilities);

        this.ionizerService =
            this.accessory.getService(this.platform.Service.Switch) ||
            this.accessory.addService(this.platform.Service.Switch);

        this.ionizerService.setCharacteristic(
            this.platform.Characteristic.Name,
            'Ionizer'
        );

        this.ionizerService
            .getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getCharacteristicValueGuard(this.getIonizer.bind(this)))
            .onSet(
                this.setCharacteristicValueGuard(this.setIonizer.bind(this))
            );

        this.airQualityService =
            this.accessory.getService(this.platform.Service.AirQualitySensor) ||
            this.accessory.addService(this.platform.Service.AirQualitySensor);

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.AirQuality)
            .onGet(
                this.getCharacteristicValueGuard(this.getAirQuality.bind(this))
            );

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.PM2_5Density)
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getPM2_5Density.bind(this)
                )
            );

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.PM10Density)
            .onGet(
                this.getCharacteristicValueGuard(this.getPM10Density.bind(this))
            );

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.VOCDensity)
            .onGet(
                this.getCharacteristicValueGuard(this.getVOCDensity.bind(this))
            );

        this.humiditySensorService =
            this.accessory.getService(this.platform.Service.HumiditySensor) ||
            this.accessory.addService(this.platform.Service.HumiditySensor);

        this.humiditySensorService
            .getCharacteristic(
                this.platform.Characteristic.CurrentRelativeHumidity
            )
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCurrentRelativeHumidity.bind(this)
                )
            );

        this.temperatureSensorService =
            this.accessory.getService(
                this.platform.Service.TemperatureSensor
            ) ||
            this.accessory.addService(this.platform.Service.TemperatureSensor);

        this.temperatureSensorService
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCurrentTemperature.bind(this)
                )
            );

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
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCarbonDioxideDetected.bind(this)
                )
            );

        this.carbonDioxideSensorService
            .getCharacteristic(this.platform.Characteristic.CarbonDioxideLevel)
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCarbonDioxideLevel.bind(this)
                )
            );
    }

    async getIonizer(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Ionizer;
    }

    async setIonizer(value: CharacteristicValue) {
        await this.sendCommand({
            Ionizer: value
        });

        this.appliance.properties.reported.Ionizer = value as boolean;
    }

    async getAirQuality(): Promise<CharacteristicValue> {
        if (this.appliance.properties.reported.PM2_5 <= 25) {
            return this.platform.Characteristic.AirQuality.EXCELLENT;
        } else if (this.appliance.properties.reported.PM2_5 <= 50) {
            return this.platform.Characteristic.AirQuality.GOOD;
        } else if (this.appliance.properties.reported.PM2_5 <= 75) {
            return this.platform.Characteristic.AirQuality.FAIR;
        } else if (this.appliance.properties.reported.PM2_5 <= 100) {
            return this.platform.Characteristic.AirQuality.INFERIOR;
        } else {
            return this.platform.Characteristic.AirQuality.POOR;
        }
    }

    async getPM2_5Density(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.PM2_5;
    }

    async getPM10Density(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.PM10;
    }

    async getVOCDensity(): Promise<CharacteristicValue> {
        const vocDensity = tvocPPBToVocDensity(
            this.appliance.properties.reported.TVOC,
            this.appliance.properties.reported.Temp,
            this._platform.config.vocMolecularWeight ?? 30.026
        );

        return Math.min(
            vocDensity,
            this.airQualityService.getCharacteristic(
                this.platform.Characteristic.VOCDensity
            ).props.maxValue!
        );
    }

    async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Humidity;
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Temp;
    }

    async getCarbonDioxideDetected(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.ECO2 >
            this.platform.config.carbonDioxideSensorAlarmValue
            ? this.platform.Characteristic.CarbonDioxideDetected
                  .CO2_LEVELS_ABNORMAL
            : this.platform.Characteristic.CarbonDioxideDetected
                  .CO2_LEVELS_NORMAL;
    }

    async getCarbonDioxideLevel(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.ECO2;
    }

    async update(appliance: Appliance) {
        super.update(appliance);

        this.ionizerService.updateCharacteristic(
            this.platform.Characteristic.On,
            this.appliance.properties.reported.Ionizer ? 1 : 0
        );

        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.AirQuality,
            await this.getAirQuality()
        );
        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.PM2_5Density,
            this.appliance.properties.reported.PM2_5
        );
        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.PM10Density,
            this.appliance.properties.reported.PM10
        );
        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.VOCDensity,
            await this.getVOCDensity()
        );

        this.humiditySensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentRelativeHumidity,
            this.appliance.properties.reported.Humidity
        );

        this.temperatureSensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            this.appliance.properties.reported.Temp
        );

        this.carbonDioxideSensorService.updateCharacteristic(
            this.platform.Characteristic.CarbonDioxideDetected,
            this.appliance.properties.reported.ECO2 >
                this.platform.config.carbonDioxideSensorAlarmValue
                ? this.platform.Characteristic.CarbonDioxideDetected
                      .CO2_LEVELS_ABNORMAL
                : this.platform.Characteristic.CarbonDioxideDetected
                      .CO2_LEVELS_NORMAL
        );
        this.carbonDioxideSensorService.updateCharacteristic(
            this.platform.Characteristic.CarbonDioxideLevel,
            this.appliance.properties.reported.ECO2
        );
    }
}
