import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'
import logger from '../logger'
import type * as Types from './types/users'
import {RPCError, isNetworkErr} from '../util/errors'
import {mapGetEnsureValue} from '../util/map'

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

export const getUserBlocksWaitingKey = 'users:getUserBlocks'
export const setUserBlocksWaitingKey = 'users:setUserBlocks'

export const reportUserWaitingKey = 'users:reportUser'
export const wotReactWaitingKey = 'users:wotReact'
export const wotRevokeWaitingKey = 'users:wotRevoke'

export type Store = {
  blockMap: Map<string, Types.BlockState>
  infoMap: Map<string, Types.UserInfo>
}

const initialStore: Store = {
  blockMap: new Map(),
  infoMap: new Map(),
}

export type State = Store & {
  dispatch: {
    getBio: (username: string) => void
    getBlockState: (usernames: Array<string>) => void
    reportUser: (p: {
      username: string
      reason: string
      comment: string
      includeTranscript: boolean
      convID?: string
    }) => void
    resetState: 'default'
    replace: (infoMap: State['infoMap'], blockMap?: State['blockMap']) => void
    setUserBlocks: (blocks: Array<RPCTypes.UserBlockArg>) => void
    update: (name: string, i: Partial<Types.UserInfo>) => void
    updateBroken: (names: Array<string>, broken: boolean) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    getBio: username => {
      const f = async () => {
        const info = get().infoMap.get(username)
        if (info?.bio) {
          return // don't re-fetch bio if we already have one cached
        }
        try {
          const userCard = await RPCTypes.userUserCardRpcPromise({useSession: true, username})
          if (userCard) {
            get().dispatch.update(username, {bio: userCard.bioDecorated})
          }
        } catch (error) {
          if (error instanceof RPCError) {
            if (isNetworkErr(error.code)) {
              logger.info('Network error getting userCard')
            } else {
              logger.info(error.message)
            }
          }
        }
      }
      Z.ignorePromise(f())
    },
    getBlockState: usernames => {
      const f = async () => {
        const blocks = await RPCTypes.userGetUserBlocksRpcPromise({usernames}, getUserBlocksWaitingKey)
        set(s => {
          blocks?.forEach(({username, chatBlocked, followBlocked}) => {
            s.blockMap.set(username.toLowerCase(), {chatBlocked, followBlocked})
          })
        })
      }
      Z.ignorePromise(f())
    },
    replace: (infoMap, blockMap) => {
      set(s => {
        s.infoMap = infoMap
        if (blockMap) {
          s.blockMap = blockMap
        }
      })
    },
    reportUser: p => {
      const f = async () => {
        await RPCTypes.userReportUserRpcPromise(p, reportUserWaitingKey)
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
    setUserBlocks: blocks => {
      const f = async () => {
        if (blocks.length) {
          await RPCTypes.userSetUserBlocksRpcPromise({blocks}, setUserBlocksWaitingKey)
        }
      }
      Z.ignorePromise(f())
    },
    update: (name, i) => {
      set(s => {
        const user = mapGetEnsureValue(s.infoMap, name, {broken: false})
        if (i.bio !== undefined) {
          user.bio = i.bio
        }
        if (i.broken !== undefined) {
          user.broken = i.broken
        }
        if (i.fullname !== undefined) {
          user.fullname = i.fullname
        }
      })
    },
    updateBroken: (names, broken) => {
      set(s => {
        for (const name of names) {
          const user = mapGetEnsureValue(s.infoMap, name, {broken})
          user.broken = broken
        }
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
