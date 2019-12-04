import * as Types from './types/users'
import {TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string) =>
  (state.users.infoMap.get(username) || {fullname: null}).fullname

export const getIsBroken = (infoMap: Map<string, Types.UserInfo>, username: string) =>
  (infoMap.get(username) || {broken: null}).broken

export const makeUserInfo = (): Types.UserInfo => ({
  bio: '',
  broken: false,
  fullname: '',
})
export const emptyUserInfo = makeUserInfo()

export const makeBlockState = (): Types.BlockState => ({
  chatBlocked: false,
  followBlocked: false,
})

export const makeState = (): Types.State => ({
  blockMap: new Map(),
  infoMap: new Map(),
})

export const getUserBlocksWaitingKey = 'users:getUserBlocks'
export const setUserBlocksWaitingKey = 'users:setUserBlocks'

export const reportUserWaitingKey = 'users:reportUser'
