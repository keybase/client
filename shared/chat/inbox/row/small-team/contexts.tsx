import * as React from 'react'
import * as RPCTypes from '../../../../constants/types/rpc-chat-gen'
// so popups will work in both places
export const SnippetContext = React.createContext('')
export const SnippetDecorationContext = React.createContext(RPCTypes.SnippetDecoration.none)
export const ParticipantsContext = React.createContext<Array<string> | string>('')
export const IsTeamContext = React.createContext(false)
export const TimeContext = React.createContext(0)
