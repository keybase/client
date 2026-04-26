import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {ignorePromise} from '@/constants/utils'
import {useDaemonState} from '@/stores/daemon'

const defaultTopReacjis = [
  {name: ':+1:'},
  {name: ':-1:'},
  {name: ':tada:'},
  {name: ':joy:'},
  {name: ':sunglasses:'},
]
const defaultSkinTone = 1
const defaultUserReacjis = {skinTone: defaultSkinTone, topReacjis: defaultTopReacjis}

// while we're debugging chat issues
export const DEBUG_CHAT_DUMP = true

type Store = T.Immutable<{
  staticConfig?: T.Chat.StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  userReacjis: T.Chat.UserReacjis
}>

const initialStore: Store = {
  staticConfig: undefined,
  userReacjis: defaultUserReacjis,
}

export type State = Store & {
  dispatch: {
    loadStaticConfig: () => void
    resetState: () => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
  }
}

// generic chat store
export const useChatState = Z.createZustand<State>('chat', (set, get) => {
  const dispatch: State['dispatch'] = {
    loadStaticConfig: () => {
      if (get().staticConfig) {
        return
      }
      const {handshakeVersion, dispatch} = useDaemonState.getState()
      const f = async () => {
        const name = 'chat.loadStatic'
        dispatch.wait(name, handshakeVersion, true)
        try {
          const res = await T.RPCChat.localGetStaticConfigRpcPromise()
          if (!res.deletableByDeleteHistory) {
            logger.error('chat.loadStaticConfig: got no deletableByDeleteHistory in static config')
            return
          }
          const deletableByDeleteHistory = res.deletableByDeleteHistory.reduce<Array<T.Chat.MessageType>>(
            (res, type) => {
              const ourTypes = Message.serviceMessageTypeToMessageTypes(type)
              res.push(...ourTypes)
              return res
            },
            []
          )
          set(s => {
            s.staticConfig = {
              builtinCommands: (res.builtinCommands || []).reduce<T.Chat.StaticConfig['builtinCommands']>(
                (map, c) => {
                  map[c.typ] = T.castDraft(c.commands) || []
                  return map
                },
                {
                  [T.RPCChat.ConversationBuiltinCommandTyp.none]: [],
                  [T.RPCChat.ConversationBuiltinCommandTyp.adhoc]: [],
                  [T.RPCChat.ConversationBuiltinCommandTyp.smallteam]: [],
                  [T.RPCChat.ConversationBuiltinCommandTyp.bigteam]: [],
                  [T.RPCChat.ConversationBuiltinCommandTyp.bigteamgeneral]: [],
                }
              ),
              deletableByDeleteHistory: new Set(deletableByDeleteHistory),
            }
          })
        } finally {
          dispatch.wait(name, handshakeVersion, false)
        }
      }
      ignorePromise(f())
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        staticConfig: s.staticConfig,
      }))
    },
    updateUserReacjis: userReacjis => {
      set(s => {
        const {skinTone, topReacjis} = userReacjis
        s.userReacjis.skinTone = skinTone
        // filter out non-simple emojis
        s.userReacjis.topReacjis =
          T.castDraft(topReacjis)?.filter(r => /^:[^:]+:$/.test(r.name)) ?? defaultTopReacjis
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

export * from '@/stores/inbox-rows'
export type {RefreshReason} from '@/constants/types/chat'
export * from '@/constants/chat/common'
export * from '@/constants/chat/meta'
export * from '@/constants/chat/message'

export {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  isValidConversationIDKey,
  dummyConversationIDKey,
} from '@/constants/types/chat/common'
