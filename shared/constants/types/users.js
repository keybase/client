// @flow strict
// Info about users we get from various places. Fullname, broken, etc
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'

export type _UserInfo = {
  broken: boolean,
  fullname: string,
}
type UserInfo = I.RecordOf<_UserInfo>

export type _State = {
  infoMap: I.Map<string, UserInfo>,
}

export type State = I.RecordOf<_State>
