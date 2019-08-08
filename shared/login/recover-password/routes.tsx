import DeviceSelector from './device-selector/container'

export const newRoutes = {
  recoverPasswordDeviceSelector: {getScreen: (): typeof DeviceSelector => require('./device-selector/container').default},
}
