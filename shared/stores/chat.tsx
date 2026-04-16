import * as Common from '@/constants/chat/common'
import type * as EngineGen from '@/constants/rpc'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import * as TeamConstants from '@/constants/teams'
import * as Z from '@/util/zustand'
import isEqual from 'lodash/isEqual'
import logger from '@/logger'
import type {RefreshReason} from '@/stores/chat-shared'
import {RPCError} from '@/util/errors'
import {bodyToJSON} from '@/constants/rpc-utils'
import {chatStores} from '@/stores/convo-registry'
import {
  ensureWidgetMetas as ensureConvoWidgetMetas,
  handleConvoEngineIncoming,
  hydrateInboxConversations,
  hydrateInboxLayout,
  loadSelectedConversationIfStale,
  metasReceived as convoMetasReceived,
  maybeChangeSelectedConversation,
  syncGregorExplodingModes,
  unboxRows as convoUnboxRows,
} from '@/stores/convostate'
import {ignorePromise} from '@/constants/utils'
import {isPhone} from '@/constants/platform'
import {storeRegistry} from '@/stores/store-registry'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useUsersState} from '@/stores/users'
import {useWaitingState} from '@/stores/waiting'

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

export const getMessageKey = (message: T.Chat.Message) =>
  `${message.conversationIDKey}:${T.Chat.ordinalToNumber(message.ordinal)}`

export const getBotsAndParticipants = (
  meta: T.Immutable<T.Chat.ConversationMeta>,
  participantInfo: T.Immutable<T.Chat.ParticipantInfo>,
  teamMembers?: ReadonlyMap<string, T.Teams.MemberInfo>,
  sort?: boolean
) => {
  const isAdhocTeam = meta.teamType === 'adhoc'
  const members = teamMembers ?? new Map<string, T.Teams.MemberInfo>()
  let bots: Array<string> = []
  if (isAdhocTeam) {
    bots = participantInfo.all.filter(p => !participantInfo.name.includes(p))
  } else {
    bots = [...members.values()]
      .filter(
        p =>
          TeamConstants.userIsRoleInTeamWithInfo(members, p.username, 'restrictedbot') ||
          TeamConstants.userIsRoleInTeamWithInfo(members, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }
  let participants: ReadonlyArray<string> = participantInfo.all
  if (meta.channelname === 'general') {
    participants = [...members.values()].reduce<Array<string>>((l, mi) => {
      l.push(mi.username)
      return l
    }, [])
  }
  participants = participants.filter(p => !bots.includes(p))
  participants = sort
    ? participants
        .map(p => ({
          isAdmin: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(members, p, 'admin') : false,
          isOwner: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(members, p, 'owner') : false,
          username: p,
        }))
        .sort((l, r) => {
          const leftIsAdmin = l.isAdmin || l.isOwner
          const rightIsAdmin = r.isAdmin || r.isOwner
          if (leftIsAdmin && !rightIsAdmin) {
            return -1
          } else if (!leftIsAdmin && rightIsAdmin) {
            return 1
          }
          return l.username.localeCompare(r.username)
        })
        .map(p => p.username)
    : participants
  return {bots, participants}
}

export const getTeamMentionName = (name: string, channel: string) => {
  return name + (channel ? `#${channel}` : '')
}

export const isAssertion = (username: string) => username.includes('@')

export const clampImageSize = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const aspectRatio = width / height

  let newWidth = width
  let newHeight = height

  if (newWidth > maxWidth) {
    newWidth = maxWidth
    newHeight = newWidth / aspectRatio
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = newHeight * aspectRatio
  }

  return {
    height: Math.ceil(newHeight),
    width: Math.ceil(newWidth),
  }
}

export const zoomImage = (width: number, height: number, maxThumbSize: number) => {
  const dims =
    height > width
      ? {height: (maxThumbSize * height) / width, width: maxThumbSize}
      : {height: maxThumbSize, width: (maxThumbSize * width) / height}
  const marginHeight = dims.height > maxThumbSize ? (dims.height - maxThumbSize) / 2 : 0
  const marginWidth = dims.width > maxThumbSize ? (dims.width - maxThumbSize) / 2 : 0
  return {
    dims,
    margins: {
      marginBottom: -marginHeight,
      marginLeft: -marginWidth,
      marginRight: -marginWidth,
      marginTop: -marginHeight,
    },
  }
}

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: State, teamID: string): boolean => {
  const bigTeams = state.inboxLayout?.bigTeams
  return (bigTeams || []).some(v => v.state === T.RPCChat.UIInboxBigTeamRowTyp.label && v.label.id === teamID)
}

