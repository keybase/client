// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type {ConversationIDKey} from '../constants/types/chat2'
import type * as Types from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteMultiChannelsConfirmed = 'teams:deleteMultiChannelsConfirmed'
export const ignoreRequest = 'teams:ignoreRequest'
export const loadTeamTree = 'teams:loadTeamTree'
export const manageChatChannels = 'teams:manageChatChannels'
export const removeMember = 'teams:removeMember'
export const removePendingInvite = 'teams:removePendingInvite'
export const renameTeam = 'teams:renameTeam'
export const setMemberActivityDetails = 'teams:setMemberActivityDetails'
export const setPublicity = 'teams:setPublicity'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const showTeamByName = 'teams:showTeamByName'
export const teamSeen = 'teams:teamSeen'
export const updateChannelName = 'teams:updateChannelName'
export const updateTopic = 'teams:updateTopic'

// Action Creators
/**
 * Rename a subteam
 */
export const createRenameTeam = (payload: {readonly oldName: string; readonly newName: string}) => ({
  payload,
  type: renameTeam as typeof renameTeam,
})
/**
 * Tries to show a team with this name whether the user is in the team or not.
 * For teams we are not in:
 * - with teamsRedesign on go to external team page
 * - with teamsRedesign off noop
 */
export const createShowTeamByName = (payload: {
  readonly teamname: string
  readonly initialTab?: Types.TabKey
  readonly join?: boolean
  readonly addMembers?: boolean
}) => ({payload, type: showTeamByName as typeof showTeamByName})
/**
 * User has viewed this team. Clear related badges.
 */
export const createTeamSeen = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: teamSeen as typeof teamSeen,
})
export const createDeleteChannelConfirmed = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
}) => ({payload, type: deleteChannelConfirmed as typeof deleteChannelConfirmed})
export const createDeleteMultiChannelsConfirmed = (payload: {
  readonly teamID: Types.TeamID
  readonly channels: Array<ConversationIDKey>
}) => ({payload, type: deleteMultiChannelsConfirmed as typeof deleteMultiChannelsConfirmed})
export const createIgnoreRequest = (payload: {
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly username: string
}) => ({payload, type: ignoreRequest as typeof ignoreRequest})
export const createLoadTeamTree = (payload: {readonly teamID: Types.TeamID; readonly username: string}) => ({
  payload,
  type: loadTeamTree as typeof loadTeamTree,
})
export const createManageChatChannels = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: manageChatChannels as typeof manageChatChannels,
})
export const createRemoveMember = (payload: {readonly teamID: Types.TeamID; readonly username: string}) => ({
  payload,
  type: removeMember as typeof removeMember,
})
export const createRemovePendingInvite = (payload: {
  readonly teamID: Types.TeamID
  readonly inviteID: string
}) => ({payload, type: removePendingInvite as typeof removePendingInvite})
export const createSetMemberActivityDetails = (payload: {
  readonly activityMap: Map<Types.TeamID, number>
  readonly username: string
}) => ({payload, type: setMemberActivityDetails as typeof setMemberActivityDetails})
export const createSetPublicity = (payload: {
  readonly teamID: Types.TeamID
  readonly settings: Types.PublicitySettings
}) => ({payload, type: setPublicity as typeof setPublicity})
export const createSetUpdatedChannelName = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
  readonly newChannelName: string
}) => ({payload, type: setUpdatedChannelName as typeof setUpdatedChannelName})
export const createSetUpdatedTopic = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
  readonly newTopic: string
}) => ({payload, type: setUpdatedTopic as typeof setUpdatedTopic})
export const createUpdateChannelName = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
  readonly newChannelName: string
}) => ({payload, type: updateChannelName as typeof updateChannelName})
export const createUpdateTopic = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
  readonly newTopic: string
}) => ({payload, type: updateTopic as typeof updateTopic})

// Action Payloads
export type DeleteChannelConfirmedPayload = ReturnType<typeof createDeleteChannelConfirmed>
export type DeleteMultiChannelsConfirmedPayload = ReturnType<typeof createDeleteMultiChannelsConfirmed>
export type IgnoreRequestPayload = ReturnType<typeof createIgnoreRequest>
export type LoadTeamTreePayload = ReturnType<typeof createLoadTeamTree>
export type ManageChatChannelsPayload = ReturnType<typeof createManageChatChannels>
export type RemoveMemberPayload = ReturnType<typeof createRemoveMember>
export type RemovePendingInvitePayload = ReturnType<typeof createRemovePendingInvite>
export type RenameTeamPayload = ReturnType<typeof createRenameTeam>
export type SetMemberActivityDetailsPayload = ReturnType<typeof createSetMemberActivityDetails>
export type SetPublicityPayload = ReturnType<typeof createSetPublicity>
export type SetUpdatedChannelNamePayload = ReturnType<typeof createSetUpdatedChannelName>
export type SetUpdatedTopicPayload = ReturnType<typeof createSetUpdatedTopic>
export type ShowTeamByNamePayload = ReturnType<typeof createShowTeamByName>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>
export type UpdateChannelNamePayload = ReturnType<typeof createUpdateChannelName>
export type UpdateTopicPayload = ReturnType<typeof createUpdateTopic>

// All Actions
// prettier-ignore
export type Actions =
  | DeleteChannelConfirmedPayload
  | DeleteMultiChannelsConfirmedPayload
  | IgnoreRequestPayload
  | LoadTeamTreePayload
  | ManageChatChannelsPayload
  | RemoveMemberPayload
  | RemovePendingInvitePayload
  | RenameTeamPayload
  | SetMemberActivityDetailsPayload
  | SetPublicityPayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | ShowTeamByNamePayload
  | TeamSeenPayload
  | UpdateChannelNamePayload
  | UpdateTopicPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
