import { Mode } from './applianceState';

export type DeviceType = 'PORTABLE_AIR_CONDITIONER' | 'AIR_PURIFIER';

export type Appliance = {
    applianceInfo: ApplianceInfo;
    capabilities: Capabilities;
};

export type ApplianceInfo = {
    serialNumber: string;
    pnc: string;
    brand: string;
    deviceType: DeviceType;
    model: string;
    variant: string;
    colour: string;
};

export type Capabilities = {
    /* Comfort 600 */
    mode?: {
        values: Record<Uppercase<Mode>, Record<string, unknown>>;
    };
    targetTemperatureC?: {
        max: number;
        min: number;
        step: number;
    };
    fanSpeedState?: {
        values: Record<string, unknown>;
    };
    verticalSwing?: {
        values: Record<Uppercase<Mode>, unknown>;
    };

    /* Air purifiers */
    Workmode?: {
        values: Record<Uppercase<WorkMode>, unknown>;
    };
};

type WorkMode = 'Manual' | 'Auto' | 'PowerOff';
