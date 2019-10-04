import * as Types from './types/users'
import {TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string) => {
  const info = state.users.infoMap.get(username)
  return info ? info.fullname : null
}

export const getIsBroken = (infoMap: Types.InfoMap, username: string) => {
  const info = infoMap.get(username)
  return info ? info.broken : null
}

export const makeUserInfo = () => ({
  broken: false,
  fullname: '',
})
export const emptyUserInfo = makeUserInfo()

export const makeState = () => ({
  infoMap: new Map(),
})
