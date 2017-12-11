// @flow
import * as I from 'immutable'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/devices'
import {isMobile} from './platform'

const makeDeviceDetail: I.RecordFactory<Types._DeviceDetail> = I.Record({
  created: 0,
  currentDevice: false,
  deviceID: '',
  lastUsed: 0,
  name: '',
  provisionedAt: 0,
  provisionerName: null,
  revokedAt: null,
  revokedByName: null,
  type: 'desktop',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  deviceIDs: I.List(),
  waitingForServer: false,
})

// Converts a string to the DeviceType enum, logging an error if it doesn't match
function toDeviceType(s: string): Types.DeviceType {
  switch (s) {
    case 'mobile':
    case 'desktop':
    case 'backup':
      return s
    default:
      console.log('Unknown Device Type %s. Defaulting to `desktop`', s)
      return 'desktop'
  }
}

const devicesTabLocation = isMobile ? [Tabs.settingsTab, SettingsConstants.devicesTab] : [Tabs.devicesTab]

export {devicesTabLocation, makeState, makeDeviceDetail, toDeviceType}
