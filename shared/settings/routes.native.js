// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import * as Constants from '../constants/settings'

const routeTree = () => {
  const Settings = require('./').default
  const InvitationsContainer = require('./invites/container').default
  const InviteGenerated = require('./invite-generated/container').default
  const Feedback = require('./feedback-container').default
  const DevicesRoute = require('../devices/routes').default
  const WalletsRoute = require('../wallets/routes').default
  const GitRoute = require('../git/routes').default
  const FilesRoute = require('../fs/routes').default
  const WebLinks = require('./web-links.native').default
  const Passphrase = require('./passphrase/container').default
  const About = require('./about-container').default
  const NotificationsContainer = require('./notifications/container').default
  const DBNukeConfirm = require('./db-nuke-confirm/container').default
  const DeleteContainer = require('./delete/container').default
  const RemoveDevice = require('../devices/device-revoke/container').default
  const DeleteConfirm = require('./delete-confirm/container').default
  const AdvancedContainer = require('./advanced/container').default
  const ChatContainer = require('./chat/container').default
  const Screenprotector = require('./screenprotector-container.native').default

  return makeRouteDefNode({
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
}

export default routeTree
