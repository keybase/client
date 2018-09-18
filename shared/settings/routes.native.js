// @flow
import * as React from 'react'
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import TestPopup from '../dev/test-popup.native'
import Settings from './'
import InvitationsContainer from './invites/container'
import InviteGenerated from './invite-generated/container'
import Feedback from './feedback-container'
import PushPrompt from '../app/push-prompt.native'
import DevicesRoute from '../devices/routes'
import WalletsRoute from '../wallets/routes'
import GitRoute from '../git/routes'
import FilesRoute from '../fs/routes'
import WebLinks from './web-links.native'
import Passphrase from './passphrase/container'

import About from './about-container'
import NotificationsContainer from './notifications/container'
import DBNukeConfirm from './db-nuke-confirm/container'
import DeleteContainer from './delete/container'
import RemoveDevice from '../devices/device-revoke/container'
import DeleteConfirm from './delete-confirm/container'
import AdvancedContainer from './advanced/container'
import DevMenu from '../dev/dev-menu'
import Screenprotector from './screenprotector-container.native'

import * as Constants from '../constants/settings'

const routeTree = makeRouteDefNode({
  component: Settings,
  children: {
    [Constants.aboutTab]: {
      component: About,
      children: {
        privacyPolicy: {component: WebLinks},
        terms: {component: WebLinks},
      },
    },
    [Constants.passphraseTab]: {component: Passphrase},
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
    [Constants.fsTab]: FilesRoute,
    [Constants.devicesTab]: DevicesRoute,
    [Constants.walletsTab]: WalletsRoute,
    [Constants.gitTab]: GitRoute,
    [Constants.notificationsTab]: {component: NotificationsContainer},
    [Constants.advancedTab]: {
      component: AdvancedContainer,
      children: {
        dbNukeConfirm: {
          component: DBNukeConfirm,
          tags: makeLeafTags({modal: true}),
        },
      },
    },
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
        push: {
          component: () => <PushPrompt />,
        },
        testPopup: {
          component: TestPopup,
          tags: makeLeafTags({layerOnTop: true}),
        },
      },
    },
  },
})

export default routeTree
