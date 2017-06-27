// @flow
import React from 'react'
import {RouteDefNode} from '../route-tree'
import TestPopup from '../dev/test-popup.native'
import Settings from './'
import InvitationsContainer from './invites/container'
import InviteGenerated from './invite-generated'
import Feedback from './feedback-container'
import DumbSheet from '../dev/dumb-sheet'
import Push from '../push/push.native'
import DevicesRoute from '../devices/routes'
import WebLinks from './web-links'

import About from './about-container'
import NotificationsContainer from './notifications/container'
import DeleteContainer from './delete/container'
import RemoveDevice from '../devices/device-revoke/container'
import DeleteConfirm from './delete-confirm/container'
import DevMenu from '../dev/dev-menu'
import Screenprotector from './screenprotector-container.native'

import * as Constants from '../constants/settings'

const routeTree = new RouteDefNode({
  component: Settings,
  children: {
    [Constants.aboutTab]: {
      component: About,
      children: {
        privacyPolicy: {component: WebLinks},
        terms: {component: WebLinks},
      },
    },
    [Constants.feedbackTab]: {component: Feedback},
    [Constants.landingTab]: {component: About},
    [Constants.screenprotectorTab]: {component: Screenprotector},
    [Constants.invitationsTab]: {
      component: InvitationsContainer,
      children: {
        inviteSent: {
          component: InviteGenerated,
        },
      },
    },
    [Constants.devicesTab]: DevicesRoute,
    [Constants.notificationsTab]: {component: NotificationsContainer},
    [Constants.deleteMeTab]: {
      component: DeleteContainer,
      children: {
        deleteConfirm: {component: DeleteConfirm},
        removeDevice: {component: RemoveDevice},
      },
    },
    [Constants.devMenuTab]: {
      component: DevMenu,
      children: {
        dumbSheet: {component: DumbSheet},
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
