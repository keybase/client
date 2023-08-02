import * as Chat2Gen from '../../actions/chat2-gen'
import * as TeamsConstants from '../teams'
import * as EngineGen from '../../actions/engine-gen-gen'
import * as ConfigConstants from '../config'
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
import {inboxUIItemToConversationMeta, makeConversationMeta, updateMeta} from './meta'
import {isMobile, isTablet, isPhone} from '../platform'
import {
  noConversationIDKey,
  pendingWaitingConversationIDKey,
  pendingErrorConversationIDKey,
  isValidConversationIDKey,
} from '../types/chat2/common'
import type * as TeamBuildingTypes from '../types/team-building'
import * as Z from '../../util/zustand'
import {getConvoState, stores} from './convostate'
import {explodingModeGregorKeyPrefix} from './common'

export const getMessageRenderType = (m: Types.Message): Types.RenderMessageType => {
  switch (m.type) {
    case 'attachment':
      if (m.inlineVideoPlayable && m.attachmentType !== 'audio') {
        return 'attachment:video'
      }
      return `attachment:${m.attachmentType}`
    default:
      return m.type
  }
}

export const formatTextForQuoting = (text: string) =>
  text
    .split('\n')
    .map(line => `> ${line}\n`)
    .join('')

export const defaultTopReacjis = [
  {name: ':+1:'},
  {name: ':-1:'},
  {name: ':tada:'},
  {name: ':joy:'},
  {name: ':sunglasses:'},
]
const defaultSkinTone = 1
export const defaultUserReacjis = {skinTone: defaultSkinTone, topReacjis: defaultTopReacjis}
export const isSplit = !isMobile || isTablet // Whether the inbox and conversation panels are visible side-by-side.

// while we're debugging chat issues
export const DEBUG_CHAT_DUMP = true

// in split mode the root is the 'inbox'
export const threadRouteName = isSplit ? 'chatRoot' : 'chatConversation'

export const blockButtonsGregorPrefix = 'blockButtons.'

export const makeState = (): Types.State => ({
  messageMap: new Map(), // messages in a thread,
})

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

export const isMessageWithReactions = (message: Types.Message): message is Types.MessagesWithReactions => {
  return (
    !(
      message.type === 'placeholder' ||
      message.type === 'deleted' ||
      message.type === 'systemJoined' ||
      message.type === 'systemLeft' ||
      message.type === 'journeycard'
    ) &&
    !message.exploded &&
    !message.errorReason
  )
}
export const getMessageKey = (message: Types.Message) =>
  `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`
export const getSelectedConversation = (): Types.ConversationIDKey => {
  const maybeVisibleScreen = Router2.getVisibleScreen()
  if (maybeVisibleScreen?.name === threadRouteName) {
    // @ts-ignore TODO better types
    return maybeVisibleScreen.params?.conversationIDKey ?? noConversationIDKey
  }
  return noConversationIDKey
}