type Store = T.Immutable<{
  badgeStateVersion: number
  smallTeamBadgeCount: number
  bigTeamBadgeCount: number
  inboxRetriedOnCurrentEmpty: boolean
  staticConfig?: T.Chat.StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  userReacjis: T.Chat.UserReacjis
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout?: T.RPCChat.UIInboxLayout // layout of the inbox
  maybeMentionMap: Map<string, T.RPCChat.UIMaybeMentionInfo>
  blockButtonsMap: Map<T.RPCGen.TeamID, T.Chat.BlockButtonsInfo> // Should we show block buttons for this team ID?
}>

const initialStore: Store = {
  badgeStateVersion: 0,
  bigTeamBadgeCount: 0,
  blockButtonsMap: new Map(),
  inboxHasLoaded: false,
  inboxLayout: undefined,
  inboxRetriedOnCurrentEmpty: false,
  maybeMentionMap: new Map(),
  smallTeamBadgeCount: 0,
  staticConfig: undefined,
  userReacjis: defaultUserReacjis,
}

export type State = Store & {
  dispatch: {
    badgesUpdated: (badgeState?: T.RPCGen.BadgeState) => void
    dismissBlockButtons: (teamID: T.RPCGen.TeamID) => void
    dismissBlockButtonsIfPresent: (teamID: T.RPCGen.TeamID) => void
    inboxRefresh: (reason: RefreshReason) => void
    setInboxRetriedOnCurrentEmpty: (retried: boolean) => void
    loadStaticConfig: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    onChatInboxSynced: (action: EngineGen.EngineAction<'chat.1.NotifyChat.ChatInboxSynced'>) => void
    onGetInboxConvsUnboxed: (action: EngineGen.EngineAction<'chat.1.chatUi.chatInboxConversation'>) => void
    onGetInboxUnverifiedConvs: (action: EngineGen.EngineAction<'chat.1.chatUi.chatInboxUnverified'>) => void
    onIncomingInboxUIItem: (inboxUIItem?: T.RPCChat.InboxUIItem) => void
    resetState: () => void
    setMaybeMentionInfo: (name: string, info: T.RPCChat.UIMaybeMentionInfo) => void
    updateInboxLayout: (layout: string) => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
    updatedGregor: (
      items: ReadonlyArray<{md: T.RPCGen.Gregor1.Metadata; item: T.RPCGen.Gregor1.Item}>
    ) => void
  }
}

