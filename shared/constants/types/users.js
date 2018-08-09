// @flow
// Info about users we get from various places. Fullname, broken, etc
import * as I from 'immutable'

export type _UserInfo = {
  broken: boolean,
  fullname: string,
}
export type UserInfo = I.RecordOf<_UserInfo>

export type _State = {
  infoMap: I.Map<string, UserInfo>,
}

export type State = I.RecordOf<_State>
