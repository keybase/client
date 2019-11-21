// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as WalletConstants from '../wallets'
import * as Types from '../types/chat2'
import * as TeamConstants from '../teams'
import * as Message from './message'
import {memoize} from '../../util/memoize'
import {ConversationMeta, PinnedMessageInfo} from '../types/chat2/meta'
import {TypedState} from '../reducer'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {isMobile} from '../platform'
import {toByteArray} from 'base64-js'
import {noConversationIDKey, isValidConversationIDKey} from '../types/chat2/common'
import {getFullname} from '../users'
import {AllowedColors} from '../../common-adapters/text'
import shallowEqual from 'shallowequal'

const conversationMemberStatusToMembershipType = (m: RPCChatTypes.ConversationMemberStatus) => {
  switch (m) {
    case RPCChatTypes.ConversationMemberStatus.active:
      return 'active'
    case RPCChatTypes.ConversationMemberStatus.reset:
      return 'youAreReset'
    default:
      return 'youArePreviewing'
  }
}

// This one call handles us getting a string or a buffer
const supersededConversationIDToKey = (id: string | Buffer): string =>
  typeof id === 'string' ? Buffer.from(toByteArray(id)).toString('hex') : id.toString('hex')

export const unverifiedInboxUIItemToConversationMeta = (
  i: RPCChatTypes.UnverifiedInboxUIItem
): ConversationMeta | null => {
  // Private chats only
  if (i.visibility !== RPCTypes.TLFVisibility.private) {
    return null
  }

  // Should be impossible
  if (!i.convID) {
    return null
  }

  // We only treat implicit adhoc teams as having resetParticipants
  const resetParticipants: Set<string> = new Set(
    i.localMetadata &&
    (i.membersType === RPCChatTypes.ConversationMembersType.impteamnative ||
      i.membersType === RPCChatTypes.ConversationMembersType.impteamupgrade) &&
    i.localMetadata.resetParticipants
      ? i.localMetadata.resetParticipants
      : []
  )

  const isTeam = i.membersType === RPCChatTypes.ConversationMembersType.team
  const participants =
    i.localMetadata && isTeam ? i.localMetadata.writerNames || [] : (i.name || '').split(',')
  const channelname = isTeam && i.localMetadata ? i.localMetadata.channelName : ''

  const supersededBy = conversationMetadataToMetaSupersedeInfo(i.supersededBy)
  const supersedes = conversationMetadataToMetaSupersedeInfo(i.supersedes)
  const teamname = isTeam ? i.name : ''
  const {retentionPolicy, teamRetentionPolicy} = UIItemToRetentionPolicies(i, isTeam)

  const {
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
  } = parseNotificationSettings(i.notifications)

  return {
    ...makeConversationMeta(),
    channelname,
    commands: i.commands,
    conversationIDKey: Types.stringToConversationIDKey(i.convID),
    description: (i.localMetadata && i.localMetadata.headline) || '',
    descriptionDecorated: (i.localMetadata && i.localMetadata.headlineDecorated) || '',
    draft: i.draft || '',
    inboxLocalVersion: i.localVersion,
    inboxVersion: i.version,
    isEmpty: false,
    isMuted: i.status === RPCChatTypes.ConversationStatus.muted,
    maxMsgID: i.maxMsgID,
    maxVisibleMsgID: i.maxVisibleMsgID,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    nameParticipants: participants,
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    participants,
    readMsgID: i.readMsgID,
    resetParticipants,
    retentionPolicy,
    snippet: i.localMetadata ? i.localMetadata.snippet : '',
    snippetDecoration: i.localMetadata ? i.localMetadata.snippetDecoration : '',
    status: i.status,
    supersededBy: supersededBy ? Types.stringToConversationIDKey(supersededBy) : noConversationIDKey,
    supersedes: supersedes ? Types.stringToConversationIDKey(supersedes) : noConversationIDKey,
    teamID: i.tlfID,
    teamRetentionPolicy,
    teamType: getTeamType(i),
    teamname,
    timestamp: i.time,
    tlfname: i.name,
    trustedState: 'untrusted',
    wasFinalizedBy: i.finalizeInfo ? i.finalizeInfo.resetUser : '',
  }
}

const conversationMetadataToMetaSupersedeInfo = (metas?: Array<RPCChatTypes.ConversationMetadata> | null) => {
  const meta = (metas || []).find(
    m => m.idTriple.topicType === RPCChatTypes.TopicType.chat && !!m.finalizeInfo
  )

  return meta ? supersededConversationIDToKey(meta.conversationID) : null
}

