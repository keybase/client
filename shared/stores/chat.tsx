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
  hydrateInboxLayout,
  metasReceived as convoMetasReceived,
  unboxRows as convoUnboxRows,
} from '@/stores/convostate'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {isPhone} from '@/constants/platform'
import {navigateToInbox} from '@/constants/router'
import {storeRegistry} from '@/stores/store-registry'
import {uint8ArrayToString} from '@/util/uint8array'
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
    createConversation: (participants: ReadonlyArray<string>, highlightMessageID?: T.Chat.MessageID) => void
    dismissBlockButtons: (teamID: T.RPCGen.TeamID) => void
    dismissBlockButtonsIfPresent: (teamID: T.RPCGen.TeamID) => void
    inboxRefresh: (reason: RefreshReason) => void
    setInboxRetriedOnCurrentEmpty: (retried: boolean) => void
    loadStaticConfig: () => void
    maybeChangeSelectedConv: () => void
    onChatThreadStale: (action: EngineGen.EngineAction<'chat.1.NotifyChat.ChatThreadsStale'>) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    onChatInboxSynced: (action: EngineGen.EngineAction<'chat.1.NotifyChat.ChatInboxSynced'>) => void
    onGetInboxConvsUnboxed: (action: EngineGen.EngineAction<'chat.1.chatUi.chatInboxConversation'>) => void
    onGetInboxUnverifiedConvs: (action: EngineGen.EngineAction<'chat.1.chatUi.chatInboxUnverified'>) => void
    onIncomingInboxUIItem: (inboxUIItem?: T.RPCChat.InboxUIItem) => void
    onTeamBuildingFinished: (users: ReadonlySet<T.TB.User>) => void
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
    createConversation: (participants, highlightMessageID) => {
      // TODO This will break if you try to make 2 new conversations at the same time because there is
      // only one pending conversation state.
      // The fix involves being able to make multiple pending conversations
      const f = async () => {
        const username = useCurrentUserState.getState().username
        if (!username) {
          logger.error('Making a convo while logged out?')
          return
        }
        try {
          const result = await T.RPCChat.localNewConversationLocalRpcPromise(
            {
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              membersType: T.RPCChat.ConversationMembersType.impteamnative,
              tlfName: [...new Set([username, ...participants])].join(','),
              tlfVisibility: T.RPCGen.TLFVisibility.private,
              topicType: T.RPCChat.TopicType.chat,
            },
            S.waitingKeyChatCreating
          )
          const {conv, uiConv} = result
          const conversationIDKey = T.Chat.conversationIDToKey(conv.info.id)
          if (!conversationIDKey) {
            logger.warn("Couldn't make a new conversation?")
          } else {
            const meta = Meta.inboxUIItemToConversationMeta(uiConv)
            if (meta) {
              convoMetasReceived([meta])
            }

            const participantInfo: T.Chat.ParticipantInfo = Common.uiParticipantsToParticipantInfo(
              uiConv.participants ?? []
            )
            if (participantInfo.all.length > 0) {
              storeRegistry
                .getConvoState(T.Chat.stringToConversationIDKey(uiConv.convID))
                .dispatch.setParticipants(participantInfo)
            }
            storeRegistry
              .getConvoState(conversationIDKey)
              .dispatch.navigateToThread('justCreated', highlightMessageID)
            get().dispatch.inboxRefresh('joinedAConversation')
          }
        } catch (error) {
          if (error instanceof RPCError) {
            const f = error.fields as Array<{key?: string}> | undefined
            const errUsernames = f?.filter(elem => elem.key === 'usernames') as
              | undefined
              | Array<{key: string; value: string}>
            let disallowedUsers: Array<string> = []
            if (errUsernames?.length) {
              const {value} = errUsernames[0] ?? {value: ''}
              disallowedUsers = value.split(',')
            }
            const allowedUsers = participants.filter(x => !disallowedUsers.includes(x))
            storeRegistry
              .getConvoState(T.Chat.pendingErrorConversationIDKey)
              .dispatch.navigateToThread('justCreated', highlightMessageID, undefined, undefined, {
                allowedUsers,
                code: error.code,
                disallowedUsers,
                message: error.desc,
              })
          }
        }
      }
      ignorePromise(f())
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
    maybeChangeSelectedConv: () => {
      const {inboxLayout} = get()
      const newConvID = inboxLayout?.reselectInfo?.newConvID
      const oldConvID = inboxLayout?.reselectInfo?.oldConvID

      const selectedConversation = Common.getSelectedConversation()

      if (!newConvID && !oldConvID) {
        return
      }

      const existingValid = T.Chat.isValidConversationIDKey(selectedConversation)
      // no new id, just take the opportunity to resolve
      if (!newConvID) {
        if (!existingValid && isPhone) {
          logger.info(`maybeChangeSelectedConv: no new and no valid, so go to inbox`)
          navigateToInbox(false)
        }
        return
      }
      // not matching?
      if (selectedConversation !== oldConvID) {
        if (!existingValid && isPhone) {
          logger.info(`maybeChangeSelectedConv: no new and no valid, so go to inbox`)
          navigateToInbox(false)
        }
        return
      }
      // matching
      if (isPhone) {
        // on mobile just head back to the inbox if we have something selected
        if (T.Chat.isValidConversationIDKey(selectedConversation)) {
          logger.info(`maybeChangeSelectedConv: mobile: navigating up on conv change`)
          navigateToInbox(false)
          return
        }
        logger.info(`maybeChangeSelectedConv: mobile: ignoring conv change, no conv selected`)
        return
      } else {
        logger.info(
          `maybeChangeSelectedConv: selecting new conv: new:${newConvID} old:${oldConvID} prevselected ${selectedConversation}`
        )
        storeRegistry.getConvoState(newConvID).dispatch.navigateToThread('findNewestConversation')
      }
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
          const selectedConversation = Common.getSelectedConversation()
          const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, i) => {
            const meta = Meta.unverifiedInboxUIItemToConversationMeta(i.conv)
            if (meta) arr.push(meta)
            return arr
          }, [])
          if (metas.some(m => m.conversationIDKey === selectedConversation)) {
            storeRegistry.getConvoState(selectedConversation).dispatch.loadMoreMessages({reason: 'got stale'})
          }
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
    onChatThreadStale: action => {
      const {updates} = action.payload.params
      const keys = ['clear', 'newactivity'] as const
      if (__DEV__) {
        if (keys.length * 2 !== Object.keys(T.RPCChat.StaleUpdateType).length) {
          throw new Error('onChatThreadStale invalid enum')
        }
      }
      const selectedConversation = Common.getSelectedConversation()
      const shouldLoadMore = (updates || []).some(
        u => T.Chat.conversationIDToKey(u.convID) === selectedConversation
      )
      keys.forEach(key => {
        const conversationIDKeys = (updates || []).reduce<Array<string>>((arr, u) => {
          const cid = T.Chat.conversationIDToKey(u.convID)
          if (u.updateType === T.RPCChat.StaleUpdateType[key]) {
            arr.push(cid)
          }
          return arr
        }, [])
        // load the inbox instead
        if (conversationIDKeys.length > 0) {
          logger.info(
            `onChatThreadStale: dispatching thread reload actions for ${conversationIDKeys.length} convs of type ${key}`
          )
          convoUnboxRows(conversationIDKeys, true)
          if (T.RPCChat.StaleUpdateType[key] === T.RPCChat.StaleUpdateType.clear) {
            conversationIDKeys.forEach(convID => {
              // For the selected conversation, skip immediate clear — the deferred
              // atomic clear+add in loadMoreMessages avoids a blank flash
              if (convID !== selectedConversation) {
                storeRegistry.getConvoState(convID).dispatch.messagesClear()
              }
            })
          }
        }
      })
      if (shouldLoadMore) {
        storeRegistry.getConvoState(selectedConversation).dispatch.loadMoreMessages({
          reason: 'got stale',
        })
      }
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'chat.1.chatUi.chatInboxFailed': // fallthrough
        case 'chat.1.NotifyChat.ChatSetConvSettings': // fallthrough
        case 'chat.1.NotifyChat.ChatAttachmentUploadStart': // fallthrough
        case 'chat.1.NotifyChat.ChatPromptUnfurl': // fallthrough
        case 'chat.1.NotifyChat.ChatPaymentInfo': // fallthrough
        case 'chat.1.NotifyChat.ChatRequestInfo': // fallthrough
        case 'chat.1.NotifyChat.ChatAttachmentDownloadProgress': //fallthrough
        case 'chat.1.NotifyChat.ChatAttachmentDownloadComplete': //fallthrough
        case 'chat.1.NotifyChat.ChatAttachmentUploadProgress': {
          const {convID} = action.payload.params
          const conversationIDKey = T.Chat.conversationIDToKey(convID)
          storeRegistry.getConvoState(conversationIDKey).dispatch.onEngineIncoming(action)
          break
        }
        case 'chat.1.chatUi.chatCommandMarkdown': //fallthrough
        case 'chat.1.chatUi.chatGiphyToggleResultWindow': // fallthrough
        case 'chat.1.chatUi.chatCommandStatus': // fallthrough
        case 'chat.1.chatUi.chatBotCommandsUpdateStatus': //fallthrough
        case 'chat.1.chatUi.chatGiphySearchResults': {
          const {convID} = action.payload.params
          const conversationIDKey = T.Chat.stringToConversationIDKey(convID)
          storeRegistry.getConvoState(conversationIDKey).dispatch.onEngineIncoming(action)
          break
        }
        case 'chat.1.NotifyChat.ChatParticipantsInfo': {
          const {participants: participantMap} = action.payload.params
          Object.keys(participantMap ?? {}).forEach(convIDStr => {
            const participants = participantMap?.[convIDStr]
            const conversationIDKey = T.Chat.stringToConversationIDKey(convIDStr)
            if (participants) {
              storeRegistry
                .getConvoState(conversationIDKey)
                .dispatch.setParticipants(Common.uiParticipantsToParticipantInfo(participants))
            }
          })
          break
        }
        case 'chat.1.chatUi.chatMaybeMentionUpdate': {
          const {teamName, channel, info} = action.payload.params
          get().dispatch.setMaybeMentionInfo(getTeamMentionName(teamName, channel), info)
          break
        }
        case 'chat.1.NotifyChat.ChatConvUpdate': {
          const {conv} = action.payload.params
          if (conv) {
            const meta = Meta.inboxUIItemToConversationMeta(conv)
            meta && convoMetasReceived([meta])
          }
          break
        }
        case 'chat.1.chatUi.chatCoinFlipStatus': {
          const {statuses} = action.payload.params
          const statusesByConvo = new Map<T.Chat.ConversationIDKey, Array<T.RPCChat.UICoinFlipStatus>>()
          statuses?.forEach(status => {
            const conversationIDKey = T.Chat.stringToConversationIDKey(status.convID)
            const convoStatuses = statusesByConvo.get(conversationIDKey)
            if (convoStatuses) {
              convoStatuses.push(status)
            } else {
              statusesByConvo.set(conversationIDKey, [status])
            }
          })
          statusesByConvo.forEach((convoStatuses, conversationIDKey) => {
            storeRegistry.getConvoState(conversationIDKey).dispatch.updateCoinFlipStatuses(convoStatuses)
          })
          break
        }
        case 'chat.1.NotifyChat.ChatThreadsStale':
          get().dispatch.onChatThreadStale(action)
          break
        case 'chat.1.NotifyChat.ChatSubteamRename': {
          const {convs} = action.payload.params
          const conversationIDKeys = (convs ?? []).map(c => T.Chat.stringToConversationIDKey(c.convID))
          convoUnboxRows(conversationIDKeys, true)
          break
        }
        case 'chat.1.NotifyChat.ChatTLFFinalize':
          convoUnboxRows([T.Chat.conversationIDToKey(action.payload.params.convID)])
          break
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
          get().dispatch.maybeChangeSelectedConv()
          ensureConvoWidgetMetas(get().inboxLayout?.widgetList)
          break
        case 'chat.1.NotifyChat.ChatInboxStale':
          get().dispatch.inboxRefresh('inboxStale')
          break
        case 'chat.1.chatUi.chatInboxConversation':
          get().dispatch.onGetInboxConvsUnboxed(action)
          break
        case 'chat.1.NotifyChat.NewChatActivity': {
          const {activity} = action.payload.params
          switch (activity.activityType) {
            case T.RPCChat.ChatActivityType.incomingMessage: {
              const {incomingMessage} = activity
              const conversationIDKey = T.Chat.conversationIDToKey(incomingMessage.convID)
              storeRegistry.getConvoState(conversationIDKey).dispatch.onIncomingMessage(incomingMessage)
              get().dispatch.onIncomingInboxUIItem(incomingMessage.conv ?? undefined)
              break
            }
            case T.RPCChat.ChatActivityType.setStatus:
              get().dispatch.onIncomingInboxUIItem(activity.setStatus.conv ?? undefined)
              break
            case T.RPCChat.ChatActivityType.readMessage:
              get().dispatch.onIncomingInboxUIItem(activity.readMessage.conv ?? undefined)
              break
            case T.RPCChat.ChatActivityType.newConversation:
              get().dispatch.onIncomingInboxUIItem(activity.newConversation.conv ?? undefined)
              break
            case T.RPCChat.ChatActivityType.failedMessage: {
              const {failedMessage} = activity
              get().dispatch.onIncomingInboxUIItem(failedMessage.conv ?? undefined)
              const {outboxRecords} = failedMessage
              if (!outboxRecords) return
              for (const outboxRecord of outboxRecords) {
                const s = outboxRecord.state
                if (s.state !== T.RPCChat.OutboxStateType.error) return
                const {error} = s
                const conversationIDKey = T.Chat.conversationIDToKey(outboxRecord.convID)
                const outboxID = T.Chat.rpcOutboxIDToOutboxID(outboxRecord.outboxID)
                // This is temp until fixed by CORE-7112. We get this error but not the call to let us show the red banner
                const reason = Message.rpcErrorToString(error)
                storeRegistry
                  .getConvoState(conversationIDKey)
                  .dispatch.onMessageErrored(outboxID, reason, error.typ)

                if (error.typ === T.RPCChat.OutboxErrorType.identify) {
                  // Find out the user who failed identify
                  const match = error.message.match(/"(.*)"/)
                  const tempForceRedBox = match?.[1]
                  if (tempForceRedBox) {
                    storeRegistry
                      .getState('users')
                      .dispatch.updates([{info: {broken: true}, name: tempForceRedBox}])
                  }
                }
              }
              break
            }
            case T.RPCChat.ChatActivityType.membersUpdate:
              convoUnboxRows([T.Chat.conversationIDToKey(activity.membersUpdate.convID)], true)
              break
            case T.RPCChat.ChatActivityType.setAppNotificationSettings: {
              const {setAppNotificationSettings} = activity
              const conversationIDKey = T.Chat.conversationIDToKey(setAppNotificationSettings.convID)
              const settings = setAppNotificationSettings.settings
              const cs = storeRegistry.getConvoState(conversationIDKey)
              if (cs.isMetaGood()) {
                cs.dispatch.updateMeta(Meta.parseNotificationSettings(settings))
              }
              break
            }
            case T.RPCChat.ChatActivityType.expunge: {
              // Get actions to update messagemap / metamap when retention policy expunge happens
              const {expunge} = activity
              const conversationIDKey = T.Chat.conversationIDToKey(expunge.convID)
              const staticConfig = get().staticConfig
              // The types here are askew. It confuses frontend MessageType with protocol MessageType.
              // Placeholder is an example where it doesn't make sense.
              const deletableMessageTypes = staticConfig?.deletableByDeleteHistory || Common.allMessageTypes
              storeRegistry.getConvoState(conversationIDKey).dispatch.messagesWereDeleted({
                deletableMessageTypes,
                upToMessageID: T.Chat.numberToMessageID(expunge.expunge.upto),
              })
              break
            }
            case T.RPCChat.ChatActivityType.ephemeralPurge: {
              const {ephemeralPurge} = activity
              // Get actions to update messagemap / metamap when ephemeral messages expire
              const conversationIDKey = T.Chat.conversationIDToKey(ephemeralPurge.convID)
              const messageIDs = ephemeralPurge.msgs?.reduce<Array<T.Chat.MessageID>>((arr, msg) => {
                const msgID = Message.getMessageID(msg)
                if (msgID) {
                  arr.push(msgID)
                }
                return arr
              }, [])

              !!messageIDs &&
                storeRegistry.getConvoState(conversationIDKey).dispatch.messagesExploded(messageIDs)
              break
            }
            case T.RPCChat.ChatActivityType.reactionUpdate: {
              // Get actions to update the messagemap when reactions are updated
              const {reactionUpdate} = activity
              const conversationIDKey = T.Chat.conversationIDToKey(reactionUpdate.convID)
              if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
                logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
                break
              }
              const updates = reactionUpdate.reactionUpdates.map(ru => ({
                reactions: Message.reactionMapToReactions(ru.reactions),
                targetMsgID: T.Chat.numberToMessageID(ru.targetMsgID),
              }))
              logger.info(`Got ${updates.length} reaction updates for convID=${conversationIDKey}`)
              storeRegistry.getConvoState(conversationIDKey).dispatch.updateReactions(updates)
              get().dispatch.updateUserReacjis(reactionUpdate.userReacjis)
              break
            }
            case T.RPCChat.ChatActivityType.messagesUpdated: {
              const {messagesUpdated} = activity
              const conversationIDKey = T.Chat.conversationIDToKey(messagesUpdated.convID)
              storeRegistry.getConvoState(conversationIDKey).dispatch.onMessagesUpdated(messagesUpdated)
              break
            }
            default:
          }
          break
        }
        case 'chat.1.NotifyChat.ChatTypingUpdate': {
          const {typingUpdates} = action.payload.params
          typingUpdates?.forEach(u => {
            storeRegistry
              .getConvoState(T.Chat.conversationIDToKey(u.convID))
              .dispatch.setTyping(new Set(u.typers?.map(t => t.username)))
          })
          break
        }
        case 'chat.1.NotifyChat.ChatSetConvRetention': {
          const {conv, convID} = action.payload.params
          if (!conv) {
            logger.warn('onChatSetConvRetention: no conv given')
            return
          }
          const meta = Meta.inboxUIItemToConversationMeta(conv)
          if (!meta) {
            logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
            return
          }
          const cs = storeRegistry.getConvoState(meta.conversationIDKey)
          // only insert if the convo is already in the inbox
          if (cs.isMetaGood()) {
            cs.dispatch.setMeta(meta)
          }
          break
        }
        case 'chat.1.NotifyChat.ChatSetTeamRetention': {
          const {convs} = action.payload.params
          const metas = (convs ?? []).reduce<Array<T.Chat.ConversationMeta>>((l, c) => {
            const meta = Meta.inboxUIItemToConversationMeta(c)
            if (meta) {
              l.push(meta)
            }
            return l
          }, [])
          if (metas.length) {
            metas.forEach(meta => {
              const cs = storeRegistry.getConvoState(meta.conversationIDKey)
              // only insert if the convo is already in the inbox
              if (cs.isMetaGood()) {
                cs.dispatch.setMeta(meta)
              }
            })
          } else {
            logger.error(
              'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
            )
          }
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
              md && item && arr.push({item, md})
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
      const metas: Array<T.Chat.ConversationMeta> = []
      const usernameToFullname: {[username: string]: string} = {}
      inboxUIItems.forEach(inboxUIItem => {
        const meta = Meta.inboxUIItemToConversationMeta(inboxUIItem)
        if (meta) {
          metas.push(meta)
        }
        const participantInfo: T.Chat.ParticipantInfo = Common.uiParticipantsToParticipantInfo(
          inboxUIItem.participants ?? []
        )
        if (participantInfo.all.length > 0) {
          storeRegistry
            .getConvoState(T.Chat.stringToConversationIDKey(inboxUIItem.convID))
            .dispatch.setParticipants(participantInfo)
        }
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
      if (metas.length > 0) {
        convoMetasReceived(metas)
      }
    },
    onGetInboxUnverifiedConvs: action => {
      const {inbox} = action.payload.params
      const result = JSON.parse(inbox) as T.RPCChat.UnverifiedInboxUIItems
      const items: ReadonlyArray<T.RPCChat.UnverifiedInboxUIItem> = result.items ?? []
      // We get a subset of meta information from the cache even in the untrusted payload
      const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, item) => {
        const m = Meta.unverifiedInboxUIItemToConversationMeta(item)
        m && arr.push(m)
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
    onTeamBuildingFinished: users => {
      const f = async () => {
        // need to let the mdoal hide first else its thrashy
        await timeoutPromise(500)
        storeRegistry
          .getConvoState(T.Chat.pendingWaitingConversationIDKey)
          .dispatch.navigateToThread('justCreated')
        get().dispatch.createConversation([...users].map(u => u.id))
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
      const explodingItems = items.filter(i =>
        i.item.category.startsWith(Common.explodingModeGregorKeyPrefix)
      )
      if (!explodingItems.length) {
        // No conversations have exploding modes, clear out what is set
        for (const s of chatStores.values()) {
          s.getState().dispatch.setExplodingMode(0, true)
        }
      } else {
        // logger.info('Got push state with some exploding modes')
        explodingItems.forEach(i => {
          try {
            const {category, body} = i.item
            const secondsString = uint8ArrayToString(body)
            const seconds = parseInt(secondsString, 10)
            if (isNaN(seconds)) {
              logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
              return
            }
            const _conversationIDKey = category.substring(Common.explodingModeGregorKeyPrefix.length)
            const conversationIDKey = T.Chat.stringToConversationIDKey(_conversationIDKey)
            storeRegistry.getConvoState(conversationIDKey).dispatch.setExplodingMode(seconds, true)
          } catch (e) {
            logger.info('Error parsing exploding' + e)
          }
        })
      }

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
