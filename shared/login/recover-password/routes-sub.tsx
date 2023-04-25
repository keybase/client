import type DeviceSelector from './device-selector/container'
import type ExplainDevice from './explain-device'
import {type ConnectedErrorModal} from './error'
import type Error from './error'
import type PaperKey from './paper-key'
import type {PromptResetAccount, PromptResetPassword} from './prompt-reset'
import type Password from './password'

export const newRoutes = {
  recoverPasswordDeviceSelector: {
    getScreen: (): typeof DeviceSelector => require('./device-selector/container').default,
  },
  recoverPasswordError: {
    getOptions: () => require('./error').options,
    getScreen: (): typeof Error => require('./error').default,
  },
  recoverPasswordExplainDevice: {
    getOptions: () => require('./explain-device').options,
    getScreen: (): typeof ExplainDevice => require('./explain-device').default,
  },
  recoverPasswordPaperKey: {
    getOptions: () => require('./paper-key').options,
    getScreen: (): typeof PaperKey => require('./paper-key').default,
  },
  recoverPasswordPromptResetAccount: {
    getOptions: () => require('./prompt-reset').options,
    getScreen: (): typeof PromptResetAccount => require('./prompt-reset').PromptResetAccount,
  },
  recoverPasswordPromptResetPassword: {
    getOptions: () => require('./prompt-reset').options,
    getScreen: (): typeof PromptResetPassword => require('./prompt-reset').PromptResetPassword,
  },
}

export const newModalRoutes = {
  recoverPasswordErrorModal: {
    getOptions: () => require('./error').modalOptions,
    getScreen: (): typeof ConnectedErrorModal => require('./error').ConnectedErrorModal,
  },
  recoverPasswordSetPassword: {
    getOptions: () => require('./password').options,
    getScreen: (): typeof Password => require('./password').default,
  },
}
