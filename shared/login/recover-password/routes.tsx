import DeviceSelector from './device-selector/container'
import ExplainDevice from './explain-device/container'

export const newRoutes = {
  recoverPasswordDeviceSelector: {
    getScreen: (): typeof DeviceSelector => require('./device-selector/container').default,
  },
  recoverPasswordExplainDevice: {
    getScreen: (): typeof ExplainDevice => require('./explain-device/container').default,
  },
}
