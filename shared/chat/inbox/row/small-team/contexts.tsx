import * as React from 'react'
import {ConvoIDContext} from '../../../conversation/messages/ids-context'
// so popups will work in both places
export const ConversationIDKeyContext = ConvoIDContext
export const SnippetContext = React.createContext('')
export const ParticipantsContext = React.createContext<Array<string> | string>('')
export const TopContext = React.createContext<{
  layoutIsTeam?: boolean
  layoutName?: string
  layoutTime?: number
}>({})
