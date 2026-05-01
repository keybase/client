import * as React from 'react'
import * as T from '@/constants/types'
export const OrangeLineContext = React.createContext(T.Chat.numberToOrdinal(0))
OrangeLineContext.displayName = 'OrangeLineContext'
export const SetOrangeLineContext = React.createContext<(ordinal: T.Chat.Ordinal) => void>(() => {})
SetOrangeLineContext.displayName = 'SetOrangeLineContext'
