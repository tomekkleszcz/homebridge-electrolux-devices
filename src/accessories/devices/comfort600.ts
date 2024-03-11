import { PlatformAccessory, CharacteristicValue, Service } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../../platform';
import { Appliance } from '../../definitions/appliance';
import { Mode } from '../../definitions/appliance';
import _ from 'lodash';
import { ElectroluxAccessoryController } from '../controller';
import { Capabilities } from '../../definitions/capabilities';

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
        readonly _appliance: Appliance,
        readonly _capabilities: Capabilities | undefined
    ) {
        super(_platform, _accessory, _appliance, _capabilities);

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

        const targetHeaterCoolerStateValidValues = [
            this.capabilities!.mode!.values['AUTO'] !== undefined &&
                this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
            this.capabilities!.mode!.values['COOL'] !== undefined &&
                this.platform.Characteristic.TargetHeaterCoolerState.COOL,
            this.capabilities!.mode!.values['HEAT'] !== undefined &&
                this.platform.Characteristic.TargetHeaterCoolerState.HEAT
        ].filter((value) => value !== false) as number[];

        this.service
            .getCharacteristic(
                this.platform.Characteristic.TargetHeaterCoolerState
            )
            .setProps({
                validValues: targetHeaterCoolerStateValidValues
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

        if (this.capabilities?.fanSpeedState) {
            const minRotationSpeedStep =
                100 /
                Object.entries(this.capabilities!.fanSpeedState?.values).length;

            this.service
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
                    minStep: minRotationSpeedStep
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
        } else {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(
                    this.platform.Characteristic.RotationSpeed
                )
            );
        }

        if (this.capabilities?.verticalSwing) {
            this.service
                .getCharacteristic(this.platform.Characteristic.SwingMode)
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getSwingMode.bind(this)
                    )
                )
                .onSet(
                    this.setCharacteristicValueGuard(
                        this.setSwingMode.bind(this)
                    )
                );
        } else {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(
                    this.platform.Characteristic.SwingMode
                )
            );
        }

        this.service
            .getCharacteristic(
                this.platform.Characteristic.CoolingThresholdTemperature
            )
            .setProps({
                minValue: this.capabilities?.targetTemperatureC?.min ?? 16,
                maxValue: this.capabilities?.targetTemperatureC?.max ?? 32,
                minStep: this.capabilities?.targetTemperatureC?.step ?? 1
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
                minValue: this.capabilities?.targetTemperatureC?.min ?? 16,
                maxValue: this.capabilities?.targetTemperatureC?.max ?? 32,
                minStep: this.capabilities?.targetTemperatureC?.step ?? 1
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
                if (this.capabilities?.mode?.values['HEAT'] === undefined) {
                    return this.appliance.properties.reported
                        .ambientTemperatureC >
                        this.appliance.properties.reported.targetTemperatureC
                        ? this.platform.Characteristic.CurrentHeaterCoolerState
                              .COOLING
                        : this.platform.Characteristic.CurrentHeaterCoolerState
                              .IDLE;
                }

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
                        this.capabilities?.targetTemperatureC?.max ?? 32
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
                return 33.33;
            case 'middle':
                return 66.66;
            case 'high':
                return 100;
        }
    }

    async setRotationSpeed(value: CharacteristicValue) {
        await this.sendCommand({
            fanSpeed: value
        });

        const numberValue = value as number;

        this.appliance.properties.reported.fanSpeedSetting =
            numberValue === 0
                ? 'auto'
                : numberValue <= 33.34
                  ? 'low'
                  : numberValue <= 66.67
                    ? 'middle'
                    : 'high';
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
                rotationSpeed = 33.33;
                break;
            case 'middle':
                rotationSpeed = 66.66;
                break;
            case 'high':
                rotationSpeed = 100;
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
                this.capabilities?.targetTemperatureC?.max ?? 32
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
