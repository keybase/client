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
  idToDetail: I.Map<string, DeviceDetail>,
  idToEndangeredTLFs: I.Map<string, I.Set<string>>,
}
export type State = I.RecordOf<_State>
