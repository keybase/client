// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as RPCTypes from '../types/rpc-gen'
import * as Types from '../types/chat2'
import type {_ConversationMeta} from '../types/chat2/meta'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {toByteArray} from 'base64-js'
import {globalColors, isMobile} from '../../styles'

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
  // Public chats only
  if (i.visibility !== RPCTypes.commonTLFVisibility.private) {
    return null
  }

  // We only treat implied adhoc teams as having resetParticipants
  const resetParticipants = I.Set(
    i.localMetadata &&
    i.membersType === RPCChatTypes.commonConversationMembersType.impteam &&
    i.localMetadata.resetParticipants
      ? i.localMetadata.resetParticipants
      : []
  )

  const participants = I.Set(
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
    conversationIDKey: i.convID,
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.commonConversationStatus.muted,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    notificationSettings: null,
    participants,
    resetParticipants,
    supersededBy: null,
    supersedes: null,
    teamType: getTeamType(i),
    teamname,
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

export const inboxUIItemToConversationMeta = (i: RPCChatTypes.InboxUIItem) => {
  // Public chats only
  if (i.visibility !== RPCTypes.commonTLFVisibility.private) {
    return null
  }
  // We don't support mixed reader/writers
  if (i.name.includes('#')) {
    return null
  }

  // We only treat implied adhoc teams as having resetParticipants
  const resetParticipants = I.Set(
    i.membersType === RPCChatTypes.commonConversationMembersType.impteam && i.resetParticipants
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
    conversationIDKey: i.convID,
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.commonConversationStatus.muted,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    notificationSettings: i.notifications,
    participants: I.Set(i.participants || []),
    resetParticipants,
    supersededBy,
    supersededByCausedBy,
    supersedes,
    supersedesCausedBy,
    teamType: getTeamType(i),
    teamname: (isTeam && i.name) || '',
    trustedState: 'trusted',
  })
}

export const makeConversationMeta: I.RecordFactory<_ConversationMeta> = I.Record({
  channelname: '',
  conversationIDKey: Types.stringToConversationIDKey(''),
  inboxVersion: -1,
  isMuted: false,
  membershipType: 'active',
  notificationSettings: null,
  participants: I.Set(),
  resetParticipants: I.Set(),
  supersededBy: null,
  supersededByCausedBy: null,
  supersedes: null,
  supersedesCausedBy: null,
  teamType: 'adhoc',
  teamname: '',
  trustedState: 'untrusted',
})

const bgPlatform = isMobile ? globalColors.white : globalColors.blue5
export const getRowColors = (meta: Types.ConversationMeta, isSelected: boolean, hasUnread: boolean) => {
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

export const getRowParticipants = (meta: Types.ConversationMeta, username: string) =>
  meta.participants
    .toList()
    // Filter out ourselves unless its our 1:1 conversation
    .filter((participant, idx, list) => (list.size === 1 ? true : participant !== username))
