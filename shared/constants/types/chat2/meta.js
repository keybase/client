// Metadata about a conversation. We keep the messages sep. since we update these at different times
// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../rpc-chat-gen'
import * as Common from './common'

type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
type TeamType = 'small' | 'big' | 'adhoc'
type Username = string

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'

export type _ConversationMeta = {
  channelname: ?string,
  id: Common.ConversationIDKey,
  inboxVersion: number,
  isMuted: boolean,
  membershipType: MembershipType,
  notificationSettings: ?RPCChatTypes.ConversationNotificationInfo,
  participants: I.Set<string>,
  resetParticipants: I.Set<string>,
  supersededBy: ?Common.ConversationIDKey,
  supersededByCausedBy: ?Username,
  supersedes: ?Common.ConversationIDKey,
  supersedesCausedBy: ?Username,
  teamType: TeamType,
  teamname: ?string,
  trustedState: MetaTrustedState,
}

export type ConversationMeta = I.RecordOf<_ConversationMeta>
