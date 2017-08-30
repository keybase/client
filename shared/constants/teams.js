// @flow
import * as I from 'immutable'
import type {KBRecord} from './types/more'
import type {NoErrorTypedAction} from './types/flux'
import type {ConversationIDKey} from './chat'

export type GetChannels = NoErrorTypedAction<'teams:getChannels', {teamname: string}>
export type ToggleChannelMembership = NoErrorTypedAction<
  'teams:toggleChannelMembership',
  {teamname: string, channelname: string}
>

export type Teamname = string

export type TeamRecord = KBRecord<{
  convIDToChannelName: I.Map<ConversationIDKey, string>,
  convIDToDescription: I.Map<ConversationIDKey, string>,
  convIDToParticipants: I.Map<ConversationIDKey, I.Set<string>>,
  teamNameToConvIDs: I.Map<Teamname, ConversationIDKey>,
}>

export const Team = I.Record({
  convIDToChannelName: I.Map(),
  convIDToDescription: I.Map(),
  convIDToParticipants: I.Map(),
  teamNameToConvIDs: I.Map(),
})
