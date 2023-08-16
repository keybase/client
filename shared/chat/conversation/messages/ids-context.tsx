import * as React from 'react'
import type * as T from '../../../constants/types'
// use this if you need ordinal injected into and rerender
export const OrdinalContext = React.createContext<T.Chat.Ordinal>(0)

export const SeparatorMapContext = React.createContext(new Map<T.Chat.Ordinal, T.Chat.Ordinal>())
export const HighlightedContext = React.createContext(false)
