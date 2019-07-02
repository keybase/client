// Info about users we get from various places. Fullname, broken, etc
import * as I from 'immutable'

export enum UsernameType {
  Username = 'username',
  Email = 'email',
  Phone = 'phone',
}

export type _UserInfo = {
  broken: boolean
  fullname: string
  typ?: UsernameType
}
type UserInfo = I.RecordOf<_UserInfo>

export type InfoMap = I.Map<string, UserInfo>

export type _State = {
  infoMap: InfoMap
}

export type State = I.RecordOf<_State>
