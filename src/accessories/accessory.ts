import { PlatformAccessory } from 'homebridge';
import { ElectroluxAccessoryController } from './controller';
import { Context } from '../definitions/context';

export class ElectroluxAccessory {
    controller?: ElectroluxAccessoryController;

    constructor(
        readonly platformAccessory: PlatformAccessory<Context>,
        controller?: ElectroluxAccessoryController
    ) {
        this.controller = controller;
    }
}
