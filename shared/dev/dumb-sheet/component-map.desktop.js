// @flow
import ChatMap from '../../chat/dumb'
import CommonMap from '../../common-adapters/dumb'
import DevicePageMap from '../../devices/device-page/dumb'
import DeviceRevokeMap from '../../devices/device-revoke/dumb'
import DevicesMap from '../../devices/dumb'
import EditProfileMap from '../../profile/edit-profile/dumb'
import FoldersConfirmMap from '../../folders/confirm/dumb'
import FoldersMap from '../../folders/dumb'
import LoginMap from '../../login/dumb'
import MenubarMap from '../../menubar/dumb.desktop'
import MessagesMap from '../../chat/conversation/messages/dumb'
import MessageNoticesMap from '../../chat/conversation/notices/dumb'
import PgpMap from '../../pgp/dumb.desktop'
import PinentryMap from '../../pinentry/dumb.desktop'
import ProfileMap from '../../profile/dumb'
import RegisterMap from '../../login/register/dumb'
import SearchMap from '../../search/dumb'
import SearchUserPaneMap from '../../search/user-pane/dumb'
import SettingsMap from '../../settings/dumb.desktop'
import SignupMap from '../../login/signup/dumb'
import TabBarMap from '../../tab-bar/dumb.desktop'
import TrackerMap from '../../tracker/dumb.desktop'
import UnlockFoldersMap from '../../unlock-folders/dumb'

const map: any = {
  ...ChatMap,
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
  ...MessageNoticesMap,
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
