import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
// use this if you need ordinal injected into and rerender
export const OrdinalContext = React.createContext<Types.Ordinal>(0)

export const SeparatorMapContext = React.createContext(new Map<Types.Ordinal, Types.Ordinal>())
export const HighlightedContext = React.createContext(false)
