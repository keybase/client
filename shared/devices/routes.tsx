import {newRoutes as provisionNewRoutes} from '../provision/routes'
import DevicePage from './device-page/container'
import DeviceRevoke from './device-revoke/container'
import DevicesRoot from './container'
import DeviceAdd from './add-device/container'
import DevicePaperKey from './paper-key'

export const newRoutes = {
  devicePage: {getScreen: (): typeof DevicePage => require('./device-page/container').default},
  deviceRevoke: {getScreen: (): typeof DeviceRevoke => require('./device-revoke/container').default},
  devicesRoot: {getScreen: (): typeof DevicesRoot => require('./container').default},
}

export const newModalRoutes = {
  ...provisionNewRoutes,
  deviceAdd: {getScreen: (): typeof DeviceAdd => require('./add-device/container').default},
  devicePaperKey: {getScreen: (): typeof DevicePaperKey => require('./paper-key').default},
}
