import { PlatformAccessory, CharacteristicValue, Service } from 'homebridge';
import { ElectroluxDevicesPlatform } from '../../platform';
import { Appliance } from '../../definitions/appliance';
import _ from 'lodash';
import { ElectroluxAccessoryController } from '../controller';
import { ApplianceItem } from '../../definitions/appliances';
import {
    ApplianceState,
    FanSpeedSetting,
    Mode
} from '../../definitions/applianceState';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Comfort600 extends ElectroluxAccessoryController {
    private service: Service;
    private fanService: Service | undefined;
    private dehumidifierService: Service | undefined;

    private isAutoModeSupported: boolean;
    private isCoolModeSupported: boolean;
    private isHeatModeSupported: boolean;
    private isFanModeSupported: boolean;
    private isDryModeSupported: boolean;

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _item: ApplianceItem,
        readonly _state: ApplianceState,
        readonly _appliance: Appliance
    ) {
        super(_platform, _accessory, _item, _state, _appliance);

        this.accessory
            .getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(
                this.platform.Characteristic.Manufacturer,
                'Electrolux'
            )
            .setCharacteristic(
                this.platform.Characteristic.Model,
                this.appliance.applianceInfo.model
            )
            .setCharacteristic(
                this.platform.Characteristic.SerialNumber,
                this.item.applianceId
            );

        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
            this.accessory.addService(this.platform.Service.HeaterCooler);

        this.service.setCharacteristic(
            this.platform.Characteristic.Name,
            this.item.applianceName
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

        this.isAutoModeSupported =
            this.appliance.capabilities.mode!.values['AUTO'] !== undefined;
        this.isCoolModeSupported =
            this.appliance.capabilities.mode!.values['COOL'] !== undefined;
        this.isHeatModeSupported =
            this.appliance.capabilities.mode!.values['HEAT'] !== undefined &&
            /* Bug in the Electrolux API, the heat mode is not supported on AZULTM10 */
            this.appliance.applianceInfo.variant !== 'AZULTM10';

        const targetHeaterCoolerStateValidValues = [
            this.isAutoModeSupported &&
                this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
            this.isCoolModeSupported &&
                this.platform.Characteristic.TargetHeaterCoolerState.COOL,
            this.isHeatModeSupported &&
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

        if (this.appliance.capabilities.fanSpeedState) {
            this.service
                .getCharacteristic(this.platform.Characteristic.RotationSpeed)
                .setProps({
                    minValue: 0,
                    maxValue: 100,
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
        } else {
            this.service.removeCharacteristic(
                this.service.getCharacteristic(
                    this.platform.Characteristic.RotationSpeed
                )
            );
        }

        if (this.appliance.capabilities.verticalSwing) {
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
            .setValue(
                this.state.properties.reported.mode === 'auto'
                    ? (this.appliance.capabilities.targetTemperatureC?.max ??
                          32)
                    : this.state.properties.reported.targetTemperatureC
            )
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

        this.isFanModeSupported =
            this.appliance.capabilities.mode!.values['FANONLY'] !== undefined;

        if (this.isFanModeSupported) {
            this.platform.log.debug(
                `[${this._accessory.displayName}] Fan mode is supported`
            );

            this.fanService =
                this.accessory.getService(this.platform.Service.Fanv2) ||
                this.accessory.addService(this.platform.Service.Fanv2);

            this.fanService.setCharacteristic(
                this.platform.Characteristic.Name,
                this.item.applianceName
            );

            this.fanService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getFanActive.bind(this)
                    )
                )
                .onSet(
                    this.setCharacteristicValueGuard(
                        this.setFanActive.bind(this)
                    )
                );

            if (this.appliance.capabilities.fanSpeedState) {
                this.fanService
                    .getCharacteristic(
                        this.platform.Characteristic.RotationSpeed
                    )
                    .setProps({
                        minValue: 0,
                        maxValue: 100,
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
            } else {
                this.fanService.removeCharacteristic(
                    this.fanService.getCharacteristic(
                        this.platform.Characteristic.RotationSpeed
                    )
                );
            }

            this.fanService
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

            this.fanService
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
        }

        this.isDryModeSupported =
            this.appliance.capabilities.mode!.values['DRY'] !== undefined;

        if (this.isDryModeSupported) {
            this.platform.log.debug(
                `[${this._accessory.displayName}] Dry mode is supported`
            );

            this.dehumidifierService =
                this.accessory.getService(
                    this.platform.Service.HumidifierDehumidifier
                ) ||
                this.accessory.addService(
                    this.platform.Service.HumidifierDehumidifier
                );

            this.dehumidifierService.setCharacteristic(
                this.platform.Characteristic.Name,
                this.item.applianceName
            );

            this.dehumidifierService
                .getCharacteristic(this.platform.Characteristic.Active)
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getDehumidifierActive.bind(this)
                    )
                )
                .onSet(
                    this.setCharacteristicValueGuard(
                        this.setDehumidifierActive.bind(this)
                    )
                );

            this.dehumidifierService
                .getCharacteristic(
                    this.platform.Characteristic
                        .CurrentHumidifierDehumidifierState
                )
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getCurrentHumidifierDehumidifierState.bind(this)
                    )
                );

            this.dehumidifierService
                .getCharacteristic(
                    this.platform.Characteristic
                        .TargetHumidifierDehumidifierState
                )
                .setProps({
                    validValues: [
                        this.platform.Characteristic
                            .TargetHumidifierDehumidifierState.DEHUMIDIFIER
                    ]
                })
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getTargetHumidifierDehumidifierState.bind(this)
                    )
                )
                .onSet(
                    this.setCharacteristicValueGuard(
                        this.setTargetHumidifierDehumidifierState.bind(this)
                    )
                );

            this.dehumidifierService
                .getCharacteristic(
                    this.platform.Characteristic.CurrentRelativeHumidity
                )
                .onGet(
                    this.getCharacteristicValueGuard(
                        this.getCurrentRelativeHumidity.bind(this)
                    )
                );
        }
    }

    private setTemperature = _.debounce(async (value: CharacteristicValue) => {
        this.sendCommand({
            targetTemperatureC: value
        });
    }, 1000);

    private setFanSpeed = _.debounce(async (value: CharacteristicValue) => {
        this.sendCommand({
            fanSpeedSetting: value
        });
    }, 1000);

    async getActive(): Promise<CharacteristicValue> {
        const isAirConditionerModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode !== 'fanOnly' &&
            this.state.properties.reported.mode !== 'dry';

        return isAirConditionerModeRunning
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        const isAirConditionerModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode !== 'fanOnly' &&
            this.state.properties.reported.mode !== 'dry';

        if (
            (isAirConditionerModeRunning &&
                value === this.platform.Characteristic.Active.ACTIVE) ||
            (!isAirConditionerModeRunning &&
                value === this.platform.Characteristic.Active.INACTIVE)
        ) {
            return;
        }

        await this.sendCommand({
            executeCommand:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'ON'
                    : 'OFF',
            mode:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? this.accessory.context.lastAirConditionerMode
                    : undefined
        });

        this.state.properties.reported.applianceState =
            value === this.platform.Characteristic.Active.ACTIVE
                ? 'running'
                : 'off';
        this.state.properties.reported.mode =
            this.accessory.context.lastAirConditionerMode;

        let state;
        switch (this.accessory.context.lastAirConditionerMode) {
            case 'cool':
                state =
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .COOLING;
                break;
            case 'heat':
                state =
                    this.platform.Characteristic.CurrentHeaterCoolerState
                        .HEATING;
                break;
            case 'auto':
                if (this.isHeatModeSupported) {
                    state =
                        this.state.properties.reported.ambientTemperatureC >
                        this.state.properties.reported.targetTemperatureC
                            ? this.platform.Characteristic
                                  .CurrentHeaterCoolerState.COOLING
                            : this.platform.Characteristic
                                  .CurrentHeaterCoolerState.IDLE;
                }

                state =
                    this.state.properties.reported.ambientTemperatureC >
                    this.state.properties.reported.targetTemperatureC
                        ? this.platform.Characteristic.CurrentHeaterCoolerState
                              .COOLING
                        : this.platform.Characteristic.CurrentHeaterCoolerState
                              .HEATING;
                break;
            default:
                state =
                    this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
        }

        this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentHeaterCoolerState,
            state
        );
        this.fanService?.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
        this.dehumidifierService?.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
    }

    async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
        switch (this.state.properties.reported.mode) {
            case 'cool':
                return this.platform.Characteristic.CurrentHeaterCoolerState
                    .COOLING;
            case 'heat':
                return this.platform.Characteristic.CurrentHeaterCoolerState
                    .HEATING;
            case 'auto':
                if (this.isHeatModeSupported) {
                    return this.state.properties.reported.ambientTemperatureC >
                        this.state.properties.reported.targetTemperatureC
                        ? this.platform.Characteristic.CurrentHeaterCoolerState
                              .COOLING
                        : this.platform.Characteristic.CurrentHeaterCoolerState
                              .IDLE;
                }

                return this.state.properties.reported.ambientTemperatureC >
                    this.state.properties.reported.targetTemperatureC
                    ? this.platform.Characteristic.CurrentHeaterCoolerState
                          .COOLING
                    : this.platform.Characteristic.CurrentHeaterCoolerState
                          .HEATING;
            default:
                return this.platform.Characteristic.CurrentHeaterCoolerState
                    .IDLE;
        }
    }

    async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
        switch (this.state.properties.reported.mode) {
            case 'cool':
                return this.platform.Characteristic.TargetHeaterCoolerState
                    .COOL;
            case 'heat':
                return this.platform.Characteristic.TargetHeaterCoolerState
                    .HEAT;
            case 'auto':
                return this.platform.Characteristic.TargetHeaterCoolerState
                    .AUTO;
            default:
                return this.platform.Characteristic.CurrentHeaterCoolerState
                    .IDLE;
        }
    }

    async setTargetHeaterCoolerState(value: CharacteristicValue) {
        let mode: Uppercase<Mode> | null = null;
        let currentState: CharacteristicValue | null = null;

        switch (value) {
            case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                mode = 'AUTO';
                currentState =
                    this.state.properties.reported.ambientTemperatureC >
                    this.state.properties.reported.targetTemperatureC
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

        this.accessory.context.lastAirConditionerMode = mode;

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
                        this.appliance.capabilities.targetTemperatureC?.max ??
                            32
                    );
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .HeatingThresholdTemperature,
                        this.state.properties.reported.targetTemperatureC
                    );
                    break;
                case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .CoolingThresholdTemperature,
                        this.state.properties.reported.targetTemperatureC
                    );
                    break;
                case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                    this.service.updateCharacteristic(
                        this.platform.Characteristic
                            .HeatingThresholdTemperature,
                        this.state.properties.reported.targetTemperatureC
                    );
                    break;
            }

            this.state.properties.reported.mode = mode.toLowerCase() as Mode;
        }
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        return this.state.properties.reported.ambientTemperatureC;
    }

    async getLockPhysicalControls(): Promise<CharacteristicValue> {
        return this.state.properties.reported.uiLockMode
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

        this.state.properties.reported.uiLockMode =
            value ===
            this.platform.Characteristic.LockPhysicalControls
                .CONTROL_LOCK_ENABLED;

        this.service.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            value
        );
        this.fanService?.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            value
        );
        this.dehumidifierService?.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            value
        );
    }

    async getName(): Promise<CharacteristicValue> {
        return this.accessory.displayName;
    }

    async getRotationSpeed(): Promise<CharacteristicValue> {
        const isFanModeRunning =
            this.state.properties.reported.mode === 'fanOnly';

        switch (this.state.properties.reported.fanSpeedSetting) {
            case 'low':
                return isFanModeRunning ? 33.33 : 25;
            case 'middle':
                return isFanModeRunning ? 66.66 : 50;
            case 'high':
                return isFanModeRunning ? 100 : 75;
            case 'auto':
                return 100;
        }
    }

    async setRotationSpeed(value: CharacteristicValue) {
        const numberValue = value as number;

        const isFanModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode === 'fanOnly';

        let fanSpeedSetting: FanSpeedSetting = 'auto';
        if (isFanModeRunning) {
            if (numberValue <= 33.33) {
                fanSpeedSetting = 'low';
            } else if (numberValue <= 66.66) {
                fanSpeedSetting = 'middle';
            } else {
                fanSpeedSetting = 'high';
            }
        } else {
            if (numberValue <= 25) {
                fanSpeedSetting = 'low';
            } else if (numberValue <= 50) {
                fanSpeedSetting = 'middle';
            } else if (numberValue <= 75) {
                fanSpeedSetting = 'high';
            } else {
                fanSpeedSetting = 'auto';
            }
        }

        try {
            await this.setFanSpeed(fanSpeedSetting.toUpperCase());
            this.state.properties.reported.fanSpeedSetting = fanSpeedSetting;
        } catch {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }

        this.service.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            numberValue
        );
        this.fanService?.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            numberValue
        );
    }

    async getSwingMode(): Promise<CharacteristicValue> {
        return this.state.properties.reported.verticalSwing === 'on'
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

        this.state.properties.reported.verticalSwing =
            value === this.platform.Characteristic.SwingMode.SWING_ENABLED
                ? 'on'
                : 'off';

        this.service.updateCharacteristic(
            this.platform.Characteristic.SwingMode,
            value
        );
        this.fanService?.updateCharacteristic(
            this.platform.Characteristic.SwingMode,
            value
        );
    }

    async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
        if (this.state.properties.reported.mode === 'auto') {
            return 32;
        }

        return this.state.properties.reported.targetTemperatureC;
    }

    async setCoolingThresholdTemperature(value: CharacteristicValue) {
        if (this.state.properties.reported.mode === 'auto') {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.INVALID_VALUE_IN_REQUEST
            );
        }

        try {
            await this.setTemperature(value);
            this.state.properties.reported.targetTemperatureC = value as number;
        } catch {
            throw new this.platform.api.hap.HapStatusError(
                this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
            );
        }
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

    async getFanActive(): Promise<CharacteristicValue> {
        const isFanModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode === 'fanOnly';

        return isFanModeRunning
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }

    async setFanActive(value: CharacteristicValue) {
        const isFanModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode === 'fanOnly';

        if (
            (isFanModeRunning &&
                value === this.platform.Characteristic.Active.ACTIVE) ||
            (!isFanModeRunning &&
                value === this.platform.Characteristic.Active.INACTIVE)
        ) {
            return;
        }

        this.sendCommand({
            executeCommand:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'ON'
                    : 'OFF',
            mode:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'FANONLY'
                    : undefined
        });

        this.state.properties.reported.applianceState =
            value === this.platform.Characteristic.Active.ACTIVE
                ? 'running'
                : 'off';
        this.state.properties.reported.mode = 'fanOnly';

        this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
        this.dehumidifierService?.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
    }

    async getDehumidifierActive(): Promise<CharacteristicValue> {
        return this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode === 'dry'
            ? this.platform.Characteristic.Active.ACTIVE
            : this.platform.Characteristic.Active.INACTIVE;
    }

    async setDehumidifierActive(value: CharacteristicValue) {
        const isDryModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode === 'dry';

        if (
            (isDryModeRunning &&
                value === this.platform.Characteristic.Active.ACTIVE) ||
            (!isDryModeRunning &&
                value === this.platform.Characteristic.Active.INACTIVE)
        ) {
            return;
        }

        this.sendCommand({
            executeCommand:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'ON'
                    : 'OFF',
            mode:
                value === this.platform.Characteristic.Active.ACTIVE
                    ? 'DRY'
                    : undefined
        });

        this.state.properties.reported.applianceState = value = this.platform
            .Characteristic.Active.ACTIVE
            ? 'running'
            : 'off';
        this.state.properties.reported.mode = 'dry';

        this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
        this.fanService?.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
    }

    async getCurrentHumidifierDehumidifierState(): Promise<CharacteristicValue> {
        const isDryModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode === 'dry';

        return isDryModeRunning
            ? this.platform.Characteristic.CurrentHumidifierDehumidifierState
                  .DEHUMIDIFYING
            : this.platform.Characteristic.CurrentHumidifierDehumidifierState
                  .INACTIVE;
    }

    async getTargetHumidifierDehumidifierState(): Promise<CharacteristicValue> {
        return this.platform.Characteristic.TargetHumidifierDehumidifierState
            .DEHUMIDIFIER;
    }

    async setTargetHumidifierDehumidifierState(value: CharacteristicValue) {
        await this.sendCommand({
            mode:
                value ===
                this.platform.Characteristic.TargetHumidifierDehumidifierState
                    .DEHUMIDIFIER
                    ? 'DRY'
                    : undefined
        });

        this.state.properties.reported.applianceState = value = this.platform
            .Characteristic.Active.ACTIVE
            ? 'running'
            : 'off';
        this.state.properties.reported.mode = 'dry';

        this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
        this.fanService?.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.platform.Characteristic.Active.INACTIVE
        );
    }

    async getCurrentRelativeHumidity(): Promise<CharacteristicValue> {
        return 0; // Not supported by Comfort 600
    }

    update(state: ApplianceState) {
        this.state = state;

        let currentState: CharacteristicValue, targetState: CharacteristicValue;
        switch (this.state.properties.reported.mode) {
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
            case 'auto':
                currentState =
                    this.state.properties.reported.ambientTemperatureC >
                    this.state.properties.reported.targetTemperatureC
                        ? this.platform.Characteristic.CurrentHeaterCoolerState
                              .COOLING
                        : this.platform.Characteristic.CurrentHeaterCoolerState
                              .HEATING;
                targetState =
                    this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
                break;
            default:
                currentState =
                    this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
                targetState =
                    this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
                break;
        }
        let rotationSpeed: number;
        switch (this.state.properties.reported.fanSpeedSetting) {
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

        const isAirConditionerModeRunning =
            this.state.properties.reported.applianceState === 'running' &&
            this.state.properties.reported.mode !== 'fanOnly' &&
            this.state.properties.reported.mode !== 'dry';

        this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            isAirConditionerModeRunning
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
            this.state.properties.reported.ambientTemperatureC
        );
        this.service.updateCharacteristic(
            this.platform.Characteristic.LockPhysicalControls,
            this.state.properties.reported.uiLockMode
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
            this.state.properties.reported.verticalSwing === 'on'
                ? this.platform.Characteristic.SwingMode.SWING_ENABLED
                : this.platform.Characteristic.SwingMode.SWING_DISABLED
        );

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

        if (this.fanService) {
            const isFanModeRunning =
                this.state.properties.reported.applianceState === 'running' &&
                this.state.properties.reported.mode === 'fanOnly';

            this.fanService.updateCharacteristic(
                this.platform.Characteristic.Active,
                isFanModeRunning
                    ? this.platform.Characteristic.Active.ACTIVE
                    : this.platform.Characteristic.Active.INACTIVE
            );

            this.fanService.updateCharacteristic(
                this.platform.Characteristic.RotationSpeed,
                rotationSpeed
            );

            this.fanService.updateCharacteristic(
                this.platform.Characteristic.SwingMode,
                this.state.properties.reported.verticalSwing === 'on'
                    ? this.platform.Characteristic.SwingMode.SWING_ENABLED
                    : this.platform.Characteristic.SwingMode.SWING_DISABLED
            );
        }

        if (this.dehumidifierService) {
            const isDryModeRunning =
                this.state.properties.reported.applianceState === 'running' &&
                this.state.properties.reported.mode === 'dry';

            this.dehumidifierService.updateCharacteristic(
                this.platform.Characteristic.Active,
                isDryModeRunning
                    ? this.platform.Characteristic.Active.ACTIVE
                    : this.platform.Characteristic.Active.INACTIVE
            );

            this.dehumidifierService.updateCharacteristic(
                this.platform.Characteristic.CurrentHumidifierDehumidifierState,
                isDryModeRunning
                    ? this.platform.Characteristic
                          .CurrentHumidifierDehumidifierState.DEHUMIDIFYING
                    : this.platform.Characteristic
                          .CurrentHumidifierDehumidifierState.INACTIVE
            );

            this.dehumidifierService.updateCharacteristic(
                this.platform.Characteristic.TargetHumidifierDehumidifierState,
                this.platform.Characteristic.TargetHumidifierDehumidifierState
                    .DEHUMIDIFIER
            );

            this.dehumidifierService.updateCharacteristic(
                this.platform.Characteristic.CurrentRelativeHumidity,
                0
            );
        }
    }
}
