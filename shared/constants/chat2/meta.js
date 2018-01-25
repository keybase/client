// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as Types from '../types/chat2'
import type {_ConversationMeta} from '../types/chat2/meta'
import {formatTimeForConversationList} from '../../util/timestamp'
import {globalColors, isMobile} from '../../styles'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {toByteArray} from 'base64-js'

const IGNORE_UNTRUSTED_CACHE = false
IGNORE_UNTRUSTED_CACHE && console.log('aaa NOJIMA skipping locametadata')

const conversationMemberStatusToMembershipType = (m: RPCChatTypes.ConversationMemberStatus) => {
  switch (m) {
    case RPCChatTypes.commonConversationMemberStatus.active:
      return 'active'
    case RPCChatTypes.commonConversationMemberStatus.reset:
      return 'youAreReset'
    default:
      return 'youArePreviewing'
  }
}

// This one call handles us getting a string or a buffer
const supersededConversationIDToKey = (id: string | Buffer): string =>
  typeof id === 'string' ? Buffer.from(toByteArray(id)).toString('hex') : id.toString('hex')

export const unverifiedInboxUIItemToConversationMeta = (
  i: RPCChatTypes.UnverifiedInboxUIItem,
  username: string
) => {
  if (IGNORE_UNTRUSTED_CACHE) {
    // $FlowIssue flow rightfully complains
    i.localMetadata = null
  }

  // Public chats only
  if (i.visibility !== RPCTypes.commonTLFVisibility.private) {
    return null
  }

  // We only treat implied adhoc teams as having resetParticipants
  const resetParticipants = I.Set(
    i.localMetadata &&
    (i.membersType === RPCChatTypes.commonConversationMembersType.impteamnative ||
      i.membersType === RPCChatTypes.commonConversationMembersType.impteamupgrade) &&
    i.localMetadata.resetParticipants
      ? i.localMetadata.resetParticipants
      : []
  )

  const participants = I.OrderedSet(
    i.localMetadata
      ? i.localMetadata.writerNames || []
      : parseFolderNameToUsers(username, i.name).map(ul => ul.username)
  )

  const channelname =
    i.membersType === RPCChatTypes.commonConversationMembersType.team && i.localMetadata
      ? i.localMetadata.channelName
      : ''

  const teamname = i.membersType === RPCChatTypes.commonConversationMembersType.team ? i.name : ''

  return makeConversationMeta({
    channelname,
    conversationIDKey: Types.stringToConversationIDKey(i.convID),
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.commonConversationStatus.muted,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    notificationSettings: null,
    participants,
    resetParticipants,
    snippet: i.localMetadata ? i.localMetadata.snippet : '',
    supersededBy: null,
    supersedes: null,
    teamType: getTeamType(i),
    teamname,
    timestamp: i.time,
    tlfname: i.name,
    trustedState: i.localMetadata ? 'trusted' : 'untrusted', // if we have localMetadata attached to an unverifiedInboxUIItem it's been loaded previously
  })
}

const conversationMetadataToMetaSupersedeInfo = (metas: ?Array<RPCChatTypes.ConversationMetadata>) => {
  const meta: ?RPCChatTypes.ConversationMetadata = (metas || []).find(
    m => m.idTriple.topicType === RPCChatTypes.commonTopicType.chat && m.finalizeInfo
  )

  return {
    conversationIDKey: meta ? supersededConversationIDToKey(meta.conversationID) : null,
    username: meta && meta.finalizeInfo ? meta.finalizeInfo.resetUser : null,
  }
}

const getTeamType = ({teamType, membersType}) => {
  if (teamType === RPCChatTypes.commonTeamType.complex) {
    return 'big'
  } else if (membersType === RPCChatTypes.commonConversationMembersType.team) {
    return 'small'
  } else {
    return 'adhoc'
  }
}

// Upgrade a meta, try and keep exising values if possible to reduce render thrashing in components
// Enforce the verions only increase and we only go from untrusted to trusted, etc
export const updateMeta = (
  old: Types.ConversationMeta,
  meta: Types.ConversationMeta
): Types.ConversationMeta => {
  // Don't downgrade version
  if (meta.inboxVersion < old.inboxVersion) {
    return old
  }

  // Same version and same state?
  if (meta.inboxVersion === old.inboxVersion && meta.trustedState === old.trustedState) {
    return old
  }

  // TODO this should be our own type and NOT this raw structure from the daemon
  const notificationSettings =
    JSON.stringify(old.notificationSettings || {}) === JSON.stringify(meta.notificationSettings || {})
      ? old.notificationSettings
      : meta.notificationSettings
  const hasLoadedThread = old.hasLoadedThread
  const participants = old.participants.equals(meta.participants) ? old.participants : meta.participants
  const rekeyers = old.rekeyers.equals(meta.rekeyers) ? old.rekeyers : meta.rekeyers
  const resetParticipants = old.resetParticipants.equals(meta.resetParticipants)
    ? old.resetParticipants
    : meta.resetParticipants

  return meta.withMutations(m => {
    m.set('hasLoadedThread', hasLoadedThread)
    m.set('notificationSettings', notificationSettings)
    m.set('participants', participants)
    m.set('rekeyers', rekeyers)
    m.set('resetParticipants', resetParticipants)
  })
}

