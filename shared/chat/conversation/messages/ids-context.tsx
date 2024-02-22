import * as React from 'react'
import * as T from '@/constants/types'
// use this if you need ordinal injected into and rerender
export const OrdinalContext = React.createContext<T.Chat.Ordinal>(T.Chat.numberToOrdinal(0))
export const HighlightedContext = React.createContext(false)
