import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import { ElectroluxDevicesPlatform } from '../../../platform';
import { Appliance, FilterType } from '../../../definitions/appliance';
import { ElectroluxAccessoryController } from '../../controller';
import { tvocPPBToVocDensity } from '../../../util/voc';

export class AirPurifier extends ElectroluxAccessoryController {
    private airPurifierService: Service;
    private ionizerService: Service;
    private airQualityService: Service;
    private humiditySensorService: Service;
    private temperatureSensorService: Service;
    private particleFilterService?: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _appliance: Appliance
    ) {
        super(_platform, _accessory, _appliance);

        this.accessory
            .getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(
                this.platform.Characteristic.Manufacturer,
                'Electrolux'
            )
            .setCharacteristic(
                this.platform.Characteristic.Model,
                this.appliance.applianceData.modelName
            )
            .setCharacteristic(
                this.platform.Characteristic.SerialNumber,
                this.appliance.applianceId
            );

        this.airPurifierService =
            this.accessory.getService(this.platform.Service.AirPurifier) ||
            this.accessory.addService(this.platform.Service.AirPurifier);

        this.airPurifierService.setCharacteristic(
            this.platform.Characteristic.Name,
            this.appliance.applianceData.applianceName
        );

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getCharacteristicValueGuard(this.getActive.bind(this)))
            .onSet(this.setCharacteristicValueGuard(this.setActive.bind(this)));

        this.airPurifierService
            .getCharacteristic(
                this.platform.Characteristic.CurrentAirPurifierState
            )
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCurrentAirPurifierState.bind(this)
                )
            );

        this.airPurifierService
            .getCharacteristic(
                this.platform.Characteristic.TargetAirPurifierState
            )
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getTargetAirPurifierState.bind(this)
                )
            )
            .onSet(
                this.setCharacteristicValueGuard(
                    this.setTargetAirPurifierState.bind(this)
                )
            );

        this.airPurifierService
            .getCharacteristic(
                this.platform.Characteristic.LockPhysicalControls
            )
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getLockPhysicalControls.bind(this)
                )
            )
            .onSet(
                this.setCharacteristicValueGuard(
                    this.setLockPhysicalControls.bind(this)
                )
            );

        this.airPurifierService
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 5,
                minStep: 1
            })
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getRotationSpeed.bind(this)
                )
            )
            .onSet(
                this.setCharacteristicValueGuard(
                    this.setRotationSpeed.bind(this)
                )
            );

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

        if (
            this.appliance.properties.reported.FilterType_1 ===
                FilterType.ParticleFilter ||
            this.appliance.properties.reported.FilterType_2 ===
                FilterType.ParticleFilter
        ) {
            this.particleFilterService =
                this.accessory.getService(
                    this.platform.Service.FilterMaintenance
                ) ||
                this.accessory.addService(
                    this.platform.Service.FilterMaintenance
                );

            this.particleFilterService
                .getCharacteristic(
                    this.platform.Characteristic.FilterChangeIndication
                )
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getParticleFilterChangeIndication.bind(this)
                    )
                );

            this.particleFilterService
                .getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getParticleFilterLifeLevel.bind(this)
                    )
                );

            this.particleFilterService.setCharacteristic(
                this.platform.Characteristic.Name,
                'Particle Filter'
            );

            this.airPurifierService.addLinkedService(
                this.particleFilterService
            );
        }
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
            await this.sendCommand({
                Workmode:
                    value === this.platform.Characteristic.Active.ACTIVE
                        ? 'Auto'
                        : 'PowerOff'
            });

            this.appliance.properties.reported.Workmode =
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'Auto'
                    : 'PowerOff';

            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.TargetAirPurifierState,
                value === this.platform.Characteristic.Active.ACTIVE
                    ? await this.getTargetAirPurifierState()
                    : this.platform.Characteristic.TargetAirPurifierState.AUTO
            );

            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.RotationSpeed,
                value === this.platform.Characteristic.Active.ACTIVE
                    ? this.appliance.properties.reported.Fanspeed
                    : 0
            );
        }

        this.airPurifierService.updateCharacteristic(
            this.platform.Characteristic.CurrentAirPurifierState,
            value === this.platform.Characteristic.Active.ACTIVE
                ? this.platform.Characteristic.CurrentAirPurifierState
                      .PURIFYING_AIR
                : this.platform.Characteristic.CurrentAirPurifierState.INACTIVE
        );
    }

    async getCurrentAirPurifierState(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.Workmode) {
            case 'Manual':
                return this.platform.Characteristic.CurrentAirPurifierState
                    .PURIFYING_AIR;
            case 'Auto':
                return this.platform.Characteristic.CurrentAirPurifierState
                    .PURIFYING_AIR;
            case 'PowerOff':
                return this.platform.Characteristic.CurrentAirPurifierState
                    .INACTIVE;
        }
    }

    async getTargetAirPurifierState(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.Workmode) {
            case 'Manual':
                return this.platform.Characteristic.TargetAirPurifierState
                    .MANUAL;
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
            Workmode: workMode
        });

        this.appliance.properties.reported.Workmode = workMode;
    }

    async getLockPhysicalControls(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.SafetyLock
            ? this.platform.Characteristic.LockPhysicalControls
                  .CONTROL_LOCK_ENABLED
            : this.platform.Characteristic.LockPhysicalControls
                  .CONTROL_LOCK_DISABLED;
    }

    async setLockPhysicalControls(value: CharacteristicValue) {
        await this.sendCommand({
            SafetyLock:
                value ===
                this.platform.Characteristic.LockPhysicalControls
                    .CONTROL_LOCK_ENABLED
        });

        this.appliance.properties.reported.SafetyLock =
            value ===
            this.platform.Characteristic.LockPhysicalControls
                .CONTROL_LOCK_ENABLED;
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Fanspeed;
    }

    async setRotationSpeed(value: CharacteristicValue) {
        if (value === 0) {
            await this.sendCommand({
                Workmode: 'PowerOff'
            });

            this.appliance.properties.reported.Workmode = 'PowerOff';
            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.CurrentAirPurifierState,
                this.platform.Characteristic.CurrentAirPurifierState.INACTIVE
            );
            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.TargetAirPurifierState,
                this.platform.Characteristic.TargetAirPurifierState.AUTO
            );
            return;
        } else if (this.appliance.properties.reported.Workmode === 'Auto') {
            await this.sendCommand({
                Workmode: 'Manual'
            });
            this.appliance.properties.reported.Workmode = 'Manual';

            this.airPurifierService.updateCharacteristic(
                this.platform.Characteristic.TargetAirPurifierState,
                this.platform.Characteristic.TargetAirPurifierState.MANUAL
            );
        }

        await this.sendCommand({
            Fanspeed: value
        });

        this.appliance.properties.reported.Fanspeed = value as number;
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

        return vocDensity;
    }

    async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Humidity;
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.Temp;
    }

    async getParticleFilterChangeIndication(): Promise<CharacteristicValue> {
        const filterLife =
            this.appliance.properties.reported.FilterType_1 ===
            FilterType.ParticleFilter
                ? this.appliance.properties.reported.FilterLife_1
                : this.appliance.properties.reported.FilterLife_2;

        return filterLife <= 10
            ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER
            : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }

    async getParticleFilterLifeLevel(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.FilterType_1 ===
            FilterType.ParticleFilter
            ? this.appliance.properties.reported.FilterLife_1
            : this.appliance.properties.reported.FilterLife_2;
    }

    async update(appliance: Appliance) {
        this.appliance = appliance;

        switch (this.appliance.properties.reported.Workmode) {
            case 'Manual':
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.Active,
                    this.platform.Characteristic.Active.ACTIVE
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.CurrentAirPurifierState,
                    this.platform.Characteristic.CurrentAirPurifierState
                        .PURIFYING_AIR
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.TargetAirPurifierState,
                    this.platform.Characteristic.TargetAirPurifierState.MANUAL
                );
                break;
            case 'Auto':
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.Active,
                    this.platform.Characteristic.Active.ACTIVE
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.CurrentAirPurifierState,
                    this.platform.Characteristic.CurrentAirPurifierState
                        .PURIFYING_AIR
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.TargetAirPurifierState,
                    this.platform.Characteristic.TargetAirPurifierState.AUTO
                );
                break;
            case 'PowerOff':
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.Active,
                    this.platform.Characteristic.Active.INACTIVE
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.CurrentAirPurifierState,
                    this.platform.Characteristic.CurrentAirPurifierState
                        .INACTIVE
                );
                this.airPurifierService.updateCharacteristic(
                    this.platform.Characteristic.TargetAirPurifierState,
                    this.platform.Characteristic.TargetAirPurifierState.AUTO
                );
                break;
        }

        this.airPurifierService.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            this.appliance.properties.reported.SafetyLock
                ? this.platform.Characteristic.LockPhysicalControls
                      .CONTROL_LOCK_ENABLED
                : this.platform.Characteristic.LockPhysicalControls
                      .CONTROL_LOCK_DISABLED
        );
        this.airPurifierService.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            this.appliance.properties.reported.Fanspeed
        );

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
            this.appliance.properties.reported.TVOC
        );

        this.humiditySensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentRelativeHumidity,
            this.appliance.properties.reported.Humidity
        );

        this.temperatureSensorService.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            this.appliance.properties.reported.Temp
        );

        const filterLife =
            this.appliance.properties.reported.FilterType_1 ===
            FilterType.ParticleFilter
                ? this.appliance.properties.reported.FilterLife_1
                : this.appliance.properties.reported.FilterLife_2;

        this.particleFilterService?.updateCharacteristic(
            this.platform.Characteristic.FilterChangeIndication,
            filterLife <= 10
                ? this.platform.Characteristic.FilterChangeIndication
                      .CHANGE_FILTER
                : this.platform.Characteristic.FilterChangeIndication.FILTER_OK
        );

        this.particleFilterService?.updateCharacteristic(
            this.platform.Characteristic.FilterLifeLevel,
            filterLife
        );
    }
}
