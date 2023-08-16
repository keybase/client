import * as React from 'react'
import * as T from '../../../../constants/types'
// so popups will work in both places
export const SnippetContext = React.createContext('')
export const SnippetDecorationContext = React.createContext(T.RPCChat.SnippetDecoration.none)
export const ParticipantsContext = React.createContext<Array<string> | string>('')
export const IsTeamContext = React.createContext(false)
export const TimeContext = React.createContext(0)
