// Metadata about a conversation.
import * as I from 'immutable'
import * as Common from './common'
import * as RPCChatTypes from '../rpc-chat-gen'
import {RetentionPolicy} from '../retention-policy'

type TeamRoleType = 'reader' | 'writer' | 'admin' | 'owner'
type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
export type TeamType = 'small' | 'big' | 'adhoc'

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type _ConversationMeta = {
  cannotWrite: boolean
  channelname: string
  conversationIDKey: Common.ConversationIDKey
  commands: RPCChatTypes.ConversationCommandGroups
  description: string
  descriptionDecorated: string
  inboxLocalVersion: number
  inboxVersion: number
  isMuted: boolean
  wasFinalizedBy: string
  membershipType: MembershipType
  minWriterRole: TeamRoleType
  notificationsDesktop: NotificationsType
  notificationsMobile: NotificationsType
  notificationsGlobalIgnoreMentions: boolean
  offline: boolean
  participants: I.List<string>
  maxMsgID: number
  maxVisibleMsgID: number
  readMsgID: number
  rekeyers: I.Set<string>
  resetParticipants: I.Set<string>
  retentionPolicy: RetentionPolicy
  snippet: string
  snippetDecoration: string
  status: RPCChatTypes.ConversationStatus
  supersededBy: Common.ConversationIDKey
  supersedes: Common.ConversationIDKey
  teamType: TeamType
  teamname: string
  teamRetentionPolicy: RetentionPolicy
  timestamp: number
  tlfname: string
  trustedState: MetaTrustedState
}

export type ConversationMeta = I.RecordOf<_ConversationMeta>