const getTeamType = (tt: {
  teamType: RPCChatTypes.TeamType
  membersType: RPCChatTypes.ConversationMembersType
}): Types.TeamType => {
  if (tt.teamType === RPCChatTypes.TeamType.complex) {
    return 'big'
  } else if (tt.membersType === RPCChatTypes.ConversationMembersType.team) {
    return 'small'
  } else {
    return 'adhoc'
  }
}

export const getEffectiveRetentionPolicy = (meta: Types.ConversationMeta) => {
  return meta.retentionPolicy.type === 'inherit' ? meta.teamRetentionPolicy : meta.retentionPolicy
}

// Upgrade a meta, try and keep existing values if possible to reduce render thrashing in components
// Enforce the verions only increase and we only go from untrusted to trusted, etc
export const updateMeta = (
  oldMeta: Types.ConversationMeta,
  newMeta: Types.ConversationMeta
): Types.ConversationMeta => {
  if (newMeta.inboxVersion < oldMeta.inboxVersion) {
    // new is older, keep old
    return oldMeta
  } else if (oldMeta.inboxVersion === newMeta.inboxVersion) {
    // same version, take data if untrusted -> trusted
    // or if localVersion increased
    if (
      (newMeta.trustedState === 'trusted' && oldMeta.trustedState !== 'trusted') ||
      newMeta.inboxLocalVersion > oldMeta.inboxLocalVersion
    ) {
      const merged = {...newMeta}
      if (shallowEqual(merged.participants, oldMeta.participants)) {
        merged.participants = oldMeta.participants
      }
      if (shallowEqual(merged.nameParticipants, oldMeta.nameParticipants)) {
        merged.nameParticipants = oldMeta.nameParticipants
      }
      if (shallowEqual([...merged.rekeyers], [...oldMeta.rekeyers])) {
        merged.rekeyers = oldMeta.rekeyers
      }
      if (shallowEqual([...merged.resetParticipants], [...oldMeta.resetParticipants])) {
        merged.resetParticipants = oldMeta.resetParticipants
      }
      if (shallowEqual(merged.retentionPolicy, oldMeta.retentionPolicy)) {
        merged.retentionPolicy = oldMeta.retentionPolicy
      }
      if (shallowEqual(merged.teamRetentionPolicy, oldMeta.teamRetentionPolicy)) {
        merged.teamRetentionPolicy = oldMeta.teamRetentionPolicy
      }
      return merged
    }
    return oldMeta
  }
  // higher inbox version, use new
  return newMeta
}

type NotificationSettingsParsed = {
  notificationsDesktop: Types.NotificationsType
  notificationsGlobalIgnoreMentions: boolean
  notificationsMobile: Types.NotificationsType
}
const parseNotificationSettings = (
  notifications?: RPCChatTypes.ConversationNotificationInfo | null
): NotificationSettingsParsed => {
  let notificationsDesktop = 'never' as Types.NotificationsType
  let notificationsGlobalIgnoreMentions = false
  let notificationsMobile = 'never' as Types.NotificationsType

  // Map this weird structure from the daemon to something we want
  if (notifications) {
    notificationsGlobalIgnoreMentions = notifications.channelWide
    const s = notifications.settings
    if (s) {
      const desktop = s[String(RPCTypes.DeviceType.desktop)]
      if (desktop) {
        if (desktop[String(RPCChatTypes.NotificationKind.generic)]) {
          notificationsDesktop = 'onAnyActivity'
        } else if (desktop[String(RPCChatTypes.NotificationKind.atmention)]) {
          notificationsDesktop = 'onWhenAtMentioned'
        }
      }
      const mobile = s[String(RPCTypes.DeviceType.mobile)]
      if (mobile) {
        if (mobile[String(RPCChatTypes.NotificationKind.generic)]) {
          notificationsMobile = 'onAnyActivity'
        } else if (mobile[String(RPCChatTypes.NotificationKind.atmention)]) {
          notificationsMobile = 'onWhenAtMentioned'
        }
      }
    }
  }

  return {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile}
}

export const updateMetaWithNotificationSettings = (
  old: Types.ConversationMeta,
  notifications: RPCChatTypes.ConversationNotificationInfo | null
) => {
  const {
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
  } = parseNotificationSettings(notifications)
  return {
    ...old,
    notificationsDesktop: notificationsDesktop,
    notificationsGlobalIgnoreMentions: notificationsGlobalIgnoreMentions,
    notificationsMobile: notificationsMobile,
  } as Types.ConversationMeta
}

