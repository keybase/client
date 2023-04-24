import {newRoutes as provisionNewRoutes} from '../provision/routes-sub'
import type DevicePage from './device-page/container'
import type DeviceRevoke from './device-revoke/container'
import type DevicesRoot from './container'
import type DeviceAdd from './add-device/container'
import type DevicePaperKey from './paper-key'

export const newRoutes = {
  devicePage: {
    getOptions: () => require('./device-page/container').options,
    getScreen: (): typeof DevicePage => require('./device-page/container').default,
  },
  deviceRevoke: {
    getOptions: () => require('./device-revoke/container').options,
    getScreen: (): typeof DeviceRevoke => require('./device-revoke/container').default,
  },
  devicesRoot: {
    getOptions: () => require('./container').options,
    getScreen: (): typeof DevicesRoot => require('./container').default,
  },
}

export const newModalRoutes = {
  // TODO likely should rename these
  ...provisionNewRoutes,
  deviceAdd: {getScreen: (): typeof DeviceAdd => require('./add-device/container').default},
  devicePaperKey: {
    getOptions: () => require('./paper-key').options,
    getScreen: (): typeof DevicePaperKey => require('./paper-key').default,
  },
}

export type RootParamListDevices = {
  deviceAdd: {highlight: Array<'computer' | 'phone' | 'paper key'>}
  devicePage: {deviceID: string}
  deviceRevoke: {deviceID: string}
  devicePaperKey: undefined
  devicesRoot: undefined
}
