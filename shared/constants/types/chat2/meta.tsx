// Metadata about a conversation.
// @flow strict
import * as I from 'immutable'
import * as Common from './common'
import * as RPCChatTypes from '../rpc-chat-gen'
import { RetentionPolicy } from '../retention-policy';

type TeamRoleType = "reader" | "writer" | "admin" | "owner";
type MembershipType = "active" | "youArePreviewing" | "youAreReset";
type TeamType = "small" | "big" | "adhoc";

export type MetaTrustedState = "untrusted" | "requesting" | "trusted" | "error";
export type NotificationsType = "onAnyActivity" | "onWhenAtMentioned" | "never";

export type _ConversationMeta = {
  channelname: string,
  conversationIDKey: Common.ConversationIDKey,
  commands: RPCChatTypes.ConversationCommandGroups,
  description: string,
  inboxLocalVersion: number,
  inboxVersion: number,
  isMuted: boolean,
  wasFinalizedBy: string,
  membershipType: MembershipType,
  minWriterRole: TeamRoleType,
  notificationsDesktop: NotificationsType,
  notificationsMobile: NotificationsType,
  notificationsGlobalIgnoreMentions: boolean,
  offline: boolean,
  participants: I.List<string>,
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
  teamRetentionPolicy: RetentionPolicy,
  timestamp: number,
  tlfname: string,
  trustedState: MetaTrustedState
};

export type ConversationMeta = I.RecordOf<_ConversationMeta>;
