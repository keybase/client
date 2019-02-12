// Metadata about a conversation.
// @flow strict
import * as I from 'immutable'
import * as Common from './common'
import * as RPCChatTypes from '../rpc-chat-gen'
import type {RetentionPolicy} from '../retention-policy'

type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'
type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
type TeamType = 'small' | 'big' | 'adhoc'

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type _ConversationMeta = {
  channelname: string,
  conversationIDKey: Common.ConversationIDKey, // should be the key for this meta EXCEPT for pendingConversationIDKey, in that case its the resolved conversation we're previewing
  commands: RPCChatTypes.ConversationCommandGroups,
  description: string,
  inboxVersion: number,
  isMuted: boolean,
  wasFinalizedBy: string, // a conversation can be finalized but not superseded
  membershipType: MembershipType,
  minWriterRole: TeamRoleType, // minimum role to be able to write into a channel
  notificationsDesktop: NotificationsType,
  notificationsMobile: NotificationsType,
  notificationsGlobalIgnoreMentions: boolean,
  offline: boolean,
  participants: I.List<string>, // was OrderedSet but is quite slow
  maxMsgID: number,
  maxVisibleMsgID: number,
  readMsgID: number,
  rekeyers: I.Set<string>,
  resetParticipants: I.Set<string>,
  retentionPolicy: RetentionPolicy,
  snippet: string,
  snippetDecoration: string,
  supersededBy: Common.ConversationIDKey,
  supersedes: Common.ConversationIDKey,
  teamType: TeamType,
  teamname: string,
  // We have a place in the team store that also stores `teamRetentionPolicy`.
  // If you want to index by teamname and aren't writing a component that will
  // live in the conversation view you probably want to use the instance in the
  // team store, as it'll probably be more reliably updated
  teamRetentionPolicy: RetentionPolicy,
  timestamp: number,
  tlfname: string, // just used for rpc calls
  trustedState: MetaTrustedState,
}

export type ConversationMeta = I.RecordOf<_ConversationMeta>
