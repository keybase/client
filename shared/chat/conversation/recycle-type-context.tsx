import * as React from 'react'
import type * as T from '@/constants/types'

export const SetRecycleTypeContext = React.createContext((_ordinal: T.Chat.Ordinal, _type: string) => {})
