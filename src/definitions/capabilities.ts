import { Mode } from './appliance';

export type Capabilities = {
    /* Comfort 600 */
    mode: {
        values: Record<Uppercase<Mode>, Record<string, unknown>>;
    };
    targetTemperatureC: {
        max: number;
        min: number;
        step: number;
    };
};
