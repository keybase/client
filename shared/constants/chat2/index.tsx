import * as C from '..'
import * as Tabs from '../tabs'
import * as EngineGen from '../../actions/engine-gen-gen'
import type * as ConfigConstants from '../config'
import * as Message from './message'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as Router2 from '../router2'
import * as TeamConstants from '../teams'
import * as Types from '../types/chat2'
import logger from '../../logger'
import type * as TeamsTypes from '../types/teams'
import type * as Wallet from '../types/wallets'
import {RPCError} from '../../util/errors'
import {inboxUIItemToConversationMeta, updateMeta, parseNotificationSettings} from './meta'
import {isMobile, isPhone} from '../platform'
import {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
} from '../types/chat2/common'
import type * as TeamBuildingTypes from '../types/team-building'
import * as Z from '../../util/zustand'
import {
  explodingModeGregorKeyPrefix,
  getSelectedConversation,
  allMessageTypes,
  threadRouteName,
  waitingKeyCreating,
} from './common'

export const defaultTopReacjis = [
  {name: ':+1:'},
  {name: ':-1:'},
  {name: ':tada:'},
  {name: ':joy:'},
  {name: ':sunglasses:'},
]
const defaultSkinTone = 1
export const defaultUserReacjis = {skinTone: defaultSkinTone, topReacjis: defaultTopReacjis}

// while we're debugging chat issues
export const DEBUG_CHAT_DUMP = true

export const blockButtonsGregorPrefix = 'blockButtons.'

export const inboxSearchMaxTextMessages = 25
export const inboxSearchMaxTextResults = 50
export const inboxSearchMaxNameResults = 7
export const inboxSearchMaxUnreadNameResults = isMobile ? 5 : 10

