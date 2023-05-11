import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import type DevicePage from './device-page'
import type DeviceRevoke from './device-revoke'
import type DevicesRoot from '.'
import type DeviceAdd from './add-device'
import type DevicePaperKey from './paper-key'

export const newRoutes = {
  devicePage: {
    getOptions: () => require('./device-page').options,
    getScreen: (): typeof DevicePage => require('./device-page').default,
  },
  deviceRevoke: {
    getOptions: () => require('./device-revoke').options,
    getScreen: (): typeof DeviceRevoke => require('./device-revoke').default,
  },
  devicesRoot: {
    getOptions: () => require('.').options,
    getScreen: (): typeof DevicesRoot => require('.').default,
  },
}

export const newModalRoutes = {
  // TODO likely should rename these
  ...provisionNewRoutes,
  deviceAdd: {getScreen: (): typeof DeviceAdd => require('./add-device').default},
  devicePaperKey: {
    getOptions: () => require('./paper-key').options,
    getScreen: (): typeof DevicePaperKey => require('./paper-key').default,
  },
}

export type RootParamListDevices = {
  deviceAdd: {highlight?: Array<'computer' | 'phone' | 'paper key'>}
  devicePage: {deviceID: string}
  deviceRevoke: {deviceID: string}
  devicePaperKey: undefined
  devicesRoot: undefined
}
