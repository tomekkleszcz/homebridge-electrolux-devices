import {Service, PlatformAccessory, CharacteristicValue} from 'homebridge';

import {ElectroluxDevicesPlatform} from '../platform';
import { Appliance } from '../definitions/appliance';
import { axiosAppliance } from '../services/axios';
import { Appliances } from '../definitions/appliances';
import { Mode } from '../definitions/appliance';
import _ from 'lodash';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class AC {

    private applianceId: string;

    private heaterCoolerService: Service;
    // private temperatureSensorService: Service;

    constructor(
        private readonly platform: ElectroluxDevicesPlatform,
        private readonly accessory: PlatformAccessory,
        readonly appliance: Appliance
    ) {
        this.applianceId = appliance.applianceId;

        this.heaterCoolerService = this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Electrolux')
            .setCharacteristic(this.platform.Characteristic.Model, appliance.applianceData.modelName)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, appliance.applianceId);

        this.heaterCoolerService = this.accessory.getService(this.platform.Service.HeaterCooler) ||
            this.accessory.addService(this.platform.Service.HeaterCooler);

        this.heaterCoolerService.setCharacteristic(this.platform.Characteristic.Name, appliance.applianceData.applianceName);

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).props.minValue = 16;
        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).props.maxValue = 32;
        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature).props.minStep = 1;

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).props.minValue = 16;
        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).props.maxValue = 32;
        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature).props.minStep = 1;

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).props.validValues = [
            this.platform.Characteristic.CurrentHeaterCoolerState.COOLING,
            this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
        ];
        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState).props.validValues = [
            this.platform.Characteristic.TargetHeaterCoolerState.COOL,
            this.platform.Characteristic.TargetHeaterCoolerState.HEAT
        ];

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.getCurrentHeaterCoolerState.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onGet(this.getTargetHeaterCoolerState.bind(this))
            .onSet(this.setTargetHeaterCoolerState.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
            .onGet(this.getLockPhysicalControls.bind(this))
            .onSet(this.setLockPhysicalControls.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.Name)
            .onGet(this.getName.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.SwingMode)
            .onGet(this.getSwingMode.bind(this))
            .onSet(this.setSwingMode.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .onGet(this.getCoolingThresholdTemperature.bind(this))
            .onSet(this.setCoolingThresholdTemperature.bind(this));

        this.heaterCoolerService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .onGet(this.getHeatingThresholdTemperature.bind(this))
            .onSet(this.setHeatingThresholdTemperature.bind(this));
    }

    private async getAppliance(): Promise<Appliance> {
        const response = await axiosAppliance.get<Appliances>('/appliances', {
            headers: {
                'Authorization': `Bearer ${this.platform.config.accessToken}`
            }
        });

        const appliance = response.data.find((appliance) => {
            const uuid = this.platform.api.hap.uuid.generate(appliance.applianceId);

            return uuid === this.accessory.UUID;
        });

        if(!appliance) {
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.RESOURCE_DOES_NOT_EXIST);
        }

        return appliance;
    }

    private async sendCommand(body: Record<string, string | number | CharacteristicValue>): Promise<void> {
        try {
            await axiosAppliance.put(`/appliances/${this.applianceId}/command`, body, {
                headers: {
                    'Authorization': `Bearer ${this.platform.config.accessToken}`
                }
            });
        } catch(error) {
            this.platform.log.debug(error as string);

            // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
    }

    private setTemperature = _.debounce(async (value: CharacteristicValue) => {
        this.sendCommand({
            'targetTemperatureC': value
        });
    }, 1000);

    async getActive(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        return appliance.properties.reported.applianceState === 'running' ?
            this.platform.Characteristic.Active.ACTIVE :
            this.platform.Characteristic.Active.INACTIVE;
    }

    async setActive(value: CharacteristicValue) {
        this.sendCommand({
            'executeCommand': value === this.platform.Characteristic.Active.ACTIVE ? 'ON' : 'OFF'
        });
    }

    async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        switch(appliance.properties.reported.mode) {
            case 'auto':
                return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE;
            case 'cool':
                return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
            case 'heat':
                return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
        }
    }

    async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        switch(appliance.properties.reported.mode) {
            case 'auto':
                return this.platform.Characteristic.TargetHeaterCoolerState.AUTO;
            case 'cool':
                return this.platform.Characteristic.TargetHeaterCoolerState.COOL;
            case 'heat':
                return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
        }
    }

    async setTargetHeaterCoolerState(value: CharacteristicValue) {
        let mode: Uppercase<Mode> | null = null;
        let currentState: CharacteristicValue | null = null;

        switch(value) {
            case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
                mode = 'AUTO';
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
                mode = 'COOL';
                currentState = this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
                break;
            case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
                mode = 'HEAT';
                currentState = this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
                break;
        }

        if(!mode) {
            return;
        }

        await this.sendCommand({
            mode
        });

        if(currentState) {
            this.heaterCoolerService.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, currentState);
        }
    }

    async getCurrentTemperature(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        return appliance.properties.reported.ambientTemperatureC;
    }

    async getLockPhysicalControls(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        return appliance.properties.reported.uiLockMode ?
            this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED :
            this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED;
    }

    async setLockPhysicalControls(value: CharacteristicValue) {
        await this.sendCommand({
            'uiLockMode': value === this.platform.Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED
        });
    }

    async getName(): Promise<CharacteristicValue> {
        return this.accessory.displayName;
    }

    async getSwingMode(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        return appliance.properties.reported.verticalSwing === 'on' ?
            this.platform.Characteristic.SwingMode.SWING_ENABLED :
            this.platform.Characteristic.SwingMode.SWING_DISABLED;
    }

    async setSwingMode(value: CharacteristicValue) {
        await this.sendCommand({
            'verticalSwing': value === this.platform.Characteristic.SwingMode.SWING_ENABLED ? 'ON' : 'OFF'
        });
    }

    async getCoolingThresholdTemperature(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        return appliance.properties.reported.targetTemperatureC;
    }

    async setCoolingThresholdTemperature(value: CharacteristicValue) {
        this.setTemperature(value);

        this.heaterCoolerService.setCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, value);
    }

    async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
        const appliance = await this.getAppliance();

        return appliance.properties.reported.targetTemperatureC;
    }

    async setHeatingThresholdTemperature(value: CharacteristicValue) {
        this.setTemperature(value);

        this.heaterCoolerService.setCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, value);
    }

}