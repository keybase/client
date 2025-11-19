import * as React from 'react'
import * as T from '@/constants/types'

export type MessageContextValue = {
  canFixOverdraw: boolean
  isHighlighted: boolean
  ordinal: T.Chat.Ordinal
}

const defaultValue: MessageContextValue = {
  canFixOverdraw: true,
  isHighlighted: false,
  ordinal: T.Chat.numberToOrdinal(0),
}

export const MessageContext = React.createContext<MessageContextValue>(defaultValue)

// Convenience hooks for accessing individual values
export const useOrdinal = () => React.useContext(MessageContext).ordinal
export const useIsHighlighted = () => React.useContext(MessageContext).isHighlighted
export const useCanFixOverdraw = () => React.useContext(MessageContext).canFixOverdraw
