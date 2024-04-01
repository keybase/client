import * as EngineGen from '../actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import * as T from './types'
import * as C from '.'
import {mapGetEnsureValue} from '@/util/map'

export const getUserBlocksWaitingKey = 'users:getUserBlocks'
export const setUserBlocksWaitingKey = 'users:setUserBlocks'
export const reportUserWaitingKey = 'users:reportUser'

export type Store = T.Immutable<{
  blockMap: Map<string, T.Users.BlockState>
  infoMap: Map<string, T.Users.UserInfo>
}>

const initialStore: Store = {
  blockMap: new Map(),
  infoMap: new Map(),
}

export interface State extends Store {
  dispatch: {
    getBio: (username: string) => void
    getBlockState: (usernames: ReadonlyArray<string>) => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    reportUser: (p: {
      username: string
      reason: string
      comment: string
      includeTranscript: boolean
      conversationIDKey?: string
    }) => void
    resetState: 'default'
    replace: (infoMap: State['infoMap'], blockMap?: State['blockMap']) => void
    setUserBlocks: (blocks: ReadonlyArray<T.RPCGen.UserBlockArg>) => void
    updates: (infos: ReadonlyArray<{name: string; info: Partial<T.Users.UserInfo>}>) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    getBio: username => {
      const f = async () => {
        const info = get().infoMap.get(username)
        if (info?.bio) {
          return // don't re-fetch bio if we already have one cached
        }
        try {
          const userCard = await T.RPCGen.userUserCardRpcPromise({useSession: true, username})
          if (userCard) {
            get().dispatch.updates([{info: {bio: userCard.bioDecorated}, name: username}])
          }
        } catch (error) {
          if (error instanceof C.RPCError) {
            if (C.isNetworkErr(error.code)) {
              logger.info('Network error getting userCard')
            } else {
              logger.info(error.message)
            }
          }
        }
      }
      C.ignorePromise(f())
    },
    getBlockState: usernames => {
      const f = async () => {
        const blocks = await T.RPCGen.userGetUserBlocksRpcPromise({usernames}, getUserBlocksWaitingKey)
        set(s => {
          blocks?.forEach(({username, chatBlocked, followBlocked}) => {
            s.blockMap.set(username.toLowerCase(), {chatBlocked, followBlocked})
          })
        })
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyUsersIdentifyUpdate: {
          const {brokenUsernames, okUsernames} = action.payload.params
          brokenUsernames &&
            get().dispatch.updates(brokenUsernames.map(name => ({info: {broken: true}, name})))
          okUsernames && get().dispatch.updates(okUsernames.map(name => ({info: {broken: false}, name})))
          break
        }
        default:
      }
    },
    replace: (infoMap, blockMap) => {
      set(s => {
        s.infoMap = T.castDraft(infoMap)
        if (blockMap) {
          s.blockMap = T.castDraft(blockMap)
        }
      })
    },
    reportUser: p => {
      const {conversationIDKey, username, reason, comment, includeTranscript} = p
      const f = async () => {
        await T.RPCGen.userReportUserRpcPromise(
          {
            comment,
            convID: conversationIDKey,
            includeTranscript,
            reason,
            username,
          },
          reportUserWaitingKey
        )
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    setUserBlocks: blocks => {
      const f = async () => {
        if (blocks.length) {
          await T.RPCGen.userSetUserBlocksRpcPromise({blocks}, setUserBlocksWaitingKey)
        }
      }
      C.ignorePromise(f())
    },
    updates: infos => {
      set(s => {
        for (const {name, info: i} of infos) {
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
        }
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
