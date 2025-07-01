export type ApplianceState = {
    applianceId: string;
    connectionState: ConnectionState;
    status: Status;
    properties: Properties;
};

type ConnectionState = 'Connected' | 'Disconnected';

type Status = 'enabled' | 'disabled';

type Properties = {
    reported: {
        /* Comfort 600 */
        applianceState: ApplianceStateValue;
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
        FilterLife_1: number;
        FilterType_1: FilterType;
        FilterLife_2: number;
        FilterType_2: FilterType;

        /* Well A7, Pure A9 */
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

        /* Extreme Home 500 */
        UVState: Toggle;
        PM2_5_approximate: number;
    };
};

/* Comfort 600 */
type ApplianceStateValue = 'running' | 'off';

type Toggle = 'on' | 'off';

type TemperatureRepresentation = 'celcius';

export type Mode = 'auto' | 'cool' | 'heat';

export type FanSpeedSetting = 'auto' | 'low' | 'middle' | 'high';

type State = 'good';

/* Air purifiers */
export type WorkMode = 'Manual' | 'Auto' | 'Smart' | 'PowerOff';

export enum FilterType {
    ParticleFilter1 = 48,
    ParticleFilter2 = 49,
    OdorFilter = 192
}
