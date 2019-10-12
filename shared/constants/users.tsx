import * as Types from './types/users'
import {TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string) =>
  (state.users.infoMap.get(username) || {fullname: null}).fullname

export const getIsBroken = (infoMap: Map<string, Types.UserInfo>, username: string) =>
  (infoMap.get(username) || {broken: null}).broken

export const makeUserInfo = () => ({
  bio: '',
  broken: false,
  fullname: '',
})
export const emptyUserInfo = makeUserInfo()

export const makeState = () => ({
  infoMap: new Map(),
})