export const makeInboxSearchInfo = (): Types.InboxSearchInfo => ({
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

export const getInboxSearchSelected = (inboxSearch: Types.InboxSearchInfo) => {
  const {selectedIndex, nameResults, botsResults, openTeamsResults, textResults} = inboxSearch
  const firstTextResultIdx = botsResults.length + openTeamsResults.length + nameResults.length
  const firstOpenTeamResultIdx = nameResults.length

  if (selectedIndex < firstOpenTeamResultIdx) {
    const maybeNameResults = nameResults[selectedIndex]
    const conversationIDKey =
      maybeNameResults === null || maybeNameResults === undefined
        ? undefined
        : maybeNameResults.conversationIDKey
    if (conversationIDKey) {
      return {
        conversationIDKey,
        query: undefined,
      }
    }
  } else if (selectedIndex < firstTextResultIdx) {
    return null
  } else if (selectedIndex >= firstTextResultIdx) {
    const result = textResults[selectedIndex - firstTextResultIdx]
    if (result) {
      return {
        conversationIDKey: result.conversationIDKey,
        query: result.query,
      }
    }
  }

  return null
}

export const isTextOrAttachment = (
  message: Types.Message
): message is Types.Message | Types.MessageAttachment => {
  return message.type === 'text' || message.type === 'attachment'
}

export const getMessageKey = (message: Types.Message) =>
  `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`

export const getBotsAndParticipants = (
  meta: Types.ConversationMeta,
  participantInfo: Types.ParticipantInfo,
  sort?: boolean
) => {
  const isAdhocTeam = meta.teamType === 'adhoc'
  const teamMembers = C.useTeamsState.getState().teamIDToMembers.get(meta.teamID) ?? new Map()
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
  let participants: Array<string> = participantInfo.all
  if (teamMembers && meta.channelname === 'general') {
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

// When user clicks wallets icon in chat input, set seenWalletsGregorKey with
// body of 'true'
export const seenWalletsGregorKey = 'chat.seenWallets'

export const makeInboxQuery = (
  convIDKeys: Array<Types.ConversationIDKey>,
  allStatuses?: boolean
): RPCChatTypes.GetInboxLocalQuery => {
  return {
    computeActiveList: true,
    convIDs: convIDKeys.map(Types.keyToConversationID),
    memberStatus: Object.keys(RPCChatTypes.ConversationMemberStatus)
      .filter(
        k =>
          typeof RPCChatTypes.ConversationMemberStatus[k as any] === 'number' &&
          (!!allStatuses || !['neverJoined', 'left', 'removed'].includes(k as any))
      )
      .map(
        k => RPCChatTypes.ConversationMemberStatus[k as any]
      ) as unknown as Array<RPCChatTypes.ConversationMemberStatus>,
    readOnly: false,
    status: Object.keys(RPCChatTypes.ConversationStatus)
      .filter(k => typeof RPCChatTypes.ConversationStatus[k as any] === 'number')
      .filter(k => !['ignored', 'blocked', 'reported'].includes(k as any))
      .map(
        k => RPCChatTypes.ConversationStatus[k as any]
      ) as unknown as Array<RPCChatTypes.ConversationStatus>,
    tlfVisibility: RPCTypes.TLFVisibility.private,
    topicType: RPCChatTypes.TopicType.chat,
    unreadOnly: false,
  }
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

export const messageAuthorIsBot = (
  state: TeamConstants.State,
  meta: Types.ConversationMeta,
  message: Types.Message,
  participantInfo: Types.ParticipantInfo
) => {
  const teamID = meta.teamID
  return meta.teamname
    ? TeamConstants.userIsRoleInTeam(state, teamID, message.author, 'restrictedbot') ||
        TeamConstants.userIsRoleInTeam(state, teamID, message.author, 'bot')
    : meta.teamType === 'adhoc' && participantInfo.name.length > 0 // teams without info may have type adhoc with an empty participant name list
    ? !participantInfo.name.includes(message.author) // if adhoc, check if author in participants
    : false // if we don't have team information, don't show bot icon
}

export const getBotRestrictBlockMap = (
  settings: Map<string, RPCChatTypes.Keybase1.TeamBotSettings | undefined>,
  conversationIDKey: Types.ConversationIDKey,
  bots: Array<string>
) => {
  const blocks = new Map<string, boolean>()
  bots.forEach(b => {
    const botSettings = settings.get(b)
    if (!botSettings) {
      blocks.set(b, false)
      return
    }
    const convs = botSettings.convs
    const cmds = botSettings.cmds
    blocks.set(b, !cmds || (!((convs?.length ?? 0) === 0) && !convs?.find(c => c === conversationIDKey)))
  })
  return blocks
}

export const uiParticipantsToParticipantInfo = (uiParticipants: Array<RPCChatTypes.UIParticipant>) => {
  const participantInfo: Types.ParticipantInfo = {all: [], contactName: new Map(), name: []}
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
  return (bigTeams || []).some(
    v => v.state === RPCChatTypes.UIInboxBigTeamRowTyp.label && v.label.id === teamID
  )
}

// prettier-ignore
type PreviewReason =
  | 'appLink' | 'channelHeader' | 'convertAdHoc' | 'files' | 'forward' | 'fromAReset'
  | 'journeyCardPopular' | 'manageView' | 'memberView' | 'messageLink' | 'newChannel'
  | 'profile' | 'requestedPayment' | 'resetChatWithoutThem' | 'search' | 'sentPayment'
  | 'teamHeader' | 'teamInvite' | 'teamMember' | 'teamMention' | 'teamRow' | 'tracker' | 'transaction'

type Store = {
  // increments when the convo stores values change, badges and unread
  badgeCountsChanged: number
  botPublicCommands: Map<string, Types.BotPublicCommands>
  createConversationError?: Types.CreateConversationError
  smallTeamBadgeCount: number
  bigTeamBadgeCount: number
  smallTeamsExpanded: boolean // if we're showing all small teams,
  lastCoord?: Types.Coordinate
  paymentStatusMap: Map<Wallet.PaymentID, Types.ChatPaymentInfo>
  staticConfig?: Types.StaticConfig // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded,
  trustedInboxHasLoaded: boolean // if we've done initial trusted inbox load,
  userReacjis: Types.UserReacjis
  userEmojis?: RPCChatTypes.EmojiGroup[]
  userEmojisForAutocomplete?: Array<RPCChatTypes.Emoji>
  infoPanelShowing: boolean
  infoPanelSelectedTab?: 'settings' | 'members' | 'attachments' | 'bots'
  inboxNumSmallRows?: number
  inboxHasLoaded: boolean // if we've ever loaded,
  inboxLayout?: RPCChatTypes.UIInboxLayout // layout of the inbox
  inboxSearch?: Types.InboxSearchInfo
  teamIDToGeneralConvID: Map<TeamsTypes.TeamID, Types.ConversationIDKey>
  flipStatusMap: Map<string, RPCChatTypes.UICoinFlipStatus>
  maybeMentionMap: Map<string, RPCChatTypes.UIMaybeMentionInfo>
  blockButtonsMap: Map<RPCTypes.TeamID, Types.BlockButtonsInfo> // Should we show block buttons for this team ID?
}

const initialStore: Store = {
  badgeCountsChanged: 0,
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

export type State = Store & {
  dispatch: {
    badgesUpdated: (bigTeamBadgeCount: number, smallTeamBadgeCount: number) => void
    clearMetas: () => void
    conversationErrored: (
      allowedUsers: Array<string>,
      disallowedUsers: Array<string>,
      code: number,
      message: string
    ) => void
    createConversation: (participants: Array<string>, highlightMessageID?: number) => void
    findGeneralConvIDFromTeamID: (teamID: TeamsTypes.TeamID) => void
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
      conversationIDKey?: Types.ConversationIDKey,
      query?: string,
      selectedIndex?: number
    ) => void
    loadStaticConfig: () => void
    loadedUserEmoji: (results: RPCChatTypes.UserEmojiRes) => void
    messageSendByUsername: (username: string, text: string, waitingKey?: string) => void
    metasReceived: (
      metas: Array<Types.ConversationMeta>,
      removals?: Array<Types.ConversationIDKey> // convs to remove
    ) => void
    navigateToInbox: () => void
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    onIncomingInboxUIItem: (inboxUIItem?: RPCChatTypes.InboxUIItem) => void
    onRouteChanged: (prev: Router2.NavState, next: Router2.NavState) => void
    onTeamBuildingFinished: (users: Set<TeamBuildingTypes.User>) => void
    paymentInfoReceived: (paymentInfo: Types.ChatPaymentInfo) => void
    previewConversation: (p: {
      participants?: Array<string>
      teamname?: string
      channelname?: string
      conversationIDKey?: Types.ConversationIDKey // we only use this when we click on channel mentions. we could maybe change that plumbing but keeping it for now
      highlightMessageID?: number
      reason: PreviewReason
    }) => void
    queueMetaToRequest: (ids: Array<Types.ConversationIDKey>) => void
    queueMetaHandle: () => void
    refreshBotPublicCommands: (username: string) => void
    resetConversationErrored: () => void
    resetState: () => void
    setMaybeMentionInfo: (name: string, info: RPCChatTypes.UIMaybeMentionInfo) => void
    setTrustedInboxHasLoaded: () => void
    showInfoPanel: (
      show: boolean,
      tab: 'settings' | 'members' | 'attachments' | 'bots' | undefined,
      conversationIDKey: Types.ConversationIDKey
    ) => void
    setInboxNumSmallRows: (rows: number, ignoreWrite?: boolean) => void
    toggleInboxSearch: (enabled: boolean) => void
    toggleSmallTeamsExpanded: () => void
    unboxRows: (ids: Array<Types.ConversationIDKey>, force?: boolean) => void
    updateCoinFlipStatus: (statuses: Array<RPCChatTypes.UICoinFlipStatus>) => void
    updateInboxLayout: (layout: string) => void
    updateLastCoord: (coord: Types.Coordinate) => void
    updateUserReacjis: (userReacjis: RPCTypes.UserReacjis) => void
    updatedGregor: (items: ConfigConstants.Store['gregorPushState']) => void
  }
  getBadgeMap: (badgeCountsChanged: number) => Map<string, number>
  getUnreadMap: (badgeCountsChanged: number) => Map<string, number>
}

// Only get the untrusted conversations out
const untrustedConversationIDKeys = (ids: Array<Types.ConversationIDKey>) =>
  ids.filter(id => C.getConvoState(id).meta.trustedState === 'untrusted')

// generic chat store
export const _useState = Z.createZustand<State>((set, get) => {
  // We keep a set of conversations to unbox
  let metaQueue = new Set<Types.ConversationIDKey>()

  const dispatch: State['dispatch'] = {
    badgesUpdated: (bigTeamBadgeCount, smallTeamBadgeCount) => {
      set(s => {
        s.smallTeamBadgeCount = smallTeamBadgeCount
        s.bigTeamBadgeCount = bigTeamBadgeCount
        s.badgeCountsChanged++
      })
    },
    clearMetas: () => {
      for (const [, cs] of C.chatStores) {
        cs.getState().dispatch.setMeta()
      }
    },
    conversationErrored: (allowedUsers, disallowedUsers, code, message) => {
      set(s => {
        s.createConversationError = {
          allowedUsers,
          code,
          disallowedUsers,
          message,
        }
      })
    },
    createConversation: (participants, highlightMessageID) => {
      // TODO This will break if you try to make 2 new conversations at the same time because there is
      // only one pending conversation state.
      // The fix involves being able to make multiple pending conversations
      const f = async () => {
        const username = C.useCurrentUserState.getState().username
        if (!username) {
          logger.error('Making a convo while logged out?')
          return
        }
        try {
          const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
            {
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
              membersType: RPCChatTypes.ConversationMembersType.impteamnative,
              tlfName: [...new Set([username, ...participants])].join(','),
              tlfVisibility: RPCTypes.TLFVisibility.private,
              topicType: RPCChatTypes.TopicType.chat,
            },
            waitingKeyCreating
          )
          const {conv, uiConv} = result
          const conversationIDKey = Types.conversationIDToKey(conv.info.id)
          if (!conversationIDKey) {
            logger.warn("Couldn't make a new conversation?")
          } else {
            const meta = inboxUIItemToConversationMeta(uiConv)
            if (meta) {
              get().dispatch.metasReceived([meta])
            }

            const participantInfo: Types.ParticipantInfo = uiParticipantsToParticipantInfo(
              uiConv.participants ?? []
            )
            if (participantInfo.all.length > 0) {
              C.getConvoState(Types.stringToConversationIDKey(uiConv.convID)).dispatch.setParticipants(
                participantInfo
              )
            }
            C.getConvoState(conversationIDKey).dispatch.navigateToThread('justCreated', highlightMessageID)
          }
        } catch (error) {
          if (error instanceof RPCError) {
            const errUsernames = error.fields?.filter((elem: any) => elem.key === 'usernames') as
              | undefined
              | Array<{key: string; value: string}>
            let disallowedUsers: Array<string> = []
            if (errUsernames?.length) {
              const {value} = errUsernames[0] ?? {value: ''}
              disallowedUsers = value.split(',')
            }
            const allowedUsers = participants.filter(x => !disallowedUsers?.includes(x))
            get().dispatch.conversationErrored(allowedUsers, disallowedUsers, error.code, error.desc)
            C.getConvoState(pendingErrorConversationIDKey).dispatch.navigateToThread(
              'justCreated',
              highlightMessageID
            )
          }
        }
      }
      Z.ignorePromise(f())
    },
    findGeneralConvIDFromTeamID: teamID => {
      const f = async () => {
        try {
          const conv = await RPCChatTypes.localFindGeneralConvFromTeamIDRpcPromise({teamID})
          const meta = inboxUIItemToConversationMeta(conv)
          if (!meta) {
            logger.info(`findGeneralConvIDFromTeamID: failed to convert to meta`)
            return
          }
          get().dispatch.metasReceived([meta])
          set(s => {
            s.teamIDToGeneralConvID.set(teamID, Types.stringToConversationIDKey(conv.convID))
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`findGeneralConvIDFromTeamID: failed to get general conv: ${error.message}`)
          }
        }
      }
      Z.ignorePromise(f())
    },
    inboxRefresh: reason => {
      const f = async () => {
        const {username} = C.useCurrentUserState.getState()
        const {loggedIn} = C.useConfigState.getState()
        if (!loggedIn || !username) {
          return
        }
        const clearExistingMetas = reason === 'inboxSyncedClear'
        const clearExistingMessages = reason === 'inboxSyncedClear'

        logger.info(`Inbox refresh due to ${reason}`)
        const reselectMode =
          get().inboxHasLoaded || isPhone
            ? RPCChatTypes.InboxLayoutReselectMode.default
            : RPCChatTypes.InboxLayoutReselectMode.force
        await RPCChatTypes.localRequestInboxLayoutRpcPromise({reselectMode})
        if (clearExistingMetas) {
          get().dispatch.clearMetas()
        }
        if (clearExistingMessages) {
          for (const [, cs] of C.chatStores) {
            cs.getState().dispatch.setMessageOrdinals()
            cs.getState().dispatch.replaceMessageMap(new Map())
          }
        }
      }
      Z.ignorePromise(f())
    },
    inboxSearch: query => {
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch) {
          inboxSearch.query = query
        }
      })
      const f = async () => {
        const teamType = (t: RPCChatTypes.TeamType) => (t === RPCChatTypes.TeamType.complex ? 'big' : 'small')

        const onConvHits = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchConvHits']['inParam']
        ) => {
          const results = (resp.hits.hits || []).reduce<Array<Types.InboxSearchConvHit>>((arr, h) => {
            arr.push({
              conversationIDKey: Types.stringToConversationIDKey(h.convID),
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

          const missingMetas = results.reduce<Array<Types.ConversationIDKey>>((arr, r) => {
            if (C.getConvoState(r.conversationIDKey).meta.conversationIDKey !== r.conversationIDKey) {
              arr.push(r.conversationIDKey)
            }
            return arr
          }, [])
          if (missingMetas.length > 0) {
            get().dispatch.unboxRows(missingMetas, true)
          }
        }

        const onOpenTeamHits = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchTeamHits']['inParam']
        ) => {
          const results = (resp.hits.hits || []).reduce<Array<Types.InboxSearchOpenTeamHit>>((arr, h) => {
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
              inboxSearch.openTeamsResults = results
              inboxSearch.openTeamsStatus = 'success'
            }
          })
        }

        const onBotsHits = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchBotHits']['inParam']
        ) => {
          const results = resp.hits.hits || []
          const suggested = resp.hits.suggestedMatches
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch?.botsStatus === 'inprogress') {
              inboxSearch.botsResultsSuggested = suggested
              inboxSearch.botsResults = results
              inboxSearch.botsStatus = 'success'
            }
          })
        }

        const onTextHit = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchInboxHit']['inParam']
        ) => {
          const {convID, convName, hits, query, teamType: tt, time} = resp.searchHit

          const result = {
            conversationIDKey: Types.conversationIDToKey(convID),
            name: convName,
            numHits: hits?.length ?? 0,
            query,
            teamType: teamType(tt),
            time,
          } as const
          set(s => {
            const {inboxSearch} = s
            if (inboxSearch && inboxSearch.textStatus === 'inprogress') {
              const {conversationIDKey} = result
              const textResults = inboxSearch.textResults.filter(
                r => r.conversationIDKey !== conversationIDKey
              )
              textResults.push(result)
              inboxSearch.textResults = textResults.sort((l, r) => r.time - l.time)
            }
          })

          if (C.getConvoState(result.conversationIDKey).meta.conversationIDKey === noConversationIDKey) {
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
            s.inboxSearch = inboxSearch
            inboxSearch.textStatus = status
          })
        }

        const onIndexStatus = (
          resp: RPCChatTypes.MessageTypes['chat.1.chatUi.chatSearchIndexStatus']['inParam']
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
          await RPCChatTypes.localSearchInboxRpcListener(
            {
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
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
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
                  maxNameConvs:
                    query.length > 0 ? inboxSearchMaxNameResults : inboxSearchMaxUnreadNameResults,
                  maxTeams: 10,
                  reindexMode: RPCChatTypes.ReIndexingMode.postsearchSync,
                  sentAfter: 0,
                  sentBefore: 0,
                  sentBy: '',
                  sentTo: '',
                  skipBotCache: false,
                },
                query,
              },
            },
            Z.dummyListenerApi
          )
        } catch (error) {
          if (error instanceof RPCError) {
            if (!(error.code === RPCTypes.StatusCode.sccanceled)) {
              logger.error('search failed: ' + error.message)
              set(s => {
                const status = 'error'
                const inboxSearch = s.inboxSearch ?? makeInboxSearchInfo()
                s.inboxSearch = inboxSearch
                inboxSearch.textStatus = status
              })
            }
          }
        }
      }
      Z.ignorePromise(f())
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
    inboxSearchSelect: (conversationIDKey, q, selectedIndex) => {
      let query = q
      set(s => {
        const {inboxSearch} = s
        if (inboxSearch && selectedIndex != null) {
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

      C.getConvoState(conversationIDKey).dispatch.navigateToThread('inboxSearch')
      if (query) {
        const cs = C.getConvoState(conversationIDKey)
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
      const {handshakeVersion, dispatch} = C.useDaemonState.getState()
      const f = async () => {
        const name = 'chat.loadStatic'
        dispatch.wait(name, handshakeVersion, true)
        try {
          const res = await RPCChatTypes.localGetStaticConfigRpcPromise()
          if (!res.deletableByDeleteHistory) {
            logger.error('chat.loadStaticConfig: got no deletableByDeleteHistory in static config')
            return
          }
          const deletableByDeleteHistory = res.deletableByDeleteHistory.reduce<Array<Types.MessageType>>(
            (res, type) => {
              const ourTypes = Message.serviceMessageTypeToMessageTypes(type)
              if (ourTypes) {
                res.push(...ourTypes)
              }
              return res
            },
            []
          )
          set(s => {
            s.staticConfig = {
              builtinCommands: (res.builtinCommands || []).reduce<Types.StaticConfig['builtinCommands']>(
                (map, c) => {
                  map[c.typ] = c.commands || []
                  return map
                },
                {
                  [RPCChatTypes.ConversationBuiltinCommandTyp.none]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.adhoc]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.smallteam]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.bigteam]: [],
                  [RPCChatTypes.ConversationBuiltinCommandTyp.bigteamgeneral]: [],
                }
              ),
              deletableByDeleteHistory: new Set(deletableByDeleteHistory),
            }
          })
        } finally {
          dispatch.wait(name, handshakeVersion, false)
        }
      }
      Z.ignorePromise(f())
    },
    loadedUserEmoji: results => {
      set(s => {
        const newEmojis: Array<RPCChatTypes.Emoji> = []
        results.emojis.emojis?.forEach(group => {
          group.emojis?.forEach(e => newEmojis.push(e))
        })
        s.userEmojisForAutocomplete = newEmojis
        s.userEmojis = results.emojis.emojis ?? []
      })
    },
    messageSendByUsername: (username, text, waitingKey) => {
      const f = async () => {
        const tlfName = `${C.useCurrentUserState.getState().username},${username}`
        try {
          const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
            {
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
              membersType: RPCChatTypes.ConversationMembersType.impteamnative,
              tlfName,
              tlfVisibility: RPCTypes.TLFVisibility.private,
              topicType: RPCChatTypes.TopicType.chat,
            },
            waitingKey
          )
          C.getConvoState(Types.conversationIDToKey(result.conv.info.id)).dispatch.messageSend(
            text,
            undefined,
            waitingKey
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.warn('Could not send in messageSendByUsernames', error.message)
          }
        }
      }
      Z.ignorePromise(f())
    },
    metasReceived: (metas, removals) => {
      removals?.forEach(r => {
        C.getConvoState(r).dispatch.setMeta()
      })
      metas.forEach(m => {
        const {meta: oldMeta, dispatch} = C.getConvoState(m.conversationIDKey)
        dispatch.setMeta(oldMeta.conversationIDKey === m.conversationIDKey ? updateMeta(oldMeta, m) : m)
      })

      const selectedConversation = getSelectedConversation()
      const meta = C.getConvoState(selectedConversation).meta
      if (meta.conversationIDKey === selectedConversation) {
        const {teamID} = meta
        if (!C.useTeamsState.getState().teamIDToMembers.get(teamID) && meta.teamname) {
          C.useTeamsState.getState().dispatch.getMembers(teamID)
        }
      }
    },
    navigateToInbox: () => {
      C.useRouterState.getState().dispatch.navUpToScreen('chatRoot')
      C.useRouterState.getState().dispatch.switchTab(Tabs.chatTab)
    },
    onEngineConnected: () => {
      const f = async () => {
        try {
          await RPCTypes.delegateUiCtlRegisterChatUIRpcPromise()
          await RPCTypes.delegateUiCtlRegisterLogUIRpcPromise()
          console.log('Registered Chat UI')
        } catch (error) {
          console.warn('Error in registering Chat UI:', error)
        }
      }
      Z.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.chat1ChatUiChatInboxFailed: // fallthrough
        case EngineGen.chat1NotifyChatChatSetConvSettings: // fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentUploadStart: // fallthrough
        case EngineGen.chat1NotifyChatChatAttachmentUploadProgress: {
          const {convID} = action.payload.params
          const conversationIDKey = Types.conversationIDToKey(convID)
          C.getConvoState(conversationIDKey).dispatch.onEngineIncoming(action)
          break
        }
        case EngineGen.chat1NotifyChatNewChatActivity: {
          const {activity} = action.payload.params
          switch (activity.activityType) {
            case RPCChatTypes.ChatActivityType.incomingMessage: {
              const {incomingMessage} = activity
              const conversationIDKey = Types.conversationIDToKey(incomingMessage.convID)
              C.getConvoState(conversationIDKey).dispatch.onIncomingMessage(incomingMessage)
              get().dispatch.onIncomingInboxUIItem(incomingMessage.conv ?? undefined)
              break
            }
            case RPCChatTypes.ChatActivityType.setStatus:
              get().dispatch.onIncomingInboxUIItem(activity.setStatus.conv ?? undefined)
              break
            case RPCChatTypes.ChatActivityType.readMessage:
              get().dispatch.onIncomingInboxUIItem(activity.readMessage.conv ?? undefined)
              break
            case RPCChatTypes.ChatActivityType.newConversation:
              get().dispatch.onIncomingInboxUIItem(activity.newConversation.conv ?? undefined)
              break
            case RPCChatTypes.ChatActivityType.failedMessage: {
              const {failedMessage} = activity
              get().dispatch.onIncomingInboxUIItem(failedMessage.conv ?? undefined)
              const {outboxRecords} = failedMessage
              if (!outboxRecords) return
              for (const outboxRecord of outboxRecords) {
                const s = outboxRecord.state
                if (s.state !== RPCChatTypes.OutboxStateType.error) return
                const {error} = s
                const conversationIDKey = Types.conversationIDToKey(outboxRecord.convID)
                const outboxID = Types.rpcOutboxIDToOutboxID(outboxRecord.outboxID)
                // This is temp until fixed by CORE-7112. We get this error but not the call to let us show the red banner
                const reason = Message.rpcErrorToString(error)
                C.getConvoState(conversationIDKey).dispatch.onMessageErrored(outboxID, reason, error.typ)

                if (error.typ === RPCChatTypes.OutboxErrorType.identify) {
                  // Find out the user who failed identify
                  const match = error.message.match(/"(.*)"/)
                  const tempForceRedBox = match?.[1]
                  if (tempForceRedBox) {
                    C.useUsersState
                      .getState()
                      .dispatch.updates([{info: {broken: true}, name: tempForceRedBox}])
                  }
                }
              }
              break
            }
            case RPCChatTypes.ChatActivityType.membersUpdate:
              get().dispatch.unboxRows([Types.conversationIDToKey(activity.membersUpdate.convID)], true)
              break
            case RPCChatTypes.ChatActivityType.setAppNotificationSettings: {
              const {setAppNotificationSettings} = activity
              const conversationIDKey = Types.conversationIDToKey(setAppNotificationSettings.convID)
              const settings = setAppNotificationSettings.settings
              const cs = C.getConvoState(conversationIDKey)
              if (cs.meta.conversationIDKey === conversationIDKey) {
                cs.dispatch.updateMeta(parseNotificationSettings(settings))
              }
              break
            }
            case RPCChatTypes.ChatActivityType.expunge: {
              // Get actions to update messagemap / metamap when retention policy expunge happens
              const {expunge} = activity
              const conversationIDKey = Types.conversationIDToKey(expunge.convID)
              const staticConfig = get().staticConfig
              // The types here are askew. It confuses frontend MessageType with protocol MessageType.
              // Placeholder is an example where it doesn't make sense.
              const deletableMessageTypes = staticConfig?.deletableByDeleteHistory || allMessageTypes
              C.getConvoState(conversationIDKey).dispatch.messagesWereDeleted({
                deletableMessageTypes,
                upToMessageID: expunge.expunge.upto,
              })
              break
            }
            case RPCChatTypes.ChatActivityType.ephemeralPurge: {
              const {ephemeralPurge} = activity
              // Get actions to update messagemap / metamap when ephemeral messages expire
              const conversationIDKey = Types.conversationIDToKey(ephemeralPurge.convID)
              const messageIDs = ephemeralPurge.msgs?.reduce<Array<Types.MessageID>>((arr, msg) => {
                const msgID = Message.getMessageID(msg)
                if (msgID) {
                  arr.push(msgID)
                }
                return arr
              }, [])

              !!messageIDs && C.getConvoState(conversationIDKey).dispatch.messagesExploded(messageIDs)
              break
            }
            case RPCChatTypes.ChatActivityType.reactionUpdate: {
              // Get actions to update the messagemap when reactions are updated
              const {reactionUpdate} = activity
              const conversationIDKey = Types.conversationIDToKey(reactionUpdate.convID)
              if (!reactionUpdate.reactionUpdates || reactionUpdate.reactionUpdates.length === 0) {
                logger.warn(`Got ReactionUpdateNotif with no reactionUpdates for convID=${conversationIDKey}`)
                break
              }
              const updates = reactionUpdate.reactionUpdates.map(ru => ({
                reactions: Message.reactionMapToReactions(ru.reactions),
                targetMsgID: ru.targetMsgID,
              }))
              logger.info(`Got ${updates.length} reaction updates for convID=${conversationIDKey}`)
              C.getConvoState(conversationIDKey).dispatch.updateReactions(updates)
              get().dispatch.updateUserReacjis(reactionUpdate.userReacjis)
              break
            }
            case RPCChatTypes.ChatActivityType.messagesUpdated: {
              const {messagesUpdated} = activity
              const conversationIDKey = Types.conversationIDToKey(messagesUpdated.convID)
              C.getConvoState(conversationIDKey).dispatch.onMessagesUpdated(messagesUpdated)
              break
            }
            default:
          }
          break
        }
        case EngineGen.chat1NotifyChatChatTypingUpdate: {
          const {typingUpdates} = action.payload.params
          typingUpdates?.forEach(u => {
            C.getConvoState(Types.conversationIDToKey(u.convID)).dispatch.setTyping(
              new Set(u.typers?.map(t => t.username))
            )
          })
          break
        }
        case EngineGen.chat1NotifyChatChatSetConvRetention: {
          const {conv, convID} = action.payload.params
          if (!conv) {
            logger.warn('onChatSetConvRetention: no conv given')
            return
          }
          const meta = inboxUIItemToConversationMeta(conv)
          if (!meta) {
            logger.warn(`onChatSetConvRetention: no meta found for ${convID.toString()}`)
            return
          }
          const cs = C.getConvoState(meta.conversationIDKey)
          // only insert if the convo is already in the inbox
          if (cs.meta.conversationIDKey === meta.conversationIDKey) {
            cs.dispatch.setMeta(meta)
          }
          break
        }
        case EngineGen.chat1NotifyChatChatSetTeamRetention: {
          const {convs} = action.payload.params
          const metas = (convs ?? []).reduce<Array<Types.ConversationMeta>>((l, c) => {
            const meta = inboxUIItemToConversationMeta(c)
            if (meta) {
              l.push(meta)
            }
            return l
          }, [])
          if (metas.length) {
            metas.forEach(meta => {
              const cs = C.getConvoState(meta.conversationIDKey)
              // only insert if the convo is already in the inbox
              if (cs.meta.conversationIDKey === meta.conversationIDKey) {
                cs.dispatch.setMeta(meta)
              }
            })
            C.useTeamsState.getState().dispatch.updateTeamRetentionPolicy(metas)
          }
          // this is a more serious problem, but we don't need to bug the user about it
          logger.error(
            'got NotifyChat.ChatSetTeamRetention with no attached InboxUIItems. The local version may be out of date'
          )
          break
        }
        default:
      }
    },
    onIncomingInboxUIItem: conv => {
      if (!conv) return
      const meta = inboxUIItemToConversationMeta(conv)
      const usernameToFullname = (conv.participants ?? []).reduce<{[key: string]: string}>((map, part) => {
        if (part.fullName) {
          map[part.assertion] = part.fullName
        }
        return map
      }, {})

      C.useUsersState.getState().dispatch.updates(
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
        const wasModal = prev && C.getModalStack(prev).length > 0
        const isModal = next && C.getModalStack(next).length > 0
        // ignore if changes involve a modal
        if (wasModal || isModal) {
          return
        }
        const p = Router2.getVisibleScreen(prev)
        const n = Router2.getVisibleScreen(next)
        const wasChat = p?.name === threadRouteName
        const isChat = n?.name === threadRouteName
        // nothing to do with chat
        if (!wasChat && !isChat) {
          return
        }
        // @ts-ignore
        const wasID: string | undefined = p?.params?.conversationIDKey
        // @ts-ignore
        const isID: string | undefined = n?.params?.conversationIDKey

        logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

        // same? ignore
        if (wasChat && isChat && wasID === isID) {
          // if we've never loaded anything, keep going so we load it
          if (!isID || C.getConvoState(isID).containsLatestMessage !== undefined) {
            return
          }
        }

        // deselect if there was one
        const deselectAction = () => {
          if (wasChat && wasID && Types.isValidConversationIDKey(wasID)) {
            get().dispatch.unboxRows([wasID], true)
          }
        }

        // still chatting? just select new one
        if (wasChat && isChat && isID && Types.isValidConversationIDKey(isID)) {
          deselectAction()
          C.getConvoState(isID).dispatch.selectedConversation()
          return
        }

        // leaving a chat
        if (wasChat && !isChat) {
          deselectAction()
          return
        }

        // going into a chat
        if (isChat && isID && Types.isValidConversationIDKey(isID)) {
          deselectAction()
          C.getConvoState(isID).dispatch.selectedConversation()
          return
        }
      }

      const maybeChatTabSelected = () => {
        if (Router2.getTab(prev) !== Tabs.chatTab && Router2.getTab(next) === Tabs.chatTab) {
          const n = Router2.getVisibleScreen(next)
          // @ts-ignore
          const isID: string | undefined = n?.params?.conversationIDKey
          isID && C.getConvoState(isID).dispatch.tabSelected()
        }
      }
      maybeChangeChatSelection()
      maybeChatTabSelected()
    },
    onTeamBuildingFinished: users => {
      const f = async () => {
        // need to let the mdoal hide first else its thrashy
        await Z.timeoutPromise(500)
        C.getConvoState(pendingWaitingConversationIDKey).dispatch.navigateToThread('justCreated')
        get().dispatch.createConversation([...users].map(u => u.id))
      }
      Z.ignorePromise(f())
    },
    paymentInfoReceived: paymentInfo => {
      set(s => {
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
    },
    previewConversation: p => {
      // We always make adhoc convos and never preview it
      const previewConversationPersonMakesAConversation = () => {
        const {participants, teamname, reason, highlightMessageID} = p
        if (teamname) return
        if (!participants) return

        // if stellar just search first, could do others maybe
        if ((reason === 'requestedPayment' || reason === 'sentPayment') && participants.length === 1) {
          const username = C.useCurrentUserState.getState().username
          const toFind = participants[0]
          for (const cs of C.chatStores.values()) {
            const p = cs.getState().participants
            if (p.name.length === 2) {
              const other = p.name.filter(n => n !== username)
              if (other[0] === toFind) {
                C.getConvoState(cs.getState().id).dispatch.navigateToThread('justCreated')
                return
              }
            }
          }
        }

        C.getConvoState(pendingWaitingConversationIDKey).dispatch.navigateToThread('justCreated')
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
            await RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
              convID: Types.keyToConversationID(conversationIDKey),
            })
          }

          C.getConvoState(conversationIDKey).dispatch.navigateToThread('previewResolved', highlightMessageID)
          return
        }

        if (!teamname) {
          return
        }

        const channelname = p.channelname || 'general'
        try {
          const results = await RPCChatTypes.localFindConversationsLocalRpcPromise({
            identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            membersType: RPCChatTypes.ConversationMembersType.team,
            oneChatPerTLF: true,
            tlfName: teamname,
            topicName: channelname,
            topicType: RPCChatTypes.TopicType.chat,
            visibility: RPCTypes.TLFVisibility.private,
          })
          const resultMetas = (results.uiConversations || [])
            .map(row => inboxUIItemToConversationMeta(row))
            .filter(Boolean)

          const first = resultMetas[0]
          if (!first) {
            if (p.reason === 'appLink') {
              C.useDeepLinksState
                .getState()
                .dispatch.setLinkError(
                  "We couldn't find this team chat channel. Please check that you're a member of the team and the channel exists."
                )
              C.useRouterState.getState().dispatch.navigateAppend('keybaseLinkError')
              return
            } else {
              return
            }
          }

          const results2 = await RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
            convID: Types.keyToConversationID(first.conversationIDKey),
          })
          const meta = inboxUIItemToConversationMeta(results2.conv)
          if (meta) {
            _useState.getState().dispatch.metasReceived([meta])
          }

          C.getConvoState(first.conversationIDKey).dispatch.navigateToThread(
            'previewResolved',
            highlightMessageID
          )
        } catch (error) {
          if (
            error instanceof RPCError &&
            error.code === RPCTypes.StatusCode.scteamnotfound &&
            reason === 'appLink'
          ) {
            C.useDeepLinksState
              .getState()
              .dispatch.setLinkError(
                "We couldn't find this team. Please check that you're a member of the team and the channel exists."
              )
            C.useRouterState.getState().dispatch.navigateAppend('keybaseLinkError')
            return
          } else {
            throw error
          }
        }
      }
      previewConversationPersonMakesAConversation()
      Z.ignorePromise(previewConversationTeam())
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
          await Z.timeoutPromise(100)
        }
        if (metaQueue.size) {
          get().dispatch.queueMetaHandle()
        }
      }
      Z.ignorePromise(f())
    },
    queueMetaToRequest: ids => {
      let added = false
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
        let res: RPCChatTypes.ListBotCommandsLocalRes | undefined
        try {
          res = await RPCChatTypes.localListPublicBotCommandsLocalRpcPromise({
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
      Z.ignorePromise(f())
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
          await RPCTypes.configGuiSetValueRpcPromise({
            path: 'ui.inboxSmallRows',
            value: {i: inboxNumSmallRows, isNull: false},
          })
        } catch (_) {}
      }
      Z.ignorePromise(f())
    },
    setMaybeMentionInfo: (name, info) => {
      set(s => {
        const {maybeMentionMap} = s
        maybeMentionMap.set(name, info)
      })
    },
    setTrustedInboxHasLoaded: () => {
      set(s => {
        s.trustedInboxHasLoaded = true
      })
    },
    showInfoPanel: (show, tab, conversationIDKey) => {
      set(s => {
        s.infoPanelShowing = show
        s.infoPanelSelectedTab = show ? tab : undefined
      })

      if (isPhone) {
        const visibleScreen = Router2.getVisibleScreen()
        if ((visibleScreen?.name === 'chatInfoPanel') !== show) {
          if (show) {
            C.useRouterState
              .getState()
              .dispatch.navigateAppend({props: {conversationIDKey, tab}, selected: 'chatInfoPanel'})
          } else {
            C.useRouterState.getState().dispatch.navigateUp()
            conversationIDKey && C.getConvoState(conversationIDKey).dispatch.clearAttachmentView()
          }
        }
      }
    },
    toggleInboxSearch: enabled => {
      set(s => {
        const {inboxSearch} = s
        if (enabled && !inboxSearch) {
          s.inboxSearch = makeInboxSearchInfo()
        } else if (!enabled && inboxSearch) {
          s.inboxSearch = undefined
        }
      })
      const f = async () => {
        const {inboxSearch} = get()
        if (!inboxSearch) {
          await RPCChatTypes.localCancelActiveInboxSearchRpcPromise()
          return
        }
        if (inboxSearch.nameStatus === 'initial') {
          get().dispatch.inboxSearch('')
        }
      }
      Z.ignorePromise(f())
    },
    toggleSmallTeamsExpanded: () => {
      set(s => {
        s.smallTeamsExpanded = !s.smallTeamsExpanded
      })
    },
    unboxRows: (ids, force) => {
      // We want to unbox rows that have scroll into view
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }

        // Get valid keys that we aren't already loading or have loaded
        const conversationIDKeys = force
          ? ids
          : ids.reduce((arr: Array<string>, id) => {
              if (id && Types.isValidConversationIDKey(id)) {
                const cs = C.getConvoState(id)
                const trustedState = cs.meta.trustedState
                if (trustedState !== 'requesting' && trustedState !== 'trusted') {
                  arr.push(id)
                  cs.dispatch.updateMeta({
                    trustedState: 'requesting',
                  })
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
          await RPCChatTypes.localRequestInboxUnboxRpcPromise({
            convIDs: conversationIDKeys.map(k => Types.keyToConversationID(k)),
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(`unboxRows: failed ${error.desc}`)
          }
        }
      }
      Z.ignorePromise(f())
    },
    updateCoinFlipStatus: statuses => {
      set(s => {
        const {flipStatusMap} = s
        statuses.forEach(status => {
          flipStatusMap.set(status.gameID, status)
        })
      })
    },
    updateInboxLayout: str => {
      set(s => {
        try {
          const {inboxHasLoaded} = s
          const layout: RPCChatTypes.UIInboxLayout = JSON.parse(str)
          s.inboxLayout = layout
          s.inboxHasLoaded = true
          if (!inboxHasLoaded) {
            // on first layout, initialize any drafts and muted status
            // After the first layout, any other updates will come in the form of meta updates.
            layout.smallTeams?.forEach(t => {
              const cs = C.getConvoState(t.convID)
              cs.dispatch.setMuted(t.isMuted)
              cs.dispatch.setDraft(t.draft ?? '')
            })
            layout.bigTeams?.forEach(t => {
              if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
                const cs = C.getConvoState(t.channel.convID)
                cs.dispatch.setMuted(t.channel.isMuted)
                cs.dispatch.setDraft(t.channel.draft ?? '')
              }
            })
          }
        } catch (e) {
          logger.info('failed to JSON parse inbox layout: ' + e)
        }
      })
    },
    updateLastCoord: coord => {
      set(s => {
        s.lastCoord = coord
      })
      const f = async () => {
        const {accuracy, lat, lon} = coord
        await RPCChatTypes.localLocationUpdateRpcPromise({coord: {accuracy, lat, lon}})
      }
      Z.ignorePromise(f())
    },
    updateUserReacjis: userReacjis => {
      set(s => {
        const {skinTone, topReacjis} = userReacjis
        s.userReacjis.skinTone = skinTone
        s.userReacjis.topReacjis = topReacjis || defaultTopReacjis
      })
    },
    updatedGregor: items => {
      const explodingItems = items.filter(i => i.item.category.startsWith(explodingModeGregorKeyPrefix))
      if (!explodingItems.length) {
        // No conversations have exploding modes, clear out what is set
        for (const s of C.chatStores.values()) {
          s.getState().dispatch.setExplodingMode(0, true)
        }
      } else {
        logger.info('Got push state with some exploding modes')
        explodingItems.forEach(i => {
          try {
            const {category, body} = i.item
            const secondsString = Buffer.from(body).toString()
            const seconds = parseInt(secondsString, 10)
            if (isNaN(seconds)) {
              logger.warn(`Got dirty exploding mode ${secondsString} for category ${category}`)
              return
            }
            const _conversationIDKey = category.substring(explodingModeGregorKeyPrefix.length)
            const conversationIDKey = Types.stringToConversationIDKey(_conversationIDKey)
            C.getConvoState(conversationIDKey).dispatch.setExplodingMode(seconds, true)
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
                  const body = C.bodyToJSON(i.item.body) as {adder: string}
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
    getBadgeMap: badgeCountsChanged => {
      badgeCountsChanged // this param is just to ensure the selector reruns on a change
      const badgeMap = new Map()
      C.chatStores.forEach(s => {
        const {id, badge} = s.getState()
        badgeMap.set(id, badge)
      })
      return badgeMap
    },
    getUnreadMap: badgeCountsChanged => {
      badgeCountsChanged // this param is just to ensure the selector reruns on a change
      const unreadMap = new Map()
      C.chatStores.forEach(s => {
        const {id, unread} = s.getState()
        unreadMap.set(id, unread)
      })
      return unreadMap
    },
  }
})

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
