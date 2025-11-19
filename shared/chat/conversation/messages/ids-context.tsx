import * as React from 'react'
import * as T from '@/constants/types'

export type MessageContextValue = {
  ordinal: T.Chat.Ordinal
  isHighlighted: boolean
  canFixOverdraw: boolean
}

const defaultValue: MessageContextValue = {
  ordinal: T.Chat.numberToOrdinal(0),
  isHighlighted: false,
  canFixOverdraw: true,
}

export const MessageContext = React.createContext<MessageContextValue>(defaultValue)

// Convenience hooks for accessing individual values
export const useOrdinal = () => React.useContext(MessageContext).ordinal
export const useIsHighlighted = () => React.useContext(MessageContext).isHighlighted
export const useCanFixOverdraw = () => React.useContext(MessageContext).canFixOverdraw
