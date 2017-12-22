// @flow
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'

export type _State = {
  metaMap: I.Map<Common.ConversationIDKey, Meta.ConversationMeta>,
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>,
  messageOrdinals: I.Map<Common.ConversationIDKey, I.List<Message.Ordinal>>,
}

export type State = I.RecordOf<_State>

export type {ConversationMeta, MetaTrustedState, _ConversationMeta} from './meta'
export type {Message, _MessageText, Ordinal, MessageAttachment, _MessageAttachment} from './message'
export type {ConversationIDKey} from './common'
export {stringToConversationIDKey} from './common'
