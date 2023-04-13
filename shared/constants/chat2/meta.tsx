// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as WalletConstants from '../wallets'
import * as Types from '../types/chat2'
import * as TeamConstants from '../teams'
import * as Message from './message'
import {memoize} from '../../util/memoize'
import type {ConversationMeta, PinnedMessageInfo} from '../types/chat2/meta'
import type {TypedState} from '../reducer'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors} from '../../styles'
import {isMobile, isPhone} from '../platform'
import {toByteArray} from 'base64-js'
import {noConversationIDKey, isValidConversationIDKey} from '../types/chat2/common'
import type {AllowedColors} from '../../common-adapters/text'
import shallowEqual from 'shallowequal'
import {getParticipantInfo} from '.'

const conversationMemberStatusToMembershipType = (m: RPCChatTypes.ConversationMemberStatus) => {
  switch (m) {
    case RPCChatTypes.ConversationMemberStatus.active:
      return 'active'
    case RPCChatTypes.ConversationMemberStatus.reset:
      return 'youAreReset'
    case RPCChatTypes.ConversationMemberStatus.preview:
      return 'youArePreviewing'
    default:
      return 'notMember'
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
  const channelname = isTeam && i.localMetadata ? i.localMetadata.channelName : ''

  const supersededBy = conversationMetadataToMetaSupersedeInfo(i.supersededBy)
  const supersedes = conversationMetadataToMetaSupersedeInfo(i.supersedes)
  const teamname = isTeam ? i.name : ''
  const {retentionPolicy, teamRetentionPolicy} = UIItemToRetentionPolicies(i, isTeam)

  const {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile} =
    parseNotificationSettings(i.notifications)

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
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    readMsgID: i.readMsgID,
    resetParticipants,
    retentionPolicy,
    snippet: i.localMetadata ? i.localMetadata.snippet : undefined,
    snippetDecorated: undefined,
    snippetDecoration: i.localMetadata
      ? i.localMetadata.snippetDecoration
      : RPCChatTypes.SnippetDecoration.none,
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

const copyOverOldValuesIfEqual = (oldMeta: Types.ConversationMeta, newMeta: Types.ConversationMeta) => {
  const merged = {...newMeta}
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
      return copyOverOldValuesIfEqual(oldMeta, newMeta)
    }
    return oldMeta
  }
  // higher inbox version, use new
  return copyOverOldValuesIfEqual(oldMeta, newMeta)
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
  const {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile} =
    parseNotificationSettings(notifications)
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
  state: TypedState | undefined,
  i: RPCChatTypes.InboxUIItem
): ConversationMeta | null => {
  // Private chats only
  if (i.visibility !== RPCTypes.TLFVisibility.private) {
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
  const {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile} =
    parseNotificationSettings(i.notifications)

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
  if (i.pinnedMsg && state) {
    const {getLastOrdinal, username, devicename} = Message.getMessageStateExtras(state, conversationIDKey)
    const message = Message.uiMessageToMessage(
      conversationIDKey,
      i.pinnedMsg.message,
      username,
      getLastOrdinal,
      devicename
    )
    if (message) {
      pinnedMsg = {
        message,
        pinnerUsername: i.pinnedMsg.pinnerUsername,
      }
    }
  }
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
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    pinnedMsg,
    readMsgID: i.readMsgID,
    resetParticipants,
    retentionPolicy,
    snippet: i.snippet,
    snippetDecorated: i.snippetDecorated,
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
  notificationsDesktop: 'never' as const,
  notificationsGlobalIgnoreMentions: false,
  notificationsMobile: 'never' as const,
  offline: false,
  pinnedMsg: undefined,
  readMsgID: -1,
  rekeyers: new Set(),
  resetParticipants: new Set(),
  retentionPolicy: TeamConstants.makeRetentionPolicy(),
  snippet: '',
  snippetDecorated: '',
  snippetDecoration: RPCChatTypes.SnippetDecoration.none as RPCChatTypes.SnippetDecoration,
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

export const getGeneralChannelForBigTeam = (state: TypedState, teamname: string) => {
  const t = state.chat2.inboxLayout?.bigTeams?.find(
    m =>
      m.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel &&
      m.channel.teamname === teamname &&
      m.channel.channelname === 'general'
  )
  return t?.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel ? t.channel.convID : noConversationIDKey
}

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
  const participants = state.chat2.participantMap.get(id)
  const accountID = WalletConstants.getDefaultAccountID(state.wallets)
  const sendDisabled = !isMobile && accountID && !!state.wallets.mobileOnlyMap.get(accountID)

  return (
    !sendDisabled &&
    meta.teamType === 'adhoc' &&
    (participants?.name ?? []).filter(u => u !== state.config.username).length === 1
  )
}

export const getRowStyles = (isSelected: boolean, hasUnread: boolean) => {
  const backgroundColor = isSelected
    ? globalColors.blue
    : isPhone
    ? globalColors.fastBlank
    : globalColors.blueGrey
  const showBold = !isSelected && hasUnread
  const subColor: AllowedColors = isSelected
    ? globalColors.white
    : hasUnread
    ? globalColors.black
    : globalColors.black_50
  const usernameColor = isSelected ? globalColors.white : globalColors.black

  return {
    backgroundColor,
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

export const getRowParticipants = memoize((participants: Types.ParticipantInfo, username: string) =>
  participants.name
    // Filter out ourselves unless it's our 1:1 conversation
    .filter((participant, _, list) => (list.length === 1 ? true : participant !== username))
)

export const getConversationLabel = (
  state: TypedState,
  conv: Types.ConversationMeta,
  alwaysIncludeChannelName: boolean
): string => {
  if (conv.teamType === 'big') {
    return conv.teamname + '#' + conv.channelname
  }
  if (conv.teamType === 'small') {
    return alwaysIncludeChannelName ? conv.teamname + '#' + conv.channelname : conv.teamname
  }
  const participantInfo = getParticipantInfo(state, conv.conversationIDKey)
  return getRowParticipants(participantInfo, '').join(',')
}

export const timestampToString = (meta: Types.ConversationMeta) =>
  formatTimeForConversationList(meta.timestamp)

export const getConversationRetentionPolicy = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const conv = getMeta(state, conversationIDKey)
  return conv.retentionPolicy
}

export const getTeams = (metaMap: Types.MetaMap) =>
  [...metaMap.values()].reduce<Array<string>>((l, meta) => {
    if (meta.teamname && meta.channelname === 'general') {
      l.push(meta.teamname)
    }
    return l
  }, [])
