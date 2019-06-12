import * as Constants from '../constants/settings'
import {isMobile} from '../constants/platform'

export const newRoutes = {
  [Constants.aboutTab]: {getScreen: () => require('./about-container').default},
  [Constants.advancedTab]: {getScreen: () => require('./advanced/container').default},
  [Constants.chatTab]: {getScreen: () => require('./chat/container').default},
  [Constants.fsTab]: {getScreen: () => require('./files/container').default},
  [Constants.walletsTab]: {
    getScreen: () =>
      isMobile
        ? require('../wallets/wallet/container').default
        : require('../wallets/wallets-and-details/container').default,
  },
  [Constants.deleteMeTab]: {getScreen: () => require('./delete/container').default},
  [Constants.feedbackTab]: {getScreen: () => require('./feedback/container').default},
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
