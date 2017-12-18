// @flow
import * as I from 'immutable'
import * as RPCChatTypes from './flow-types-chat'

// TODO put back
// export opaque type ConversationIDKey: string = string
export type ConversationIDKey = string
export const stringToConversationIDKey = (s: string): ConversationIDKey => s

// TODO put back
// export opaque type MessageID: string = string
export type MessageID = string
export const stringToMessageID = (s: string): MessageID => s

type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
type TeamType = 'small' | 'big' | 'adhoc'

export type _Conversation = {
  id: ConversationIDKey,
  idToMessage: I.Map<MessageID, Message>,
  inboxVersion: number,
  isMuted: boolean,
  membershipType: MembershipType,
  messageIDs: I.List<MessageID>,
  notificationSettings: ?RPCChatTypes.ConversationNotificationInfo,
  participants: I.Set<string>,
  resetParticipants: I.Set<string>,
  supersededBy: ?ConversationIDKey,
  supersedes: ?ConversationIDKey,
  teamType: TeamType,
}

export type Conversation = I.RecordOf<_Conversation>

export type _State = {
  idToConversation: I.Map<ConversationIDKey, Conversation>,
}

export type State = I.RecordOf<_State>