const UIItemToRetentionPolicies = (
  i: RPCChatTypes.InboxUIItem | RPCChatTypes.UnverifiedInboxUIItem,
  isTeam: boolean
) => {
  // default inherit for teams, retain for ad-hoc
  // TODO remove these hard-coded defaults if core starts sending the defaults instead of nil to represent 'unset'
  let retentionPolicy = isTeam
    ? TeamConstants.makeRetentionPolicy({type: 'inherit'})
    : TeamConstants.makeRetentionPolicy()
  if (i.convRetention) {
    // it has been set for this conversation
    retentionPolicy = TeamConstants.serviceRetentionPolicyToRetentionPolicy(i.convRetention)
  }

  // default for team-wide policy is 'retain'
  let teamRetentionPolicy = TeamConstants.makeRetentionPolicy()
  if (i.teamRetention) {
    teamRetentionPolicy = TeamConstants.serviceRetentionPolicyToRetentionPolicy(i.teamRetention)
  }
  return {retentionPolicy, teamRetentionPolicy}
}

export const inboxUIItemToConversationMeta = (
  state: TypedState,
  i: RPCChatTypes.InboxUIItem,
  allowEmpty?: boolean
): ConversationMeta | null => {
  // Private chats only
  if (i.visibility !== RPCTypes.TLFVisibility.private) {
    return null
  }
  // Ignore empty unless we explicitly allow it (making new conversations)
  if (i.isEmpty && !allowEmpty) {
    return null
  }
  // We don't support mixed reader/writers
  if (i.name.includes('#')) {
    return null
  }

  // We only treat implied adhoc teams as having resetParticipants
  const resetParticipants = new Set(
    (i.membersType === RPCChatTypes.ConversationMembersType.impteamnative ||
      i.membersType === RPCChatTypes.ConversationMembersType.impteamupgrade) &&
    i.resetParticipants
      ? i.resetParticipants
      : []
  )

  const supersededBy = conversationMetadataToMetaSupersedeInfo(i.supersededBy)
  const supersedes = conversationMetadataToMetaSupersedeInfo(i.supersedes)

  const isTeam = i.membersType === RPCChatTypes.ConversationMembersType.team
  const {
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
  } = parseNotificationSettings(i.notifications)

  const {retentionPolicy, teamRetentionPolicy} = UIItemToRetentionPolicies(i, isTeam)

  const minWriterRoleEnum =
    i.convSettings && i.convSettings.minWriterRoleInfo ? i.convSettings.minWriterRoleInfo.role : undefined
  let minWriterRole = (minWriterRoleEnum && TeamConstants.teamRoleByEnum[minWriterRoleEnum]) || 'reader'
  if (minWriterRole === 'none') {
    // means nothing. set it to reader.
    minWriterRole = 'reader'
  }

  const cannotWrite =
    i.convSettings && i.convSettings.minWriterRoleInfo ? i.convSettings.minWriterRoleInfo.cannotWrite : false
  const conversationIDKey = Types.stringToConversationIDKey(i.convID)
  let pinnedMsg: PinnedMessageInfo | undefined
  if (i.pinnedMsg) {
    const message = Message.uiMessageToMessage(state, conversationIDKey, i.pinnedMsg.message)
    if (message) {
      pinnedMsg = {
        message,
        pinnerUsername: i.pinnedMsg.pinnerUsername,
      }
    }
  }
  const participants = i.participants || []
  return {
    ...makeConversationMeta(),
    botAliases: i.botAliases,
    botCommands: i.botCommands,
    cannotWrite,
    channelname: (isTeam && i.channel) || '',
    commands: i.commands,
    conversationIDKey,
    description: i.headline,
    descriptionDecorated: i.headlineDecorated,
    draft: i.draft || '',
    inboxLocalVersion: i.localVersion,
    inboxVersion: i.version,
    isEmpty: i.isEmpty,
    isMuted: i.status === RPCChatTypes.ConversationStatus.muted,
    maxMsgID: i.maxMsgID,
    maxVisibleMsgID: i.maxVisibleMsgID,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    minWriterRole,
    nameParticipants: (i.participants || []).reduce<Array<string>>((l, part) => {
      if (part.inConvName) {
        l.push(part.assertion)
      }
      return l
    }, []),
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    participantToContactName: participants
      ? new Map(
          participants.reduce<Array<[string, string]>>((arr, part) => {
            if (part.contactName) {
              arr.push([part.assertion, part.contactName])
            }
            return arr
          }, [])
        )
      : new Map(),
    participants: (i.participants || []).map(part => part.assertion),
    pinnedMsg,
    readMsgID: i.readMsgID,
    resetParticipants,
    retentionPolicy,
    snippet: i.snippet,
    snippetDecoration: i.snippetDecoration,
    status: i.status,
    supersededBy: supersededBy ? Types.stringToConversationIDKey(supersededBy) : noConversationIDKey,
    supersedes: supersedes ? Types.stringToConversationIDKey(supersedes) : noConversationIDKey,
    teamID: i.tlfID,
    teamRetentionPolicy,
    teamType: getTeamType(i),
    teamname: (isTeam && i.name) || '',
    timestamp: i.time,
    tlfname: i.name,
    trustedState: 'trusted',
    wasFinalizedBy: i.finalizeInfo ? i.finalizeInfo.resetUser : '',
  }
}

