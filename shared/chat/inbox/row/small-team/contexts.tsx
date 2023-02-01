import * as React from 'react'
import {ConvoIDContext} from '../../../conversation/messages/ids-context'
// so popups will work in both places
export const ConversationIDKeyContext = ConvoIDContext
export const SnippetContext = React.createContext('')
export const ParticipantsContext = React.createContext<Array<string> | string>('')
export const IsTeamContext = React.createContext(false)
export const TimeContext = React.createContext(0)
