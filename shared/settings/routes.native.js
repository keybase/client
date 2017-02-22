// @flow
import React from 'react'
import {RouteDefNode} from '../route-tree'
import DevMenu from '../dev/dev-menu'
import DumbSheet from '../dev/dumb-sheet'
import LogSend from '../dev/log-send'
import Push from '../push/push.native'

const routeTree = new RouteDefNode({
  component: DevMenu,
  children: {
    dumbSheet: {
      component: DumbSheet,
    },
    logSend: {
      component: LogSend,
    },
    push: {
      component: () => <Push prompt={true} />,
    },
  },
})

export default routeTree
