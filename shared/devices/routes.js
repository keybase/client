// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {newRoutes as provisionNewRoutes} from '../provision/routes'
import {modalizeRoute} from '../router-v2/modal-helper'
import {isMobile} from '../constants/platform'
import {mapValues} from 'lodash-es'

const routeTree = () => {
  const CodePage = require('../provision/code-page/container').default
  const DevicePage = require('./device-page/container').default
  const Devices = require('./container').default
  const ErrorPage = require('../provision/error/container').default
  const PaperKey = require('./paper-key/container').default
  const RevokeDevice = require('./device-revoke/container').default
  const AddDevice = require('./add-device/container').default
  return makeRouteDefNode({
    children: {
      codePage: {
        component: CodePage,
        tags: makeLeafTags({fullscreen: true, hideStatusBar: true}),
      },
      deviceAdd: {
        component: AddDevice,
        tags: makeLeafTags({fullscreen: isMobile, layerOnTop: !isMobile}),
      },
      devicePage: {
        children: {
          deviceRevoke: {
            component: RevokeDevice,
            title: 'Device Revoke',
          },
        },
        component: DevicePage,
      },
      devicePaperKey: {component: PaperKey},
      error: {
        component: ErrorPage,
        tags: makeLeafTags({fullscreen: true, hideStatusBar: true}),
      },
    },
    component: Devices,
    initialState: {showingRevoked: false},
    tags: makeLeafTags({title: 'Devices'}),
  })
}

export const newRoutes = {
  devicePage: {getScreen: () => require('./device-page/container').default, upgrade: true},
  deviceRevoke: {getScreen: () => require('./device-revoke/container').default, upgraded: true},
  'settingsTabs.devicesTab': {getScreen: () => require('./container').default, upgraded: true},
  'tabs.devicesTab': {getScreen: () => require('./container').default, upgraded: true},
}

export const newModalRoutes = {
  ...mapValues(provisionNewRoutes, v => modalizeRoute(v)),
  deviceAdd: {getScreen: () => require('./add-device/container').default, upgraded: true},
  devicePaperKey: modalizeRoute({getScreen: () => require('./paper-key/container').default, upgraded: true}),
}

export default routeTree
