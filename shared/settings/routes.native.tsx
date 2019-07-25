import * as Constants from '../constants/settings'
import AboutTab from './about-container'
import AdvancedTab from './advanced/container'
import ChatTab from './chat/container'
import FsTab from './files/container'
import WalletsTab from '../wallets/wallet/container'
import DeleteMeTab from './delete/container'
import FeedbackTab from './feedback/container'
import InvitationsTab from './invites/container'
import AccountTab from './account/container'
import NotificationsTab from './notifications/container'
import PasswordTab from './password/container'
import ScreenprotectorTab from './screenprotector-container.native'
import DbNukeConfirm from './db-nuke-confirm/container'
import DeleteConfirm from './delete-confirm/container'
import InviteSent from './invite-generated/container'
import RemoveDevice from '../devices/device-revoke/container'
import SettingsRoot from '.'
import WebLink from './web-links.native'
import LogOutTab from './logout/container'
import DisableCertPinningModal from './disable-cert-pinning-modal/container'
import {DeleteModal} from './account/confirm-delete'
import {Email, Phone, VerifyPhone} from './account/add-modals'
import SettingsManageContacts from './account/manage-contacts.native'

export const newRoutes = {
  [Constants.aboutTab]: {
    getScreen: (): typeof AboutTab => require('./about-container').default,
    upgraded: true,
  },
  [Constants.advancedTab]: {
    // TODO connect broken
    getScreen: (): typeof AdvancedTab => require('./advanced/container').default,
    upgraded: true,
  },
  [Constants.chatTab]: {getScreen: (): typeof ChatTab => require('./chat/container').default, upgraded: true},
  [Constants.fsTab]: {getScreen: (): typeof FsTab => require('./files/container').default, upgraded: true},
  [Constants.walletsTab]: {
    getScreen: (): typeof WalletsTab => require('../wallets/wallet/container').default,
    upgraded: true,
  },
  [Constants.deleteMeTab]: {
    getScreen: (): typeof DeleteMeTab => require('./delete/container').default,
    upgraded: true,
  },
  [Constants.feedbackTab]: {
    getScreen: (): typeof FeedbackTab => require('./feedback/container').default,
    upgraded: true,
  },
  // TODO connect broken
  [Constants.invitationsTab]: {
    getScreen: (): typeof InvitationsTab => require('./invites/container').default,
    upgraded: true,
  },
  [Constants.accountTab]: {
    getScreen: (): typeof AccountTab => require('./account/container').default,
    upgraded: true,
  },
  [Constants.notificationsTab]: {
    getScreen: (): typeof NotificationsTab => require('./notifications/container').default,
    upgraded: true,
  },
  [Constants.screenprotectorTab]: {
    getScreen: (): typeof ScreenprotectorTab => require('./screenprotector-container.native').default,
    upgraded: true,
  },
  addEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email, upgraded: true},
  addPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone, upgraded: true},
  dbNukeConfirm: {
    getScreen: (): typeof DbNukeConfirm => require('./db-nuke-confirm/container').default,
    upgraded: true,
  },
  deleteConfirm: {
    getScreen: (): typeof DeleteConfirm => require('./delete-confirm/container').default,
    upgraded: true,
  },
  inviteSent: {
    getScreen: (): typeof InviteSent => require('./invite-generated/container').default,
    upgraded: true,
  },
  // TODO connect broken
  privacyPolicy: {getScreen: (): typeof WebLink => require('./web-links.native').default, upgraded: true},
  removeDevice: {
    getScreen: (): typeof RemoveDevice => require('../devices/device-revoke/container').default,
    upgraded: true,
  },
  settingsRoot: {getScreen: (): typeof SettingsRoot => require('./').default, upgraded: true},
  // TODO connect broken
  terms: {getScreen: (): typeof WebLink => require('./web-links.native').default, upgraded: true},
}
export const newModalRoutes = {
  [Constants.logOutTab]: {
    getScreen: (): typeof LogOutTab => require('./logout/container').default,
    upgraded: true,
  },
  [Constants.passwordTab]: {
    getScreen: (): typeof PasswordTab => require('./password/container').default,
    upgraded: true,
  },
  disableCertPinningModal: {
    getScreen: (): typeof DisableCertPinningModal =>
      require('./disable-cert-pinning-modal/container').default,
    upgraded: true,
  },
  settingsAddEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email, upgraded: true},
  settingsAddPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone, upgraded: true},
  settingsDeleteAddress: {
    getScreen: (): typeof DeleteModal => require('./account/confirm-delete').DeleteModal,
    upgraded: true,
  },
  settingsManageContacts: {
    getScreen: (): typeof SettingsManageContacts => require('./account/manage-contacts.native').default,
    upgraded: true,
  },
  settingsVerifyPhone: {
    getScreen: (): typeof VerifyPhone => require('./account/add-modals').VerifyPhone,
    upgraded: true,
  },
}
