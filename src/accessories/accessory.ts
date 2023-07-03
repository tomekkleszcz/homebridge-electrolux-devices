import { PlatformAccessory } from 'homebridge';
import { ElectroluxAccessoryController } from './controller';

export class ElectroluxAccessory {

    controller?: ElectroluxAccessoryController;

    constructor(
        readonly platformAccessory: PlatformAccessory,
        controller?: ElectroluxAccessoryController
    ) {
        this.controller = controller;
    }

}