export const inboxUIItemToConversationMeta = (i: RPCChatTypes.InboxUIItem) => {
  // Public chats only
  if (i.visibility !== RPCTypes.commonTLFVisibility.private) {
    return null
  }
  // Ignore empty
  if (i.isEmpty) {
    return null
  }
  // We don't support mixed reader/writers
  if (i.name.includes('#')) {
    return null
  }

  // We only treat implied adhoc teams as having resetParticipants
  const resetParticipants = I.Set(
    (i.membersType === RPCChatTypes.commonConversationMembersType.impteamnative ||
      i.membersType === RPCChatTypes.commonConversationMembersType.impteamupgrade) &&
    i.resetParticipants
      ? i.resetParticipants
      : []
  )

  const {
    conversationIDKey: supersededBy,
    username: supersededByCausedBy,
  } = conversationMetadataToMetaSupersedeInfo(i.supersededBy)
  const {
    conversationIDKey: supersedes,
    username: supersedesCausedBy,
  } = conversationMetadataToMetaSupersedeInfo(i.supersedes)

  const isTeam = i.membersType === RPCChatTypes.commonConversationMembersType.team

  return makeConversationMeta({
    channelname: (isTeam && i.channel) || '',
    conversationIDKey: Types.stringToConversationIDKey(i.convID),
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.commonConversationStatus.muted,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    notificationSettings: i.notifications,
    participants: I.OrderedSet(i.participants || []),
    resetParticipants,
    snippet: i.snippet,
    supersededBy: supersededBy ? Types.stringToConversationIDKey(supersededBy) : null,
    supersededByCausedBy,
    supersedes: supersedes ? Types.stringToConversationIDKey(supersedes) : null,
    supersedesCausedBy,
    teamType: getTeamType(i),
    teamname: (isTeam && i.name) || '',
    timestamp: i.time,
    tlfname: i.name,
    trustedState: 'trusted',
  })
}

export const makeConversationMeta: I.RecordFactory<_ConversationMeta> = I.Record({
  channelname: '',
  conversationIDKey: Types.stringToConversationIDKey(''),
  hasLoadedThread: false,
  inboxVersion: -1,
  isMuted: false,
  membershipType: 'active',
  notificationSettings: null,
  participants: I.OrderedSet(),
  rekeyers: I.Set(),
  resetParticipants: I.Set(),
  snippet: '',
  supersededBy: null,
  supersededByCausedBy: null,
  supersedes: null,
  supersedesCausedBy: null,
  teamType: 'adhoc',
  teamname: '',
  timestamp: 0,
  tlfname: '',
  trustedState: 'untrusted',
})

const bgPlatform = isMobile ? globalColors.white : globalColors.blue5
export const getRowStyles = (meta: Types.ConversationMeta, isSelected: boolean, hasUnread: boolean) => {
  const isError = meta.trustedState === 'error'
  const backgroundColor = isSelected ? globalColors.blue : bgPlatform
  const showBold = !isSelected && hasUnread
  const subColor = isError
    ? globalColors.red
    : isSelected ? globalColors.white : hasUnread ? globalColors.black_75 : globalColors.black_40
  const usernameColor = isSelected ? globalColors.white : globalColors.darkBlue

  return {
    backgroundColor,
    showBold,
    subColor,
    usernameColor,
  }
}

export const getConversationIDKeyMetasToLoad = (
  conversationIDKeys: Array<Types.ConversationIDKey>,
  metaMap: I.Map<Types.ConversationIDKey, Types.ConversationMeta>
) =>
  conversationIDKeys.reduce((arr, id) => {
    if (id) {
      const trustedState = metaMap.getIn([id, 'trustedState'])
      if (trustedState !== 'requesting' && trustedState !== 'trusted') {
        arr.push(id)
      }
    }
    return arr
  }, [])

export const getRowParticipants = (meta: Types.ConversationMeta, username: string) =>
  meta.participants
    // Filter out ourselves unless its our 1:1 conversation
    .filter((participant, idx, list) => (list.size === 1 ? true : participant !== username))

export const timestampToString = (meta: Types.ConversationMeta) =>
  formatTimeForConversationList(meta.timestamp)
