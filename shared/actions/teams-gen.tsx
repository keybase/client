// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type {ConversationIDKey} from '../constants/types/chat2'
import type * as Types from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const addParticipant = 'teams:addParticipant'
export const clearAddUserToTeamsResults = 'teams:clearAddUserToTeamsResults'
export const createChannel = 'teams:createChannel'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteMultiChannelsConfirmed = 'teams:deleteMultiChannelsConfirmed'
export const deleteTeam = 'teams:deleteTeam'
export const ignoreRequest = 'teams:ignoreRequest'
export const inviteToTeamByPhone = 'teams:inviteToTeamByPhone'
export const leaveTeam = 'teams:leaveTeam'
export const leftTeam = 'teams:leftTeam'
export const loadTeamTree = 'teams:loadTeamTree'
export const manageChatChannels = 'teams:manageChatChannels'
export const reAddToTeam = 'teams:reAddToTeam'
export const removeMember = 'teams:removeMember'
export const removeParticipant = 'teams:removeParticipant'
export const removePendingInvite = 'teams:removePendingInvite'
export const renameTeam = 'teams:renameTeam'
export const saveChannelMembership = 'teams:saveChannelMembership'
export const setMemberActivityDetails = 'teams:setMemberActivityDetails'
export const setPublicity = 'teams:setPublicity'
export const setTeamVersion = 'teams:setTeamVersion'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const showTeamByName = 'teams:showTeamByName'
export const teamSeen = 'teams:teamSeen'
export const updateChannelName = 'teams:updateChannelName'
export const updateTopic = 'teams:updateTopic'
export const uploadTeamAvatar = 'teams:uploadTeamAvatar'

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
/**
 * We successfully left a team
 */
export const createLeftTeam = (payload: {readonly teamname: string; readonly context: 'teams' | 'chat'}) => ({
  payload,
  type: leftTeam as typeof leftTeam,
})
export const createAddParticipant = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
}) => ({payload, type: addParticipant as typeof addParticipant})
export const createClearAddUserToTeamsResults = (payload?: undefined) => ({
  payload,
  type: clearAddUserToTeamsResults as typeof clearAddUserToTeamsResults,
})
export const createCreateChannel = (payload: {
  readonly teamID: Types.TeamID
  readonly channelname: string
  readonly description?: string
  readonly navToChatOnSuccess: boolean
}) => ({payload, type: createChannel as typeof createChannel})
export const createDeleteChannelConfirmed = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
}) => ({payload, type: deleteChannelConfirmed as typeof deleteChannelConfirmed})
export const createDeleteMultiChannelsConfirmed = (payload: {
  readonly teamID: Types.TeamID
  readonly channels: Array<ConversationIDKey>
}) => ({payload, type: deleteMultiChannelsConfirmed as typeof deleteMultiChannelsConfirmed})
export const createDeleteTeam = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: deleteTeam as typeof deleteTeam,
})
export const createIgnoreRequest = (payload: {
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly username: string
}) => ({payload, type: ignoreRequest as typeof ignoreRequest})
export const createInviteToTeamByPhone = (payload: {
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly role: Types.TeamRoleType
  readonly phoneNumber: string
  readonly fullName: string
  readonly loadingKey?: string
}) => ({payload, type: inviteToTeamByPhone as typeof inviteToTeamByPhone})
export const createLeaveTeam = (payload: {
  readonly teamname: string
  readonly permanent: boolean
  readonly context: 'teams' | 'chat'
}) => ({payload, type: leaveTeam as typeof leaveTeam})
export const createLoadTeamTree = (payload: {readonly teamID: Types.TeamID; readonly username: string}) => ({
  payload,
  type: loadTeamTree as typeof loadTeamTree,
})
export const createManageChatChannels = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: manageChatChannels as typeof manageChatChannels,
})
export const createReAddToTeam = (payload: {readonly teamID: Types.TeamID; readonly username: string}) => ({
  payload,
  type: reAddToTeam as typeof reAddToTeam,
})
export const createRemoveMember = (payload: {readonly teamID: Types.TeamID; readonly username: string}) => ({
  payload,
  type: removeMember as typeof removeMember,
})
export const createRemoveParticipant = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ConversationIDKey
}) => ({payload, type: removeParticipant as typeof removeParticipant})
export const createRemovePendingInvite = (payload: {
  readonly teamID: Types.TeamID
  readonly inviteID: string
}) => ({payload, type: removePendingInvite as typeof removePendingInvite})
export const createSaveChannelMembership = (payload: {
  readonly teamID: Types.TeamID
  readonly oldChannelState: Types.ChannelMembershipState
  readonly newChannelState: Types.ChannelMembershipState
}) => ({payload, type: saveChannelMembership as typeof saveChannelMembership})
export const createSetMemberActivityDetails = (payload: {
  readonly activityMap: Map<Types.TeamID, number>
  readonly username: string
}) => ({payload, type: setMemberActivityDetails as typeof setMemberActivityDetails})
export const createSetPublicity = (payload: {
  readonly teamID: Types.TeamID
  readonly settings: Types.PublicitySettings
}) => ({payload, type: setPublicity as typeof setPublicity})
export const createSetTeamVersion = (payload: {
  readonly teamID: Types.TeamID
  readonly version: Types.TeamVersion
}) => ({payload, type: setTeamVersion as typeof setTeamVersion})
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
export const createUploadTeamAvatar = (payload: {
  readonly crop?: RPCTypes.ImageCropRect
  readonly filename: string
  readonly sendChatNotification: boolean
  readonly teamname: string
}) => ({payload, type: uploadTeamAvatar as typeof uploadTeamAvatar})

