import * as React from 'react'
import * as C from '@/constants'
import {newRoutes as devicesRoutes} from '../devices/routes'
import {newRoutes as gitRoutes} from '../git/routes'
import {newRoutes as walletsRoutes} from '../wallets/routes'
import * as Settings from '@/constants/settings'

const SettingsRootDesktop = React.lazy(async () => import('./root-desktop-tablet'))

const feedback = C.makeScreen(
  React.lazy(async () => import('./feedback/container')),
  {getOptions: C.isMobile ? {headerShown: true, title: 'Feedback'} : {}}
)

export const sharedNewRoutes = {
  [Settings.settingsAboutTab]: {
    getOptions: {title: 'About'},
    screen: React.lazy(async () => import('./about')),
  },
  [Settings.settingsAccountTab]: {
    getOptions: {title: 'Your account'},
    screen: React.lazy(async () => import('./account')),
  },
  [Settings.settingsAdvancedTab]: {
    getOptions: C.isMobile ? {title: 'Advanced'} : undefined,
    screen: React.lazy(async () => import('./advanced')),
  },
  [Settings.settingsArchiveTab]: {
    getOptions: C.isMobile ? {title: 'Backup'} : undefined,
    screen: React.lazy(async () => import('./archive')),
  },
  [Settings.settingsChatTab]: {
    getOptions: {title: 'Chat'},
    screen: React.lazy(async () => import('./chat')),
  },
  [Settings.settingsCryptoTab]: {
    getOptions: C.isMobile ? {title: 'Crypto'} : {title: 'Crypto tools'},
    screen: React.lazy(async () => import('../crypto/sub-nav')),
  },
  [Settings.settingsDevicesTab]: devicesRoutes.devicesRoot,
  [Settings.settingsDisplayTab]: {
    getOptions: {title: 'Display'},
    screen: React.lazy(async () => import('./display')),
  },
  [Settings.settingsFeedbackTab]: feedback,
  [Settings.settingsFsTab]: {
    getOptions: C.isMobile ? {title: 'Files'} : undefined,
    screen: React.lazy(async () => import('./files')),
  },
  [Settings.settingsGitTab]: gitRoutes.gitRoot,
  [Settings.settingsInvitationsTab]: {screen: React.lazy(async () => import('./invites'))},
  [Settings.settingsNotificationsTab]: {
    getOptions: {title: 'Notifications'},
    screen: React.lazy(async () => import('./notifications')),
  },
  [Settings.settingsScreenprotectorTab]: {
    getOptions: {header: undefined, title: 'Screen Protector'},
    screen: React.lazy(async () => import('./screenprotector')),
  },
  [Settings.settingsWalletsTab]: {...walletsRoutes.walletsRoot},
  [Settings.settingsWhatsNewTab]: {
    getOptions: C.isMobile ? {title: 'Keybase FM 87.7'} : undefined,
    screen: React.lazy(async () => import('../whats-new/container')),
  },
  dbNukeConfirm: {
    getOptions: {title: 'Confirm'},
    screen: React.lazy(async () => import('./db-nuke.confirm')),
  },
  inviteSent: C.makeScreen(React.lazy(async () => import('./invite-generated'))),
  keybaseLinkError: {screen: React.lazy(async () => import('../deeplinks/error'))},
  makeIcons: {screen: React.lazy(async () => import('./make-icons.page'))},
  removeDevice: devicesRoutes.deviceRevoke,
}

const sharedNewModalRoutes = {
  [Settings.settingsLogOutTab]: {screen: React.lazy(async () => import('./logout'))},
  [Settings.settingsPasswordTab]: {screen: React.lazy(async () => import('./password'))},
  archiveModal: C.makeScreen(React.lazy(async () => import('./archive/modal'))),
  deleteConfirm: {screen: React.lazy(async () => import('./delete-confirm'))},
  disableCertPinningModal: {screen: React.lazy(async () => import('./disable-cert-pinning-modal'))},
  settingsAddEmail: {
    screen: React.lazy(async () => {
      const {Email} = await import('./account/add-modals')
      return {default: Email}
    }),
  },
  settingsAddPhone: {
    screen: React.lazy(async () => {
      const {Phone} = await import('./account/add-modals')
      return {default: Phone}
    }),
  },

  settingsDeleteAddress: C.makeScreen(React.lazy(async () => import('./account/confirm-delete'))),
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
      ? {getOptions: {title: 'More'}, screen: React.lazy(async () => import('./root-phone'))}
      : {getOptions: {title: 'Settings'}, screen: SettingsRootDesktop}
    : {getOptions: {title: 'Settings'}, screen: SettingsRootDesktop},
  ...sharedNewRoutes,
  [Settings.settingsContactsTab]: {
    getOptions: {header: undefined, title: 'Contacts'},
    screen: C.isMobile ? React.lazy(async () => import('./manage-contacts')) : () => <></>,
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
  settingsPushPrompt: {
    screen: C.isMobile ? React.lazy(async () => import('./notifications/push-prompt')) : () => <></>,
  },
}

export type RootParamListSettings = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