export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const isUserActivelyLookingAtThisThread = (conversationIDKey: Types.ConversationIDKey) => {
  const selectedConversationIDKey = getSelectedConversation()

  let chatThreadSelected = false
  if (!isSplit) {
    chatThreadSelected = true // conversationIDKey === selectedConversationIDKey is the only thing that matters in the new router
  } else {
    const maybeVisibleScreen = Router2.getVisibleScreen()
    chatThreadSelected =
      (maybeVisibleScreen === null || maybeVisibleScreen === undefined
        ? undefined
        : maybeVisibleScreen.name) === threadRouteName
  }

  const {appFocused} = ConfigConstants.useConfigState.getState()
  const {active: userActive} = ConfigConstants.useActiveState.getState()

  return (
    appFocused && // app focused?
    userActive && // actually interacting w/ the app
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}

export const getBotsAndParticipants = (
  meta: Types.ConversationMeta,
  participantInfo: Types.ParticipantInfo,
  sort?: boolean
) => {
  const isAdhocTeam = meta.teamType === 'adhoc'
  const teamMembers = TeamConstants.useState.getState().teamIDToMembers.get(meta.teamID) ?? new Map()
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

const numMessagesOnInitialLoad = isMobile ? 20 : 100
const numMessagesOnScrollback = isMobile ? 100 : 100

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

export {
  isValidConversationIDKey,
  noConversationIDKey,
  numMessagesOnInitialLoad,
  numMessagesOnScrollback,
  pendingErrorConversationIDKey,
  pendingWaitingConversationIDKey,
}

export const allMessageTypes: Set<Types.MessageType> = new Set([
  'attachment',
  'deleted',
  'requestPayment',
  'sendPayment',
  'setChannelname',
  'setDescription',
  'systemAddedToTeam',
  'systemChangeRetention',
  'systemGitPush',
  'systemInviteAccepted',
  'systemJoined',
  'systemLeft',
  'systemSBSResolved',
  'systemSimpleToComplex',
  'systemChangeAvatar',
  'systemNewChannel',
  'systemText',
  'systemUsersAddedToConversation',
  'text',
  'placeholder',
])

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: State, teamID: string): boolean => {
  const bigTeams = state.inboxLayout?.bigTeams
  return (bigTeams || []).some(
    v => v.state === RPCChatTypes.UIInboxBigTeamRowTyp.label && v.label.id === teamID
  )
}

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
    conversationErrored: (
      allowedUsers: Array<string>,
      disallowedUsers: Array<string>,
      code: number,
      message: string
    ) => void
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
    metasReceived: (
      metas: Array<Types.ConversationMeta>,
      removals?: Array<Types.ConversationIDKey> // convs to remove
    ) => void
    onEngineConnected: () => void
    onEngineIncoming: (action: EngineGen.Chat1NotifyChatChatTypingUpdatePayload) => void
    onTeamBuildingFinished: (users: Set<TeamBuildingTypes.User>) => void
    paymentInfoReceived: (paymentInfo: Types.ChatPaymentInfo) => void
    refreshBotPublicCommands: (username: string) => void
    resetConversationErrored: () => void
    resetState: () => void
    setMaybeMentionInfo: (name: string, info: RPCChatTypes.UIMaybeMentionInfo) => void
    setTrustedInboxHasLoaded: () => void
    showInfoPanel: (
      show: boolean,
      tab?: 'settings' | 'members' | 'attachments' | 'bots',
      conversationIDKey?: Types.ConversationIDKey
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

// generic chat store
export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()
  const dispatch: State['dispatch'] = {
    badgesUpdated: (bigTeamBadgeCount, smallTeamBadgeCount) => {
      set(s => {
        s.smallTeamBadgeCount = smallTeamBadgeCount
        s.bigTeamBadgeCount = bigTeamBadgeCount
        s.badgeCountsChanged++
      })
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
        const {username} = ConfigConstants.useCurrentUserState.getState()
        const {loggedIn} = ConfigConstants.useConfigState.getState()
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
          reduxDispatch(Chat2Gen.createClearMetas())
        }
        if (clearExistingMessages) {
          reduxDispatch(Chat2Gen.createClearMessages())
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
            if (getConvoState(r.conversationIDKey).meta.conversationIDKey !== r.conversationIDKey) {
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

          if (getConvoState(result.conversationIDKey).meta.conversationIDKey === noConversationIDKey) {
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

      reduxDispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'inboxSearch'}))
      if (query) {
        const cs = getConvoState(conversationIDKey)
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
      const {handshakeVersion, dispatch} = ConfigConstants.useDaemonState.getState()
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
    metasReceived: (metas, removals) => {
      removals?.forEach(r => {
        getConvoState(r).dispatch.setMeta(makeConversationMeta())
      })
      metas.forEach(m => {
        const {meta: oldMeta, dispatch} = getConvoState(m.conversationIDKey)
        dispatch.setMeta(oldMeta.conversationIDKey === m.conversationIDKey ? updateMeta(oldMeta, m) : m)
      })

      const selectedConversation = getSelectedConversation()
      const meta = getConvoState(selectedConversation).meta
      if (meta.conversationIDKey === selectedConversation) {
        const {teamID} = meta
        if (!TeamsConstants.useState.getState().teamIDToMembers.get(teamID) && meta.teamname) {
          TeamsConstants.useState.getState().dispatch.getMembers(teamID)
        }
      }
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
        case EngineGen.chat1NotifyChatChatTypingUpdate: {
          const {typingUpdates} = action.payload.params
          typingUpdates?.forEach(u => {
            getConvoState(Types.conversationIDToKey(u.convID)).dispatch.setTyping(
              new Set(u.typers?.map(t => t.username))
            )
          })
          break
        }
      }
    },
    onTeamBuildingFinished: (users: Set<TeamBuildingTypes.User>) => {
      const f = async () => {
        // need to let the mdoal hide first else its thrashy
        await Z.timeoutPromise(500)
        reduxDispatch(
          Chat2Gen.createNavigateToThread({
            conversationIDKey: pendingWaitingConversationIDKey,
            reason: 'justCreated',
          })
        )
        reduxDispatch(
          Chat2Gen.createCreateConversation({
            participants: [...users].map(u => u.id),
          })
        )
      }
      Z.ignorePromise(f())
    },
    paymentInfoReceived: paymentInfo => {
      set(s => {
        s.paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
      })
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
    showInfoPanel: (
      show: boolean,
      tab?: 'settings' | 'members' | 'attachments' | 'bots',
      conversationIDKey?: Types.ConversationIDKey
    ) => {
      set(s => {
        s.infoPanelShowing = show
        s.infoPanelSelectedTab = show ? tab : undefined
      })

      if (isPhone) {
        const visibleScreen = Router2.getVisibleScreen()
        if ((visibleScreen?.name === 'chatInfoPanel') !== show) {
          if (show) {
            Router2.useState
              .getState()
              .dispatch.navigateAppend({props: {conversationIDKey, tab}, selected: 'chatInfoPanel'})
          } else {
            Router2.useState.getState().dispatch.navigateUp()
            conversationIDKey && getConvoState(conversationIDKey).dispatch.clearAttachmentView()
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
        const ConfigConstants = await import('../config')
        if (!ConfigConstants.useConfigState.getState().loggedIn) {
          return
        }

        // Get valid keys that we aren't already loading or have loaded
        const conversationIDKeys = force
          ? ids
          : ids.reduce((arr: Array<string>, id) => {
              if (id && Types.isValidConversationIDKey(id)) {
                const trustedState = getConvoState(id).meta.trustedState
                if (trustedState !== 'requesting' && trustedState !== 'trusted') {
                  arr.push(id)
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
        reduxDispatch(Chat2Gen.createMetaRequestingTrusted({conversationIDKeys}))
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
              const cs = getConvoState(t.convID)
              cs.dispatch.setMuted(t.isMuted)
              cs.dispatch.setDraft(t.draft ?? '')
            })
            layout.bigTeams?.forEach(t => {
              if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
                const cs = getConvoState(t.channel.convID)
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
        for (const s of stores.values()) {
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
            getConvoState(conversationIDKey).dispatch.setExplodingMode(seconds, true)
          } catch (e) {
            logger.info('Error parsing exploding' + e)
          }
        })
      }

      const f = async () => {
        const GregorConstants = await import('../gregor')
        set(s => {
          const blockButtons = items.some(i => i.item.category.startsWith(blockButtonsGregorPrefix))
          if (blockButtons || s.blockButtonsMap.size > 0) {
            const shouldKeepExistingBlockButtons = new Map<string, boolean>()
            s.blockButtonsMap.forEach((_, teamID: string) =>
              shouldKeepExistingBlockButtons.set(teamID, false)
            )
            items
              .filter(i => i.item.category.startsWith(blockButtonsGregorPrefix))
              .forEach(i => {
                try {
                  const teamID = i.item.category.substring(blockButtonsGregorPrefix.length)
                  if (!s.blockButtonsMap.get(teamID)) {
                    const body = GregorConstants.bodyToJSON(i.item.body) as {adder: string}
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
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
    getBadgeMap: badgeCountsChanged => {
      badgeCountsChanged // this param is just to ensure the selector reruns on a change
      const badgeMap = new Map()
      stores.forEach(s => {
        const {id, badge} = s.getState()
        badgeMap.set(id, badge)
      })
      return badgeMap
    },
    getUnreadMap: badgeCountsChanged => {
      badgeCountsChanged // this param is just to ensure the selector reruns on a change
      const unreadMap = new Map()
      stores.forEach(s => {
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
