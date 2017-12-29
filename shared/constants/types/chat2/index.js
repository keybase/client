// @flow
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'

export type _State = {
  badgeMap: I.Map<Common.ConversationIDKey, number>,
  inboxFilter: string,
  isSearching: boolean,
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>,
  messageOrdinals: I.Map<Common.ConversationIDKey, I.List<Message.Ordinal>>,
  metaMap: I.Map<Common.ConversationIDKey, Meta.ConversationMeta>,
  selectedConversation: ?Common.ConversationIDKey,
  unreadMap: I.Map<Common.ConversationIDKey, number>,
}

export type State = I.RecordOf<_State>

export type {ConversationMeta, MetaTrustedState} from './meta'
export type {Message, MessageAttachment, MessageText, Ordinal} from './message'
export type {ConversationIDKey} from './common'
export {stringToConversationIDKey} from './common'
