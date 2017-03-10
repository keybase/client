// @flow
import {RouteDefNode} from '../route-tree'
import Devices from './container'
import CodePage from '../login/register/code-page'
import GenPaperKey from './gen-paper-key'
import DevicePage from './device-page/container'
import RemoveDevice from './device-revoke'

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
        removeDevice: {
          title: 'Device Revoke',
          component: RemoveDevice,
        },
      },
    },
  },
})

export default routeTree
