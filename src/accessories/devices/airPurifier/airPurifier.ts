import {CharacteristicValue, PlatformAccessory, Service} from 'homebridge';

import {ElectroluxDevicesPlatform} from '../../../platform';
import {Appliance} from '../../../definitions/appliance';
import {ElectroluxAccessoryContext, ElectroluxAccessoryController} from '../../controller';

export class AirPurifier extends ElectroluxAccessoryController {
    private airPurifierService: Service;
    private airQualityService: Service;
    private humiditySensorService: Service;
    private temperatureSensorService: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryContext>,
        readonly _appliance: Appliance,
    ) {
        super(_platform, _accessory, _appliance);

        this.accessory
            .getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, this.manufacturer())
            .setCharacteristic(this.platform.Characteristic.Model, this.appliance.applianceData.modelName)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.serial())
            .setCharacteristic(
                this.platform.Characteristic.FirmwareRevision,
                this.appliance.properties.reported.FrmVer_NIU,
            );

        this.airPurifierService =
            this.accessory.getService(this.platform.Service.AirPurifier) ||
            this.accessory.addService(this.platform.Service.AirPurifier);

        this.airPurifierService.setCharacteristic(
            this.platform.Characteristic.Name,
            this.appliance.applianceData.applianceName,
        );

        this.airPurifierService.getCharacteristic(this.platform.Characteristic.RotationSpeed).props.minStep = 20;

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.CurrentAirPurifierState)
            .onGet(this.getCurrentAirPurifierState.bind(this));

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.TargetAirPurifierState)
            .onGet(this.getTargetAirPurifierState.bind(this))
            .onSet(this.setTargetAirPurifierState.bind(this));

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
            .onGet(this.getLockPhysicalControls.bind(this))
            .onSet(this.setLockPhysicalControls.bind(this));

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .onGet(this.getRotationSpeed.bind(this))
            .onSet(this.setRotationSpeed.bind(this));

        this.airQualityService =
            this.accessory.getService(this.platform.Service.AirQualitySensor) ||
            this.accessory.addService(this.platform.Service.AirQualitySensor);

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.AirQuality)
            .onGet(this.getAirQuality.bind(this));

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.PM2_5Density)
            .onGet(this.getPM2_5Density.bind(this));

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.PM10Density)
            .onGet(this.getPM10Density.bind(this));

        this.airQualityService
            .getCharacteristic(this.platform.Characteristic.VOCDensity)
            .onGet(this.getVOCDensity.bind(this));

        this.humiditySensorService =
            this.accessory.getService(this.platform.Service.HumiditySensor) ||
            this.accessory.addService(this.platform.Service.HumiditySensor);

        this.humiditySensorService
            .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
            .onGet(this.getCurrentRelativeHumidity.bind(this));

        this.temperatureSensorService =
            this.accessory.getService(this.platform.Service.TemperatureSensor) ||
            this.accessory.addService(this.platform.Service.TemperatureSensor);

        this.temperatureSensorService
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
    }

    async getActive(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Workmode === 'PowerOff'
            ? this.platform.Characteristic.Active.INACTIVE
            : this.platform.Characteristic.Active.ACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        if (
            (this.appliance.properties.reported.Workmode === 'PowerOff' &&
                value === this.platform.Characteristic.Active.ACTIVE) ||
            (this.appliance.properties.reported.Workmode !== 'PowerOff' &&
                value === this.platform.Characteristic.Active.INACTIVE)
        ) {
            this.sendCommand({
                Workmode: value === this.platform.Characteristic.Active.ACTIVE ? 'Auto' : 'PowerOff',
            });

            this.appliance.properties.reported.Workmode =
                value === this.platform.Characteristic.Active.ACTIVE ? 'Auto' : 'PowerOff';

            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.TargetAirPurifierState,
                value === this.platform.Characteristic.Active.ACTIVE
                    ? await this.getTargetAirPurifierState()
                    : this.platform.Characteristic.TargetAirPurifierState.AUTO,
            );

            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.RotationSpeed,
                value === this.platform.Characteristic.Active.ACTIVE ? this.appliance.properties.reported.Fanspeed : 0,
            );
        }

        this.airPurifierService.updateCharacteristic(
            this.platform.Characteristic.CurrentAirPurifierState,
            value === this.platform.Characteristic.Active.ACTIVE
                ? this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
                : this.platform.Characteristic.CurrentAirPurifierState.INACTIVE,
        );
    }

    async getCurrentAirPurifierState(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.Workmode) {
            case 'Manual':
                return this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
            case 'Auto':
                return this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR;
            case 'PowerOff':
                return this.platform.Characteristic.CurrentAirPurifierState.INACTIVE;
        }
    }

    async getTargetAirPurifierState(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.Workmode) {
            case 'Manual':
                return this.platform.Characteristic.TargetAirPurifierState.MANUAL;
            case 'Auto':
                return this.platform.Characteristic.TargetAirPurifierState.AUTO;
            case 'PowerOff':
                return this.platform.Characteristic.TargetAirPurifierState.AUTO;
        }
    }

    async setTargetAirPurifierState(value: CharacteristicValue) {
        let workMode;
        switch (value) {
            case this.platform.Characteristic.TargetAirPurifierState.MANUAL:
                workMode = 'Manual';
                break;
            case this.platform.Characteristic.TargetAirPurifierState.AUTO:
                workMode = 'Auto';
                break;
        }

        await this.sendCommand({
            Workmode: workMode,
        });

        this.appliance.properties.reported.Workmode = workMode;
    }

    async getLockPhysicalControls(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.SafetyLock
            ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
            : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    async setLockPhysicalControls(value: CharacteristicValue) {
        await this.sendCommand({
            SafetyLock: value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED,
        });

        this.appliance.properties.reported.SafetyLock =
            value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED;
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Fanspeed * 20;
    }

    async setRotationSpeed(value: CharacteristicValue) {
        if (this.appliance.properties.reported.Workmode === 'Auto') {
            setTimeout(() => {
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.RotationSpeed,
                    this.appliance.properties.reported.Fanspeed * 20,
                );
            }, 100);
            return;
        }

        if (value === 0) {
            await this.sendCommand({
                Workmode: 'PowerOff',
            });

            this.appliance.properties.reported.Workmode = 'PowerOff';
            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.CurrentAirPurifierState,
                this.platform.Characteristic.CurrentAirPurifierState.INACTIVE,
            );
            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.TargetAirPurifierState,
                this.platform.Characteristic.TargetAirPurifierState.AUTO,
            );
            return;
        }

        await this.sendCommand({
            Fanspeed: Math.round((value as number) / 20),
        });

        this.appliance.properties.reported.Fanspeed = Math.round((value as number) / 20);
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
        return this.appliance.properties.reported.TVOC;
    }

    async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Humidity;
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Temp;
    }

    async update(appliance: Appliance) {
        this.appliance = appliance;

        switch (this.appliance.properties.reported.Workmode) {
            case 'Manual':
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.Active,
                    this.platform.Characteristic.Active.ACTIVE,
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.CurrentAirPurifierState,
                    this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR,
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.TargetAirPurifierState,
                    this.platform.Characteristic.TargetAirPurifierState.MANUAL,
                );
                break;
            case 'Auto':
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.Active,
                    this.platform.Characteristic.Active.ACTIVE,
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.CurrentAirPurifierState,
                    this.platform.Characteristic.CurrentAirPurifierState.PURIFYING_AIR,
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.TargetAirPurifierState,
                    this.platform.Characteristic.TargetAirPurifierState.AUTO,
                );
                break;
            case 'PowerOff':
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.Active,
                    this.platform.Characteristic.Active.INACTIVE,
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.CurrentAirPurifierState,
                    this.platform.Characteristic.CurrentAirPurifierState.INACTIVE,
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.TargetAirPurifierState,
                    this.platform.Characteristic.TargetAirPurifierState.AUTO,
                );
                break;
        }

        this.airPurifierService.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            this.appliance.properties.reported.SafetyLock
                ? this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
                : this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED,
        );
        this.airPurifierService.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            this.appliance.properties.reported.Fanspeed * 20,
        );

        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.AirQuality,
            await this.getAirQuality(),
        );
        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.PM2_5Density,
            this.appliance.properties.reported.PM2_5,
        );
        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.PM10Density,
            this.appliance.properties.reported.PM10,
        );
        this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.VOCDensity,
            this.appliance.properties.reported.TVOC,
        );

        this.humiditySensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentRelativeHumidity,
            this.appliance.properties.reported.Humidity,
        );

        this.temperatureSensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            this.appliance.properties.reported.Temp,
        );
    }
}
