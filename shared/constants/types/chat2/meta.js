// Metadata about a conversation.
// @flow
import * as I from 'immutable'
import * as Common from './common'
import type {Ordinal} from './message'
import type {RetentionPolicy} from '../teams'

type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
type TeamType = 'small' | 'big' | 'adhoc'

// When we scroll backwards we get an opaque string back to use as a token to get the next page
export opaque type PaginationKey: string = string
export const stringToPaginationKey = (s: string): PaginationKey => s

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type _ConversationMeta = {
  channelname: string,
  conversationIDKey: Common.ConversationIDKey,
  description: string,
  inboxVersion: number,
  isMuted: boolean,
  wasFinalizedBy: string, // a conversation can be finalized but not superseded
  membershipType: MembershipType,
  notificationsDesktop: NotificationsType,
  notificationsMobile: NotificationsType,
  notificationsGlobalIgnoreMentions: boolean,
  offline: boolean,
  orangeLineOrdinal: ?Ordinal,
  paginationKey: ?PaginationKey,
  participants: I.OrderedSet<string>,
  rekeyers: I.Set<string>,
  resetParticipants: I.Set<string>,
  retentionPolicy: RetentionPolicy,
  snippet: string,
  supersededBy: ?Common.ConversationIDKey,
  supersedes: ?Common.ConversationIDKey,
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
