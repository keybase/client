import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import {newRoutes as devicesRoutes} from '../devices/routes'
import {newRoutes as gitRoutes} from '../git/routes'
import {newRoutes as walletsRoutes} from '../wallets/routes'
import about from './about.page'
import account from './account/page'
import advanced from './advanced.page'
import chat from './chat.page'
import crypto from '../crypto/sub-nav/page'
import display from './display.page'
import feedback from './feedback/page'
import fs from './files/page'
import invitations from './invites/page'
import notifications from './notifications/page'
import whatsNew from '../whats-new/page'
import addEmail from './account/email.page'
import addPhone from './account/phone.page'
import settingsVerifyPhone from './account/verify-phone.page'
import dbNukeConfirm from './db-nuke-confirm/page'
import makeIcons from './make-icons.page'
import inviteSent from './invite-generated/page'
import logOut from './logout/page'
import password from './password/page'
import deleteConfirm from './delete-confirm/page'
import mobileCheckPassphrase from './delete-confirm/check-passphrase.page'
import disableCertPinningModal from './disable-cert-pinning-modal/page'
import settingsDeleteAddress from './account/confirm-delete.modal.page'
import keybaseLinkError from '../deeplinks/page'

import settingsRootPhone from './root-phone.page'
import settingsRootDesktop from './root-desktop-tablet.page'
import screenprotectorTab from './screenprotector.page'
import contactsTab from './manage-contacts.page'
import webLinks from './web-links.page'
import settingsContactsJoined from './contacts-joined/page'
import settingsPushPrompt from './notifications/push-prompt.page'
import archive from './archive/index.page'
import archiveModal from './archive/modal.page'

export const sharedNewRoutes = {
  [Constants.settingsAboutTab]: about,
  [Constants.settingsAccountTab]: account,
  [Constants.settingsAdvancedTab]: advanced,
  [Constants.settingsArchiveTab]: archive,
  [Constants.settingsChatTab]: chat,
  [Constants.settingsCryptoTab]: crypto,
  [Constants.settingsDevicesTab]: devicesRoutes.devicesRoot,
  [Constants.settingsDisplayTab]: display,
  [Constants.settingsFeedbackTab]: feedback,
  [Constants.settingsFsTab]: fs,
  [Constants.settingsGitTab]: gitRoutes.gitRoot,
  [Constants.settingsInvitationsTab]: invitations,
  [Constants.settingsNotificationsTab]: notifications,
  [Constants.settingsScreenprotectorTab]: screenprotectorTab,
  [Constants.settingsWalletsTab]: {...walletsRoutes.walletsRoot},
  [Constants.settingsWhatsNewTab]: whatsNew,
  addEmail,
  addPhone,
  dbNukeConfirm,
  inviteSent,
  keybaseLinkError,
  makeIcons,
  removeDevice: devicesRoutes.deviceRevoke,
}

const sharedNewModalRoutes = {
  [Constants.settingsLogOutTab]: logOut,
  [Constants.settingsPasswordTab]: password,
  archiveModal,
  deleteConfirm,
  disableCertPinningModal,
  settingsAddEmail: addEmail,
  settingsAddPhone: addPhone,
  settingsDeleteAddress,
  settingsVerifyPhone,
}

export const newRoutes = {
  settingsRoot: C.isMobile ? (C.isPhone ? settingsRootPhone : settingsRootDesktop) : settingsRootDesktop,
  ...sharedNewRoutes,
  [Constants.settingsContactsTab]: contactsTab,
  webLinks,
}

export const newModalRoutes = {
  ...sharedNewModalRoutes,
  [Constants.settingsLogOutTab]: logOut,
  [Constants.settingsPasswordTab]: password,
  checkPassphraseBeforeDeleteAccount: mobileCheckPassphrase,
  modalFeedback: feedback,
  settingsContactsJoined,
  settingsPushPrompt,
}

export type RootParamListSettings = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
