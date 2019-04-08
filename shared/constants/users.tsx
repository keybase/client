import * as I from 'immutable'
import * as Types from './types/users'
import {TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string): string | null =>
  state.users.infoMap.getIn([username, 'fullname'], null)

export const getIsBroken = (infoMap: Types.InfoMap, username: string): boolean | null =>
  infoMap.getIn([username, 'broken'], null)

export const makeUserInfo: I.Record.Factory<Types._UserInfo> = I.Record({
  broken: false,
  fullname: '',
})

export const makeState: I.Record.Factory<Types._State> = I.Record({
  infoMap: I.Map(),
} as Types._State)