// generic chat store
export const useChatState = Z.createZustand<State>('chat', (set, get) => {
  const requestInboxLayout = async (reason: RefreshReason) => {
    const {username} = useCurrentUserState.getState()
    const {loggedIn} = useConfigState.getState()
    if (!loggedIn || !username) {
      return
    }

    logger.info(`Inbox refresh due to ${reason}`)
    const reselectMode =
      get().inboxHasLoaded || isPhone
        ? T.RPCChat.InboxLayoutReselectMode.default
        : T.RPCChat.InboxLayoutReselectMode.force
    await T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode})
  }

  const dispatch: State['dispatch'] = {
    badgesUpdated: b => {
      if (!b) return
      const badgedConvIDs = new Set(b.conversations?.map(c => T.Chat.conversationIDToKey(c.convID)) ?? [])
      for (const [id, cs] of chatStores) {
        if (!badgedConvIDs.has(id) && cs.getState().badge > 0) {
          cs.getState().dispatch.badgesUpdated(0)
        }
      }
      b.conversations?.forEach(c => {
        const id = T.Chat.conversationIDToKey(c.convID)
        storeRegistry.getConvoState(id).dispatch.badgesUpdated(c.badgeCount)
        storeRegistry.getConvoState(id).dispatch.unreadUpdated(c.unreadMessages)
      })
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
    dismissBlockButtonsIfPresent: teamID => {
      if (get().blockButtonsMap.has(teamID)) {
        get().dispatch.dismissBlockButtons(teamID)
      }
    },
    inboxRefresh: reason => {
      ignorePromise(requestInboxLayout(reason))
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
    onChatInboxSynced: action => {
      const {syncRes} = action.payload.params
      const {clear} = useWaitingState.getState().dispatch
      clear(S.waitingKeyChatInboxSyncStarted)

      switch (syncRes.syncType) {
        // Just clear it all
        case T.RPCChat.SyncInboxResType.clear: {
          const f = async () => {
            await requestInboxLayout('inboxSyncedClear')
            for (const [, cs] of chatStores) {
              const {dispatch} = cs.getState()
              dispatch.setMeta()
              dispatch.messagesClear()
            }
          }
          ignorePromise(f())
          break
        }
        // We're up to date
        case T.RPCChat.SyncInboxResType.current:
          break
        // We got some new messages appended
        case T.RPCChat.SyncInboxResType.incremental: {
          const items = syncRes.incremental.items || []
          const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, i) => {
            const meta = Meta.unverifiedInboxUIItemToConversationMeta(i.conv)
            if (meta) arr.push(meta)
            return arr
          }, [])
          loadSelectedConversationIfStale(metas)
          const removals = syncRes.incremental.removals?.map(T.Chat.stringToConversationIDKey)
          // Update new untrusted
          if (metas.length || removals?.length) {
            convoMetasReceived(metas, removals)
          }

          convoUnboxRows(
            items.filter(i => i.shouldUnbox).map(i => T.Chat.stringToConversationIDKey(i.conv.convID)),
            true
          )
          break
        }
        default:
          inboxRefresh('inboxSyncedUnknown')
      }
    },
    onEngineIncomingImpl: action => {
      const convoResult = handleConvoEngineIncoming(action, get().staticConfig)
      if (convoResult.handled) {
        if (convoResult.inboxUIItem) {
          get().dispatch.onIncomingInboxUIItem(convoResult.inboxUIItem)
        }
        if (convoResult.userReacjis) {
          get().dispatch.updateUserReacjis(convoResult.userReacjis)
        }
        return
      }
      switch (action.type) {
        case 'chat.1.chatUi.chatMaybeMentionUpdate': {
          const {teamName, channel, info} = action.payload.params
          get().dispatch.setMaybeMentionInfo(getTeamMentionName(teamName, channel), info)
          break
        }
        case 'chat.1.NotifyChat.ChatConvUpdate': {
          const {conv} = action.payload.params
          if (conv) {
            const meta = Meta.inboxUIItemToConversationMeta(conv)
            if (meta) {
              convoMetasReceived([meta])
            }
          }
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
        case 'chat.1.chatUi.chatInboxUnverified':
          get().dispatch.onGetInboxUnverifiedConvs(action)
          break
        case 'chat.1.NotifyChat.ChatInboxSyncStarted':
          useWaitingState.getState().dispatch.increment(S.waitingKeyChatInboxSyncStarted)
          break

        case 'chat.1.NotifyChat.ChatInboxSynced':
          get().dispatch.onChatInboxSynced(action)
          break
        case 'chat.1.chatUi.chatInboxLayout':
          get().dispatch.updateInboxLayout(action.payload.params.layout)
          maybeChangeSelectedConversation(get().inboxLayout)
          ensureConvoWidgetMetas(get().inboxLayout?.widgetList)
          break
        case 'chat.1.NotifyChat.ChatInboxStale':
          get().dispatch.inboxRefresh('inboxStale')
          break
        case 'chat.1.chatUi.chatInboxConversation':
          get().dispatch.onGetInboxConvsUnboxed(action)
          break
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
    onGetInboxConvsUnboxed: action => {
      // TODO not reactive
      const {infoMap} = useUsersState.getState()
      const {convs} = action.payload.params
      const inboxUIItems = JSON.parse(convs) as Array<T.RPCChat.InboxUIItem>
      const usernameToFullname: {[username: string]: string} = {}
      inboxUIItems.forEach(inboxUIItem => {
        inboxUIItem.participants?.forEach((part: T.RPCChat.UIParticipant) => {
          const {assertion, fullName} = part
          if (!infoMap.get(assertion) && fullName) {
            usernameToFullname[assertion] = fullName
          }
        })
      })
      if (Object.keys(usernameToFullname).length > 0) {
        useUsersState.getState().dispatch.updates(
          Object.keys(usernameToFullname).map(name => ({
            info: {fullname: usernameToFullname[name]},
            name,
          }))
        )
      }
      hydrateInboxConversations(inboxUIItems)
    },
    onGetInboxUnverifiedConvs: action => {
      const {inbox} = action.payload.params
      const result = JSON.parse(inbox) as T.RPCChat.UnverifiedInboxUIItems
      const items: ReadonlyArray<T.RPCChat.UnverifiedInboxUIItem> = result.items ?? []
      // We get a subset of meta information from the cache even in the untrusted payload
      const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, item) => {
        const m = Meta.unverifiedInboxUIItemToConversationMeta(item)
        if (m) {
          arr.push(m)
        }
        return arr
      }, [])
      // Check if some of our existing stored metas might no longer be valid
      convoMetasReceived(metas)
    },
    onIncomingInboxUIItem: conv => {
      if (!conv) return
      const meta = Meta.inboxUIItemToConversationMeta(conv)
      const usernameToFullname = (conv.participants ?? []).reduce<{[key: string]: string}>((map, part) => {
        if (part.fullName) {
          map[part.assertion] = part.fullName
        }
        return map
      }, {})

      useUsersState.getState().dispatch.updates(
        Object.keys(usernameToFullname).map(name => ({
          info: {fullname: usernameToFullname[name]},
          name,
        }))
      )

      if (meta) {
        convoMetasReceived([meta])
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
    setInboxRetriedOnCurrentEmpty: retried => {
      set(s => {
        s.inboxRetriedOnCurrentEmpty = retried
      })
    },
    setMaybeMentionInfo: (name, info) => {
      set(s => {
        const {maybeMentionMap} = s
        maybeMentionMap.set(name, T.castDraft(info))
      })
    },
    updateInboxLayout: str => {
      set(s => {
        try {
          const {inboxHasLoaded} = s
          const _layout = JSON.parse(str) as unknown
          if (!_layout || typeof _layout !== 'object') {
            console.log('Invalid layout?')
            return
          }
          const layout = _layout as T.RPCChat.UIInboxLayout
          const hasInboxRows =
            (layout.smallTeams?.length ?? 0) > 0 ||
            (layout.bigTeams?.length ?? 0) > 0 ||
            layout.totalSmallTeams > 0

          const layoutChanged = !isEqual(s.inboxLayout, layout)
          if (layoutChanged) {
            s.inboxLayout = T.castDraft(layout)
          }
          s.inboxHasLoaded = !!layout
          if (hasInboxRows) {
            s.inboxRetriedOnCurrentEmpty = false
          }
          if (!inboxHasLoaded) {
            hydrateInboxLayout(layout)
          }
        } catch (e) {
          logger.info('failed to JSON parse inbox layout: ' + e)
        }
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
      syncGregorExplodingModes(items)

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
export type {RefreshReason} from '@/stores/chat-shared'
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
