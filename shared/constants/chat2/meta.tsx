// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
import * as C from '..'
import * as T from '../types'
import * as Message from './message'
import {formatTimeForConversationList} from '@/util/timestamp'
import {globalColors} from '@/styles'
import {isPhone} from '../platform'
import type {AllowedColors} from '@/common-adapters/text'
import {base64ToUint8Array, uint8ArrayToHex} from 'uint8array-extras'

const conversationMemberStatusToMembershipType = (m: T.RPCChat.ConversationMemberStatus) => {
  switch (m) {
    case T.RPCChat.ConversationMemberStatus.active:
      return 'active'
    case T.RPCChat.ConversationMemberStatus.reset:
      return 'youAreReset'
    case T.RPCChat.ConversationMemberStatus.preview:
      return 'youArePreviewing'
    default:
      return 'notMember'
  }
}

// This one call handles us getting a string or a buffer
const supersededConversationIDToKey = (id: string | Uint8Array): string => {
  return typeof id === 'string' ? uint8ArrayToHex(base64ToUint8Array(id)) : uint8ArrayToHex(id)
}

export const unverifiedInboxUIItemToConversationMeta = (
  i: T.RPCChat.UnverifiedInboxUIItem
): T.Chat.ConversationMeta | undefined => {
  // Private chats only
  if (i.visibility !== T.RPCGen.TLFVisibility.private) {
    return undefined
  }

  // Should be impossible
  if (!i.convID) {
    return undefined
  }

  // We only treat implicit adhoc teams as having resetParticipants
  const resetParticipants: Set<string> = new Set(
    i.localMetadata &&
    (i.membersType === T.RPCChat.ConversationMembersType.impteamnative ||
      i.membersType === T.RPCChat.ConversationMembersType.impteamupgrade) &&
    i.localMetadata.resetParticipants
      ? i.localMetadata.resetParticipants
      : []
  )

  const isTeam = i.membersType === T.RPCChat.ConversationMembersType.team
  const channelname = isTeam && i.localMetadata ? i.localMetadata.channelName : ''

  const supersededBy = conversationMetadataToMetaSupersedeInfo(i.supersededBy ?? undefined)
  const supersedes = conversationMetadataToMetaSupersedeInfo(i.supersedes ?? undefined)
  const teamname = isTeam ? i.name : ''
  const {retentionPolicy, teamRetentionPolicy} = UIItemToRetentionPolicies(i, isTeam)

  const {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile} =
    parseNotificationSettings(i.notifications ?? undefined)

  return {
    ...makeConversationMeta(),
    channelname,
    commands: i.commands,
    conversationIDKey: T.Chat.stringToConversationIDKey(i.convID),
    description: i.localMetadata?.headline || '',
    descriptionDecorated: i.localMetadata?.headlineDecorated || '',
    draft: i.draft || '',
    inboxLocalVersion: i.localVersion,
    inboxVersion: i.version,
    isEmpty: false,
    isMuted: i.status === T.RPCChat.ConversationStatus.muted,
    maxMsgID: T.Chat.numberToMessageID(i.maxMsgID),
    maxVisibleMsgID: T.Chat.numberToMessageID(i.maxVisibleMsgID),
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    readMsgID: T.Chat.numberToMessageID(i.readMsgID),
    resetParticipants,
    retentionPolicy,
    snippet: i.localMetadata ? i.localMetadata.snippet : undefined,
    snippetDecorated: undefined,
    snippetDecoration: i.localMetadata ? i.localMetadata.snippetDecoration : T.RPCChat.SnippetDecoration.none,
    status: i.status,
    supersededBy: supersededBy ? T.Chat.stringToConversationIDKey(supersededBy) : T.Chat.noConversationIDKey,
    supersedes: supersedes ? T.Chat.stringToConversationIDKey(supersedes) : T.Chat.noConversationIDKey,
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

const conversationMetadataToMetaSupersedeInfo = (metas?: ReadonlyArray<T.RPCChat.ConversationMetadata>) => {
  const meta = metas?.find(m => m.idTriple.topicType === T.RPCChat.TopicType.chat && !!m.finalizeInfo)

  return meta ? supersededConversationIDToKey(meta.conversationID) : undefined
}

const getTeamType = (tt: {
  teamType: T.RPCChat.TeamType
  membersType: T.RPCChat.ConversationMembersType
}): T.Chat.TeamType => {
  if (tt.teamType === T.RPCChat.TeamType.complex) {
    return 'big'
  } else if (tt.membersType === T.RPCChat.ConversationMembersType.team) {
    return 'small'
  } else {
    return 'adhoc'
  }
}

export const getEffectiveRetentionPolicy = (meta: T.Immutable<T.Chat.ConversationMeta>) => {
  return meta.retentionPolicy.type === 'inherit' ? meta.teamRetentionPolicy : meta.retentionPolicy
}

const copyOverOldValuesIfEqual = (
  oldMeta: T.Immutable<T.Chat.ConversationMeta>,
  newMeta: T.Immutable<T.Chat.ConversationMeta>
) => {
  const merged = {...newMeta}
  if (C.shallowEqual([...merged.rekeyers], [...oldMeta.rekeyers])) {
    merged.rekeyers = oldMeta.rekeyers
  }
  if (C.shallowEqual([...merged.resetParticipants], [...oldMeta.resetParticipants])) {
    merged.resetParticipants = oldMeta.resetParticipants
  }
  if (C.shallowEqual(merged.retentionPolicy, oldMeta.retentionPolicy)) {
    merged.retentionPolicy = oldMeta.retentionPolicy
  }
  if (C.shallowEqual(merged.teamRetentionPolicy, oldMeta.teamRetentionPolicy)) {
    merged.teamRetentionPolicy = oldMeta.teamRetentionPolicy
  }
  return merged
}

// Upgrade a meta, try and keep existing values if possible to reduce render thrashing in components
// Enforce the verions only increase and we only go from untrusted to trusted, etc
export const updateMeta = (
  oldMeta: T.Immutable<T.Chat.ConversationMeta>,
  newMeta: T.Immutable<T.Chat.ConversationMeta>
): T.Immutable<T.Chat.ConversationMeta> => {
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
  notificationsDesktop: T.Chat.NotificationsType
  notificationsGlobalIgnoreMentions: boolean
  notificationsMobile: T.Chat.NotificationsType
}
export const parseNotificationSettings = (
  notifications?: T.RPCChat.ConversationNotificationInfo
): NotificationSettingsParsed => {
  let notificationsDesktop = 'never' as T.Chat.NotificationsType
  let notificationsGlobalIgnoreMentions = false
  let notificationsMobile = 'never' as T.Chat.NotificationsType

  // Map this weird structure from the daemon to something we want
  if (notifications) {
    notificationsGlobalIgnoreMentions = notifications.channelWide
    const s = notifications.settings
    const desktop = s?.[String(T.RPCGen.DeviceType.desktop)]
    if (desktop) {
      if (desktop[String(T.RPCChat.NotificationKind.generic)]) {
        notificationsDesktop = 'onAnyActivity'
      } else if (desktop[String(T.RPCChat.NotificationKind.atmention)]) {
        notificationsDesktop = 'onWhenAtMentioned'
      }
    }
    const mobile = s?.[String(T.RPCGen.DeviceType.mobile)]
    if (mobile) {
      if (mobile[String(T.RPCChat.NotificationKind.generic)]) {
        notificationsMobile = 'onAnyActivity'
      } else if (mobile[String(T.RPCChat.NotificationKind.atmention)]) {
        notificationsMobile = 'onWhenAtMentioned'
      }
    }
  }

  return {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile}
}

const UIItemToRetentionPolicies = (
  i: T.RPCChat.InboxUIItem | T.RPCChat.UnverifiedInboxUIItem,
  isTeam: boolean
) => {
  // default inherit for teams, retain for ad-hoc
  // TODO remove these hard-coded defaults if core starts sending the defaults instead of nil to represent 'unset'
  let retentionPolicy = isTeam
    ? C.Teams.makeRetentionPolicy({type: 'inherit'})
    : C.Teams.makeRetentionPolicy()
  if (i.convRetention) {
    // it has been set for this conversation
    retentionPolicy = C.Teams.serviceRetentionPolicyToRetentionPolicy(i.convRetention)
  }

  // default for team-wide policy is 'retain'
  let teamRetentionPolicy = C.Teams.makeRetentionPolicy()
  if (i.teamRetention) {
    teamRetentionPolicy = C.Teams.serviceRetentionPolicyToRetentionPolicy(i.teamRetention)
  }
  return {retentionPolicy, teamRetentionPolicy}
}

export const inboxUIItemToConversationMeta = (
  i: T.RPCChat.InboxUIItem
): T.Chat.ConversationMeta | undefined => {
  // Private chats only
  if (i.visibility !== T.RPCGen.TLFVisibility.private) {
    return
  }
  // We don't support mixed reader/writers
  if (i.name.includes('#')) {
    return
  }

  // We only treat implied adhoc teams as having resetParticipants
  const resetParticipants = new Set(
    (i.membersType === T.RPCChat.ConversationMembersType.impteamnative ||
      i.membersType === T.RPCChat.ConversationMembersType.impteamupgrade) &&
    i.resetParticipants
      ? i.resetParticipants
      : []
  )

  const supersededBy = conversationMetadataToMetaSupersedeInfo(i.supersededBy ?? undefined)
  const supersedes = conversationMetadataToMetaSupersedeInfo(i.supersedes ?? undefined)

  const isTeam = i.membersType === T.RPCChat.ConversationMembersType.team
  const {notificationsDesktop, notificationsGlobalIgnoreMentions, notificationsMobile} =
    parseNotificationSettings(i.notifications ?? undefined)

  const {retentionPolicy, teamRetentionPolicy} = UIItemToRetentionPolicies(i, isTeam)

  const minWriterRoleEnum = i.convSettings?.minWriterRoleInfo
    ? i.convSettings.minWriterRoleInfo.role
    : undefined
  let minWriterRole = minWriterRoleEnum !== undefined ? C.Teams.teamRoleByEnum[minWriterRoleEnum] : 'reader'
  if (minWriterRole === 'none') {
    // means nothing. set it to reader.
    minWriterRole = 'reader'
  }

  const cannotWrite = i.convSettings?.minWriterRoleInfo ? i.convSettings.minWriterRoleInfo.cannotWrite : false
  const conversationIDKey = T.Chat.stringToConversationIDKey(i.convID)
  let pinnedMsg: T.Chat.PinnedMessageInfo | undefined
  if (i.pinnedMsg) {
    const username = C.useCurrentUserState.getState().username
    const devicename = C.useCurrentUserState.getState().deviceName
    const getLastOrdinal = () =>
      C.getConvoState(conversationIDKey).messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
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
    botAliases: i.botAliases ?? {},
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
    isMuted: i.status === T.RPCChat.ConversationStatus.muted,
    maxMsgID: T.Chat.numberToMessageID(i.maxMsgID),
    maxVisibleMsgID: T.Chat.numberToMessageID(i.maxVisibleMsgID),
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    minWriterRole,
    notificationsDesktop,
    notificationsGlobalIgnoreMentions,
    notificationsMobile,
    pinnedMsg,
    readMsgID: T.Chat.numberToMessageID(i.readMsgID),
    resetParticipants,
    retentionPolicy,
    snippet: i.snippet,
    snippetDecorated: i.snippetDecorated,
    snippetDecoration: i.snippetDecoration,
    status: i.status,
    supersededBy: supersededBy ? T.Chat.stringToConversationIDKey(supersededBy) : T.Chat.noConversationIDKey,
    supersedes: supersedes ? T.Chat.stringToConversationIDKey(supersedes) : T.Chat.noConversationIDKey,
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

export const makeConversationMeta = (): T.Chat.ConversationMeta => ({
  botAliases: {},
  botCommands: {} as T.RPCChat.ConversationCommandGroups,
  cannotWrite: false,
  channelname: '',
  commands: {} as T.RPCChat.ConversationCommandGroups,
  conversationIDKey: T.Chat.noConversationIDKey,
  description: '',
  descriptionDecorated: '',
  draft: '',
  inboxLocalVersion: -1,
  inboxVersion: -1,
  isEmpty: false,
  isMuted: false,
  maxMsgID: T.Chat.numberToMessageID(-1),
  maxVisibleMsgID: T.Chat.numberToMessageID(-1),
  membershipType: 'active' as const,
  minWriterRole: 'reader' as const,
  notificationsDesktop: 'never' as const,
  notificationsGlobalIgnoreMentions: false,
  notificationsMobile: 'never' as const,
  offline: false,
  pinnedMsg: undefined,
  readMsgID: T.Chat.numberToMessageID(-1),
  rekeyers: new Set(),
  resetParticipants: new Set(),
  retentionPolicy: C.Teams.makeRetentionPolicy(),
  snippet: '',
  snippetDecorated: undefined,
  snippetDecoration: T.RPCChat.SnippetDecoration.none as T.RPCChat.SnippetDecoration,
  status: T.RPCChat.ConversationStatus.unfiled as T.RPCChat.ConversationStatus,
  supersededBy: T.Chat.noConversationIDKey,
  supersedes: T.Chat.noConversationIDKey,
  teamID: '',
  teamRetentionPolicy: C.Teams.makeRetentionPolicy(),
  teamType: 'adhoc' as T.Chat.TeamType,
  teamname: '',
  timestamp: 0,
  tlfname: '',
  trustedState: 'untrusted' as T.Chat.MetaTrustedState,
  wasFinalizedBy: '',
})

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

export const getRowParticipants = (participants: T.Immutable<T.Chat.ParticipantInfo>, username: string) =>
  participants.name
    // Filter out ourselves unless it's our 1:1 conversation
    .filter((participant, _, list) => (list.length === 1 ? true : participant !== username))

export const getConversationLabel = (
  participantInfo: T.Chat.ParticipantInfo,
  conv: T.Chat.ConversationMeta,
  alwaysIncludeChannelName: boolean
): string => {
  if (conv.teamType === 'big') {
    return conv.teamname + '#' + conv.channelname
  }
  if (conv.teamType === 'small') {
    return alwaysIncludeChannelName ? conv.teamname + '#' + conv.channelname : conv.teamname
  }
  return getRowParticipants(participantInfo, '').join(',')
}

export const timestampToString = (meta: T.Chat.ConversationMeta) =>
  formatTimeForConversationList(meta.timestamp)

export const getTeams = (metaMap: T.Chat.MetaMap) =>
  [...metaMap.values()].reduce<Array<string>>((l, meta) => {
    if (meta.teamname && meta.channelname === 'general') {
      l.push(meta.teamname)
    }
    return l
  }, [])
