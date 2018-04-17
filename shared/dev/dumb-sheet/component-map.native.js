// @flow
import CommonMap from '../../common-adapters/dumb'
import RegisterMap from '../../login/register/dumb'
import SignupMap from '../../login/signup/dumb'
import QRMap from '../../login/register/code-page/qr/dumb.native'
import FoldersMap from '../../folders/dumb'
import FoldersConfirmMap from '../../folders/confirm/dumb'
import LoginMap from '../../login/dumb'
import ProfileMap from '../../profile/dumb'
import SearchMap from '../../search/dumb'
import Settings from '../../settings/dumb.native'

const map: any = {
  ...CommonMap,
  ...QRMap,
  ...RegisterMap,
  ...SignupMap,
  ...FoldersMap,
  ...FoldersConfirmMap,
  ...ProfileMap,
  ...SearchMap,
  ...Settings,
  ...LoginMap,
}

export default map
