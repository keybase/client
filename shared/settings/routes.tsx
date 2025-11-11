import * as React from 'react'
import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import type {ViewPropsToPageProps} from '@/constants'
import {newRoutes as devicesRoutes} from '../devices/routes'
import {newRoutes as gitRoutes} from '../git/routes'
import {newRoutes as walletsRoutes} from '../wallets/routes'
import crypto from '../crypto/sub-nav/page'

// About
const About = React.lazy(async () => import('./about'))
const about = {getOptions: {title: 'About'}, screen: About}

// Account
const Account = React.lazy(async () => import('./account'))
const account = {getOptions: {title: 'Your account'}, screen: Account}

// Advanced
const Advanced = React.lazy(async () => import('./advanced'))
const advanced = {screen: Advanced}

// Chat
const Chat = React.lazy(async () => import('./chat'))
const chat = {screen: Chat}

// Display
const Display = React.lazy(async () => import('./display'))
const display = {screen: Display}

// Feedback
const Feedback = React.lazy(async () => import('./feedback/container'))
const feedback = {
  getOptions: C.isMobile
    ? {
        headerShown: true,
        title: 'Feedback',
      }
    : {},
  screen: function FeedbackScreen(p: C.ViewPropsToPageProps<typeof Feedback>) {
    return <Feedback {...p.route.params} />
  },
}

// Files
const Files = React.lazy(async () => import('./files'))
const fs = {screen: Files}

// Invitations
const Invitations = React.lazy(async () => import('./invites'))
const invitations = {screen: Invitations}

// Notifications
const Notifications = React.lazy(async () => import('./notifications'))
const notifications = {screen: Notifications}

// What's New
const WhatsNew = React.lazy(async () => import('../whats-new/container'))
const whatsNew = {
  getOptions: C.isMobile ? {title: 'Keybase FM 87.7'} : undefined,
  screen: WhatsNew,
}

// Email
const AddEmail = React.lazy(async () => import('./account/email'))
const addEmail = {screen: AddEmail}

// Phone
const AddPhone = React.lazy(async () => import('./account/phone'))
const addPhone = {screen: AddPhone}

// Verify Phone
const SettingsVerifyPhone = React.lazy(async () => {
  const {VerifyPhone} = await import('./account/add-modals')
  return {default: VerifyPhone}
})
const settingsVerifyPhone = {screen: SettingsVerifyPhone}

// DB Nuke Confirm
const DbNukeConfirm = React.lazy(async () => import('./db-nuke-confirm/container'))
const dbNukeConfirm = {screen: DbNukeConfirm}

// Make Icons
const MakeIcons = React.lazy(async () => import('./make-icons'))
const makeIcons = {screen: MakeIcons}

// Invite Sent
const InviteSent = React.lazy(async () => import('./invite-generated'))
const inviteSent = {screen: InviteSent}

// Logout
const LogOut = React.lazy(async () => import('./logout'))
const logOut = {screen: LogOut}

// Password
const Password = React.lazy(async () => import('./password'))
const password = {screen: Password}

// Delete Confirm
const DeleteConfirm = React.lazy(async () => import('./delete-confirm'))
const deleteConfirm = {screen: DeleteConfirm}

// Mobile Check Passphrase
const MobileCheckPassphrase = React.lazy(async () => import('./delete-confirm/check-passphrase'))
const mobileCheckPassphrase = {screen: MobileCheckPassphrase}

// Disable Cert Pinning Modal
const DisableCertPinningModal = React.lazy(async () => import('./disable-cert-pinning-modal'))
const disableCertPinningModal = {screen: DisableCertPinningModal}

// Delete Address
const SettingsDeleteAddress = React.lazy(async () => import('./account/confirm-delete-modal'))
const settingsDeleteAddress = {screen: SettingsDeleteAddress}

// Deeplinks Error
const KeybaseLinkError = React.lazy(async () => import('../deeplinks/error'))
const keybaseLinkError = {screen: KeybaseLinkError}

// Settings Root Phone
const SettingsRootPhone = React.lazy(async () => import('./root-phone'))
const settingsRootPhone = {screen: SettingsRootPhone}

// Settings Root Desktop
const SettingsRootDesktop = React.lazy(async () => import('./root-desktop-tablet'))
const settingsRootDesktop = {screen: SettingsRootDesktop}

// Screenprotector Tab
const ScreenprotectorTab = React.lazy(async () => import('./screenprotector'))
const screenprotectorTab = {
  getOptions: {
    header: undefined,
    title: 'Screen Protector',
  },
  screen: ScreenprotectorTab,
}

// Contacts Tab
const ContactsTab = C.isMobile ? React.lazy(async () => import('./manage-contacts')) : () => <></>
const contactsTab = {
  getOptions: {
    header: undefined,
    title: 'Contacts',
  },
  screen: ContactsTab,
}

// Web Links
const WebLinks = React.lazy(async () => import('./web-links'))
const webLinks = {
  getOptions: ({route}: C.ViewPropsToPageProps<typeof WebLinks>) => ({
    header: undefined,
    title: route.params.title,
  }),
  screen: function WebLinksScreen(p: C.ViewPropsToPageProps<typeof WebLinks>) {
    return <WebLinks {...p.route.params} />
  },
}

// Contacts Joined
const SettingsContactsJoined = React.lazy(async () => import('./contacts-joined'))
const settingsContactsJoined = {screen: SettingsContactsJoined}

// Push Prompt
const SettingsPushPrompt = React.lazy(async () => import('./notifications/push-prompt'))
const settingsPushPrompt = {screen: SettingsPushPrompt}

// Archive
const Archive = C.featureFlags.archive ? React.lazy(async () => import('./archive')) : () => <></>
const archive = {
  getOptions: C.isMobile ? {title: 'Backup'} : undefined,
  screen: Archive,
}

// Archive Modal
const ArchiveModal = React.lazy(async () => import('./archive/modal'))
const archiveModal = {screen: ArchiveModal}

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

