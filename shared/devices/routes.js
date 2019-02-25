// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

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
  deviceAdd: {getScreen: () => require('./add-device/container').default},
  devicePage: {getScreen: () => require('./device-page/container').default},
  devicePaperKey: {getScreen: () => require('./paper-key/container').default},
  deviceRevoke: {getScreen: () => require('./device-revoke/container').default},
  'settingsTabs.devicesTab': {getScreen: () => require('./container').default},
  'tabs.devicesTab': {getScreen: () => require('./container').default},
}

export const newModalRoutes = {}

export default routeTree
