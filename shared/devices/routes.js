// @flow
import CodePage from '../login/register/code-page/container'
import DevicePage from './device-page/container'
import Devices from './container'
import GenPaperKey from './gen-paper-key/container'
import RevokeDevice from './device-revoke/container'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'

const routeTree = makeRouteDefNode({
  component: Devices,
  initialState: {showingRevoked: false},
  tags: makeLeafTags({title: 'Devices'}),
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
