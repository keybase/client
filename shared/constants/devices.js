// @flow
import * as I from 'immutable'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as Types from './types/devices'
import * as WaitingConstants from './waiting'
import {isMobile} from './platform'
import type {TypedState} from './reducer'

const makeDeviceDetail: I.RecordFactory<Types._DeviceDetail> = I.Record({
  created: 0,
  currentDevice: false,
  deviceID: Types.stringToDeviceID(''),
  lastUsed: 0,
  name: '',
  provisionedAt: 0,
  provisionerName: null,
  revokedAt: null,
  revokedByName: null,
  type: Types.stringToDeviceType('desktop'),
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  idToDetail: I.Map(),
  idToEndangeredTLFs: I.Map(),
})

const devicesTabLocation = isMobile ? [Tabs.settingsTab, SettingsConstants.devicesTab] : [Tabs.devicesTab]
const waitingKey = 'devices:devicesPage'

const isWaiting = (state: TypedState) => WaitingConstants.anyWaiting(state, waitingKey)

export {devicesTabLocation, makeState, makeDeviceDetail, waitingKey, isWaiting}
