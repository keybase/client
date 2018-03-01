// Metadata about a conversation.
// @flow
import * as I from 'immutable'
import * as Common from './common'
import type {Ordinal} from './message'

type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
type TeamType = 'small' | 'big' | 'adhoc'
type Username = string

// When we scroll backwards we get an opaque string back to use as a token to get the next page
export opaque type PaginationKey: string = string
export const stringToPaginationKey = (s: string): PaginationKey => s

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type _ConversationMeta = {
  channelname: string,
  conversationIDKey: Common.ConversationIDKey,
  inboxVersion: number,
  isMuted: boolean,
  membershipType: MembershipType,
  notificationsDesktop: NotificationsType,
  notificationsMobile: NotificationsType,
  notificationsGlobalIgnoreMentions: boolean,
  orangeLineOrdinal: ?Ordinal,
  paginationKey: ?PaginationKey,
  paginationMoreToLoad: boolean,
  participants: I.OrderedSet<string>,
  rekeyers: I.Set<string>,
  resetParticipants: I.Set<string>,
  snippet: string,
  supersededBy: ?Common.ConversationIDKey,
  supersededByCausedBy: ?Username,
  supersedes: ?Common.ConversationIDKey,
  supersedesCausedBy: ?Username,
  teamType: TeamType,
  teamname: string,
  timestamp: number,
  tlfname: string, // just used for rpc calls
  trustedState: MetaTrustedState,
}

export type ConversationMeta = I.RecordOf<_ConversationMeta>
