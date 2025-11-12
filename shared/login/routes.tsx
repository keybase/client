import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import {InfoIcon} from '@/signup/common'
import proxySettingsModal from '../settings/proxy/page'
import {newRoutes as provisionRoutes} from '../provision/routes-sub'
import {sharedNewRoutes as settingsRoutes} from '../settings/routes'
import {newRoutes as signupRoutes} from './signup/routes'

const recoverPasswordStyles = Kb.Styles.styleSheetCreate(() => ({
  questionBox: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0),
}))

export const newRoutes = {
  feedback: settingsRoutes[C.Settings.settingsFeedbackTab],
  login: C.makeScreen(React.lazy(async () => import('.'))),
  recoverPasswordDeviceSelector: C.makeScreen(
    React.lazy(async () => import('./recover-password/device-selector/container'))
  ),
  recoverPasswordError: C.makeScreen(React.lazy(async () => import('./recover-password/error')), {
    getOptions: {
      gesturesEnabled: false,
      headerLeft: undefined, // no back button
      headerRightActions: () => (
        <Kb.Box2
          direction="horizontal"
          style={Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0)}
        >
          <InfoIcon />
        </Kb.Box2>
      ),
    },
  }),
  recoverPasswordExplainDevice: C.makeScreen(React.lazy(async () => import('./recover-password/explain-device')), {
    getOptions: () => ({
      headerBottomStyle: {height: undefined},
      headerLeft: undefined, // no back button
      headerRightActions: () => (
        <Kb.Box2
          direction="horizontal"
          style={Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0)}
        >
          <InfoIcon />
        </Kb.Box2>
      ),
    }),
  }),
  recoverPasswordPaperKey: C.makeScreen(React.lazy(async () => import('./recover-password/paper-key')), {
    getOptions: {
      headerBottomStyle: {height: undefined},
      headerLeft: undefined, // no back button
      headerRightActions: () => (
        <Kb.Box2
          direction="horizontal"
          style={Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0)}
        >
          <InfoIcon />
        </Kb.Box2>
      ),
    },
  }),
  recoverPasswordPromptResetAccount: C.makeScreen(
    React.lazy(async () => import('./recover-password/prompt-reset-account')),
    {
      getOptions: {
        headerBottomStyle: {height: undefined},
        headerLeft: undefined, // no back button
        headerRightActions: () => (
          <Kb.Box2 direction="horizontal" style={recoverPasswordStyles.questionBox}>
            <InfoIcon />
          </Kb.Box2>
        ),
      },
    }
  ),
  recoverPasswordPromptResetPassword: C.makeScreen(
    React.lazy(async () => import('./recover-password/prompt-reset-password')),
    {
      getOptions: {
        headerBottomStyle: {height: undefined},
        headerLeft: undefined, // no back button
        headerRightActions: () => (
          <Kb.Box2 direction="horizontal" style={recoverPasswordStyles.questionBox}>
            <InfoIcon />
          </Kb.Box2>
        ),
      },
    }
  ),
  resetConfirm: C.makeScreen(React.lazy(async () => import('./reset/confirm')), {
    getOptions: {gesturesEnabled: false},
  }),
  resetEnterPassword: C.makeScreen(React.lazy(async () => import('./reset/password-enter'))),
  resetKnowPassword: C.makeScreen(React.lazy(async () => import('./reset/password-known'))),
  resetWaiting: C.makeScreen(React.lazy(async () => import('./reset/waiting'))),
  ...provisionRoutes,
  ...signupRoutes,
}
export const newModalRoutes = {
  proxySettingsModal,
  recoverPasswordErrorModal: C.makeScreen(React.lazy(async () => import('./recover-password/error-modal')), {
    getOptions: {gesturesEnabled: false},
  }),
  recoverPasswordSetPassword: C.makeScreen(React.lazy(async () => import('./recover-password/password')), {
    getOptions: {gesturesEnabled: false},
  }),
}

export type RootParamListLogin = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
