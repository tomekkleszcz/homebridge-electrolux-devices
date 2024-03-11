import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../../../platform';
import { AirPurifier } from './airPurifier';
import { ElectroluxAccessoryController } from '../../controller';
import { Appliance } from '../../../definitions/appliance';
import { Capabilities } from '../../../definitions/capabilities';

export class UltimateHome500 extends AirPurifier {
    private uvLightService: Service;
    private airQualityService: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _appliance: Appliance,
        readonly _capabilities: Capabilities
    ) {
        super(_platform, _accessory, _appliance, _capabilities);

        this.uvLightService =
            this.accessory.getService(this.platform.Service.Lightbulb) ||
            this.accessory.addService(this.platform.Service.Lightbulb);

        this.uvLightService.setCharacteristic(
            this.platform.Characteristic.Name,
            'UV Light'
        );

        this.uvLightService
            .getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getCharacteristicValueGuard(this.getUVLight.bind(this)))
            .onSet(
                this.setCharacteristicValueGuard(this.setUVLight.bind(this))
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
    }

    async getUVLight(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.UVState === 'on';
    }

    async setUVLight(value: CharacteristicValue) {
        await this.sendCommand({
            UVState: value ? 'On' : 'Off'
        });

        this.appliance.properties.reported.UVState = value ? 'on' : 'off';
    }

    async getAirQuality(): Promise<CharacteristicValue> {
        if (this.appliance.properties.reported.PM2_5_approximate <= 25) {
            return this.platform.Characteristic.AirQuality.EXCELLENT;
        } else if (this.appliance.properties.reported.PM2_5_approximate <= 50) {
            return this.platform.Characteristic.AirQuality.GOOD;
        } else if (this.appliance.properties.reported.PM2_5_approximate <= 75) {
            return this.platform.Characteristic.AirQuality.FAIR;
        } else if (
            this.appliance.properties.reported.PM2_5_approximate <= 100
        ) {
            return this.platform.Characteristic.AirQuality.INFERIOR;
        } else {
            return this.platform.Characteristic.AirQuality.POOR;
        }
    }

    async getPM2_5Density(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.PM2_5_approximate;
    }

    async update(appliance: Appliance) {
        super.update(appliance);
    }
}
