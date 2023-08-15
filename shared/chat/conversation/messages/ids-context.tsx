import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
// use this if you need context / ordinal injected into and rerender
// TODO remove now that we have the zustand context
export const ConvoIDContext = React.createContext<Types.ConversationIDKey>('')
export const OrdinalContext = React.createContext<Types.Ordinal>(0)

export const SeparatorMapContext = React.createContext(new Map<Types.Ordinal, Types.Ordinal>())
export const HighlightedContext = React.createContext(false)
