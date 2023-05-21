import * as SettingsConstants from '../constants/settings'
import login from './page'
import proxySettingsModal from '../settings/proxy/page'
import recoverPasswordDeviceSelector from './recover-password/device-selector/page'
import recoverPasswordError from './recover-password/error.page'
import recoverPasswordErrorModal from './recover-password/error-modal.page'
import recoverPasswordExplainDevice from './recover-password/explain-device.page'
import recoverPasswordPaperKey from './recover-password/paper-key.page'
import recoverPasswordPromptResetAccount from './recover-password/prompt-reset-account.page'
import recoverPasswordPromptResetPassword from './recover-password/prompt-reset-password.page'
import recoverPasswordSetPassword from './recover-password/password.page'
import resetConfirm from './reset/confirm.page'
import resetEnterPassword from './reset/password-enter.page'
import resetKnowPassword from './reset/password-known.page'
import resetWaiting from './reset/waiting.page'
import type * as Container from '../util/container'
import {newRoutes as provisionRoutes} from '../provision/routes-sub'
import {sharedNewRoutes as settingsRoutes} from '../settings/routes.shared'
import {newRoutes as signupRoutes} from './signup/routes'

export const newRoutes = {
  feedback: settingsRoutes[SettingsConstants.feedbackTab],
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

export type RootParamListLogin = Container.PagesToParams<typeof newRoutes & typeof newModalRoutes>
