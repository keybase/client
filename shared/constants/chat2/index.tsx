import * as T from '../types'
import {ignorePromise, timeoutPromise, type ViewPropsToPageProps} from '../utils'
import * as Tabs from '../tabs'
import * as EngineGen from '@/actions/engine-gen-gen'
import type * as ConfigConstants from '../config'
import * as Message from './message'
import * as Router2 from '../router2'
import * as TeamConstants from '../teams/util'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import * as Meta from './meta'
import {isMobile, isPhone} from '../platform'
import * as Z from '@/util/zustand'
import * as Common from './common'
import {clearChatStores, chatStores} from './convostate'
import {uint8ArrayToString} from 'uint8array-extras'
import isEqual from 'lodash/isEqual'
import {bodyToJSON} from '../rpc-utils'
import {navigateAppend, navUpToScreen, switchTab} from '../router2/util'
import {storeRegistry} from '../store-registry'
import * as S from '../strings'

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

export const inboxSearchMaxTextMessages = 25
export const inboxSearchMaxTextResults = 50
export const inboxSearchMaxNameResults = 7
export const inboxSearchMaxUnreadNameResults = isMobile ? 5 : 10

export const makeInboxSearchInfo = (): T.Chat.InboxSearchInfo => ({
  botsResults: [],
  botsResultsSuggested: false,
  botsStatus: 'initial',
  indexPercent: 0,
  nameResults: [],
  nameResultsUnread: false,
  nameStatus: 'initial',
  openTeamsResults: [],
  openTeamsResultsSuggested: false,
  openTeamsStatus: 'initial',
  query: '',
  selectedIndex: 0,
  textResults: [],
  textStatus: 'initial',
})

const getInboxSearchSelected = (
  inboxSearch: T.Immutable<T.Chat.InboxSearchInfo>
):
  | undefined
  | {
      conversationIDKey: T.Chat.ConversationIDKey
      query?: string
    } => {
  const {selectedIndex, nameResults, botsResults, openTeamsResults, textResults} = inboxSearch
  const firstTextResultIdx = botsResults.length + openTeamsResults.length + nameResults.length
  const firstOpenTeamResultIdx = nameResults.length

  if (selectedIndex < firstOpenTeamResultIdx) {
    const maybeNameResults = nameResults[selectedIndex]
    const conversationIDKey = maybeNameResults === undefined ? undefined : maybeNameResults.conversationIDKey
    if (conversationIDKey) {
      return {
        conversationIDKey,
        query: undefined,
      }
    }
  } else if (selectedIndex < firstTextResultIdx) {
    return
  } else if (selectedIndex >= firstTextResultIdx) {
    const result = textResults[selectedIndex - firstTextResultIdx]
    if (result) {
      return {
        conversationIDKey: result.conversationIDKey,
        query: result.query,
      }
    }
  }
  return
}

export const getMessageKey = (message: T.Chat.Message) =>
  `${message.conversationIDKey}:${T.Chat.ordinalToNumber(message.ordinal)}`

