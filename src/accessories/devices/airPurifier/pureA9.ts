import { PlatformAccessory } from 'homebridge';
import { AirPurifier } from './airPurifier';
import { ElectroluxDevicesPlatform } from '../../../platform';
import { ElectroluxAccessoryController } from '../../controller';
import { Appliance } from '../../../definitions/appliance';

export class PureA9 extends AirPurifier {

    constructor(
        readonly _platform: ElectroluxDevicesPlatform,
        readonly _accessory: PlatformAccessory<ElectroluxAccessoryController>,
        readonly _appliance: Appliance
    ) {
        super(_platform, _accessory, _appliance);
    }

}