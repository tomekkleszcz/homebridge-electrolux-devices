export type Appliance = {
    applianceId: string;
    applianceData: {
        applianceName: string;
        created: Date;
        modelName: string;
    };
    properties: {
        reported: ApplianceProperties;
    };
};

type ApplianceProperties = {
    /* Comfort 600 */
    applianceState: ApplianceState;
    temperatureRepresentation: TemperatureRepresentation;
    sleepMode: Toggle;
    targetTemperatureC: number;
    uiLockMode: boolean;
    mode: Mode;
    fanSpeedSetting: FanSpeedSetting;
    verticalSwing: Toggle;
    filterState: State;
    ambientTemperatureC: number;

    /* Air purifiers */
    Workmode: WorkMode;
    Fanspeed: number;
    Ionizer: boolean;
    UILight: boolean;
    SafetyLock: boolean;
    PM1: number;
    PM2_5: number;
    PM10: number;
    Temp: number;
    Humidity: number;
    TVOC: number;

    /* Well A7 */
    ECO2: number;

    /* Pure A9 */
    CO2: number;
};

/* Comfort 600 */
type ApplianceState = 'running' | 'off';

type TemperatureRepresentation = 'celcius';

type Toggle = 'on' | 'off';

export type Mode = 'auto' | 'cool' | 'heat';

type FanSpeedSetting = 'auto' | 'low' | 'middle' | 'high';

type State = 'good';

/* Well A7 */
type WorkMode = 'Manual' | 'Auto' | 'PowerOff';