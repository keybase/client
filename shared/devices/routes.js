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
      codePage: {
        component: CodePage,
        tags: makeLeafTags({fullscreen: true, hideStatusBar: true}),
      },
      devicePage: {
        children: {
          revokeDevice: {
            component: RevokeDevice,
            title: 'Device Revoke',
          },
        },
        component: DevicePage,
      },
      error: {
        component: ErrorPage,
        tags: makeLeafTags({fullscreen: true, hideStatusBar: true}),
      },
      paperKey: {component: PaperKey},
    },
    component: Devices,
    initialState: {showingRevoked: false},
    tags: makeLeafTags({title: 'Devices'}),
  })
}

export default routeTree
