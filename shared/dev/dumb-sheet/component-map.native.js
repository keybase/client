// @flow
import {pick} from 'lodash'
import ChatMap from '../../chat/dumb'
import CommonMap from '../../common-adapters/dumb'
import RegisterMap from '../../login/register/dumb'
import SignupMap from '../../login/signup/dumb.native'
import DevicesMap from '../../devices/dumb'
import DeviceRevokeMap from '../../devices/device-revoke/dumb'
import QRMap from '../../login/register/code-page/qr/dumb.native'
import DevicePageMap from '../../devices/device-page/dumb.native'
import FoldersMap from '../../folders/dumb'
import FoldersConfirmMap from '../../folders/confirm/dumb'
import MessagesMap from '../../chat/conversation/messages/dumb'
import ProfileMap from '../../profile/dumb'
import SearchMap from '../../search/dumb'
import Tracker from '../../tracker/dumb.native'

const map: any = {
  ...ChatMap,
  ...CommonMap,
  ...QRMap,
  ...RegisterMap,
  ...SignupMap,
  ...DevicesMap,
  ...DeviceRevokeMap,
  ...DevicePageMap,
  ...FoldersMap,
  ...FoldersConfirmMap,
  ...pick(MessagesMap, 'Text Message', 'Stacked Text Message'),
  ...ProfileMap,
  ...SearchMap,
  ...Tracker,
}

export default map
