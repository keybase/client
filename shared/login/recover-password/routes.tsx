import DeviceSelector from './device-selector/container'
import ExplainDevice from './explain-device/container'
import Error, {ConnectedErrorModal} from './error/container'
import PaperKey from './paper-key/container'
import {PromptResetAccount, PromptResetPassword} from './prompt-reset'
import Password from './password'

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
