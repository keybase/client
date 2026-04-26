import type * as EngineGen from '@/constants/rpc'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'
import {getTeamMentionName} from '@/constants/chat/helpers'
import {RPCError} from '@/util/errors'
import {bodyToJSON} from '@/constants/rpc-utils'
import {ignorePromise} from '@/constants/utils'
import {useDaemonState} from '@/stores/daemon'
import {useUsersState} from '@/stores/users'

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

const blockButtonsGregorPrefix = 'blockButtons.'

type Store = T.Immutable<{
  badgeStateVersion: number
  smallTeamBadgeCount: number
  bigTeamBadgeCount: number
  staticConfig?: T.Chat.StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  userReacjis: T.Chat.UserReacjis
  maybeMentionMap: Map<string, T.RPCChat.UIMaybeMentionInfo>
  blockButtonsMap: Map<T.RPCGen.TeamID, T.Chat.BlockButtonsInfo> // Should we show block buttons for this team ID?
}>

const initialStore: Store = {
  badgeStateVersion: 0,
  bigTeamBadgeCount: 0,
  blockButtonsMap: new Map(),
  maybeMentionMap: new Map(),
  smallTeamBadgeCount: 0,
  staticConfig: undefined,
  userReacjis: defaultUserReacjis,
}

export type State = Store & {
  dispatch: {
    badgesUpdated: (badgeState?: T.RPCGen.BadgeState) => void
    dismissBlockButtons: (teamID: T.RPCGen.TeamID) => void
    loadStaticConfig: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
    setMaybeMentionInfo: (name: string, info: T.RPCChat.UIMaybeMentionInfo) => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
    updatedGregor: (
      items: ReadonlyArray<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>
    ) => void
  }
}

// generic chat store
export const useChatState = Z.createZustand<State>('chat', (set, get) => {
  const dispatch: State['dispatch'] = {
    badgesUpdated: b => {
      if (!b) {
        return
      }
      const {bigTeamBadgeCount, smallTeamBadgeCount} = b
      set(s => {
        s.badgeStateVersion += 1
        s.smallTeamBadgeCount = smallTeamBadgeCount
        s.bigTeamBadgeCount = bigTeamBadgeCount
      })
    },
    dismissBlockButtons: teamID => {
      const f = async () => {
        try {
          await T.RPCGen.userDismissBlockButtonsRpcPromise({tlfID: teamID})
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Couldn't dismiss block buttons: ${error.message}`)
          }
        }
      }
      ignorePromise(f())
    },
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
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'chat.1.chatUi.chatMaybeMentionUpdate': {
          const {teamName, channel, info} = action.payload.params
          get().dispatch.setMaybeMentionInfo(getTeamMentionName(teamName, channel), info)
          break
        }
        case 'chat.1.NotifyChat.ChatIdentifyUpdate': {
          // Some participants are broken/fixed now
          const {update} = action.payload.params
          const usernames = update.CanonicalName.split(',')
          const broken = (update.breaks.breaks || []).map(b => b.user.username)
          const updates = usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
          useUsersState.getState().dispatch.updates(updates)
          break
        }
        case 'keybase.1.NotifyBadges.badgeState': {
          const {badgeState} = action.payload.params
          get().dispatch.badgesUpdated(badgeState)
          break
        }
        case 'keybase.1.gregorUI.pushState': {
          const {state} = action.payload.params
          const items = state.items || []
          const goodState = items.reduce<Array<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>>(
            (arr, {md, item}) => {
              if (md && item) {
                arr.push({item, md})
              }
              return arr
            },
            []
          )
          if (goodState.length !== items.length) {
            logger.warn('Lost some messages in filtering out nonNull gregor items')
          }
          get().dispatch.updatedGregor(goodState)
          break
        }
        default:
      }
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        staticConfig: s.staticConfig,
      }))
    },
    setMaybeMentionInfo: (name, info) => {
      set(s => {
        const {maybeMentionMap} = s
        maybeMentionMap.set(name, T.castDraft(info))
      })
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
    updatedGregor: items => {
      set(s => {
        const blockButtons = items.some(i => i.item.category.startsWith(blockButtonsGregorPrefix))
        if (blockButtons || s.blockButtonsMap.size > 0) {
          const shouldKeepExistingBlockButtons = new Map<string, boolean>()
          s.blockButtonsMap.forEach((_, teamID: string) => shouldKeepExistingBlockButtons.set(teamID, false))
          items
            .filter(i => i.item.category.startsWith(blockButtonsGregorPrefix))
            .forEach(i => {
              try {
                const teamID = i.item.category.substring(blockButtonsGregorPrefix.length)
                if (!s.blockButtonsMap.get(teamID)) {
                  const body = bodyToJSON(i.item.body) as {adder: string}
                  const adder = body.adder
                  s.blockButtonsMap.set(teamID, {adder})
                } else {
                  shouldKeepExistingBlockButtons.set(teamID, true)
                }
              } catch (e) {
                logger.info('block buttons parse fail', e)
              }
            })
          shouldKeepExistingBlockButtons.forEach((keep, teamID) => {
            if (!keep) {
              s.blockButtonsMap.delete(teamID)
            }
          })
        }
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
