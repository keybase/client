// A mailbox, not a model. One pending intent per conversation, deleted when the input
// provider reads it. Nothing here is durable state and nothing derives from it.
//
// It exists for callers with no path to the composer's context: popups rendered outside the
// thread's provider (the info panel, the attachment viewer), and module-level code that
// synthesizes a composer-directed message with no engine event behind it to listen for
// (constants/init's location-permission failure). A component that IS inside
// ConversationInputProvider must use that context directly and must not come through here.
// An engine event that already exists should be handled by a useEngineActionListener in the
// provider, filtered on id, the way chatCommandStatus and chatCommandMarkdown are - not here.
//
// commandStatus is delivered only if a provider is mounted, matching what its sibling
// engine listener does; everything else waits in the map until a provider consumes it.
//
// Do not add composer state to this store. The composer's state lives in the reducer in
// input-area/input-state.tsx; this only carries a one-shot instruction to it.
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'

export type InputIntent =
  | {type: 'commandStatus'; info?: T.Chat.CommandStatusInfo}
  | {type: 'injectText'; text?: string}
  | {type: 'setEditing'; ordinal: T.Chat.Ordinal}
  | {type: 'setReplyTo'; ordinal: T.Chat.Ordinal}
  | {type: 'highlight'; messageID: T.Chat.MessageID}

type State = T.Immutable<{
  intents: Map<T.Chat.ConversationIDKey, InputIntent>
  dispatch: {
    resetState: () => void
  }
}>

export const useInputIntentState = Z.createZustand<State>('inputIntent', () => ({
  dispatch: {resetState: Z.defaultReset},
  intents: new Map(),
}))

export const setInputIntent = (conversationIDKey: T.Chat.ConversationIDKey, intent: InputIntent) => {
  useInputIntentState.setState(s => {
    s.intents.set(conversationIDKey, T.castDraft(intent))
  })
  // commandStatus mirrors its sibling engine event (chatCommandStatus, handled in
  // input-state.tsx:243-253): if nothing consumed it synchronously above, no provider is
  // mounted for this conversation, so drop it rather than let it surface later with no
  // context. subscribe listeners run synchronously inside zustand's setState, so a mounted
  // provider has already consumed and deleted the entry by the time we get here.
  if (intent.type === 'commandStatus' && useInputIntentState.getState().intents.has(conversationIDKey)) {
    useInputIntentState.setState(s => {
      s.intents.delete(conversationIDKey)
    })
    logger.error(`[chat] dropped commandStatus input intent: no provider mounted for ${conversationIDKey}`)
  }
}

// Two providers can be mounted for the same conversation (the input provider, and
// ConversationCenterProvider for 'highlight'), each with its own slice of InputIntent['type'].
// `types` restricts a read to the caller's slice so one provider can never swallow an
// intent meant for the other; an intent whose type isn't in `types` is left pending.
//
// peek reads without consuming. Only for a component that must know an intent is waiting
// without being its consumer: NormalWrapper picks the initial thread-load options from a
// pending 'highlight' that ConversationCenterProvider, mounted below it, actually consumes.
export const peekInputIntent = <K extends InputIntent['type']>(
  conversationIDKey: T.Chat.ConversationIDKey,
  types: ReadonlyArray<K>
): T.Immutable<Extract<InputIntent, {type: K}>> | undefined => {
  const intent = useInputIntentState.getState().intents.get(conversationIDKey)
  if (!intent || !types.includes(intent.type as K)) {
    return undefined
  }
  // The bus's only cast: `types.includes` is the runtime proof of the narrowing the signature
  // promises, and TS can't see through Array.includes. Consumers get it for free.
  return intent as T.Immutable<Extract<InputIntent, {type: K}>>
}

export const consumeInputIntent = <K extends InputIntent['type']>(
  conversationIDKey: T.Chat.ConversationIDKey,
  types: ReadonlyArray<K>
): T.Immutable<Extract<InputIntent, {type: K}>> | undefined => {
  const intent = peekInputIntent(conversationIDKey, types)
  if (!intent) {
    return undefined
  }
  useInputIntentState.setState(s => {
    s.intents.delete(conversationIDKey)
  })
  return intent
}
