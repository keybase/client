// @flow
import React from 'react'
import {RouteDefNode} from '../route-tree'
import TestPopup from '../dev/test-popup.native'
import Settings from './'
import InvitationsContainer from './invites/container'
import InviteGenerated from './invite-generated'
import Feedback from './feedback'
import DumbSheet from '../dev/dumb-sheet'
import LogSend from '../dev/log-send'
import Push from '../push/push.native'
import DevicesRoute from '../devices/routes'

import About from './about'
import NotificationsContainer from './notifications/container'
import DeleteContainer from './delete/container'
import RemoveDevice from '../devices/device-revoke/container'
import DeleteConfirm from './delete-confirm/container'
import DevMenu from '../dev/dev-menu'

import * as Constants from '../constants/settings'

const routeTree = new RouteDefNode({
  component: Settings,
  children: {
    [Constants.aboutTab]: {
      component: About,
    },
    [Constants.landingTab]: {
      // TODO
      component: Feedback,
    },
    [Constants.invitationsTab]: {
      component: InvitationsContainer,
      children: {
        inviteSent: {
          component: InviteGenerated,
        },
      },
    },
    [Constants.devicesTab]: DevicesRoute,
    [Constants.notificationsTab]: {
      component: NotificationsContainer,
    },
    [Constants.deleteMeTab]: {
      component: DeleteContainer,
      children: {
        deleteConfirm: {
          component: DeleteConfirm,
        },
        removeDevice: {
          component: RemoveDevice,
        },
      },
    },
    [Constants.devMenuTab]: {
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
    },
  },
})

export default routeTree
