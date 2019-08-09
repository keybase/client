// Metadata about a conversation.
import * as I from 'immutable'
import * as Common from './common'
import * as RPCChatTypes from '../rpc-chat-gen'
import {RetentionPolicy} from '../retention-policy'

export type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'
export type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
export type TeamType = 'small' | 'big' | 'adhoc'

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type _ConversationMeta = {
  botCommands: RPCChatTypes.ConversationCommandGroups
  cannotWrite: boolean
  channelname: string
  commands: RPCChatTypes.ConversationCommandGroups
  conversationIDKey: Common.ConversationIDKey // should be the key for this meta EXCEPT for pendingConversationIDKey, in that case its the resolved conversation we're previewing,
  description: string
  descriptionDecorated: string
  draft: string
  inboxLocalVersion: number
  inboxVersion: number
  isMuted: boolean
  maxMsgID: number
  maxVisibleMsgID: number
  membershipType: MembershipType
  minWriterRole: TeamRoleType // minimum role to be able to write into a channel,
  notificationsDesktop: NotificationsType
  notificationsGlobalIgnoreMentions: boolean
  notificationsMobile: NotificationsType
  offline: boolean
  participantToContactName: I.Map<string, string>
  participants: I.List<string> // was OrderedSet but is quite slow,
  readMsgID: number
  rekeyers: I.Set<string>
  resetParticipants: I.Set<string>
  retentionPolicy: RetentionPolicy
  snippet: string
  snippetDecoration: string
  status: RPCChatTypes.ConversationStatus
  supersededBy: Common.ConversationIDKey
  supersedes: Common.ConversationIDKey
  // We have a place in the team store that also stores `teamRetentionPolicy`.
  // If you want to index by teamname and aren't writing a component that will
  // live in the conversation view you probably want to use the instance in the
  // team store, as it'll probably be more reliably updated
  teamRetentionPolicy: RetentionPolicy
  teamType: TeamType
  teamname: string
  timestamp: number
  tlfname: string // just used for rpc calls,
  trustedState: MetaTrustedState
  wasFinalizedBy: string // a conversation can be finalized but not superseded,
}

export type ConversationMeta = I.RecordOf<_ConversationMeta>
