import * as React from 'react'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type ExplicitOrangeLine = T.Immutable<{
  ordinal: T.Chat.Ordinal
  version: number
}>

type ExplicitOrangeLineState = T.Immutable<{
  updates: Map<T.Chat.ConversationIDKey, ExplicitOrangeLine>
  dispatch: {
    resetState: () => void
    setOrangeLine: (conversationIDKey: T.Chat.ConversationIDKey, ordinal: T.Chat.Ordinal) => void
  }
}>

export const useExplicitOrangeLineState = Z.createZustand<ExplicitOrangeLineState>(
  'chat-explicit-orange-line',
  set => {
    let explicitOrangeLineVersion = 0
    return {
      dispatch: {
        resetState: Z.defaultReset,
        setOrangeLine: (conversationIDKey, ordinal) => {
          set(s => {
            s.updates.set(conversationIDKey, {
              ordinal,
              version: ++explicitOrangeLineVersion,
            })
          })
        },
      },
      updates: new Map(),
    }
  }
)

export const setConversationOrangeLine = (
  conversationIDKey: T.Chat.ConversationIDKey,
  ordinal: T.Chat.Ordinal
) => {
  if (!T.Chat.isValidConversationIDKey(conversationIDKey) || !T.Chat.ordinalToNumber(ordinal)) {
    return
  }
  useExplicitOrangeLineState.getState().dispatch.setOrangeLine(conversationIDKey, ordinal)
}

export const OrangeLineContext = React.createContext(T.Chat.numberToOrdinal(0))
OrangeLineContext.displayName = 'OrangeLineContext'
export const SetOrangeLineContext = React.createContext<(ordinal: T.Chat.Ordinal) => void>(() => {})
SetOrangeLineContext.displayName = 'SetOrangeLineContext'
