import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {HeaderBackButtonProps} from '@/common-adapters/header-hoc'
import {InfoIcon} from '@/signup/common'
import proxySettingsModal from '../settings/proxy/page'
import {newRoutes as provisionRoutes} from '../provision/routes-sub'
import {sharedNewRoutes as settingsRoutes} from '../settings/routes'
import {newRoutes as signupRoutes} from './signup/routes'

const Login = React.lazy(async () => import('.'))
const login = {
  screen: Login,
}

const RecoverPasswordDeviceSelector = React.lazy(async () => import('./recover-password/device-selector/container'))
const recoverPasswordDeviceSelector = {
  screen: RecoverPasswordDeviceSelector,
}

const RecoverPasswordError = React.lazy(async () => import('./recover-password/error'))
const recoverPasswordError = {
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
  screen: RecoverPasswordError,
}

const RecoverPasswordErrorModal = React.lazy(async () => import('./recover-password/error-modal'))
const recoverPasswordErrorModal = {
  getOptions: {gesturesEnabled: false},
  screen: RecoverPasswordErrorModal,
}

const RecoverPasswordExplainDevice = React.lazy(async () => import('./recover-password/explain-device'))
const recoverPasswordExplainDevice = {
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
  screen: RecoverPasswordExplainDevice,
}

const RecoverPasswordPaperKey = React.lazy(async () => import('./recover-password/paper-key'))
const recoverPasswordPaperKey = {
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
  screen: RecoverPasswordPaperKey,
}

const recoverPasswordStyles = Kb.Styles.styleSheetCreate(() => ({
  questionBox: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0),
}))

const RecoverPasswordPromptResetAccount = React.lazy(async () => import('./recover-password/prompt-reset-account'))
const recoverPasswordPromptResetAccount = {
  getOptions: {
    headerBottomStyle: {height: undefined},
    headerLeft: undefined, // no back button
    headerRightActions: () => (
      <Kb.Box2 direction="horizontal" style={recoverPasswordStyles.questionBox}>
        <InfoIcon />
      </Kb.Box2>
    ),
  },
  screen: RecoverPasswordPromptResetAccount,
}

const RecoverPasswordPromptResetPassword = React.lazy(async () => import('./recover-password/prompt-reset-password'))
const recoverPasswordPromptResetPassword = {
  getOptions: {
    headerBottomStyle: {height: undefined},
    headerLeft: undefined, // no back button
    headerRightActions: () => (
      <Kb.Box2 direction="horizontal" style={recoverPasswordStyles.questionBox}>
        <InfoIcon />
      </Kb.Box2>
    ),
  },
  screen: RecoverPasswordPromptResetPassword,
}

const RecoverPasswordSetPassword = React.lazy(async () => import('./recover-password/password'))
const recoverPasswordSetPassword = {
  getOptions: {gesturesEnabled: false},
  screen: RecoverPasswordSetPassword,
}

const ResetConfirm = React.lazy(async () => import('./reset/confirm'))
const resetConfirm = {
  getOptions: {gesturesEnabled: false},
  screen: ResetConfirm,
}

const ResetEnterPassword = React.lazy(async () => import('./reset/password-enter'))
const resetEnterPassword = {
  screen: ResetEnterPassword,
}

const ResetKnowPassword = React.lazy(async () => import('./reset/password-known'))
const resetKnowPassword = {
  screen: ResetKnowPassword,
}

const ResetWaiting = React.lazy(async () => import('./reset/waiting'))
const resetWaiting = {
  screen: function ResetWaitingScreen(p: C.ViewPropsToPageProps<typeof ResetWaiting>) {
    return <ResetWaiting {...p.route.params} />
  },
}

export const newRoutes = {
  feedback: settingsRoutes[C.Settings.settingsFeedbackTab],
  login,
  recoverPasswordDeviceSelector,
  recoverPasswordError,
  recoverPasswordExplainDevice,
  recoverPasswordPaperKey,
  recoverPasswordPromptResetAccount,
  recoverPasswordPromptResetPassword,
  resetConfirm,
  resetEnterPassword,
  resetKnowPassword,
  resetWaiting,
  ...provisionRoutes,
  ...signupRoutes,
}
export const newModalRoutes = {
  proxySettingsModal,
  recoverPasswordErrorModal,
  recoverPasswordSetPassword,
}

export type RootParamListLogin = C.PagesToParams<typeof newRoutes & typeof newModalRoutes>
