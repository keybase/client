// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import * as Constants from '../constants/settings'
import {isMobile} from '../constants/platform'

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
  const Password = require('./password/container').default
  const About = require('./about-container').default
  const NotificationsContainer = require('./notifications/container').default
  const DBNukeConfirm = require('./db-nuke-confirm/container').default
  const DeleteContainer = require('./delete/container').default
  const RemoveDevice = require('../devices/device-revoke/container').default
  const DeleteConfirm = require('./delete-confirm/container').default
  const AdvancedContainer = require('./advanced/container').default
  const ChatContainer = require('./chat/container').default
  const Screenprotector = require('./screenprotector-container.native').default
  const LogOut = require('./logout/container').default

  return makeRouteDefNode({
    children: {
      [Constants.aboutTab]: {
        children: {
          privacyPolicy: {component: WebLinks},
          terms: {component: WebLinks},
        },
        component: About,
      },
      [Constants.passwordTab]: {component: Password},
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
      [Constants.logOutTab]: {
        component: LogOut,
      },
    },
    component: Settings,
  })
}

export default routeTree

export const newRoutes = {
  [Constants.aboutTab]: {getScreen: () => require('./about-container').default},
  [Constants.advancedTab]: {getScreen: () => require('./advanced/container').default},
  [Constants.chatTab]: {getScreen: () => require('./chat/container').default},
  [Constants.walletsTab]: {
    getScreen: () =>
      isMobile
        ? require('../wallets/wallet/container').default
        : require('../wallets/wallets-and-details/container').default,
  },
  [Constants.deleteMeTab]: {getScreen: () => require('./delete/container').default},
  [Constants.feedbackTab]: {getScreen: () => require('./feedback-container').default},
  [Constants.invitationsTab]: {getScreen: () => require('./invites/container').default},
  [Constants.landingTab]: {getScreen: () => require('./about-container').default},
  [Constants.notificationsTab]: {getScreen: () => require('./notifications/container').default},
  [Constants.passwordTab]: {getScreen: () => require('./password/container').default},
  [Constants.screenprotectorTab]: {getScreen: () => require('./screenprotector-container.native').default},
  dbNukeConfirm: {getScreen: () => require('./db-nuke-confirm/container').default},
  deleteConfirm: {getScreen: () => require('./delete-confirm/container').default},
  inviteSent: {getScreen: () => require('./invite-generated/container').default},
  privacyPolicy: {getScreen: () => require('./web-links.native').default},
  removeDevice: {getScreen: () => require('../devices/device-revoke/container').default},
  settingsRoot: {getScreen: () => require('./').default},
  terms: {getScreen: () => require('./web-links.native').default},
}
export const newModalRoutes = {
  [Constants.logOutTab]: {getScreen: () => require('./logout/container').default},
}
