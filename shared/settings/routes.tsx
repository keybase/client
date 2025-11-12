import * as React from 'react'
import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import {newRoutes as devicesRoutes} from '../devices/routes'
import {newRoutes as gitRoutes} from '../git/routes'
import {newRoutes as walletsRoutes} from '../wallets/routes'
import crypto from '../crypto/sub-nav/page'

const AddEmail = React.lazy(async () => {
  const {Email} = await import('./account/add-modals')
  return {default: Email}
})

const AddPhone = React.lazy(async () => {
  const {Phone} = await import('./account/add-modals')
  return {default: Phone}
})

const SettingsRootDesktop = React.lazy(async () => import('./root-desktop-tablet'))

const feedback = C.makeScreen(
  React.lazy(async () => import('./feedback/container')),
  {getOptions: C.isMobile ? {headerShown: true, title: 'Feedback'} : {}}
)

export const sharedNewRoutes = {
  [Constants.settingsAboutTab]: {
    getOptions: {title: 'About'},
    screen: React.lazy(async () => import('./about')),
  },
  [Constants.settingsAccountTab]: {
    getOptions: {title: 'Your account'},
    screen: React.lazy(async () => import('./account')),
  },
  [Constants.settingsAdvancedTab]: {screen: React.lazy(async () => import('./advanced'))},
  [Constants.settingsArchiveTab]: {
    getOptions: C.isMobile ? {title: 'Backup'} : undefined,
    screen: C.featureFlags.archive ? React.lazy(async () => import('./archive')) : () => <></>,
  },
  [Constants.settingsChatTab]: {screen: React.lazy(async () => import('./chat'))},
  [Constants.settingsCryptoTab]: crypto,
  [Constants.settingsDevicesTab]: devicesRoutes.devicesRoot,
  [Constants.settingsDisplayTab]: {screen: React.lazy(async () => import('./display'))},
  [Constants.settingsFeedbackTab]: feedback,
  [Constants.settingsFsTab]: {screen: React.lazy(async () => import('./files/container'))},
  [Constants.settingsGitTab]: gitRoutes.gitRoot,
  [Constants.settingsInvitationsTab]: {screen: React.lazy(async () => import('./invites/container'))},
  [Constants.settingsNotificationsTab]: {screen: React.lazy(async () => import('./notifications/container'))},
  [Constants.settingsScreenprotectorTab]: {
    getOptions: {header: undefined, title: 'Screen Protector'},
    screen: React.lazy(async () => import('./screenprotector')),
  },
  [Constants.settingsWalletsTab]: {...walletsRoutes.walletsRoot},
  [Constants.settingsWhatsNewTab]: {
    getOptions: C.isMobile ? {title: 'Keybase FM 87.7'} : undefined,
    screen: React.lazy(async () => import('../whats-new/container')),
  },
  addEmail: {screen: AddEmail},
  addPhone: {screen: AddPhone},
  dbNukeConfirm: {screen: React.lazy(async () => import('./db-nuke-confirm/container'))},
  inviteSent: C.makeScreen(React.lazy(async () => import('./invite-generated/container'))),
  keybaseLinkError: {screen: React.lazy(async () => import('../deeplinks/error'))},
  makeIcons: {screen: React.lazy(async () => import('./make-icons.page'))},
  removeDevice: devicesRoutes.deviceRevoke,
}

const sharedNewModalRoutes = {
  [Constants.settingsLogOutTab]: {screen: React.lazy(async () => import('./logout'))},
  [Constants.settingsPasswordTab]: {screen: React.lazy(async () => import('./password/container'))},
  archiveModal: {screen: C.makeScreen(React.lazy(async () => import('./archive/modal')))},
  deleteConfirm: {screen: React.lazy(async () => import('./delete-confirm'))},
  disableCertPinningModal: {screen: React.lazy(async () => import('./disable-cert-pinning-modal'))},
  settingsAddEmail: {screen: AddEmail},
  settingsAddPhone: {screen: AddPhone},
  settingsDeleteAddress: {screen: React.lazy(async () => import('./account/confirm-delete'))},
  settingsVerifyPhone: {
    screen: React.lazy(async () => {
      const {VerifyPhone} = await import('./account/add-modals')
      return {default: VerifyPhone}
    }),
  },
}

const WebLinks = React.lazy(async () => import('./web-links'))

export const newRoutes = {
  settingsRoot: C.isMobile
    ? C.isPhone
      ? {screen: React.lazy(async () => import('./root-phone'))}
      : {screen: SettingsRootDesktop}
    : {screen: SettingsRootDesktop},
  ...sharedNewRoutes,
  [Constants.settingsContactsTab]: {
    getOptions: {header: undefined, title: 'Contacts'},
    screen: C.isMobile ? React.lazy(async () => import('./manage-contacts')) : Promise.resolve(() => <></>),
  },
  webLinks: C.makeScreen(WebLinks, {
    getOptions: ({route}: C.ViewPropsToPageProps<typeof WebLinks>) => ({
      header: undefined,
      title: route.params.title,
    }),
  }),
}

export const newModalRoutes = {
  ...sharedNewModalRoutes,
  checkPassphraseBeforeDeleteAccount: {
    screen: React.lazy(async () => import('./delete-confirm/check-passphrase')),
  },
  modalFeedback: feedback,
  settingsContactsJoined: {screen: React.lazy(async () => import('./contacts-joined'))},
  settingsPushPrompt: {screen: React.lazy(async () => import('./notifications/push-prompt'))},
}

export type RootParamListSettings = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
