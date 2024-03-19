import { PlatformAccessory, CharacteristicValue, Service } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../../platform';
import { Appliance, FanSpeedSetting } from '../../definitions/appliance';
import { Mode } from '../../definitions/appliance';
import _ from 'lodash';
import { ElectroluxAccessoryController } from '../controller';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Comfort600 extends ElectroluxAccessoryController {
    private service: Service;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory,
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

        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
            this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(
            this.platform.Characteristic.Name,
            this.appliance.applianceData.applianceName
        );

        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getCharacteristicValueGuard(this.getActive.bind(this)))
            .onSet(this.setCharacteristicValueGuard(this.setActive.bind(this)));

        this.service
            .getCharacteristic(
                this.platform.Characteristic.CurrentHeaterCoolerState
            )
            .setProps({
                validValues: [
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .INACTIVE,
                    this.platform.Characteristic.CurrentHeaterCoolerState.IDLE,
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .COOLING,
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .HEATING
                ]
            })
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCurrentHeaterCoolerState.bind(this)
                )
            );

        this.service
            .getCharacteristic(
                this.platform.Characteristic.TargetHeaterCoolerState
            )
            .setProps({
                validValues: [
                    this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
                    this.platform.Characteristic.TargetHeaterCoolerState.COOL,
                    this.platform.Characteristic.TargetHeaterCoolerState.HEAT
                ]
            })
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getTargetHeaterCoolerState.bind(this)
                )
            )
            .onSet(
                this.setCharacteristicValueGuard(
                    this.setTargetHeaterCoolerState.bind(this)
                )
            );

        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCurrentTemperature.bind(this)
                )
            );

        this.service
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

        this.service
            .getCharacteristic(this.platform.Characteristic.Name)
            .onGet(this.getCharacteristicValueGuard(this.getName.bind(this)));

        this.service
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 3,
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

        this.service
            .getCharacteristic(this.platform.Characteristic.SwingMode)
            .onGet(
                this.getCharacteristicValueGuard(this.getSwingMode.bind(this))
            )
            .onSet(
                this.setCharacteristicValueGuard(this.setSwingMode.bind(this))
            );

        this.service
            .getCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature
            )
            .setProps({
                minValue: 16,
                maxValue: 32,
                minStep: 1
            })
            .onGet(
                this.getCharacteristicValueGuard(
                    this.getCoolingThresholdTemperature.bind(this)
                )
            )
            .onSet(
                this.setCharacteristicValueGuard(
                    this.setCoolingThresholdTemperature.bind(this)
                )
            );

        this.service
            .getCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature
            )
            .setProps({
                minValue: 16,
                maxValue: 32,
                minStep: 1
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

    private setTemperature = _.debounce(async (value: CharacteristicValue) => {
        this.sendCommand({
            targetTemperatureC: value
        });
    }, 1000);

    async getActive(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.applianceState === 'running'
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        if (
            (this.appliance.properties.reported.applianceState === 'running' &&
                value === this.platform.Characteristic.Active.ACTIVE) ||
            (this.appliance.properties.reported.applianceState === 'off' &&
                value === this.platform.Characteristic.Active.INACTIVE)
        ) {
            return;
        }

        this.sendCommand({
            executeCommand:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'ON'
                    : 'OFF'
        });

        this.appliance.properties.reported.applianceState =
            value === this.platform.Characteristic.Active.ACTIVE
                ? 'running'
                : 'off';
    }

    async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.mode) {
            case 'cool':
                return this.platform.Characteristic.CurrentHeaterCoolerState
                    .COOLING;
            case 'heat':
                return this.platform.Characteristic.CurrentHeaterCoolerState
                    .HEATING;
            case 'auto':
                return this.appliance.properties.reported.ambientTemperatureC >
                    this.appliance.properties.reported.targetTemperatureC
                    ? this.platform.Characteristic.CurrentHeaterCoolerState
                          .COOLING
                    : this.platform.Characteristic.CurrentHeaterCoolerState
                          .HEATING;
        }
    }

    async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.mode) {
            case 'cool':
                return this.platform.Characteristic.TargetHeaterCoolerState
                    .COOL;
            case 'heat':
                return this.platform.Characteristic.TargetHeaterCoolerState
                    .HEAT;
            case 'auto':
                return this.platform.Characteristic.TargetHeaterCoolerState
                    .AUTO;
        }
    }

    async setTargetHeaterCoolerState(value: CharacteristicValue) {
        let mode: Uppercase<Mode> | null = null;
        let currentState: CharacteristicValue | null = null;

        switch (value) {
            case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                mode = 'AUTO';
                currentState =
                    this.appliance.properties.reported.ambientTemperatureC >
                    this.appliance.properties.reported.targetTemperatureC
                        ? this.platform.Characteristic.CurrentHeaterCoolerState
                              .COOLING
                        : this.platform.Characteristic.CurrentHeaterCoolerState
                              .HEATING;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                mode = 'COOL';
                currentState =
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .COOLING;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                mode = 'HEAT';
                currentState =
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .HEATING;
                break;
        }

        if (!mode) {
            return;
        }

        await this.sendCommand({
            mode
        });

        if (currentState) {
            this.service.updateCharacteristic(
                this.platform.Characteristic.CurrentHeaterCoolerState,
                currentState
            );

            switch (value) {
                case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .CoolingThresholdTemperature,
                        32
                    );
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .HeatingThresholdTemperature,
                        this.appliance.properties.reported.targetTemperatureC
                    );
                    break;
                case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .CoolingThresholdTemperature,
                        this.appliance.properties.reported.targetTemperatureC
                    );
                    break;
                case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .HeatingThresholdTemperature,
                        this.appliance.properties.reported.targetTemperatureC
                    );
                    break;
            }

            this.appliance.properties.reported.mode =
                mode.toLowerCase() as Mode;
        }
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.ambientTemperatureC;
    }

    async getLockPhysicalControls(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.uiLockMode
            ? this.platform.Characteristic.LockPhysicalControls
                  .CONTROL_LOCK_ENABLED
            : this.platform.Characteristic.LockPhysicalControls
                  .CONTROL_LOCK_DISABLED;
    }

    async setLockPhysicalControls(value: CharacteristicValue) {
        await this.sendCommand({
            uiLockMode:
                value ===
                this.platform.Characteristic.LockPhysicalControls
                    .CONTROL_LOCK_ENABLED
        });

        this.appliance.properties.reported.uiLockMode =
            value ===
            this.platform.Characteristic.LockPhysicalControls
                .CONTROL_LOCK_ENABLED;
    }

    async getName(): Promise<CharacteristicValue> {
        return this.accessory.displayName;
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        switch (this.appliance.properties.reported.fanSpeedSetting) {
            case 'auto':
                return 0;
            case 'low':
                return 1;
            case 'middle':
                return 2;
            case 'high':
                return 3;
        }
    }

    async setRotationSpeed(value: CharacteristicValue) {
        const numberValue = value as number;

        let fanSpeedSetting: FanSpeedSetting = 'auto';
        switch (numberValue) {
            case 1:
                fanSpeedSetting = 'low';
                break;
            case 2:
                fanSpeedSetting = 'middle';
                break;
            case 3:
                fanSpeedSetting = 'high';
                break;
        }

        this.appliance.properties.reported.fanSpeedSetting = fanSpeedSetting;

        await this.sendCommand({
            fanSpeedSetting: fanSpeedSetting.toUpperCase()
        });
    }

    async getSwingMode(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.verticalSwing === 'on'
            ? this.platform.Characteristic.SwingMode.SWING_ENABLED
            : this.platform.Characteristic.SwingMode.SWING_DISABLED;
    }

    async setSwingMode(value: CharacteristicValue) {
        await this.sendCommand({
            verticalSwing:
                value === this.platform.Characteristic.SwingMode.SWING_ENABLED
                    ? 'ON'
                    : 'OFF'
        });

        this.appliance.properties.reported.verticalSwing =
            value === this.platform.Characteristic.SwingMode.SWING_ENABLED
                ? 'on'
                : 'off';
    }

    async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
        if (this.appliance.properties.reported.mode === 'auto') {
            return 32;
        }

        return this.appliance.properties.reported.targetTemperatureC;
    }

    async setCoolingThresholdTemperature(value: CharacteristicValue) {
        if (this.appliance.properties.reported.mode === 'auto') {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.INVALID_VALUE_IN_REQUEST
            );
        }

        try {
            await this.setTemperature(value);
            this.appliance.properties.reported.targetTemperatureC =
                value as number;
        } catch (err) {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }
    }

    async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
        return this.appliance.properties.reported.targetTemperatureC;
    }

    async setHeatingThresholdTemperature(value: CharacteristicValue) {
        try {
            await this.setTemperature(value);
            this.appliance.properties.reported.targetTemperatureC =
                value as number;
        } catch (err) {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }
    }

    update(appliance: Appliance) {
        this.appliance = appliance;

        let currentState: CharacteristicValue, targetState: CharacteristicValue;
        switch (this.appliance.properties.reported.mode) {
            case 'cool':
                currentState =
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .COOLING;
                targetState =
                    this.platform.Characteristic.TargetHeaterCoolerState.COOL;
                break;
            case 'heat':
                currentState =
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .HEATING;
                targetState =
                    this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
                break;
            default:
                currentState =
                    this.appliance.properties.reported.ambientTemperatureC >
                    this.appliance.properties.reported.targetTemperatureC
                        ? this.platform.Characteristic.CurrentHeaterCoolerState
                              .COOLING
                        : this.platform.Characteristic.CurrentHeaterCoolerState
                              .HEATING;
                targetState =
                    this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
                break;
        }
        let rotationSpeed: number;
        switch (this.appliance.properties.reported.fanSpeedSetting) {
            case 'auto':
                rotationSpeed = 0;
                break;
            case 'low':
                rotationSpeed = 1;
                break;
            case 'middle':
                rotationSpeed = 2;
                break;
            case 'high':
                rotationSpeed = 3;
                break;
        }
        this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.appliance.properties.reported.applianceState === 'running'
                ? this.platform.Characteristic.Active.ACTIVE
                : this.platform.Characteristic.Active.INACTIVE
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentHeaterCoolerState,
            currentState
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.TargetHeaterCoolerState,
            targetState
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            this.appliance.properties.reported.ambientTemperatureC
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            this.appliance.properties.reported.uiLockMode
                ? this.platform.Characteristic.LockPhysicalControls
                      .CONTROL_LOCK_ENABLED
                : this.platform.Characteristic.LockPhysicalControls
                      .CONTROL_LOCK_DISABLED
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            rotationSpeed
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.SwingMode,
            this.appliance.properties.reported.verticalSwing === 'on'
                ? this.platform.Characteristic.SwingMode.SWING_ENABLED
                : this.platform.Characteristic.SwingMode.SWING_DISABLED
        );

        if (this.appliance.properties.reported.mode === 'auto') {
            this.service.updateCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature,
                32
            );
            this.service.updateCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature,
                this.appliance.properties.reported.targetTemperatureC
            );
        } else {
            this.service.updateCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature,
                this.appliance.properties.reported.targetTemperatureC
            );
            this.service.updateCharacteristic(
                this.platform.Characteristic.HeatingThresholdTemperature,
                this.appliance.properties.reported.targetTemperatureC
            );
        }
    }
}