export const makeConversationMeta = (): Types.ConversationMeta => ({
  botAliases: {},
  botCommands: {} as RPCChatTypes.ConversationCommandGroups,
  cannotWrite: false,
  channelname: '',
  commands: {} as RPCChatTypes.ConversationCommandGroups,
  conversationIDKey: noConversationIDKey,
  description: '',
  descriptionDecorated: '',
  draft: '',
  inboxLocalVersion: -1,
  inboxVersion: -1,
  isEmpty: false,
  isMuted: false,
  maxMsgID: -1,
  maxVisibleMsgID: -1,
  membershipType: 'active' as const,
  minWriterRole: 'reader' as const,
  nameParticipants: [],
  notificationsDesktop: 'never' as const,
  notificationsGlobalIgnoreMentions: false,
  notificationsMobile: 'never' as const,
  offline: false,
  participantToContactName: new Map(),
  participants: [],
  pinnedMsg: undefined,
  readMsgID: -1,
  rekeyers: new Set(),
  resetParticipants: new Set(),
  retentionPolicy: TeamConstants.makeRetentionPolicy(),
  snippet: '',
  snippetDecoration: '',
  status: RPCChatTypes.ConversationStatus.unfiled as RPCChatTypes.ConversationStatus,
  supersededBy: noConversationIDKey,
  supersedes: noConversationIDKey,
  teamID: '',
  teamRetentionPolicy: TeamConstants.makeRetentionPolicy(),
  teamType: 'adhoc' as Types.TeamType,
  teamname: '',
  timestamp: 0,
  tlfname: '',
  trustedState: 'untrusted' as Types.MetaTrustedState,
  wasFinalizedBy: '',
})

const emptyMeta = makeConversationMeta()
export const getMeta = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.metaMap.get(id) || emptyMeta

// we want the memoized function to have access to state but not have it be a part of the memoization else it'll fail always
let _unmemoizedState: TypedState
const _getParticipantSuggestionsMemoized = memoize(
  (participants: Array<string>, teamType: Types.TeamType) => {
    const suggestions = participants.map(username => ({
      fullName: getFullname(_unmemoizedState, username) || '',
      username,
    }))
    if (teamType !== 'adhoc') {
      const fullName = teamType === 'small' ? 'Everyone in this team' : 'Everyone in this channel'
      suggestions.push({fullName, username: 'channel'}, {fullName, username: 'here'})
    }
    return suggestions
  }
)

export const getParticipantSuggestions = (state: TypedState, id: Types.ConversationIDKey) => {
  const {participants, teamType} = getMeta(state, id)
  _unmemoizedState = state
  return _getParticipantSuggestionsMemoized(participants, teamType)
}

export const getChannelSuggestions = (state: TypedState, teamname: string) => {
  if (!teamname) {
    return []
  }
  // First try channelinfos (all channels in a team), then try inbox (the
  // partial list of channels that you have joined).
  const convs = state.teams.teamNameToChannelInfos.get(teamname)
  if (convs) {
    return convs
      .toIndexedSeq()
      .toList()
      .map(conv => conv.channelname)
      .toArray()
  }
  return [...state.chat2.metaMap.values()].filter(v => v.teamname === teamname).map(v => v.channelname)
}

