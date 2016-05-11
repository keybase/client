import CommonMap from '../common-adapters/dumb.native'
import RegisterMap from '../login/register/dumb'
import SignupMap from '../login/signup/dumb.native'
import DevicesMap from '../devices/dumb'
import DeviceRevokeMap from '../devices/device-revoke/dumb.native'
import QRMap from '../login/register/code-page/qr/dumb.native'
import DevicePageMap from '../devices/device-page/dumb.native'
import FoldersMap from '../folders/dumb'
import type {DumbComponentMap} from './dumb'

const map: DumbComponentMap = {
  ...CommonMap,
  ...QRMap,
  ...RegisterMap,
  ...SignupMap,
  ...DevicesMap,
  ...DeviceRevokeMap,
  ...DevicePageMap,
  ...FoldersMap
}

export default map
