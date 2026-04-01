import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {InfoIcon} from '@/signup/common'
import {newRoutes as provisionRoutes} from '../provision/routes-sub'
import {sharedNewRoutes as settingsRoutes} from '../settings/routes'
import {newRoutes as signupRoutes} from './signup/routes'
import {settingsFeedbackTab} from '@/constants/settings'
import {defineRouteMap, withRouteParams} from '@/constants/types/router'
import type {Props as FeedbackRouteParams} from '../settings/feedback/container'

const recoverPasswordStyles = Kb.Styles.styleSheetCreate(() => ({
  questionBox: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0),
}))

const headerRightActions = () => (
  <Kb.Box2 direction="horizontal" style={recoverPasswordStyles.questionBox}>
    <InfoIcon />
  </Kb.Box2>
)

const recoverPasswordGetOptions = {
  headerBottomStyle: {height: undefined},
  headerRightActions,
  title: 'Recover password',
}

export const newRoutes = defineRouteMap({
  feedback: withRouteParams<FeedbackRouteParams>(settingsRoutes[settingsFeedbackTab]),
  login: {getOptions: {headerShown: false}, screen: React.lazy(async () => import('.'))},
  recoverPasswordDeviceSelector: {
    getOptions: {title: 'Recover password'},
    screen: React.lazy(async () => import('./recover-password/device-selector')),
  },
  recoverPasswordError: {
    getOptions: {
      gestureEnabled: false,
      headerRightActions,
      title: 'Recover password',
    },
    screen: React.lazy(async () => import('./recover-password/error')),
  },
  recoverPasswordExplainDevice: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/explain-device')),
  },
  recoverPasswordPaperKey: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/paper-key')),
  },
  recoverPasswordPromptResetAccount: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/prompt-reset-account')),
  },
  recoverPasswordPromptResetPassword: {
    getOptions: recoverPasswordGetOptions,
    screen: React.lazy(async () => import('./recover-password/prompt-reset-password')),
  },
  resetConfirm: {
    getOptions: {gestureEnabled: false, title: 'Account reset'},
    screen: React.lazy(async () => import('./reset/confirm')),
  },
  resetEnterPassword: {
    getOptions: {title: 'Account reset'},
    screen: React.lazy(async () => import('./reset/password-enter')),
  },
  resetKnowPassword: {
    getOptions: {title: 'Account reset'},
    screen: React.lazy(async () => import('./reset/password-known')),
  },
  resetWaiting: C.makeScreen(React.lazy(async () => import('./reset/waiting')), {
    getOptions: {title: 'Account reset'},
  }),
  ...provisionRoutes,
  ...signupRoutes,
})
export const newModalRoutes = defineRouteMap({
  proxySettingsModal: {
    getOptions: {title: 'Proxy settings'},
    screen: React.lazy(async () => import('../settings/proxy')),
  },
  recoverPasswordErrorModal: {
    getOptions: {gestureEnabled: false, title: 'Error'},
    screen: React.lazy(async () => import('./recover-password/error-modal')),
  },
  recoverPasswordSetPassword: {
    getOptions: {gestureEnabled: false, title: 'Set password'},
    screen: React.lazy(async () => import('./recover-password/password')),
  },
})
