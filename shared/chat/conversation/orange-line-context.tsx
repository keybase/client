import * as React from 'react'
import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

type ExplicitOrangeLine = T.Immutable<{
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
  version: number
}>

type ExplicitOrangeLineState = T.Immutable<{
  update?: ExplicitOrangeLine
  dispatch: {
    resetState: () => void
    setOrangeLine: (conversationIDKey: T.Chat.ConversationIDKey, ordinal: T.Chat.Ordinal) => void
  }
}>

let explicitOrangeLineVersion = 0

export const useExplicitOrangeLineState = Z.createZustand<ExplicitOrangeLineState>(
  'chat-explicit-orange-line',
  set => ({
    dispatch: {
      resetState: Z.defaultReset,
      setOrangeLine: (conversationIDKey, ordinal) => {
        set(s => {
          s.update = {
            conversationIDKey,
            ordinal,
            version: ++explicitOrangeLineVersion,
          }
        })
      },
    },
    update: undefined,
  })
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
