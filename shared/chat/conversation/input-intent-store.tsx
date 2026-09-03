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
// commandStatus is delivered only to a consumer that is registered for the conversation when it
// is written, matching what its sibling engine listener does; everything else waits in the map
// until a consumer takes it.
//
// Do not add composer state to this store. The composer's state lives in the reducer in
// input-area/input-state.tsx; this only carries a one-shot instruction to it.
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import logger from '@/logger'

export type InputIntent =
  | {type: 'commandStatus'; info?: T.Chat.CommandStatusInfo}
  | {type: 'injectText'; text: string}
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

// Which consumers are mounted, as a fact the store is told rather than one it infers. The
// alternative - "nobody consumed synchronously inside setState, so nothing is mounted" - cannot
// tell an absent provider from a mounted one whose delivery is not synchronous, and a screen
// frozen by enableFreeze (react-native-screens wraps every off-top screen in react-freeze) is
// exactly that shape. A frozen provider is still mounted, so it stays registered and its intent
// is still waiting for it on thaw, which is what the route-param channel used to give us.
//
// Deliberately not zustand state: nothing renders from it, and a subscriber must never see it
// change. Entries are per mount, so the two providers a conversation can have are independent.
type Consumer = {types: ReadonlyArray<InputIntent['type']>}
const consumers = new Map<T.Chat.ConversationIDKey, Array<Consumer>>()

// Only ConversationInputProvider registers today: it is the sole consumer of the one type whose
// delivery is gated on a mount. ConversationCenterProvider claims 'highlight', which is durable,
// so registering it would add an entry nothing ever asks about.
export const registerInputIntentConsumer = <K extends InputIntent['type']>(
  conversationIDKey: T.Chat.ConversationIDKey,
  types: ReadonlyArray<K>
) => {
  // A fresh object per call, never `types` itself: two providers for one conversation pass the
  // same module-level array, and identity is how an unregister finds its own entry.
  const consumer: Consumer = {types}
  const existing = consumers.get(conversationIDKey)
  if (existing) {
    existing.push(consumer)
  } else {
    consumers.set(conversationIDKey, [consumer])
  }
  return () => {
    const current = consumers.get(conversationIDKey)
    const index = current?.indexOf(consumer) ?? -1
    if (!current || index === -1) {
      return
    }
    current.splice(index, 1)
    if (!current.length) {
      consumers.delete(conversationIDKey)
    }
  }
}

const hasConsumerFor = (conversationIDKey: T.Chat.ConversationIDKey, type: InputIntent['type']) =>
  !!consumers.get(conversationIDKey)?.some(c => c.types.includes(type))

export const setInputIntent = (conversationIDKey: T.Chat.ConversationIDKey, intent: InputIntent) => {
  // commandStatus mirrors its sibling engine event (the chatCommandStatus useEngineActionListener
  // in input-state.tsx): with no consumer mounted there is nothing to give it context, and an
  // error banner surfacing on some later, unrelated mount of this conversation is worse than no
  // banner. The drop is a no-op and not a write-then-delete: the mailbox holds one intent per
  // conversation, so writing first would make an unrelated durable intent collateral damage.
  if (intent.type === 'commandStatus' && !hasConsumerFor(conversationIDKey, 'commandStatus')) {
    logger.info(`[chat] dropped commandStatus input intent: no consumer mounted for ${conversationIDKey}`)
    return
  }
  useInputIntentState.setState(s => {
    s.intents.set(conversationIDKey, T.castDraft(intent))
  })
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
