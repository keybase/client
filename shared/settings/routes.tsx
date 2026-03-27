import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {newRoutes as devicesRoutes} from '../devices/routes'
import {newRoutes as gitRoutes} from '../git/routes'
import {newRoutes as walletsRoutes} from '../wallets/routes'
import * as Settings from '@/constants/settings'
import {usePushState} from '@/stores/push'
import {usePWState} from '@/stores/settings-password'
import {useSettingsState} from '@/stores/settings'
import {e164ToDisplay} from '@/util/phone-numbers'
import {useRoute} from '@react-navigation/native'
import type {RootRouteProps} from '@/router-v2/route-params'

const PushPromptSkipButton = () => {
  const rejectPermissions = usePushState(s => s.dispatch.rejectPermissions)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  return (
    <Kb.ClickableBox
      onClick={() => {
        rejectPermissions()
        clearModals()
      }}
    >
      <Kb.Text type="BodyBig" negative={true}>
        Skip
      </Kb.Text>
    </Kb.ClickableBox>
  )
}

const PasswordHeaderTitle = () => {
  const hasRandomPW = usePWState(s => !!s.randomPW)
  return <Kb.Text type="BodyBig">{hasRandomPW ? 'Set a password' : 'Change password'}</Kb.Text>
}

const CheckPassphraseCancelButton = () => {
  const resetCheckPassword = useSettingsState(s => s.dispatch.resetCheckPassword)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  return (
    <Kb.Text
      type="BodyBigLink"
      onClick={() => {
        resetCheckPassword()
        navigateUp()
      }}
    >
      Cancel
    </Kb.Text>
  )
}

const VerifyPhoneHeaderTitle = () => {
  const {params} = useRoute<RootRouteProps<'settingsVerifyPhone'>>()
  const displayPhone = e164ToDisplay(params.phoneNumber)
  return (
    <Kb.Text type="BodySmall" negative={true} center={true}>
      {displayPhone || 'Unknown number'}
    </Kb.Text>
  )
}

const VerifyPhoneHeaderLeft = () => {
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  return (
    <Kb.BackButton
      onClick={() => {
        clearModals()
      }}
      iconColor={Kb.Styles.globalColors.white}
    />
  )
}

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
  [Settings.settingsNotificationsTab]: {
    getOptions: {title: 'Notifications'},
    screen: React.lazy(async () => import('./notifications')),
  },
  [Settings.settingsScreenprotectorTab]: {
    getOptions: {header: undefined, title: 'Screen Protector'},
    screen: React.lazy(async () => import('./screenprotector')),
  },
  [Settings.settingsWalletsTab]: {...walletsRoutes.walletsRoot},
  dbNukeConfirm: {
    getOptions: {title: 'Confirm'},
    screen: React.lazy(async () => import('./db-nuke.confirm')),
  },
  keybaseLinkError: {screen: React.lazy(async () => import('../deeplinks/error'))},
  makeIcons: {screen: React.lazy(async () => import('./make-icons.page'))},
}

export const settingsDesktopTabRoutes = {
  [Settings.settingsAboutTab]: sharedNewRoutes[Settings.settingsAboutTab],
  [Settings.settingsAccountTab]: sharedNewRoutes[Settings.settingsAccountTab],
  [Settings.settingsAdvancedTab]: sharedNewRoutes[Settings.settingsAdvancedTab],
  [Settings.settingsArchiveTab]: sharedNewRoutes[Settings.settingsArchiveTab],
  [Settings.settingsChatTab]: sharedNewRoutes[Settings.settingsChatTab],
  [Settings.settingsCryptoTab]: sharedNewRoutes[Settings.settingsCryptoTab],
  [Settings.settingsDevicesTab]: sharedNewRoutes[Settings.settingsDevicesTab],
  [Settings.settingsDisplayTab]: sharedNewRoutes[Settings.settingsDisplayTab],
  [Settings.settingsFeedbackTab]: sharedNewRoutes[Settings.settingsFeedbackTab],
  [Settings.settingsFsTab]: sharedNewRoutes[Settings.settingsFsTab],
  [Settings.settingsGitTab]: sharedNewRoutes[Settings.settingsGitTab],
  [Settings.settingsNotificationsTab]: sharedNewRoutes[Settings.settingsNotificationsTab],
  [Settings.settingsScreenprotectorTab]: sharedNewRoutes[Settings.settingsScreenprotectorTab],
  [Settings.settingsWalletsTab]: sharedNewRoutes[Settings.settingsWalletsTab],
}

const sharedNewModalRoutes = {
  [Settings.settingsLogOutTab]: C.makeScreen(React.lazy(async () => import('./logout')), {
    getOptions: C.isMobile ? undefined : {title: 'Do you know your password?'},
  }),
  [Settings.settingsPasswordTab]: C.makeScreen(React.lazy(async () => import('./password')), {
    getOptions: {headerTitle: () => <PasswordHeaderTitle />},
  }),
  archiveModal: C.makeScreen(React.lazy(async () => import('./archive/modal')), {
    getOptions: {title: 'Backup'},
  }),
  deleteConfirm: {screen: React.lazy(async () => import('./delete-confirm'))},
  disableCertPinningModal: {screen: React.lazy(async () => import('./disable-cert-pinning-modal'))},
  settingsAddEmail: C.makeScreen(
    React.lazy(async () => {
      const {Email} = await import('./account/add-modals')
      return {default: Email}
    }),
    {getOptions: C.isMobile ? {title: 'Add email address'} : {title: 'Add an email address'}}
  ),
  settingsAddPhone: C.makeScreen(
    React.lazy(async () => {
      const {Phone} = await import('./account/add-modals')
      return {default: Phone}
    }),
    {getOptions: C.isMobile ? {title: 'Add phone number'} : {title: 'Add a phone number'}}
  ),
  settingsDeleteAddress: C.makeScreen(React.lazy(async () => import('./account/confirm-delete'))),
  settingsVerifyPhone: C.makeScreen(
    React.lazy(async () => {
      const {VerifyPhone} = await import('./account/add-modals')
      return {default: VerifyPhone}
    }),
    {
      getOptions: {
        headerLeft: Kb.Styles.isMobile ? () => <VerifyPhoneHeaderLeft /> : undefined,
        headerStyle: {backgroundColor: Kb.Styles.globalColors.blue},
        headerTitle: () => <VerifyPhoneHeaderTitle />,
      },
    }
  ),
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
    getOptions: ({route}) => ({
      header: undefined,
      title: route.params.title,
    }),
  }),
}

export const newModalRoutes = {
  ...sharedNewModalRoutes,
  checkPassphraseBeforeDeleteAccount: C.makeScreen(
    React.lazy(async () => import('./delete-confirm/check-passphrase')),
    {getOptions: {headerLeft: () => <CheckPassphraseCancelButton />}}
  ),
  modalFeedback: feedback,
  settingsContactsJoined: C.makeScreen(React.lazy(async () => import('./contacts-joined'))),
  settingsPushPrompt: C.isMobile
    ? C.makeScreen(React.lazy(async () => import('./notifications/push-prompt')), {
        getOptions: {
          headerLeft: () => null,
          headerRight: () => <PushPromptSkipButton />,
          headerStyle: {backgroundColor: Kb.Styles.globalColors.blue},
          headerTitle: () => (
            <Kb.Text type="Header" lineClamp={1} center={true} negative={true}>
              Allow notifications
            </Kb.Text>
          ),
        },
      })
    : {screen: () => <></>},
}
