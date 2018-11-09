// @flow
import CodePage from '../provision/code-page/container'
import DevicePage from './device-page/container'
import Devices from './container'
import ErrorPage from '../provision/error/container'
import PaperKey from './paper-key/container'
import RevokeDevice from './device-revoke/container'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = makeRouteDefNode({
  children: {
    error: {
      component: ErrorPage,
      tags: makeLeafTags({hideStatusBar: true, fullscreen: true}),
    },
    codePage: {
      component: CodePage,
      tags: makeLeafTags({hideStatusBar: true, fullscreen: true}),
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
    paperKey: {component: PaperKey},
  },
  component: Devices,
  initialState: {showingRevoked: false},
  tags: makeLeafTags({title: 'Devices'}),
})

export default routeTree