export const getBotsAndParticipants = (
  meta: T.Immutable<T.Chat.ConversationMeta>,
  participantInfo: T.Immutable<T.Chat.ParticipantInfo>,
  sort?: boolean
) => {
  const isAdhocTeam = meta.teamType === 'adhoc'
  const teamMembers =
    storeRegistry.getState('teams').teamIDToMembers.get(meta.teamID) ?? new Map<string, T.Teams.MemberInfo>()
  let bots: Array<string> = []
  if (isAdhocTeam) {
    bots = participantInfo.all.filter(p => !participantInfo.name.includes(p))
  } else {
    bots = [...teamMembers.values()]
      .filter(
        p =>
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'restrictedbot') ||
          TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }
  let participants: ReadonlyArray<string> = participantInfo.all
  if (meta.channelname === 'general') {
    participants = [...teamMembers.values()].reduce<Array<string>>((l, mi) => {
      l.push(mi.username)
      return l
    }, [])
  }
  participants = participants.filter(p => !bots.includes(p))
  participants = sort
    ? participants
        .map(p => ({
          isAdmin: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'admin') : false,
          isOwner: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(teamMembers, p, 'owner') : false,
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

const uiParticipantsToParticipantInfo = (
  uiParticipants: ReadonlyArray<T.RPCChat.UIParticipant>
): T.Chat.ParticipantInfo => {
  const participantInfo = {all: new Array<string>(), contactName: new Map(), name: new Array<string>()}
  uiParticipants.forEach(part => {
    const {assertion, contactName, inConvName} = part
    participantInfo.all.push(assertion)
    if (inConvName) {
      participantInfo.name.push(assertion)
    }
    if (contactName) {
      participantInfo.contactName.set(assertion, contactName)
    }
  })
  return participantInfo
}

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: State, teamID: string): boolean => {
  const bigTeams = state.inboxLayout?.bigTeams
  return (bigTeams || []).some(v => v.state === T.RPCChat.UIInboxBigTeamRowTyp.label && v.label.id === teamID)
}

// prettier-ignore
type PreviewReason =
  | 'appLink' | 'channelHeader' | 'convertAdHoc' | 'files' | 'forward' | 'fromAReset'
  | 'journeyCardPopular' | 'manageView' | 'memberView' | 'messageLink' | 'newChannel'
  | 'profile' | 'requestedPayment' | 'resetChatWithoutThem' | 'search' | 'sentPayment'
  | 'teamHeader' | 'teamInvite' | 'teamMember' | 'teamMention' | 'teamRow' | 'tracker' | 'transaction'

type Store = T.Immutable<{
  botPublicCommands: Map<string, T.Chat.BotPublicCommands>
  createConversationError?: T.Chat.CreateConversationError
  smallTeamBadgeCount: number
  bigTeamBadgeCount: number
  smallTeamsExpanded: boolean // if we're showing all small teams,
  lastCoord?: T.Chat.Coordinate
  paymentStatusMap: Map<T.Wallets.PaymentID, T.Chat.ChatPaymentInfo>
  staticConfig?: T.Chat.StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  userReacjis: T.Chat.UserReacjis
  userEmojis?: Array<T.RPCChat.EmojiGroup>
  userEmojisForAutocomplete?: Array<T.RPCChat.Emoji>
  infoPanelShowing: boolean
  infoPanelSelectedTab?: 'settings' | 'members' | 'attachments' | 'bots'
  inboxNumSmallRows?: number
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout?: T.RPCChat.UIInboxLayout // layout of the inbox
  inboxSearch?: T.Chat.InboxSearchInfo
  teamIDToGeneralConvID: Map<T.Teams.TeamID, T.Chat.ConversationIDKey>
  flipStatusMap: Map<string, T.RPCChat.UICoinFlipStatus>
  maybeMentionMap: Map<string, T.RPCChat.UIMaybeMentionInfo>
  blockButtonsMap: Map<T.RPCGen.TeamID, T.Chat.BlockButtonsInfo> // Should we show block buttons for this team ID?
}>

const initialStore: Store = {
  bigTeamBadgeCount: 0,
  blockButtonsMap: new Map(),
  botPublicCommands: new Map(),
  createConversationError: undefined,
  flipStatusMap: new Map(),
  inboxHasLoaded: false,
  inboxLayout: undefined,
  inboxNumSmallRows: 5,
  inboxSearch: undefined,
  infoPanelSelectedTab: undefined,
  infoPanelShowing: false,
  lastCoord: undefined,
  maybeMentionMap: new Map(),
  paymentStatusMap: new Map(),
  smallTeamBadgeCount: 0,
  smallTeamsExpanded: false,
  staticConfig: undefined,
  teamIDToGeneralConvID: new Map(),
  trustedInboxHasLoaded: false,
  userEmojis: undefined,
  userEmojisForAutocomplete: undefined,
  userReacjis: defaultUserReacjis,
}

export interface State extends Store {
  dispatch: {
    badgesUpdated: (badgeState?: T.RPCGen.BadgeState) => void
    clearMetas: () => void
    conversationErrored: (
      allowedUsers: ReadonlyArray<string>,
      disallowedUsers: ReadonlyArray<string>,
      code: number,
      message: string
    ) => void
    createConversation: (participants: ReadonlyArray<string>, highlightMessageID?: T.Chat.MessageID) => void
    ensureWidgetMetas: () => void
    findGeneralConvIDFromTeamID: (teamID: T.Teams.TeamID) => void
    fetchUserEmoji: (conversationIDKey?: T.Chat.ConversationIDKey, onlyInTeam?: boolean) => void
    inboxRefresh: (
      reason:
        | 'bootstrap'
        | 'componentNeverLoaded'
        | 'inboxStale'
        | 'inboxSyncedClear'
        | 'inboxSyncedUnknown'
        | 'joinedAConversation'
        | 'leftAConversation'
        | 'teamTypeChanged'
        | 'maybeKickedFromTeam'
        | 'widgetRefresh'
        | 'shareConfigSearch'
    ) => void
    inboxSearch: (query: string) => void
    inboxSearchMoveSelectedIndex: (increment: boolean) => void
    inboxSearchSelect: (
      conversationIDKey?: T.Chat.ConversationIDKey,
      query?: string,
      selectedIndex?: number
    ) => void
    loadStaticConfig: () => void
    loadedUserEmoji: (results: T.RPCChat.UserEmojiRes) => void
    maybeChangeSelectedConv: () => void
    messageSendByUsername: (username: string, text: string, waitingKey?: string) => void
    metasReceived: (
      metas: ReadonlyArray<T.Chat.ConversationMeta>,
      removals?: ReadonlyArray<T.Chat.ConversationIDKey> // convs to remove
    ) => void
    navigateToInbox: (allowSwitchTab?: boolean) => void
    onChatThreadStale: (action: EngineGen.Chat1NotifyChatChatThreadsStalePayload) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    onChatInboxSynced: (action: EngineGen.Chat1NotifyChatChatInboxSyncedPayload) => void
    onGetInboxConvsUnboxed: (action: EngineGen.Chat1ChatUiChatInboxConversationPayload) => void
    onGetInboxUnverifiedConvs: (action: EngineGen.Chat1ChatUiChatInboxUnverifiedPayload) => void
    onIncomingInboxUIItem: (inboxUIItem?: T.RPCChat.InboxUIItem) => void
    onRouteChanged: (prev: T.Immutable<Router2.NavState>, next: T.Immutable<Router2.NavState>) => void
    onTeamBuildingFinished: (users: ReadonlySet<T.TB.User>) => void
    paymentInfoReceived: (paymentInfo: T.Chat.ChatPaymentInfo) => void
    previewConversation: (p: {
      participants?: ReadonlyArray<string>
      teamname?: string
      channelname?: string
      conversationIDKey?: T.Chat.ConversationIDKey // we only use this when we click on channel mentions. we could maybe change that plumbing but keeping it for now
      highlightMessageID?: T.Chat.MessageID
      reason: PreviewReason
    }) => void
    queueMetaToRequest: (ids: ReadonlyArray<T.Chat.ConversationIDKey>) => void
    queueMetaHandle: () => void
    refreshBotPublicCommands: (username: string) => void
    resetConversationErrored: () => void
    resetState: () => void
    setMaybeMentionInfo: (name: string, info: T.RPCChat.UIMaybeMentionInfo) => void
    setTrustedInboxHasLoaded: () => void
    setInfoPanelTab: (tab: 'settings' | 'members' | 'attachments' | 'bots' | undefined) => void
    setInboxNumSmallRows: (rows: number, ignoreWrite?: boolean) => void
    toggleInboxSearch: (enabled: boolean) => void
    toggleSmallTeamsExpanded: () => void
    unboxRows: (ids: Array<T.Chat.ConversationIDKey>, force?: boolean) => void
    updateCoinFlipStatus: (statuses: ReadonlyArray<T.RPCChat.UICoinFlipStatus>) => void
    updateInboxLayout: (layout: string) => void
    updateLastCoord: (coord: T.Chat.Coordinate) => void
    updateUserReacjis: (userReacjis: T.RPCGen.UserReacjis) => void
    updatedGregor: (items: ConfigConstants.State['gregorPushState']) => void
    updateInfoPanel: (show: boolean, tab: 'settings' | 'members' | 'attachments' | 'bots' | undefined) => void
  }
  getBackCount: (conversationIDKey: T.Chat.ConversationIDKey) => number
  getBadgeHiddenCount: (ids: Set<T.Chat.ConversationIDKey>) => {badgeCount: number; hiddenCount: number}
  getUnreadIndicies: (ids: Array<T.Chat.ConversationIDKey>) => Map<number, number>
}

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (ids: ReadonlyArray<T.Chat.ConversationIDKey>) =>
  ids.filter(id => storeRegistry.getConvoState(id).meta.trustedState === 'untrusted')

// generic chat store
export const useChatState = Z.createZustand<State>((set, get) => {
  // We keep a set of conversations to unbox
  let metaQueue = new Set<T.Chat.ConversationIDKey>()

  const dispatch: State['dispatch'] = {
    badgesUpdated: b => {
      if (!b) return
      // clear all first
      for (const [, cs] of chatStores) {
        cs.getState().dispatch.badgesUpdated(0)
      }
      b.conversations?.forEach(c => {
        const id = T.Chat.conversationIDToKey(c.convID)
        storeRegistry.getConvoState(id).dispatch.badgesUpdated(c.badgeCount)
        storeRegistry.getConvoState(id).dispatch.unreadUpdated(c.unreadMessages)
      })
      const {bigTeamBadgeCount, smallTeamBadgeCount} = b
      set(s => {
        s.smallTeamBadgeCount = smallTeamBadgeCount
        s.bigTeamBadgeCount = bigTeamBadgeCount
      })
    },
    clearMetas: () => {
      for (const [, cs] of chatStores) {
        cs.getState().dispatch.setMeta()
      }
    },
    conversationErrored: (allowedUsers, disallowedUsers, code, message) => {
      set(s => {
        s.createConversationError = T.castDraft({
          allowedUsers,
          code,
          disallowedUsers,
          message,
        })
      })
    },
    createConversation: (participants, highlightMessageID) => {
      // TODO This will break if you try to make 2 new conversations at the same time because there is
      // only one pending conversation state.
      // The fix involves being able to make multiple pending conversations
      const f = async () => {
        const username = storeRegistry.getState('current-user').username
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
              get().dispatch.metasReceived([meta])
            }

            const participantInfo: T.Chat.ParticipantInfo = uiParticipantsToParticipantInfo(
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
            get().dispatch.conversationErrored(allowedUsers, disallowedUsers, error.code, error.desc)
            storeRegistry
              .getConvoState(T.Chat.pendingErrorConversationIDKey)
              .dispatch.navigateToThread('justCreated', highlightMessageID)
          }
        }
      }
      ignorePromise(f())
    },
    ensureWidgetMetas: () => {
      const {inboxLayout} = get()
      if (!inboxLayout?.widgetList) {
        return
      }
      const missing = inboxLayout.widgetList.reduce<Array<T.Chat.ConversationIDKey>>((l, v) => {
        if (!storeRegistry.getConvoState(v.convID).isMetaGood()) {
          l.push(v.convID)
        }
        return l
      }, [])
      if (missing.length === 0) {
        return
      }
      get().dispatch.unboxRows(missing, true)
    },
    fetchUserEmoji: (conversationIDKey, onlyInTeam) => {
      const f = async () => {
        const results = await T.RPCChat.localUserEmojisRpcPromise(
          {
            convID:
              conversationIDKey && conversationIDKey !== T.Chat.noConversationIDKey
                ? T.Chat.keyToConversationID(conversationIDKey)
                : null,
            opts: {
              getAliases: true,
              getCreationInfo: false,
              onlyInTeam: onlyInTeam ?? false,
            },
          },
          S.waitingKeyChatLoadingEmoji
        )
        get().dispatch.loadedUserEmoji(results)
      }
      ignorePromise(f())
    },
    findGeneralConvIDFromTeamID: teamID => {
      const f = async () => {
        try {
          const conv = await T.RPCChat.localFindGeneralConvFromTeamIDRpcPromise({teamID})
          const meta = Meta.inboxUIItemToConversationMeta(conv)
          if (!meta) {
            logger.info(`findGeneralConvIDFromTeamID: failed to convert to meta`)
            return
          }
          get().dispatch.metasReceived([meta])
          set(s => {
            s.teamIDToGeneralConvID.set(teamID, T.Chat.stringToConversationIDKey(conv.convID))
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`findGeneralConvIDFromTeamID: failed to get general conv: ${error.message}`)
          }
        }
      }
      ignorePromise(f())
    },
    inboxRefresh: reason => {
      const f = async () => {
        const {username} = storeRegistry.getState('current-user')
        const {loggedIn} = storeRegistry.getState('config')
        if (!loggedIn || !username) {
          return
        }
        const clearExistingMetas = reason === 'inboxSyncedClear'
        const clearExistingMessages = reason === 'inboxSyncedClear'

        logger.info(`Inbox refresh due to ${reason}`)
        const reselectMode =
          get().inboxHasLoaded || isPhone
            ? T.RPCChat.InboxLayoutReselectMode.default
            : T.RPCChat.InboxLayoutReselectMode.force
        await T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode})
        if (clearExistingMetas) {
          get().dispatch.clearMetas()
        }
        if (clearExistingMessages) {
          for (const [, cs] of chatStores) {
            cs.getState().dispatch.messagesClear()
          }
        }
      }
      ignorePromise(f())
    },
    inboxSearch: query => {
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch) {
          inboxSearch.query = query
        }
      })
      const f = async () => {
        const teamType = (t: T.RPCChat.TeamType) => (t === T.RPCChat.TeamType.complex ? 'big' : 'small')

        const onConvHits = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']) => {
          const results = (resp.hits.hits || []).reduce<Array<T.Chat.InboxSearchConvHit>>((arr, h) => {
            arr.push({
              conversationIDKey: T.Chat.stringToConversationIDKey(h.convID),
              name: h.name,
              teamType: teamType(h.teamType),
            })
            return arr
          }, [])

          set(s => {
            const unread = resp.hits.unreadMatches
            const {inboxSearch} = s
            if (inboxSearch?.nameStatus === 'inprogress') {
              inboxSearch.nameResults = results
              inboxSearch.nameResultsUnread = unread
              inboxSearch.nameStatus = 'success'
            }
          })

          const missingMetas = results.reduce<Array<T.Chat.ConversationIDKey>>((arr, r) => {
            if (!storeRegistry.getConvoState(r.conversationIDKey).isMetaGood()) {
              arr.push(r.conversationIDKey)
            }
            return arr
          }, [])
          if (missingMetas.length > 0) {
            get().dispatch.unboxRows(missingMetas, true)
          }
        }

        const onOpenTeamHits = (
          resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']
        ) => {
          const results = (resp.hits.hits || []).reduce<Array<T.Chat.InboxSearchOpenTeamHit>>((arr, h) => {
            const {description, name, memberCount, inTeam} = h
            arr.push({
              description: description ?? '',
              inTeam,
              memberCount,
              name,
              publicAdmins: [],
            })
            return arr
          }, [])
          const suggested = resp.hits.suggestedMatches
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.openTeamsStatus === 'inprogress') {
              inboxSearch.openTeamsResultsSuggested = suggested
              inboxSearch.openTeamsResults = T.castDraft(results)
              inboxSearch.openTeamsStatus = 'success'
            }
          })
        }

        const onBotsHits = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']) => {
          const results = resp.hits.hits || []
          const suggested = resp.hits.suggestedMatches
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.botsStatus === 'inprogress') {
              inboxSearch.botsResultsSuggested = suggested
              inboxSearch.botsResults = T.castDraft(results)
              inboxSearch.botsStatus = 'success'
            }
          })
        }

        const onTextHit = (resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']) => {
          const {convID, convName, hits, query, teamType: tt, time} = resp.searchHit

          const result = {
            conversationIDKey: T.Chat.conversationIDToKey(convID),
            name: convName,
            numHits: hits?.length ?? 0,
            query,
            teamType: teamType(tt),
            time,
          } as const
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.textStatus === 'inprogress') {
              const {conversationIDKey} = result
              const textResults = inboxSearch.textResults.filter(
                r => r.conversationIDKey !== conversationIDKey
              )
              textResults.push(result)
              inboxSearch.textResults = textResults.sort((l, r) => r.time - l.time)
            }
          })

          if (
            storeRegistry.getConvoState(result.conversationIDKey).meta.conversationIDKey ===
            T.Chat.noConversationIDKey
          ) {
            get().dispatch.unboxRows([result.conversationIDKey], true)
          }
        }
        const onStart = () => {
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch) {
              inboxSearch.nameStatus = 'inprogress'
              inboxSearch.selectedIndex = 0
              inboxSearch.textResults = []
              inboxSearch.textStatus = 'inprogress'
              inboxSearch.openTeamsStatus = 'inprogress'
              inboxSearch.botsStatus = 'inprogress'
            }
          })
        }
        const onDone = () => {
          set(s => {
            const status = 'success'
            const inboxSearch = s.inboxSearch ?? makeInboxSearchInfo()
            s.inboxSearch = T.castDraft(inboxSearch)
            inboxSearch.textStatus = status
          })
        }

        const onIndexStatus = (
          resp: T.RPCChat.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
        ) => {
          const percent = resp.status.percentIndexed
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.textStatus === 'inprogress') {
              inboxSearch.indexPercent = percent
            }
          })
        }

        try {
          await T.RPCChat.localSearchInboxRpcListener({
            incomingCallMap: {
              'chat.1.chatUi.chatSearchBotHits': onBotsHits,
              'chat.1.chatUi.chatSearchConvHits': onConvHits,
              'chat.1.chatUi.chatSearchInboxDone': onDone,
              'chat.1.chatUi.chatSearchInboxHit': onTextHit,
              'chat.1.chatUi.chatSearchInboxStart': onStart,
              'chat.1.chatUi.chatSearchIndexStatus': onIndexStatus,
              'chat.1.chatUi.chatSearchTeamHits': onOpenTeamHits,
            },
            params: {
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              namesOnly: false,
              opts: {
                afterContext: 0,
                beforeContext: 0,
                isRegex: false,
                matchMentions: false,
                maxBots: 10,
                maxConvsHit: inboxSearchMaxTextResults,
                maxConvsSearched: 0,
                maxHits: inboxSearchMaxTextMessages,
                maxMessages: -1,
                maxNameConvs: query.length > 0 ? inboxSearchMaxNameResults : inboxSearchMaxUnreadNameResults,
                maxTeams: 10,
                reindexMode: T.RPCChat.ReIndexingMode.postsearchSync,
                sentAfter: 0,
                sentBefore: 0,
                sentBy: '',
                sentTo: '',
                skipBotCache: false,
              },
              query,
            },
          })
        } catch (error) {
          if (error instanceof RPCError) {
            if (!(error.code === T.RPCGen.StatusCode.sccanceled)) {
              logger.error('search failed: ' + error.message)
              set(s => {
                const status = 'error'
                const inboxSearch = s.inboxSearch ?? makeInboxSearchInfo()
                s.inboxSearch = T.castDraft(inboxSearch)
                inboxSearch.textStatus = status
              })
            }
          }
        }
      }
      ignorePromise(f())
    },
    inboxSearchMoveSelectedIndex: increment => {
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch) {
          const {selectedIndex} = inboxSearch
          const totalResults = inboxSearch.nameResults.length + inboxSearch.textResults.length
          if (increment && selectedIndex < totalResults - 1) {
            inboxSearch.selectedIndex = selectedIndex + 1
          } else if (!increment && selectedIndex > 0) {
            inboxSearch.selectedIndex = selectedIndex - 1
          }
        }
      })
    },
    inboxSearchSelect: (_conversationIDKey, q, selectedIndex) => {
      let conversationIDKey = _conversationIDKey
      let query = q
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch && selectedIndex !== undefined) {
          inboxSearch.selectedIndex = selectedIndex
        }
      })

      const {inboxSearch} = get()
      if (!inboxSearch) {
        return
      }
      const selected = getInboxSearchSelected(inboxSearch)
      if (!conversationIDKey) {
        conversationIDKey = selected?.conversationIDKey
      }

      if (!conversationIDKey) {
        return
      }
      if (!query) {
        query = selected?.query
      }

      storeRegistry.getConvoState(conversationIDKey).dispatch.navigateToThread('inboxSearch')
      if (query) {
        const cs = storeRegistry.getConvoState(conversationIDKey)
        cs.dispatch.setThreadSearchQuery(query)
        cs.dispatch.toggleThreadSearch(false)
        cs.dispatch.threadSearch(query)
      } else {
        get().dispatch.toggleInboxSearch(false)
      }
    },
    loadStaticConfig: () => {
      if (get().staticConfig) {
        return
      }
      const {handshakeVersion, dispatch} = storeRegistry.getState('daemon')
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
    loadedUserEmoji: results => {
      set(s => {
        const newEmojis: Array<T.RPCChat.Emoji> = []
        results.emojis.emojis?.forEach(group => {
          group.emojis?.forEach(e => newEmojis.push(e))
        })
        s.userEmojisForAutocomplete = newEmojis
        s.userEmojis = T.castDraft(results.emojis.emojis) ?? []
      })
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
          get().dispatch.navigateToInbox(false)
        }
        return
      }
      // not matching?
      if (selectedConversation !== oldConvID) {
        if (!existingValid && isPhone) {
          logger.info(`maybeChangeSelectedConv: no new and no valid, so go to inbox`)
          get().dispatch.navigateToInbox(false)
        }
        return
      }
      // matching
      if (isPhone) {
        // on mobile just head back to the inbox if we have something selected
        if (T.Chat.isValidConversationIDKey(selectedConversation)) {
          logger.info(`maybeChangeSelectedConv: mobile: navigating up on conv change`)
          get().dispatch.navigateToInbox(false)
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
    messageSendByUsername: (username, text, waitingKey) => {
      const f = async () => {
        const tlfName = `${storeRegistry.getState('current-user').username},${username}`
        try {
          const result = await T.RPCChat.localNewConversationLocalRpcPromise(
            {
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
              membersType: T.RPCChat.ConversationMembersType.impteamnative,
              tlfName,
              tlfVisibility: T.RPCGen.TLFVisibility.private,
              topicType: T.RPCChat.TopicType.chat,
            },
            waitingKey
          )
          storeRegistry
            .getConvoState(T.Chat.conversationIDToKey(result.conv.info.id))
            .dispatch.sendMessage(text)
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn('Could not send in messageSendByUsernames', error.message)
          }
        }
      }
      ignorePromise(f())
    },
    metasReceived: (metas, removals) => {
      removals?.forEach(r => {
        storeRegistry.getConvoState(r).dispatch.setMeta()
      })
      metas.forEach(m => {
        const {meta: oldMeta, dispatch, isMetaGood} = storeRegistry.getConvoState(m.conversationIDKey)
        if (isMetaGood()) {
          dispatch.updateMeta(Meta.updateMeta(oldMeta, m))
        } else {
          dispatch.setMeta(m)
        }
      })

      const selectedConversation = Common.getSelectedConversation()
      const {isMetaGood, meta} = storeRegistry.getConvoState(selectedConversation)
      if (isMetaGood()) {
        const {teamID} = meta
        if (!storeRegistry.getState('teams').teamIDToMembers.get(teamID) && meta.teamname) {
          storeRegistry.getState('teams').dispatch.getMembers(teamID)
        }
      }
    },
    navigateToInbox: (allowSwitchTab = true) => {
      // components can call us during render sometimes so always defer
      setTimeout(() => {
        navUpToScreen('chatRoot')
        if (allowSwitchTab) {
          switchTab(Tabs.chatTab)
        }
      }, 1)
    },
    onChatInboxSynced: action => {
      const {syncRes} = action.payload.params
      const {clear} = storeRegistry.getState('waiting').dispatch
      const {inboxRefresh} = get().dispatch
      clear(S.waitingKeyChatInboxSyncStarted)

      switch (syncRes.syncType) {
        // Just clear it all
        case T.RPCChat.SyncInboxResType.clear:
          inboxRefresh('inboxSyncedClear')
          break
        // We're up to date
        case T.RPCChat.SyncInboxResType.current:
          break
        // We got some new messages appended
        case T.RPCChat.SyncInboxResType.incremental: {
          const items = syncRes.incremental.items || []
          const selectedConversation = Common.getSelectedConversation()
          let loadMore = false as boolean
          const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, i) => {
            const meta = Meta.unverifiedInboxUIItemToConversationMeta(i.conv)
            if (meta) {
              arr.push(meta)
              if (meta.conversationIDKey === selectedConversation) {
                loadMore = true
              }
            }
            return arr
          }, [])
          if (loadMore) {
            storeRegistry.getConvoState(selectedConversation).dispatch.loadMoreMessages({reason: 'got stale'})
          }
          const removals = syncRes.incremental.removals?.map(T.Chat.stringToConversationIDKey)
          // Update new untrusted
          if (metas.length || removals?.length) {
            get().dispatch.metasReceived(metas, removals)
          }

          get().dispatch.unboxRows(
            items.filter(i => i.shouldUnbox).map(i => T.Chat.stringToConversationIDKey(i.conv.convID)),
            true
          )
          break
        }
        default:
          inboxRefresh('inboxSyncedUnknown')
      }
    },
    onChatThreadStale: (action: EngineGen.Chat1NotifyChatChatThreadsStalePayload) => {
      const {updates} = action.payload.params
      const keys = ['clear', 'newactivity'] as const
      if (__DEV__) {
        if (keys.length * 2 !== Object.keys(T.RPCChat.StaleUpdateType).length) {
          throw new Error('onChatThreadStale invalid enum')
        }
      }
      let loadMore = false as boolean
      const selectedConversation = Common.getSelectedConversation()
      keys.forEach(key => {
        const conversationIDKeys = (updates || []).reduce<Array<string>>((arr, u) => {
          const cid = T.Chat.conversationIDToKey(u.convID)
          if (u.updateType === T.RPCChat.StaleUpdateType[key]) {
            arr.push(cid)
          }
          // mentioned?
          if (cid === selectedConversation) {
            loadMore = true
          }
          return arr
        }, [])
        // load the inbox instead
        if (conversationIDKeys.length > 0) {
          logger.info(
            `onChatThreadStale: dispatching thread reload actions for ${conversationIDKeys.length} convs of type ${key}`
          )
          get().dispatch.unboxRows(conversationIDKeys, true)
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
      if (loadMore) {
        storeRegistry.getConvoState(selectedConversation).dispatch.loadMoreMessages({
          forceClear: true,
          reason: 'got stale',
        })
      }
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.chat1ChatUiChatInboxFailed: // fallthrough
        case EngineGen.chat1NotifyChatChatSetConvSettings: // fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentUploadStart: // fallthrough
        case EngineGen.chat1NotifyChatChatPromptUnfurl: // fallthrough
        case EngineGen.chat1NotifyChatChatPaymentInfo: // fallthrough
        case EngineGen.chat1NotifyChatChatRequestInfo: // fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentDownloadProgress: //fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentDownloadComplete: //fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentUploadProgress: {
          const {convID} = action.payload.params
          const conversationIDKey = T.Chat.conversationIDToKey(convID)
          storeRegistry.getConvoState(conversationIDKey).dispatch.onEngineIncoming(action)
          break
        }
        case EngineGen.chat1ChatUiChatCommandMarkdown: //fallthrough
        case EngineGen.chat1ChatUiChatGiphyToggleResultWindow: // fallthrough
        case EngineGen.chat1ChatUiChatCommandStatus: // fallthrough
        case EngineGen.chat1ChatUiChatBotCommandsUpdateStatus: //fallthrough
        case EngineGen.chat1ChatUiChatGiphySearchResults: {
          const {convID} = action.payload.params
          const conversationIDKey = T.Chat.stringToConversationIDKey(convID)
          storeRegistry.getConvoState(conversationIDKey).dispatch.onEngineIncoming(action)
          break
        }
        case EngineGen.chat1NotifyChatChatParticipantsInfo: {
          const {participants: participantMap} = action.payload.params
          Object.keys(participantMap ?? {}).forEach(convIDStr => {
            const participants = participantMap?.[convIDStr]
            const conversationIDKey = T.Chat.stringToConversationIDKey(convIDStr)
            if (participants) {
              storeRegistry
                .getConvoState(conversationIDKey)
                .dispatch.setParticipants(uiParticipantsToParticipantInfo(participants))
            }
          })
          break
        }
        case EngineGen.chat1ChatUiChatMaybeMentionUpdate: {
          const {teamName, channel, info} = action.payload.params
          get().dispatch.setMaybeMentionInfo(getTeamMentionName(teamName, channel), info)
          break
        }
        case EngineGen.chat1NotifyChatChatConvUpdate: {
          const {conv} = action.payload.params
          if (conv) {
            const meta = Meta.inboxUIItemToConversationMeta(conv)
            meta && get().dispatch.metasReceived([meta])
          }
          break
        }
        case EngineGen.chat1ChatUiChatCoinFlipStatus: {
          const {statuses} = action.payload.params
          get().dispatch.updateCoinFlipStatus(statuses || [])
          break
        }
        case EngineGen.chat1NotifyChatChatThreadsStale:
          get().dispatch.onChatThreadStale(action)
          break
        case EngineGen.chat1NotifyChatChatSubteamRename: {
          const {convs} = action.payload.params
          const conversationIDKeys = (convs ?? []).map(c => T.Chat.stringToConversationIDKey(c.convID))
          get().dispatch.unboxRows(conversationIDKeys, true)
          break
        }
        case EngineGen.chat1NotifyChatChatTLFFinalize:
          get().dispatch.unboxRows([T.Chat.conversationIDToKey(action.payload.params.convID)])
          break
        case EngineGen.chat1NotifyChatChatIdentifyUpdate: {
          // Some participants are broken/fixed now
          const {update} = action.payload.params
          const usernames = update.CanonicalName.split(',')
          const broken = (update.breaks.breaks || []).map(b => b.user.username)
          const updates = usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
          storeRegistry.getState('users').dispatch.updates(updates)
          break
        }
        case EngineGen.chat1ChatUiChatInboxUnverified:
          get().dispatch.onGetInboxUnverifiedConvs(action)
          break
        case EngineGen.chat1NotifyChatChatInboxSyncStarted:
          storeRegistry.getState('waiting').dispatch.increment(S.waitingKeyChatInboxSyncStarted)
          break

        case EngineGen.chat1NotifyChatChatInboxSynced:
          get().dispatch.onChatInboxSynced(action)
          break
        case EngineGen.chat1ChatUiChatInboxLayout:
          get().dispatch.updateInboxLayout(action.payload.params.layout)
          get().dispatch.maybeChangeSelectedConv()
          get().dispatch.ensureWidgetMetas()
          break
        case EngineGen.chat1NotifyChatChatInboxStale:
          get().dispatch.inboxRefresh('inboxStale')
          break
        case EngineGen.chat1ChatUiChatInboxConversation:
          get().dispatch.onGetInboxConvsUnboxed(action)
          break
        case EngineGen.chat1NotifyChatNewChatActivity: {
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
              get().dispatch.unboxRows([T.Chat.conversationIDToKey(activity.membersUpdate.convID)], true)
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
        case EngineGen.chat1NotifyChatChatTypingUpdate: {
          const {typingUpdates} = action.payload.params
          typingUpdates?.forEach(u => {
            storeRegistry
              .getConvoState(T.Chat.conversationIDToKey(u.convID))
              .dispatch.setTyping(new Set(u.typers?.map(t => t.username)))
          })
          break
        }
        case EngineGen.chat1NotifyChatChatSetConvRetention: {
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
        case EngineGen.chat1NotifyChatChatSetTeamRetention: {
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
            storeRegistry.getState('teams').dispatch.updateTeamRetentionPolicy(metas)
          }
          // this is a more serious problem, but we don't need to bug the user about it
          logger.error(
            'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
          )
          break
        }
        case EngineGen.keybase1NotifyBadgesBadgeState: {
          const {badgeState} = action.payload.params
          get().dispatch.badgesUpdated(badgeState)
          break
        }
        case EngineGen.keybase1GregorUIPushState: {
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
    onGetInboxConvsUnboxed: (action: EngineGen.Chat1ChatUiChatInboxConversationPayload) => {
      // TODO not reactive
      const {infoMap} = storeRegistry.getState('users')
      const {convs} = action.payload.params
      const inboxUIItems = JSON.parse(convs) as Array<T.RPCChat.InboxUIItem>
      const metas: Array<T.Chat.ConversationMeta> = []
      let added = false as boolean
      const usernameToFullname: {[username: string]: string} = {}
      inboxUIItems.forEach(inboxUIItem => {
        const meta = Meta.inboxUIItemToConversationMeta(inboxUIItem)
        if (meta) {
          metas.push(meta)
        }
        const participantInfo: T.Chat.ParticipantInfo = uiParticipantsToParticipantInfo(
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
            added = true
            usernameToFullname[assertion] = fullName
          }
        })
      })
      if (added) {
        storeRegistry.getState('users').dispatch.updates(
          Object.keys(usernameToFullname).map(name => ({
            info: {fullname: usernameToFullname[name]},
            name,
          }))
        )
      }
      if (metas.length > 0) {
        get().dispatch.metasReceived(metas)
      }
    },
    onGetInboxUnverifiedConvs: (action: EngineGen.Chat1ChatUiChatInboxUnverifiedPayload) => {
      const {inbox} = action.payload.params
      const result = JSON.parse(inbox) as T.RPCChat.UnverifiedInboxUIItems
      const items: ReadonlyArray<T.RPCChat.UnverifiedInboxUIItem> = result.items ?? []
      // We get a subset of meta information from the cache even in the untrusted payload
      const metas = items.reduce<Array<T.Chat.ConversationMeta>>((arr, item) => {
        const m = Meta.unverifiedInboxUIItemToConversationMeta(item)
        m && arr.push(m)
        return arr
      }, [])
      get().dispatch.setTrustedInboxHasLoaded()
      // Check if some of our existing stored metas might no longer be valid
      get().dispatch.metasReceived(metas)
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

      storeRegistry.getState('users').dispatch.updates(
        Object.keys(usernameToFullname).map(name => ({
          info: {fullname: usernameToFullname[name]},
          name,
        }))
      )

      if (meta) {
        get().dispatch.metasReceived([meta])
      }
    },
    onRouteChanged: (prev, next) => {
      const maybeChangeChatSelection = () => {
        const wasModal = prev && Router2.getModalStack(prev).length > 0
        const isModal = next && Router2.getModalStack(next).length > 0
        // ignore if changes involve a modal
        if (wasModal || isModal) {
          return
        }
        const p = Router2.getVisibleScreen(prev)
        const n = Router2.getVisibleScreen(next)
        const wasChat = p?.name === Common.threadRouteName
        const isChat = n?.name === Common.threadRouteName
        // nothing to do with chat
        if (!wasChat && !isChat) {
          return
        }
        const pParams = p?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
        const nParams = n?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
        const wasID = pParams?.conversationIDKey
        const isID = nParams?.conversationIDKey

        logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

        // same? ignore
        if (wasChat && isChat && wasID === isID) {
          // if we've never loaded anything, keep going so we load it
          if (!isID || storeRegistry.getConvoState(isID).loaded) {
            return
          }
        }

        // deselect if there was one
        const deselectAction = () => {
          if (wasChat && wasID && T.Chat.isValidConversationIDKey(wasID)) {
            get().dispatch.unboxRows([wasID], true)
            // needed?
            // storeRegistry.getConvoState(wasID).dispatch.clearOrangeLine('deselected')
          }
        }

        // still chatting? just select new one
        if (wasChat && isChat && isID && T.Chat.isValidConversationIDKey(isID)) {
          deselectAction()
          storeRegistry.getConvoState(isID).dispatch.selectedConversation()
          return
        }

        // leaving a chat
        if (wasChat && !isChat) {
          deselectAction()
          return
        }

        // going into a chat
        if (isChat && isID && T.Chat.isValidConversationIDKey(isID)) {
          deselectAction()
          storeRegistry.getConvoState(isID).dispatch.selectedConversation()
          return
        }
      }

      const maybeChatTabSelected = () => {
        if (Router2.getTab(prev) !== Tabs.chatTab && Router2.getTab(next) === Tabs.chatTab) {
          const n = Router2.getVisibleScreen(next)
          const nParams = n?.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
          const isID = nParams?.conversationIDKey
          isID && storeRegistry.getConvoState(isID).dispatch.tabSelected()
        }
      }
      maybeChangeChatSelection()
      maybeChatTabSelected()
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
    paymentInfoReceived: paymentInfo => {
      set(s => {
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
    },
    previewConversation: p => {
      // We always make adhoc convos and never preview it
      const previewConversationPersonMakesAConversation = () => {
        const {participants, teamname, highlightMessageID} = p
        if (teamname) return
        if (!participants) return
        const toFind = [...participants].sort().join(',')
        const toFindN = participants.length
        for (const cs of chatStores.values()) {
          const names = cs.getState().participants.name
          if (names.length !== toFindN) continue
          const p = [...names].sort().join(',')
          if (p === toFind) {
            storeRegistry
              .getConvoState(cs.getState().id)
              .dispatch.navigateToThread('justCreated', highlightMessageID)
            return
          }
        }

        storeRegistry
          .getConvoState(T.Chat.pendingWaitingConversationIDKey)
          .dispatch.navigateToThread('justCreated')
        get().dispatch.createConversation(participants, highlightMessageID)
      }

      // We preview channels
      const previewConversationTeam = async () => {
        const {conversationIDKey, highlightMessageID, teamname, reason} = p
        if (conversationIDKey) {
          if (
            reason === 'messageLink' ||
            reason === 'teamMention' ||
            reason === 'channelHeader' ||
            reason === 'manageView'
          ) {
            // Add preview channel to inbox
            await T.RPCChat.localPreviewConversationByIDLocalRpcPromise({
              convID: T.Chat.keyToConversationID(conversationIDKey),
            })
          }

          storeRegistry
            .getConvoState(conversationIDKey)
            .dispatch.navigateToThread('previewResolved', highlightMessageID)
          return
        }

        if (!teamname) {
          return
        }

        const channelname = p.channelname || 'general'
        try {
          const results = await T.RPCChat.localFindConversationsLocalRpcPromise({
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            membersType: T.RPCChat.ConversationMembersType.team,
            oneChatPerTLF: true,
            tlfName: teamname,
            topicName: channelname,
            topicType: T.RPCChat.TopicType.chat,
            visibility: T.RPCGen.TLFVisibility.private,
          })
          const resultMetas = (results.uiConversations || [])
            .map(row => Meta.inboxUIItemToConversationMeta(row))
            .filter(Boolean)

          const first = resultMetas[0]
          if (!first) {
            if (p.reason === 'appLink') {
              storeRegistry
                .getState('deeplinks')
                .dispatch.setLinkError(
                  "We couldn't find this team chat channel. Please check that you're a member of the team and the channel exists."
                )
              navigateAppend('keybaseLinkError')
              return
            } else {
              return
            }
          }

          const results2 = await T.RPCChat.localPreviewConversationByIDLocalRpcPromise({
            convID: T.Chat.keyToConversationID(first.conversationIDKey),
          })
          const meta = Meta.inboxUIItemToConversationMeta(results2.conv)
          if (meta) {
            storeRegistry.getState('chat').dispatch.metasReceived([meta])
          }

          storeRegistry
            .getConvoState(first.conversationIDKey)
            .dispatch.navigateToThread('previewResolved', highlightMessageID)
        } catch (error) {
          if (
            error instanceof RPCError &&
            error.code === T.RPCGen.StatusCode.scteamnotfound &&
            reason === 'appLink'
          ) {
            storeRegistry
              .getState('deeplinks')
              .dispatch.setLinkError(
                "We couldn't find this team. Please check that you're a member of the team and the channel exists."
              )
            navigateAppend('keybaseLinkError')
            return
          } else {
            throw error
          }
        }
      }
      previewConversationPersonMakesAConversation()
      ignorePromise(previewConversationTeam())
    },
    queueMetaHandle: () => {
      // Watch the meta queue and take up to 10 items. Choose the last items first since they're likely still visible
      const f = async () => {
        const maxToUnboxAtATime = 10
        const ar = [...metaQueue]
        const maybeUnbox = ar.slice(0, maxToUnboxAtATime)
        metaQueue = new Set(ar.slice(maxToUnboxAtATime))
        const conversationIDKeys = untrustedConversationIDKeys(maybeUnbox)
        if (conversationIDKeys.length) {
          get().dispatch.unboxRows(conversationIDKeys)
        }
        if (metaQueue.size && conversationIDKeys.length) {
          await timeoutPromise(100)
        }
        if (metaQueue.size) {
          get().dispatch.queueMetaHandle()
        }
      }
      ignorePromise(f())
    },
    queueMetaToRequest: ids => {
      let added = false as boolean
      untrustedConversationIDKeys(ids).forEach(k => {
        if (!metaQueue.has(k)) {
          added = true
          metaQueue.add(k)
        }
      })
      if (added) {
        // only unboxMore if something changed
        get().dispatch.queueMetaHandle()
      } else {
        logger.info('skipping meta queue run, queue unchanged')
      }
    },
    refreshBotPublicCommands: username => {
      set(s => {
        s.botPublicCommands.delete(username)
      })
      const f = async () => {
        let res: T.RPCChat.ListBotCommandsLocalRes | undefined
        try {
          res = await T.RPCChat.localListPublicBotCommandsLocalRpcPromise({
            username,
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info('refreshBotPublicCommands: failed to get public commands: ' + error.message)
            set(s => {
              s.botPublicCommands.set(username, {commands: [], loadError: true})
            })
          }
        }
        const commands = (res?.commands ?? []).reduce<Array<string>>((l, c) => {
          l.push(c.name)
          return l
        }, [])

        set(s => {
          s.botPublicCommands.set(username, {commands, loadError: false})
        })
      }
      ignorePromise(f())
    },
    resetConversationErrored: () => {
      set(s => {
        s.createConversationError = undefined
      })
    },
    resetState: () => {
      set(s => ({
        ...s,
        ...initialStore,
        dispatch: s.dispatch,
        staticConfig: s.staticConfig,
      }))
      // also blow away convoState
      clearChatStores()
    },
    setInboxNumSmallRows: (rows, ignoreWrite) => {
      set(s => {
        if (rows > 0) {
          s.inboxNumSmallRows = rows
        }
      })
      if (ignoreWrite) {
        return
      }
      const {inboxNumSmallRows} = get()
      if (inboxNumSmallRows === undefined || inboxNumSmallRows <= 0) {
        return
      }
      const f = async () => {
        try {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: 'ui.inboxSmallRows',
            value: {i: inboxNumSmallRows, isNull: false},
          })
        } catch {}
      }
      ignorePromise(f())
    },
    setInfoPanelTab: tab => {
      set(s => {
        s.infoPanelSelectedTab = tab
      })
    },
    setMaybeMentionInfo: (name, info) => {
      set(s => {
        const {maybeMentionMap} = s
        maybeMentionMap.set(name, T.castDraft(info))
      })
    },
    setTrustedInboxHasLoaded: () => {
      set(s => {
        s.trustedInboxHasLoaded = true
      })
    },
    toggleInboxSearch: enabled => {
      set(s => {
        const {inboxSearch} = s
        if (enabled && !inboxSearch) {
          s.inboxSearch = T.castDraft(makeInboxSearchInfo())
        } else if (!enabled && inboxSearch) {
          s.inboxSearch = undefined
        }
      })
      const f = async () => {
        const {inboxSearch} = get()
        if (!inboxSearch) {
          await T.RPCChat.localCancelActiveInboxSearchRpcPromise()
          return
        }
        if (inboxSearch.nameStatus === 'initial') {
          get().dispatch.inboxSearch('')
        }
      }
      ignorePromise(f())
    },
    toggleSmallTeamsExpanded: () => {
      set(s => {
        s.smallTeamsExpanded = !s.smallTeamsExpanded
      })
    },
    unboxRows: (ids, force) => {
      // We want to unbox rows that have scroll into view
      const f = async () => {
        if (!storeRegistry.getState('config').loggedIn) {
          return
        }

        // Get valid keys that we aren't already loading or have loaded
        const conversationIDKeys = ids.reduce((arr: Array<string>, id) => {
          if (id && T.Chat.isValidConversationIDKey(id)) {
            const cs = storeRegistry.getConvoState(id)
            const trustedState = cs.meta.trustedState
            if (force || (trustedState !== 'requesting' && trustedState !== 'trusted')) {
              arr.push(id)
              cs.dispatch.updateMeta({trustedState: 'requesting'})
            }
          }
          return arr
        }, [])

        if (!conversationIDKeys.length) {
          return
        }
        logger.info(
          `unboxRows: unboxing len: ${conversationIDKeys.length} convs: ${conversationIDKeys.join(',')}`
        )
        try {
          await T.RPCChat.localRequestInboxUnboxRpcPromise({
            convIDs: conversationIDKeys.map(k => T.Chat.keyToConversationID(k)),
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`unboxRows: failed ${error.desc}`)
          }
        }
      }
      ignorePromise(f())
    },
    updateCoinFlipStatus: statuses => {
      set(s => {
        const {flipStatusMap} = s
        statuses.forEach(status => {
          flipStatusMap.set(status.gameID, T.castDraft(status))
        })
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

          if (!isEqual(s.inboxLayout, layout)) {
            s.inboxLayout = T.castDraft(layout)
          }
          s.inboxHasLoaded = !!layout
          if (!inboxHasLoaded) {
            // on first layout, initialize any drafts and muted status
            // After the first layout, any other updates will come in the form of meta updates.
            layout.smallTeams?.forEach(t => {
              const cs = storeRegistry.getConvoState(t.convID)
              cs.dispatch.updateFromUIInboxLayout(t)
            })
            layout.bigTeams?.forEach(t => {
              if (t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel) {
                const cs = storeRegistry.getConvoState(t.channel.convID)
                cs.dispatch.updateFromUIInboxLayout(t.channel)
              }
            })
          }
        } catch (e) {
          logger.info('failed to JSON parse inbox layout: ' + e)
        }
      })
    },
    updateInfoPanel: (show, tab) => {
      set(s => {
        s.infoPanelShowing = show
        s.infoPanelSelectedTab = tab
      })
    },
    updateLastCoord: coord => {
      set(s => {
        s.lastCoord = coord
      })
      const f = async () => {
        const {accuracy, lat, lon} = coord
        await T.RPCChat.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
      }
      ignorePromise(f())
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
    getBackCount: conversationIDKey => {
      let count = 0
      chatStores.forEach(s => {
        const {id, badge} = s.getState()
        // only show sum of badges that aren't for the current conversation
        if (id !== conversationIDKey) {
          count += badge
        }
      })
      return count
    },
    getBadgeHiddenCount: ids => {
      let badgeCount = 0
      let hiddenCount = 0

      chatStores.forEach(s => {
        const {id, badge} = s.getState()
        if (ids.has(id)) {
          badgeCount -= badge
          hiddenCount -= 1
        }
      })

      return {badgeCount, hiddenCount}
    },
    getUnreadIndicies: ids => {
      const unreadIndices: Map<number, number> = new Map()
      ids.forEach((cur, idx) => {
        Array.from(chatStores.values()).some(s => {
          const {id, badge} = s.getState()
          if (id === cur && badge > 0) {
            unreadIndices.set(idx, badge)
            return true
          }
          return false
        })
      })
      return unreadIndices
    },
  }
})

import {type ChatProviderProps, ProviderScreen} from './convostate'
import type {GetOptionsRet} from '@/constants/types/router2'

export function makeChatScreen<COM extends React.LazyExoticComponent<any>>(
  Component: COM,
  options?: {
    getOptions?: GetOptionsRet | ((props: ChatProviderProps<ViewPropsToPageProps<COM>>) => GetOptionsRet)
    skipProvider?: boolean
    canBeNullConvoID?: boolean
  }
) {
  return {
    ...options,
    screen: function Screen(p: ChatProviderProps<ViewPropsToPageProps<COM>>) {
      const Comp = Component as any
      return options?.skipProvider ? (
        <Comp {...p.route.params} />
      ) : (
        <ProviderScreen rp={p} canBeNull={options?.canBeNullConvoID}>
          <Comp {...p.route.params} />
        </ProviderScreen>
      )
    },
  }
}

export * from './convostate'
export * from './common'
export * from './meta'
export * from './message'

export {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  isValidConversationIDKey,
  dummyConversationIDKey,
} from '../types/chat2/common'
