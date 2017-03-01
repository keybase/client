// @flow
import React from 'react'
import {RouteDefNode} from '../route-tree'
import TestPopup from '../dev/test-popup.native'
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
    testPopup: {
      component: TestPopup,
      tags: {layerOnTop: true},
    },
  },
})

export default routeTree
