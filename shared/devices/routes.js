// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = () => {
  const CodePage = require('../provision/code-page/container').default
  const DevicePage = require('./device-page/container').default
  const Devices = require('./container').default
  const ErrorPage = require('../provision/error/container').default
  const PaperKey = require('./paper-key/container').default
  const RevokeDevice = require('./device-revoke/container').default
  return makeRouteDefNode({
    children: {
      deviceCodePage: {
        component: CodePage,
        tags: makeLeafTags({fullscreen: true, hideStatusBar: true}),
      },
      deviceError: {
        component: ErrorPage,
        tags: makeLeafTags({fullscreen: true, hideStatusBar: true}),
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
    },
    component: Devices,
    initialState: {showingRevoked: false},
    tags: makeLeafTags({title: 'Devices'}),
  })
}

export const newRoutes = {
  deviceCodePage: {getScreen: () => require('../provision/code-page/container').default},
  deviceError: {getScreen: () => require('../provision/error/container').default},
  devicePage: {getScreen: () => require('./device-page/container').default},
  devicePaperKey: {getScreen: () => require('./paper-key/container').default},
  deviceRevoke: {getScreen: () => require('./device-revoke/container').default},
  'tabs:devicesTab': {getScreen: () => require('./container').default},
  'settingsTabs:devicesTab': {getScreen: () => require('./container').default},
}

export default routeTree
