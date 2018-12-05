// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import Settings from './'
import InvitationsContainer from './invites/container'
import InviteGenerated from './invite-generated/container'
import Feedback from './feedback-container'
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
import ChatContainer from './chat/container'
import Screenprotector from './screenprotector-container.native'

import * as Constants from '../constants/settings'

const routeTree = makeRouteDefNode({
  children: {
    [Constants.aboutTab]: {
      children: {
        privacyPolicy: {component: WebLinks},
        terms: {component: WebLinks},
      },
      component: About,
    },
    [Constants.passphraseTab]: {component: Passphrase},
    [Constants.feedbackTab]: {component: Feedback},
    [Constants.landingTab]: {component: About},
    [Constants.screenprotectorTab]: {component: Screenprotector},
    [Constants.invitationsTab]: {
      children: {
        inviteSent: {
          component: InviteGenerated,
        },
      },
      component: InvitationsContainer,
    },
    [Constants.fsTab]: FilesRoute,
    [Constants.devicesTab]: DevicesRoute,
    [Constants.walletsTab]: WalletsRoute,
    [Constants.gitTab]: GitRoute,
    [Constants.notificationsTab]: {component: NotificationsContainer},
    [Constants.chatTab]: {component: ChatContainer},
    [Constants.advancedTab]: {
      children: {
        dbNukeConfirm: {
          component: DBNukeConfirm,
          tags: makeLeafTags({modal: true}),
        },
      },
      component: AdvancedContainer,
    },
    [Constants.deleteMeTab]: {
      children: {
        deleteConfirm: {component: DeleteConfirm},
        removeDevice: {component: RemoveDevice},
      },
      component: DeleteContainer,
    },
  },
  component: Settings,
})

export default routeTree
