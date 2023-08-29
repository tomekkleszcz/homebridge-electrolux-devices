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
    $metadata: ApplianceMetadata;

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

    // Pure A9, Well A7.
    PM1: number;
    PM2_5: number;
    PM10: number;
    Temp: number;
    Humidity: number;
    TVOC: number;

    // Check last update time from metadata to figure out which.
    ECO2?: number;
    CO2?: number;
};

interface MetadataLastUpdated {
    $lastUpdated: Date;
}

type ApplianceMetadata = MetadataLastUpdated & {
    [key in keyof ApplianceProperties]: MetadataLastUpdated;
};

/* Comfort 600 */
type ApplianceState = 'running' | 'off';

type TemperatureRepresentation = 'celcius';

type Toggle = 'on' | 'off';

export type Mode = 'auto' | 'cool' | 'heat';

type FanSpeedSetting = 'auto' | 'low' | 'middle' | 'high';

type State = 'good';

// Air purifiers.
type WorkMode = 'Manual' | 'Auto' | 'PowerOff';
