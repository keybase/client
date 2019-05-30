import * as Constants from '../constants/wallets'

export const newModalRoutes = {
  [Constants.chooseAssetFormRouteKey]: {
    getScreen: () => require('./send-form/choose-asset/container').default,
    upgraded: true,
  },
  [Constants.confirmFormRouteKey]: {
    getScreen: () => require('./confirm-form/container').default,
    upgraded: true,
  },
  qrScan: {getScreen: () => require('./qr-scan/container').default, upgraded: true},
  sendReceiveForm: {getScreen: () => require('./send-form/container').default, upgraded: true},
}
