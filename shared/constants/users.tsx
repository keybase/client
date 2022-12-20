import type * as Types from './types/users'
import type {TypedState} from './reducer'

export const getFullname = (state: TypedState, username: string) =>
  state.users.infoMap.get(username)?.fullname

export const getIsBroken = (infoMap: Map<string, Types.UserInfo>, username: string) =>
  infoMap.get(username)?.broken ?? false

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
export const wotReactWaitingKey = 'users:wotReact'
export const wotRevokeWaitingKey = 'users:wotRevoke'
