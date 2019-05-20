import {newRoutes as provisionNewRoutes} from '../provision/routes'
import {modalizeRoute} from '../router-v2/modal-helper'
import {mapValues} from 'lodash-es'

export const newRoutes = {
  devicePage: {getScreen: () => require('./device-page/container').default, upgrade: true},
  deviceRevoke: {getScreen: () => require('./device-revoke/container').default, upgraded: true},
  devicesRoot: {getScreen: () => require('./container').default, upgraded: true},
  'settingsTabs.devicesTab': {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  ...mapValues(provisionNewRoutes, v => modalizeRoute(v)),
  deviceAdd: {getScreen: () => require('./add-device/container').default, upgraded: true},
  devicePaperKey: modalizeRoute({getScreen: () => require('./paper-key/container').default, upgraded: true}),
}
