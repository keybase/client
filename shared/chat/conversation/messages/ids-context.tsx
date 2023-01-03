import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
export const ConvoIDContext = React.createContext<Types.ConversationIDKey>('')
export const OrdinalContext = React.createContext<Types.Ordinal>(0)
