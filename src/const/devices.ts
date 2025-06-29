import { Comfort600 } from '../accessories/devices/airConditioners/comfort600';
import { WellA7 } from '../accessories/devices/airPurifier/wellA7';
import { PureA9 } from '../accessories/devices/airPurifier/pureA9';
import { UltimateHome500 } from '../accessories/devices/airPurifier/ultimateHome500';
import { AirConditioner } from '../accessories/devices/airConditioners/airConditioner';
import { AirPurifier } from '../accessories/devices/airPurifier/airPurifier';

export const DEVICES = {
    /* Air conditioners */
    Azul: Comfort600,
    AC: AirConditioner,

    /* Air purifiers */
    WELLA7: WellA7,
    WELLA5: AirPurifier,
    PUREA9: PureA9,
    Muju: UltimateHome500
};
