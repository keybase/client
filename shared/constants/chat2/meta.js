// Meta manages the metadata about a conversation. Participants, isMuted, reset people, etc. Things that drive the inbox
// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/flow-types-chat'
import * as Types from '../types/chat2'
import {toByteArray} from 'base64-js'

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

export const unverifiedInboxUIItemToConversationMeta = (i: RPCChatTypes.UnverifiedInboxUIItem) => {
  return makeConversationMeta({
    id: i.convID,
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.commonConversationStatus.muted,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    notificationSettings: null,
    participants: I.Set(),
    resetParticipants: I.Set(),
    supersededBy: null,
    supersedes: null,
    teamType: 'adhoc',
    trustedState: i.localMetadata ? 'trusted' : 'untrusted', // if we have localMetadata attached to an unverifiedInboxUIItem it's been loaded previously
  })
}

const conversationMetadataToMetaSupersedeInfo = (metas: ?Array<RPCChatTypes.ConversationMetadata>) => {
  const meta: ?RPCChatTypes.ConversationMetadata = (metas || [])
    .find(m => m.idTriple.topicType === RPCChatTypes.commonTopicType.chat && m.finalizeInfo)

  return {
    conversationIDKey: meta ? supersededConversationIDToKey(meta.conversationID) : null,
    username: meta && meta.finalizeInfo ? meta.finalizeInfo.resetUser : null,
  }
}

export const inboxUIItemToConversationMeta = (i: RPCChatTypes.InboxUIItem) => {
  let teamType
  if (i.teamType === RPCChatTypes.commonTeamType.complex) {
    teamType = 'big'
  } else if (i.membersType === RPCChatTypes.commonConversationMembersType.team) {
    teamType = 'small'
  } else {
    teamType = 'adhoc'
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

  return makeConversationMeta({
    id: i.convID,
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
    teamType,
    trustedState: 'trusted',
  })
}

export const makeConversationMeta: I.RecordFactory<Types._ConversationMeta> = I.Record({
  id: Types.stringToConversationIDKey(''),
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
  trustedState: 'untrusted',
})
