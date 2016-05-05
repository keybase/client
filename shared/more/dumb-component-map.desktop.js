import CommonMap from '../common-adapters/dumb.desktop'
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
import type {DumbComponentMap} from './dumb'

const map : DumbComponentMap = {
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
  ...FoldersMap
}

export default map
