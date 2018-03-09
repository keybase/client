// @flow
import CommonMap from '../../common-adapters/dumb'
import DevicePageMap from '../../devices/device-page/dumb'
import DeviceRevokeMap from '../../devices/device-revoke/dumb'
import DevicesMap from '../../devices/dumb'
import EditProfileMap from '../../profile/edit-profile/dumb'
import FoldersConfirmMap from '../../folders/confirm/dumb'
import LoginMap from '../../login/dumb'
import PinentryMap from '../../pinentry/dumb.desktop'
import ProfileMap from '../../profile/dumb'
import RegisterMap from '../../login/register/dumb'
import SearchMap from '../../search/dumb'
import SettingsMap from '../../settings/dumb.desktop'
import SignupMap from '../../login/signup/dumb'
import TabBarMap from '../../app/tab-bar/dumb.desktop'
import TrackerMap from '../../tracker/dumb.desktop'
import UnlockFoldersMap from '../../unlock-folders/dumb'

const map: any = {
  ...CommonMap,
  ...DevicePageMap,
  ...DeviceRevokeMap,
  ...DevicesMap,
  ...EditProfileMap,
  ...FoldersConfirmMap,
  ...LoginMap,
  ...PinentryMap,
  ...ProfileMap,
  ...RegisterMap,
  ...SearchMap,
  ...SettingsMap,
  ...SignupMap,
  ...TabBarMap,
  ...TrackerMap,
  ...UnlockFoldersMap,
}

export default map
