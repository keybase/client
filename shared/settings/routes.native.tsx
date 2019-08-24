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
import ManageContactsTab from './manage-contacts.native'

export const newRoutes = {
  [Constants.aboutTab]: {getScreen: (): typeof AboutTab => require('./about-container').default},
  // TODO connect broken
  [Constants.advancedTab]: {getScreen: (): typeof AdvancedTab => require('./advanced/container').default},
  [Constants.chatTab]: {getScreen: (): typeof ChatTab => require('./chat/container').default},
  [Constants.fsTab]: {getScreen: (): typeof FsTab => require('./files/container').default},
  [Constants.walletsTab]: {
    getScreen: (): typeof WalletsTab => require('../wallets/wallet/container').default,
  },
  [Constants.deleteMeTab]: {getScreen: (): typeof DeleteMeTab => require('./delete/container').default},
  [Constants.feedbackTab]: {getScreen: (): typeof FeedbackTab => require('./feedback/container').default},
  // TODO connect broken
  [Constants.invitationsTab]: {
    getScreen: (): typeof InvitationsTab => require('./invites/container').default,
  },
  [Constants.accountTab]: {getScreen: (): typeof AccountTab => require('./account/container').default},
  [Constants.notificationsTab]: {
    getScreen: (): typeof NotificationsTab => require('./notifications/container').default,
  },
  [Constants.screenprotectorTab]: {
    getScreen: (): typeof ScreenprotectorTab => require('./screenprotector-container.native').default,
  },
  addEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  addPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  dbNukeConfirm: {getScreen: (): typeof DbNukeConfirm => require('./db-nuke-confirm/container').default},
  deleteConfirm: {getScreen: (): typeof DeleteConfirm => require('./delete-confirm/container').default},
  inviteSent: {getScreen: (): typeof InviteSent => require('./invite-generated/container').default},
  [Constants.contactsTab]: {
    getScreen: (): typeof ManageContactsTab => require('./manage-contacts.native').default,
  },
  // TODO connect broken
  privacyPolicy: {getScreen: (): typeof WebLink => require('./web-links.native').default},
  removeDevice: {getScreen: (): typeof RemoveDevice => require('../devices/device-revoke/container').default},
  settingsRoot: {getScreen: (): typeof SettingsRoot => require('./').default},
  // TODO connect broken
  terms: {getScreen: (): typeof WebLink => require('./web-links.native').default},
}
export const newModalRoutes = {
  [Constants.logOutTab]: {getScreen: (): typeof LogOutTab => require('./logout/container').default},
  [Constants.passwordTab]: {getScreen: (): typeof PasswordTab => require('./password/container').default},
  disableCertPinningModal: {
    getScreen: (): typeof DisableCertPinningModal =>
      require('./disable-cert-pinning-modal/container').default,
  },
  settingsAddEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  settingsAddPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  settingsDeleteAddress: {
    getScreen: (): typeof DeleteModal => require('./account/confirm-delete').DeleteModal,
  },
  settingsVerifyPhone: {getScreen: (): typeof VerifyPhone => require('./account/add-modals').VerifyPhone},
}
