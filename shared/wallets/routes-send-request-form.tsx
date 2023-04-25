import * as Constants from '../constants/wallets'
import type ChooseAsset from './send-form/choose-asset/container'
import type PickAsset from './send-form/pick-asset'
import type ConfirmForm from './confirm-form/container'
import type QRScan from './qr-scan/container'
import type SendForm from './send-form'

export const newModalRoutes = {
  [Constants.chooseAssetFormRouteKey]: {
    getScreen: (): typeof ChooseAsset => require('./send-form/choose-asset/container').default,
  },
  [Constants.pickAssetFormRouteKey]: {
    getScreen: (): typeof PickAsset => require('./send-form/pick-asset').default,
  },
  [Constants.confirmFormRouteKey]: {
    getScreen: (): typeof ConfirmForm => require('./confirm-form/container').default,
  },
  qrScan: {getScreen: (): typeof QRScan => require('./qr-scan/container').default},
  sendReceiveForm: {
    getOptions: () => require('./send-form').options,
    getScreen: (): typeof SendForm => require('./send-form').default,
  },
}
