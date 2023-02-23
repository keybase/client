import * as Constants from '../constants/settings'
import {isMobile} from '../constants/platform'
import type AboutTab from './about'
import type AccountTab from './account/container'
import type AdvancedTab from './advanced'
import type ChatTab from './chat/container'
import type DbNukeConfirm from './db-nuke-confirm/container'
import type DeleteConfirm from './delete-confirm/index'
import type DevicesTab from '../devices/container'
import type DisableCertPinningModal from './disable-cert-pinning-modal/container'
import type DisplayTab from './display'
import type FeedbackTab from './feedback/container'
import type FsTab from './files/container'
import type GitTab from '../git/container'
import type InvitationsTab from './invites/container'
import type InviteSent from './invite-generated/container'
import type LogOutTab from './logout/container'
import type NotificationsTab from './notifications/container'
import type PasswordTab from './password/container'
import type RemoveDevice from '../devices/device-revoke/container'
import type WhatsNewTab from '../whats-new/container'
import type {DeleteModal} from './account/confirm-delete'
import type {Email, Phone, VerifyPhone} from './account/add-modals'

export const sharedNewRoutes = {
  [Constants.aboutTab]: {
    getOptions: {
      header: undefined,
      title: 'About',
    },
    getScreen: (): typeof AboutTab => require('./about').default,
  },
  [Constants.accountTab]: {getScreen: (): typeof AccountTab => require('./account/container').default},
  [Constants.advancedTab]: {getScreen: (): typeof AdvancedTab => require('./advanced').default},
  [Constants.chatTab]: {getScreen: (): typeof ChatTab => require('./chat/container').default},
  [Constants.cryptoTab]: {
    getOptions: () => ({title: 'Crypto'}),
    getScreen: (): typeof ChatTab => require('../crypto/sub-nav').default,
  },
  [Constants.devicesTab]: {getScreen: (): typeof DevicesTab => require('../devices/container').default},
  [Constants.displayTab]: {getScreen: (): typeof DisplayTab => require('./display').default},
  [Constants.feedbackTab]: {getScreen: (): typeof FeedbackTab => require('./feedback/container').default},
  [Constants.fsTab]: {getScreen: (): typeof FsTab => require('./files/container').default},
  [Constants.gitTab]: {getScreen: (): typeof GitTab => require('../git/container').default},
  [Constants.invitationsTab]: {
    getScreen: (): typeof InvitationsTab => require('./invites/container').default,
  },
  [Constants.notificationsTab]: {
    getScreen: (): typeof NotificationsTab => require('./notifications/container').default,
  },
  [Constants.whatsNewTab]: {
    getOptions: isMobile
      ? {
          HeaderTitle: 'Keybase FM 87.7',
          header: undefined,
          title: 'Keybase FM 87.7',
        }
      : {},
    getScreen: (): typeof WhatsNewTab => require('../whats-new/container').default,
  },
  addEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  addPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  dbNukeConfirm: {getScreen: (): typeof DbNukeConfirm => require('./db-nuke-confirm/container').default},
  inviteSent: {getScreen: (): typeof InviteSent => require('./invite-generated/container').default},
  removeDevice: {getScreen: (): typeof RemoveDevice => require('../devices/device-revoke/container').default},
}

export const sharedNewModalRoutes = {
  [Constants.logOutTab]: {getScreen: (): typeof LogOutTab => require('./logout/container').default},
  [Constants.passwordTab]: {getScreen: (): typeof PasswordTab => require('./password/container').default},
  deleteConfirm: {getScreen: (): typeof DeleteConfirm => require('./delete-confirm/index').default},
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
