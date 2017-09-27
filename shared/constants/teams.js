// @flow
import * as I from 'immutable'
import * as ChatConstants from './chat'
import type {KBRecord} from './types/more'
import type {NoErrorTypedAction} from './types/flux'
import type {ConversationIDKey} from './chat'
import type {TypedState} from './reducer'

export type CreateNewTeam = NoErrorTypedAction<
  'teams:createNewTeam',
  {
    name: string,
  }
>

export type CreateNewTeamFromConversation = NoErrorTypedAction<
  'teams:createNewTeamFromConversation',
  {
    conversationIDKey: ConversationIDKey,
    name: string,
  }
>

export type LeaveTeam = NoErrorTypedAction<'teams:leaveTeam', {teamname: string}>
export type GetChannels = NoErrorTypedAction<'teams:getChannels', {teamname: string}>

export type GetTeams = NoErrorTypedAction<'teams:getTeams', {}>

export type ToggleChannelMembership = NoErrorTypedAction<
  'teams:toggleChannelMembership',
  {teamname: string, channelname: string}
>

export type SetupTeamHandlers = NoErrorTypedAction<'teams:setupTeamHandlers', void>
export type GetDetails = NoErrorTypedAction<'teams:getDetails', {teamname: string}>
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

export type MemberInfoRecord = KBRecord<{
  type: null | 'reader' | 'writer' | 'admin' | 'owner',
  username: string,
}>

export const MemberInfo = I.Record({
  type: null,
  username: '',
})

export type SetTeamCreationError = NoErrorTypedAction<
  'teams:setTeamCreationError',
  {teamCreationError: string}
>

export const Team = I.Record({
  convIDToChannelInfo: I.Map(),
  sawChatBanner: false,
  teamNameToConvIDs: I.Map(),
  teamNameToMembers: I.Map(),
  teamNameToLoading: I.Map(),
  teamnames: I.Set(),
  loaded: false,
})

export type TeamRecord = KBRecord<{
  convIDToChannelInfo: I.Map<ConversationIDKey, ChannelInfo>,
  sawChatBanner: boolean,
  teamNameToConvIDs: I.Map<Teamname, ConversationIDKey>,
  teamNameToMembers: I.Map<Teamname, I.Set<MemberInfo>>,
  teamNameToLoading: I.Map<Teamname, boolean>,
  teamnames: I.Set<Teamname>,
  loaded: boolean,
}>

const getConversationIDKeyFromChannelName = (state: TypedState, channelname: string) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo'], I.Map()).findKey(i => i.channelname === channelname)

const getParticipants = (state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) =>
  state.entities.getIn(['teams', 'convIDToChannelInfo', conversationIDKey, 'participants'], I.Set())

export {getConversationIDKeyFromChannelName, getParticipants}
