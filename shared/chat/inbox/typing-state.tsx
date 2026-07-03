import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type State = T.Immutable<{
  typing: Map<T.Chat.ConversationIDKey, ReadonlySet<string>>
  dispatch: {
    resetState: () => void
  }
}>

export const useInboxTypingState = Z.createZustand<State>('inboxTyping', () => ({
  dispatch: {resetState: Z.defaultReset},
  typing: new Map(),
}))

// Each ChatTypingUpdate carries the current typers for the named convs, so we
// replace those convs' sets and leave the rest untouched.
export const updateInboxTyping = (updates?: ReadonlyArray<T.RPCChat.ConvTypingUpdate> | null) => {
  if (!updates?.length) {
    return
  }
  useInboxTypingState.setState(s => {
    updates.forEach(update => {
      const id = T.Chat.conversationIDToKey(update.convID)
      s.typing.set(id, new Set(update.typers?.map(typer => typer.username)))
    })
  })
}
