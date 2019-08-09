import * as I from 'immutable'
import * as Types from './types/users'
import {TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string): string | null =>
  state.users.infoMap.getIn([username, 'fullname'], null)

export const getIsBroken = (infoMap: Types.InfoMap, username: string): boolean | null =>
  infoMap.getIn([username, 'broken'], null)

export const makeUserInfo = I.Record<Types._UserInfo>({
  broken: false,
  fullname: '',
})
export const emptyUserInfo = makeUserInfo()

export const makeState = I.Record<Types._State>({
  infoMap: I.Map(),
})
