// @flow
import CommonMap from '../../common-adapters/dumb'
import RegisterMap from '../../login/register/dumb'
import SignupMap from '../../login/signup/dumb'
import DevicesMap from '../../devices/dumb'
import DeviceRevokeMap from '../../devices/device-revoke/dumb'
import QRMap from '../../login/register/code-page/qr/dumb.native'
import DevicePageMap from '../../devices/device-page/dumb'
import FoldersMap from '../../folders/dumb'
import FoldersConfirmMap from '../../folders/confirm/dumb'
import LoginMap from '../../login/dumb'
import ProfileMap from '../../profile/dumb'
import SearchMap from '../../search/dumb'
import Tracker from '../../tracker/dumb.native'
import Settings from '../../settings/dumb.native'

const map: any = {
  ...CommonMap,
  ...QRMap,
  ...RegisterMap,
  ...SignupMap,
  ...DevicesMap,
  ...DeviceRevokeMap,
  ...DevicePageMap,
  ...FoldersMap,
  ...FoldersConfirmMap,
  ...ProfileMap,
  ...SearchMap,
  ...Settings,
  ...Tracker,
  ...LoginMap,
}

export default map
