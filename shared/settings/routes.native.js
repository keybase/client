// @flow
import {RouteDefNode} from '../route-tree'
import DevMenu from '../dev/dev-menu'
import DumbSheet from '../dev/dumb-sheet'
import LogSend from '../dev/log-send'

const routeTree = new RouteDefNode({
  component: DevMenu,
  children: {
    dumbSheet: {
      component: DumbSheet,
    },
    logSend: {
      component: LogSend,
    },
  },
})

export default routeTree
