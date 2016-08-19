// @flow
import CommonMap from '../common-adapters/dumb.desktop'
import RegisterMap from '../login/register/dumb'
import DevicesMap from '../devices/dumb'
import LoginMap from '../login/dumb.desktop'
import SignupMap from '../login/signup/dumb.desktop'
import MenubarMap from '../menubar/dumb.desktop'
import TrackerMap from '../tracker/dumb.desktop'
import PinentryMap from '../pinentry/dumb.desktop'
import DevicePageMap from '../devices/device-page/dumb.desktop'
import DeviceRevokeMap from '../devices/device-revoke/dumb.desktop'
import TabBarMap from '../tab-bar/dumb.desktop'
import FoldersMap from '../folders/dumb'
import FoldersConfirmMap from '../folders/confirm/dumb'
import ProfileMap from '../profile/dumb'
import EditProfileMap from '../profile/edit-profile/dumb'
import SearchMap from '../search/dumb'
import SearchUserPaneMap from '../search/user-pane/dumb'
import UnlockFoldersMap from '../unlock-folders/dumb'

const map: any = {
  ...CommonMap,
  ...DevicesMap,
  ...LoginMap,
  ...SignupMap,
  ...MenubarMap,
  ...TrackerMap,
  ...PinentryMap,
  ...DevicePageMap,
  ...DeviceRevokeMap,
  ...TabBarMap,
  ...FoldersMap,
  ...FoldersConfirmMap,
  ...ProfileMap,
  ...EditProfileMap,
  ...SearchMap,
  ...SearchUserPaneMap,
  ...UnlockFoldersMap,
  ...RegisterMap,
}

export default map
