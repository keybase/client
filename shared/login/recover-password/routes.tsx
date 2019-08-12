import DeviceSelector from './device-selector/container'
import ExplainDevice from './explain-device/container'
import PromptReset from './prompt-reset/container'

export const newRoutes = {
  recoverPasswordDeviceSelector: {
    getScreen: (): typeof DeviceSelector => require('./device-selector/container').default,
  },
  recoverPasswordExplainDevice: {
    getScreen: (): typeof ExplainDevice => require('./explain-device/container').default,
  },
  recoverPasswordPromptReset: {
    getScreen: (): typeof PromptReset => require('./prompt-reset/container').default,
  },
}
