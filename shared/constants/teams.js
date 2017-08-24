// @flow
import * as I from 'immutable'
import type {KBRecord} from './types/more'
import type {NoErrorTypedAction} from './types/flux'

export type GetChannels = NoErrorTypedAction<'teams:getChannels', {teamname: string}>
export type ToggleChannelMembership = NoErrorTypedAction<
  'teams:toggleChannelMembership',
  {teamname: string, channelname: string}
>

export type Teamname = string

export type ChannelRecord = KBRecord<{
  participants: I.Set<string>,
  conversationIDKey: ?string,
}>

const ChannelRecord = I.Record({
  participants: I.Set(),
  conversationIDKey: null,
})

export type Team = KBRecord<{
  channels: I.Map<string, ChannelRecord>,
}>

export {ChannelRecord}
