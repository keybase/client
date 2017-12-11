// @flow
import * as I from 'immutable'

export type DeviceType = 'mobile' | 'desktop' | 'backup'
export type _DeviceDetail = {
  created: number,
  currentDevice: boolean,
  deviceID: string,
  lastUsed: number,
  name: string,
  provisionedAt: ?number,
  provisionerName: ?string,
  revokedAt: ?number,
  revokedByName: ?string,
  type: DeviceType,
}
export type DeviceDetail = I.RecordOf<_DeviceDetail>
export type _State = {
  deviceIDs: I.List<string>,
  waitingForServer: boolean,
}
export type State = I.RecordOf<_State>
