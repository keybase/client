import type DeviceSelector from './device-selector/container'
import type ExplainDevice from './explain-device/container'
import {type ConnectedErrorModal} from './error/container'
import type Error from './error/container'
import type PaperKey from './paper-key/container'
import type {PromptResetAccount, PromptResetPassword} from './prompt-reset'
import type Password from './password'

export const newRoutes = {
  recoverPasswordDeviceSelector: {
    getScreen: (): typeof DeviceSelector => require('./device-selector/container').default,
  },
  recoverPasswordError: {
    getScreen: (): typeof Error => require('./error/container').default,
  },
  recoverPasswordExplainDevice: {
    getScreen: (): typeof ExplainDevice => require('./explain-device/container').default,
  },
  recoverPasswordPaperKey: {
    getScreen: (): typeof PaperKey => require('./paper-key/container').default,
  },
  recoverPasswordPromptResetAccount: {
    getScreen: (): typeof PromptResetAccount => require('./prompt-reset').PromptResetAccount,
  },
  recoverPasswordPromptResetPassword: {
    getScreen: (): typeof PromptResetPassword => require('./prompt-reset').PromptResetPassword,
  },
}

export const newModalRoutes = {
  recoverPasswordErrorModal: {
    getScreen: (): typeof ConnectedErrorModal => require('./error/container').ConnectedErrorModal,
  },
  recoverPasswordSetPassword: {
    getScreen: (): typeof Password => require('./password').default,
  },
}
