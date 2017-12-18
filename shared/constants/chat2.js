// @flow
import * as I from 'immutable'
import * as Types from './types/chat2'
import * as RPCChatTypes from './types/flow-types-chat'

const conversationMemberStatusToMembershipType = (m: ConversationMemberStatus) => {
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
  return makeConversation({
    id: i.convID,
    idToMessage: I.Map(),
    inboxVersion: i.version,
    isMuted: i.status === RPCChatTypes.commonConversationStatus.muted,
    membershipType: conversationMemberStatusToMembershipType(i.memberStatus),
    messageIDs: I.List(),
    notificationSettings: null,
    participants: I.Set(),
    resetParticipants: I.Set(),
    supersededBy: null,
    supersedes: null,
    teamType: 'adhoc',
  })
}

export const makeConversation: I.RecordFactory<Types._Conversation> = I.Record({
  id: Types.stringToConversationIDKey(''),
  inboxVersion: -1,
  isMuted: false,
  isUnboxed: false,
  membershipType: 'active',
  notificationSettings: null,
  participants: I.Set(),
  resetParticipants: I.Set(),
  supersededBy: null,
  supersedes: null,
  teamType: 'adhoc',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  idToConversation: I.Map(),
})
