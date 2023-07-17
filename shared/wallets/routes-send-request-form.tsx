/*
import * as Constants from '../constants/wallets'
import type ChooseAsset from './send-form/choose-asset/container'
import type PickAsset from './send-form/pick-asset'
import type ConfirmForm from './confirm-form/container'
import type QRScan from './qr-scan/container'
import type SendForm from './send-form/container'

export const newModalRoutes = {
  chooseAssetForm,
  confirmForm,
  pickAssetForm,
  qrScan,
  sendReceiveForm,
}

*/

import * as Constants from '../constants/wallets'
const Keep = {getScreen: () => require('./keep').default}

export const newModalRoutes = {
  [Constants.chooseAssetFormRouteKey]: Keep,
  [Constants.pickAssetFormRouteKey]: Keep,
  [Constants.confirmFormRouteKey]: Keep,
  qrScan: Keep,
  sendReceiveForm: Keep,
}
