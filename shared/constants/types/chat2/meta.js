// Metadata about a conversation. We keep the messages sep. since we update these at different times
// @flow
import * as I from 'immutable'
import * as Common from './common'
import type {Ordinal} from './message'

type MembershipType = 'active' | 'youArePreviewing' | 'youAreReset'
type TeamType = 'small' | 'big' | 'adhoc'
type Username = string

export opaque type PaginationKey: string = string
export const stringToPaginationKey = (s: string): PaginationKey => s

export type MetaTrustedState = 'untrusted' | 'requesting' | 'trusted' | 'error'
export type NotificationsType = 'onAnyActivity' | 'onWhenAtMentioned' | 'never'

export type _ConversationMeta = {
  channelname: string,
  conversationIDKey: Common.ConversationIDKey,
  // hasLoadedThread: boolean,
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