let _getAllChannelsRet: Array<{channelname: string; teamname: string}> = []
// TODO why do this for all teams?
const _getAllChannelsMemo = memoize((mm: TypedState['chat2']['metaMap']) =>
  [...mm.values()]
    .filter(v => v.teamname && v.channelname && v.teamType === 'big')
    .map(({channelname, teamname}) => ({channelname, teamname}))
)
export const getAllChannels = (state: TypedState) => {
  const ret = _getAllChannelsMemo(state.chat2.metaMap)

  if (shallowEqual(ret, _getAllChannelsRet)) {
    return _getAllChannelsRet
  }
  _getAllChannelsRet = ret
  return _getAllChannelsRet
}

export const getChannelForTeam = (state: TypedState, teamname: string, channelname: string) =>
  [...state.chat2.metaMap.values()].find(m => m.teamname === teamname && m.channelname === channelname) ||
  emptyMeta

const blankCommands: Array<RPCChatTypes.ConversationCommand> = []

export const getCommands = (
  state: TypedState,
  id: Types.ConversationIDKey
): Array<RPCChatTypes.ConversationCommand> => {
  const {commands} = getMeta(state, id)
  if (commands.typ === RPCChatTypes.ConversationCommandGroupsTyp.builtin) {
    return state.chat2.staticConfig
      ? state.chat2.staticConfig.builtinCommands[commands.builtin] || blankCommands
      : blankCommands
  } else {
    return blankCommands
  }
}

export const getBotCommands = (state: TypedState, id: Types.ConversationIDKey) => {
  const {botCommands} = getMeta(state, id)
  if (botCommands.typ === RPCChatTypes.ConversationCommandGroupsTyp.custom) {
    return botCommands.custom.commands || blankCommands
  } else {
    return blankCommands
  }
}

// show wallets icon for one-on-one conversations
export const shouldShowWalletsIcon = (state: TypedState, id: Types.ConversationIDKey) => {
  const meta = getMeta(state, id)
  const accountID = WalletConstants.getDefaultAccountID(state)
  const sendDisabled = !isMobile && accountID && !!state.wallets.mobileOnlyMap.get(accountID)

  return (
    !sendDisabled &&
    meta.teamType === 'adhoc' &&
    meta.nameParticipants.filter(u => u !== state.config.username).length === 1
  )
}

export const getRowStyles = (isSelected: boolean, hasUnread: boolean) => {
  const backgroundColor = isSelected
    ? globalColors.blue
    : isMobile
    ? globalColors.fastBlank
    : globalColors.blueGrey
  const showBold = !isSelected && hasUnread
  const subColor: AllowedColors = isSelected
    ? globalColors.white
    : hasUnread
    ? globalColors.black
    : globalColors.black_50
  const usernameColor = isSelected ? globalColors.white : globalColors.black
  const iconHoverColor = isSelected ? globalColors.white_75 : globalColors.black

  return {
    backgroundColor,
    iconHoverColor,
    showBold,
    subColor,
    usernameColor,
  }
}

export const getConversationIDKeyMetasToLoad = (
  conversationIDKeys: Array<Types.ConversationIDKey>,
  metaMap: Map<Types.ConversationIDKey, Types.ConversationMeta>
) =>
  conversationIDKeys.reduce((arr: Array<string>, id) => {
    if (id && isValidConversationIDKey(id)) {
      const trustedState = (metaMap.get(id) || {trustedState: undefined}).trustedState
      if (trustedState !== 'requesting' && trustedState !== 'trusted') {
        arr.push(id)
      }
    }
    return arr
  }, [])

export const getRowParticipants = (meta: Types.ConversationMeta, username: string) =>
  meta.nameParticipants
    // Filter out ourselves unless it's our 1:1 conversation
    .filter((participant, _, list) => (list.length === 1 ? true : participant !== username))

export const timestampToString = (meta: Types.ConversationMeta) =>
  formatTimeForConversationList(meta.timestamp)

export const getConversationRetentionPolicy = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const conv = getMeta(state, conversationIDKey)
  return conv.retentionPolicy
}

export const isDecryptingSnippet = (meta: Types.ConversationMeta) =>
  meta.trustedState === 'requesting' || meta.trustedState === 'untrusted'

export const getTeams = (metaMap: Types.MetaMap) =>
  [...metaMap.values()].reduce<Array<string>>((l, meta) => {
    if (meta.teamname && meta.channelname === 'general') {
      l.push(meta.teamname)
    }
    return l
  }, [])
