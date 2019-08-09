// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as WalletConstants from '../wallets'
import * as Types from '../types/chat2'
import * as TeamConstants from '../teams'
import {memoize} from '../../util/memoize'
import {_ConversationMeta} from '../types/chat2/meta'
import {TypedState} from '../reducer'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {isMobile} from '../platform'
import {toByteArray} from 'base64-js'
import {noConversationIDKey, isValidConversationIDKey} from '../types/chat2/common'
import {getFullname} from '../users'
import {AllowedColors} from '../../common-adapters/text'

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

export const unverifiedInboxUIItemToConversationMeta = (i: RPCChatTypes.UnverifiedInboxUIItem) => {
  // Private chats only
  if (i.visibility !== RPCTypes.TLFVisibility.private) {
    return null
  }

  // Should be impossible
  if (!i.convID) {
    return null
  }

  // We only treat implicit adhoc teams as having resetParticipants
  const resetParticipants = I.Set(
    i.localMetadata &&
      (i.membersType === RPCChatTypes.ConversationMembersType.impteamnative ||
        i.membersType === RPCChatTypes.ConversationMembersType.impteamupgrade) &&
      i.localMetadata.resetParticipants
      ? i.localMetadata.resetParticipants
      : []
  )

  const participants = I.List(i.localMetadata ? i.localMetadata.writerNames || [] : (i.name || '').split(','))
  const isTeam = i.membersType === RPCChatTypes.ConversationMembersType.team
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

  return makeConversationMeta({
    channelname,
    commands: i.commands,
    conversationIDKey: Types.stringToConversationIDKey(i.convID),
    description: (i.localMetadata && i.localMetadata.headline) || '',
    descriptionDecorated: (i.localMetadata && i.localMetadata.headlineDecorated) || '',
    draft: i.draft || '',
    inboxLocalVersion: i.localVersion,
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.ConversationStatus.muted,
    maxMsgID: i.maxMsgID,
    maxVisibleMsgID: i.maxVisibleMsgID,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
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
    teamRetentionPolicy,
    teamType: getTeamType(i),
    teamname,
    timestamp: i.time,
    tlfname: i.name,
    trustedState: 'untrusted',
    wasFinalizedBy: i.finalizeInfo ? i.finalizeInfo.resetUser : '',
  })
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
      // prettier-ignore
      return newMeta.withMutations(nm => {
        // keep immutable stuff to reduce render thrashing
        I.is(oldMeta.participants, nm.participants) && nm.set('participants', oldMeta.participants)
        I.is(oldMeta.rekeyers, nm.rekeyers) && nm.set('rekeyers', oldMeta.rekeyers)
        I.is(oldMeta.resetParticipants, nm.resetParticipants) && nm.set('resetParticipants', oldMeta.resetParticipants)
        I.is(oldMeta.retentionPolicy, nm.retentionPolicy) && nm.set('retentionPolicy', oldMeta.retentionPolicy)
        I.is(oldMeta.teamRetentionPolicy, nm.teamRetentionPolicy) && nm.set('teamRetentionPolicy', oldMeta.teamRetentionPolicy)
      })
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
  return old.merge({
    notificationsDesktop: notificationsDesktop,
    notificationsGlobalIgnoreMentions: notificationsGlobalIgnoreMentions,
    notificationsMobile: notificationsMobile,
  }) as Types.ConversationMeta
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

export const inboxUIItemToConversationMeta = (i: RPCChatTypes.InboxUIItem, allowEmpty?: boolean) => {
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
  const resetParticipants = I.Set(
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
  let minWriterRole = minWriterRoleEnum ? TeamConstants.teamRoleByEnum[minWriterRoleEnum] : 'reader'
  if (minWriterRole === 'none') {
    // means nothing. set it to reader.
    minWriterRole = 'reader'
  }

  let cannotWrite =
    i.convSettings && i.convSettings.minWriterRoleInfo ? i.convSettings.minWriterRoleInfo.cannotWrite : false

  return makeConversationMeta({
    botCommands: i.botCommands,
    cannotWrite,
    channelname: (isTeam && i.channel) || '',
    commands: i.commands,
    conversationIDKey: Types.stringToConversationIDKey(i.convID),
    description: i.headline,
    descriptionDecorated: i.headlineDecorated,
    draft: i.draft || '',
    inboxLocalVersion: i.localVersion,
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.ConversationStatus.muted,
    maxMsgID: i.maxMsgID,
    maxVisibleMsgID: i.maxVisibleMsgID,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    minWriterRole,
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    participantToContactName: I.Map(
      (i.participants || []).reduce<{[key: string]: string}>((map, part) => {
        if (part.contactName) {
          map[part.assertion] = part.contactName
        }
        return map
      }, {})
    ),
    participants: I.List((i.participants || []).map(part => part.assertion)),
    readMsgID: i.readMsgID,
    resetParticipants,
    retentionPolicy,
    snippet: i.snippet,
    snippetDecoration: i.snippetDecoration,
    status: i.status,
    supersededBy: supersededBy ? Types.stringToConversationIDKey(supersededBy) : noConversationIDKey,
    supersedes: supersedes ? Types.stringToConversationIDKey(supersedes) : noConversationIDKey,
    teamRetentionPolicy,
    teamType: getTeamType(i),
    teamname: (isTeam && i.name) || '',
    timestamp: i.time,
    tlfname: i.name,
    trustedState: 'trusted',
    wasFinalizedBy: i.finalizeInfo ? i.finalizeInfo.resetUser : '',
  })
}

export const makeConversationMeta = I.Record<_ConversationMeta>({
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
  isMuted: false,
  maxMsgID: -1,
  maxVisibleMsgID: -1,
  membershipType: 'active' as Types.MembershipType,
  minWriterRole: 'reader' as Types.TeamRoleType,
  notificationsDesktop: 'never' as Types.NotificationsType,
  notificationsGlobalIgnoreMentions: false,
  notificationsMobile: 'never' as Types.NotificationsType,
  offline: false,
  participantToContactName: I.Map(),
  participants: I.List<string>(),
  readMsgID: -1,
  rekeyers: I.Set(),
  resetParticipants: I.Set(),
  retentionPolicy: TeamConstants.makeRetentionPolicy(),
  snippet: '',
  snippetDecoration: '',
  status: RPCChatTypes.ConversationStatus.unfiled as RPCChatTypes.ConversationStatus,
  supersededBy: noConversationIDKey,
  supersedes: noConversationIDKey,
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
  state.chat2.metaMap.get(id, emptyMeta)

// we want the memoized function to have access to state but not have it be a part of the memoization else it'll fail always
let _unmemoizedState: TypedState
const _getParticipantSuggestionsMemoized = memoize(
  (participants: I.List<string>, teamType: Types.TeamType) => {
    let suggestions = participants.map(username => ({
      fullName: getFullname(_unmemoizedState, username) || '',
      username,
    }))
    if (teamType !== 'adhoc') {
      const fullName = teamType === 'small' ? 'Everyone in this team' : 'Everyone in this channel'
      suggestions = suggestions.push({fullName, username: 'channel'}, {fullName, username: 'here'})
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
    return I.List()
  }
  // First try channelinfos (all channels in a team), then try inbox (the
  // partial list of channels that you have joined).
  const convs = state.teams.teamNameToChannelInfos.get(teamname)
  if (convs) {
    return convs
      .toIndexedSeq()
      .toList()
      .map(conv => conv.channelname)
  }
  return state.chat2.metaMap
    .filter(v => v.teamname === teamname)
    .map(v => v.channelname)
    .toList()
}

export const getAllChannels = (state: TypedState) => {
  return state.chat2.metaMap
    .filter(v => v.teamname && v.channelname && v.teamType === 'big')
    .map(({channelname, teamname}) => ({channelname, teamname}))
    .toList()
}

export const getChannelForTeam = (state: TypedState, teamname: string, channelname: string) =>
  state.chat2.metaMap.find(
    m => m.teamname === teamname && m.channelname === channelname,
    undefined,
    emptyMeta
  )

const blankCommands: Array<RPCChatTypes.ConversationCommand> = []

export const getCommands = (state: TypedState, id: Types.ConversationIDKey) => {
  const {commands} = getMeta(state, id)
  if (commands.typ === RPCChatTypes.ConversationCommandGroupsTyp.builtin && commands.builtin) {
    return state.chat2.staticConfig
      ? state.chat2.staticConfig.builtinCommands[commands.builtin]
      : blankCommands
  } else {
    return blankCommands
  }
}

export const getBotCommands = (state: TypedState, id: Types.ConversationIDKey) => {
  const {botCommands} = getMeta(state, id)
  if (botCommands.typ === RPCChatTypes.ConversationCommandGroupsTyp.custom && botCommands.custom) {
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
    meta.participants.filter(u => u !== state.config.username).size === 1
  )
}

export const getRowStyles = (meta: Types.ConversationMeta, isSelected: boolean, hasUnread: boolean) => {
  const isError = meta.trustedState === 'error'
  const backgroundColor = isSelected
    ? globalColors.blue
    : isMobile
    ? globalColors.fastBlank
    : globalColors.blueGrey
  const showBold = !isSelected && hasUnread
  const subColor: AllowedColors = isError
    ? globalColors.redDark
    : isSelected
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
  metaMap: I.Map<Types.ConversationIDKey, Types.ConversationMeta>
) =>
  conversationIDKeys.reduce((arr: Array<string>, id) => {
    if (id && isValidConversationIDKey(id)) {
      const trustedState = metaMap.getIn([id, 'trustedState'])
      if (trustedState !== 'requesting' && trustedState !== 'trusted') {
        arr.push(id)
      }
    }
    return arr
  }, [])

export const getRowParticipants = (meta: Types.ConversationMeta, username: string) =>
  meta.participants
    // Filter out ourselves unless it's our 1:1 conversation
    .filter((participant, _, list) => (list.size === 1 ? true : participant !== username))

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
  metaMap.reduce((l: Array<string>, meta) => {
    if (meta.teamname && meta.channelname === 'general') {
      l.push(meta.teamname)
    }
    return l
  }, [])
