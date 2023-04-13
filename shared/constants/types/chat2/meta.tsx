// Metadata about a conversation.
import type * as Common from './common'
import type * as Message from './message'
import type * as RPCChatTypes from '../rpc-chat-gen'
import type * as TeamTypes from '../teams'
import type {RetentionPolicy} from '../retention-policy'

export type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset' | 'notMember'
export type TeamType = 'small' | 'big' | 'adhoc'

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type PinnedMessageInfo = {
  message: Message.Message
  pinnerUsername: string
}

export type ConversationMeta = {
  botAliases: {[key: string]: string}
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
  isEmpty: boolean
  isMuted: boolean
  maxMsgID: number
  maxVisibleMsgID: number
  membershipType: MembershipType
  minWriterRole: TeamTypes.TeamRoleType // minimum role to be able to write into a channel,
  notificationsDesktop: NotificationsType
  notificationsGlobalIgnoreMentions: boolean
  notificationsMobile: NotificationsType
  offline: boolean
  pinnedMsg?: PinnedMessageInfo
  readMsgID: number
  rekeyers: Set<string>
  resetParticipants: Set<string>
  retentionPolicy: RetentionPolicy
  snippet?: string
  snippetDecorated?: string
  snippetDecoration: RPCChatTypes.SnippetDecoration
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
  teamID: TeamTypes.TeamID
  timestamp: number
  tlfname: string // just used for rpc calls,
  trustedState: MetaTrustedState
  wasFinalizedBy: string // a conversation can be finalized but not superseded,
}
