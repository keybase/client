// @flow
import * as I from 'immutable'
import * as ChatConstants from './chat'
import type {KBRecord} from './types/more'
import type {NoErrorTypedAction} from './types/flux'
import type {ConversationIDKey} from './chat'
import type {TypedState} from './reducer'

export type GetChannels = NoErrorTypedAction<'teams:getChannels', {teamname: string}>
export type ToggleChannelMembership = NoErrorTypedAction<
  'teams:toggleChannelMembership',
  {teamname: string, channelname: string}
>
export type CreateChannel = NoErrorTypedAction<
  'teams:createChannel',
  {channelname: string, description: string, teamname: string}
>

export type Teamname = string

export type ChannelInfoRecord = KBRecord<{
  channelname: ?string,
  description: ?string,
  participants: I.Set<string>,
}>

export const ChannelInfo = I.Record({
  channelname: null,
  description: null,
  participants: I.Set(),
})

export const Team = I.Record({
  convIDToChannelInfo: I.Map(),
  teamNameToConvIDs: I.Map(),
})

export type TeamRecord = KBRecord<{
  convIDToChannelInfo: I.Map<ConversationIDKey, ChannelInfo>,
  teamNameToConvIDs: I.Map<Teamname, ConversationIDKey>,
}>

const getConversationIDKeyFromChannelName = (state: TypedState, channelname: string) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo'], I.Map()).findKey(i => i.channelname === channelname)

const getParticipants = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo', conversationIDKey, 'participants'], I.Set())

export {getConversationIDKeyFromChannelName, getParticipants}
