// @flow
import * as I from 'immutable'
import * as Types from './types/chat2'
import * as RPCChatTypes from './types/flow-types-chat'

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

export const unverifiedInboxUIItemToConversation = (i: RPCChatTypes.UnverifiedInboxUIItem) => {
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
  })
}

export const makeConversationMeta: I.RecordFactory<Types._ConversationMeta> = I.Record({
  id: Types.stringToConversationIDKey(''),
  inboxVersion: -1,
  isMuted: false,
  loadingState: 'untrusted',
  membershipType: 'active',
  notificationSettings: null,
  participants: I.Set(),
  resetParticipants: I.Set(),
  supersededBy: null,
  supersedes: null,
  teamType: 'adhoc',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  metaMap: I.Map(),
  messageMap: I.Map(),
  messageIDsLsit: I.Map(),
})
