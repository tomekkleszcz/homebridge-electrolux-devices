import {PlatformAccessory} from 'homebridge';
import {ElectroluxAccessoryContext, ElectroluxAccessoryController} from './controller';

export class ElectroluxAccessory {
    controller?: ElectroluxAccessoryController;

    constructor(
        readonly platformAccessory: PlatformAccessory<ElectroluxAccessoryContext>,
        controller?: ElectroluxAccessoryController,
    ) {
        this.controller = controller;
    }
}
