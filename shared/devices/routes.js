// @flow
import CodePage from '../login/register/code-page/container'
import DevicePage from './device-page/container'
import Devices from './container'
import GenPaperKey from './gen-paper-key/container'
import RevokeDevice from './device-revoke/container'
import {RouteDefNode} from '../route-tree'

const routeTree = new RouteDefNode({
  component: Devices,
  initialState: {showingRevoked: false},
  tags: {title: 'Devices'},
  children: {
    codePage: {
      component: CodePage,
    },
    genPaperKey: {
      component: GenPaperKey,
    },
    devicePage: {
      component: DevicePage,
      children: {
        revokeDevice: {
          title: 'Device Revoke',
          component: RevokeDevice,
        },
      },
    },
  },
})

export default routeTree
