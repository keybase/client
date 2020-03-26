import {newRoutes as provisionNewRoutes} from '../provision/routes'
import {modalizeRoute} from '../router-v2/modal-helper'
import mapValues from 'lodash/mapValues'
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
  ...mapValues(provisionNewRoutes, (val, key) => (key === 'error' ? modalizeRoute(val) : val)),
  deviceAdd: {getScreen: (): typeof DeviceAdd => require('./add-device/container').default},
  devicePaperKey: modalizeRoute({
    getScreen: (): typeof DevicePaperKey => require('./paper-key').default,
  }),
}