// Action Payloads
export type AddParticipantPayload = ReturnType<typeof createAddParticipant>
export type ClearAddUserToTeamsResultsPayload = ReturnType<typeof createClearAddUserToTeamsResults>
export type CreateChannelPayload = ReturnType<typeof createCreateChannel>
export type DeleteChannelConfirmedPayload = ReturnType<typeof createDeleteChannelConfirmed>
export type DeleteMultiChannelsConfirmedPayload = ReturnType<typeof createDeleteMultiChannelsConfirmed>
export type DeleteTeamPayload = ReturnType<typeof createDeleteTeam>
export type IgnoreRequestPayload = ReturnType<typeof createIgnoreRequest>
export type InviteToTeamByPhonePayload = ReturnType<typeof createInviteToTeamByPhone>
export type LeaveTeamPayload = ReturnType<typeof createLeaveTeam>
export type LeftTeamPayload = ReturnType<typeof createLeftTeam>
export type LoadTeamTreePayload = ReturnType<typeof createLoadTeamTree>
export type ManageChatChannelsPayload = ReturnType<typeof createManageChatChannels>
export type ReAddToTeamPayload = ReturnType<typeof createReAddToTeam>
export type RemoveMemberPayload = ReturnType<typeof createRemoveMember>
export type RemoveParticipantPayload = ReturnType<typeof createRemoveParticipant>
export type RemovePendingInvitePayload = ReturnType<typeof createRemovePendingInvite>
export type RenameTeamPayload = ReturnType<typeof createRenameTeam>
export type SaveChannelMembershipPayload = ReturnType<typeof createSaveChannelMembership>
export type SetMemberActivityDetailsPayload = ReturnType<typeof createSetMemberActivityDetails>
export type SetPublicityPayload = ReturnType<typeof createSetPublicity>
export type SetTeamVersionPayload = ReturnType<typeof createSetTeamVersion>
export type SetUpdatedChannelNamePayload = ReturnType<typeof createSetUpdatedChannelName>
export type SetUpdatedTopicPayload = ReturnType<typeof createSetUpdatedTopic>
export type ShowTeamByNamePayload = ReturnType<typeof createShowTeamByName>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>
export type UpdateChannelNamePayload = ReturnType<typeof createUpdateChannelName>
export type UpdateTopicPayload = ReturnType<typeof createUpdateTopic>
export type UploadTeamAvatarPayload = ReturnType<typeof createUploadTeamAvatar>

// All Actions
// prettier-ignore
export type Actions =
  | AddParticipantPayload
  | ClearAddUserToTeamsResultsPayload
  | CreateChannelPayload
  | DeleteChannelConfirmedPayload
  | DeleteMultiChannelsConfirmedPayload
  | DeleteTeamPayload
  | IgnoreRequestPayload
  | InviteToTeamByPhonePayload
  | LeaveTeamPayload
  | LeftTeamPayload
  | LoadTeamTreePayload
  | ManageChatChannelsPayload
  | ReAddToTeamPayload
  | RemoveMemberPayload
  | RemoveParticipantPayload
  | RemovePendingInvitePayload
  | RenameTeamPayload
  | SaveChannelMembershipPayload
  | SetMemberActivityDetailsPayload
  | SetPublicityPayload
  | SetTeamVersionPayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | ShowTeamByNamePayload
  | TeamSeenPayload
  | UpdateChannelNamePayload
  | UpdateTopicPayload
  | UploadTeamAvatarPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
