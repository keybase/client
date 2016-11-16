// @flow
import CommonMap from '../../common-adapters/dumb'
import DevicePageMap from '../../devices/device-page/dumb.desktop'
import DeviceRevokeMap from '../../devices/device-revoke/dumb'
import DevicesMap from '../../devices/dumb'
import EditProfileMap from '../../profile/edit-profile/dumb'
import FoldersConfirmMap from '../../folders/confirm/dumb'
import FoldersMap from '../../folders/dumb'
import LoginMap from '../../login/dumb.desktop'
import MenubarMap from '../../menubar/dumb.desktop'
import MessagesMap from '../../chat/conversation/messages/dumb'
import PgpMap from '../../pgp/dumb.desktop'
import PinentryMap from '../../pinentry/dumb.desktop'
import ProfileMap from '../../profile/dumb'
import RegisterMap from '../../login/register/dumb'
import SearchMap from '../../search/dumb'
import SearchUserPaneMap from '../../search/user-pane/dumb'
import SettingsMap from '../../settings/dumb'
import SignupMap from '../../login/signup/dumb.desktop'
import TabBarMap from '../../tab-bar/dumb.desktop'
import TrackerMap from '../../tracker/dumb.desktop'
import UnlockFoldersMap from '../../unlock-folders/dumb'

const map: any = {
  ...CommonMap,
  ...DevicePageMap,
  ...DeviceRevokeMap,
  ...DevicesMap,
  ...EditProfileMap,
  ...FoldersConfirmMap,
  ...FoldersMap,
  ...LoginMap,
  ...MenubarMap,
  ...MessagesMap,
  ...PgpMap,
  ...PinentryMap,
  ...ProfileMap,
  ...RegisterMap,
  ...SearchMap,
  ...SearchUserPaneMap,
  ...SettingsMap,
  ...SignupMap,
  ...TabBarMap,
  ...TrackerMap,
  ...UnlockFoldersMap,
}

export default map
