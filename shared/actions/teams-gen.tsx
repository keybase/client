// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type {ConversationIDKey} from '../constants/types/chat2'
import type * as Types from '../constants/types/teams'
import type {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const addParticipant = 'teams:addParticipant'
export const clearAddUserToTeamsResults = 'teams:clearAddUserToTeamsResults'
export const clearNavBadges = 'teams:clearNavBadges'
export const createChannel = 'teams:createChannel'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteMultiChannelsConfirmed = 'teams:deleteMultiChannelsConfirmed'
export const deleteTeam = 'teams:deleteTeam'
export const getMembers = 'teams:getMembers'
export const getTeamProfileAddList = 'teams:getTeamProfileAddList'
export const getTeamRetentionPolicy = 'teams:getTeamRetentionPolicy'
export const ignoreRequest = 'teams:ignoreRequest'
export const inviteToTeamByPhone = 'teams:inviteToTeamByPhone'
export const joinTeam = 'teams:joinTeam'
export const leaveTeam = 'teams:leaveTeam'
export const leftTeam = 'teams:leftTeam'
export const loadTeamTree = 'teams:loadTeamTree'
export const manageChatChannels = 'teams:manageChatChannels'
export const openInviteLink = 'teams:openInviteLink'
export const reAddToTeam = 'teams:reAddToTeam'
export const removeMember = 'teams:removeMember'
export const removeParticipant = 'teams:removeParticipant'
export const removePendingInvite = 'teams:removePendingInvite'
export const renameTeam = 'teams:renameTeam'
export const requestInviteLinkDetails = 'teams:requestInviteLinkDetails'
export const respondToInviteLink = 'teams:respondToInviteLink'
export const saveChannelMembership = 'teams:saveChannelMembership'
export const setMemberActivityDetails = 'teams:setMemberActivityDetails'
export const setMembers = 'teams:setMembers'
export const setPublicity = 'teams:setPublicity'
export const setTeamInviteError = 'teams:setTeamInviteError'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamProfileAddList = 'teams:setTeamProfileAddList'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamVersion = 'teams:setTeamVersion'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const showTeamByName = 'teams:showTeamByName'
export const teamSeen = 'teams:teamSeen'
export const updateChannelName = 'teams:updateChannelName'
export const updateInviteLinkDetails = 'teams:updateInviteLinkDetails'
export const updateTopic = 'teams:updateTopic'
export const uploadTeamAvatar = 'teams:uploadTeamAvatar'

// Action Creators
/**
 * Called by the modal if the key is missing
 */
export const createRequestInviteLinkDetails = (payload?: undefined) => ({
  payload,
  type: requestInviteLinkDetails as typeof requestInviteLinkDetails,
})
/**
 * Called either by the join team UI or invite links when the modal appears
 */
export const createJoinTeam = (payload: {readonly teamname: string; readonly deeplink?: boolean}) => ({
  payload,
  type: joinTeam as typeof joinTeam,
})
/**
 * Completes the invite link decision flow, processed by joinTeam
 */
export const createRespondToInviteLink = (payload: {readonly accept: boolean}) => ({
  payload,
  type: respondToInviteLink as typeof respondToInviteLink,
})
/**
 * First stage of the invite link process, opens the modal
 */
export const createOpenInviteLink = (payload: {readonly inviteID: string; readonly inviteKey: string}) => ({
  payload,
  type: openInviteLink as typeof openInviteLink,
})
/**
 * Gets the team retention policy and stores in `state.entities.teams.teamIDToRetentionPolicy`.
 */
export const createGetTeamRetentionPolicy = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: getTeamRetentionPolicy as typeof getTeamRetentionPolicy,
})
/**
 * Rename a subteam
 */
export const createRenameTeam = (payload: {readonly oldName: string; readonly newName: string}) => ({
  payload,
  type: renameTeam as typeof renameTeam,
})
/**
 * Saves the details from the API in the store, prompting the user to make a decision
 */
export const createUpdateInviteLinkDetails = (payload: {readonly details: RPCTypes.InviteLinkDetails}) => ({
  payload,
  type: updateInviteLinkDetails as typeof updateInviteLinkDetails,
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
export const createClearNavBadges = (payload?: undefined) => ({
  payload,
  type: clearNavBadges as typeof clearNavBadges,
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
export const createGetMembers = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: getMembers as typeof getMembers,
})
export const createGetTeamProfileAddList = (payload: {readonly username: string}) => ({
  payload,
  type: getTeamProfileAddList as typeof getTeamProfileAddList,
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
export const createSetMembers = (payload: {
  readonly teamID: Types.TeamID
  readonly members: Map<string, Types.MemberInfo>
}) => ({payload, type: setMembers as typeof setMembers})
export const createSetPublicity = (payload: {
  readonly teamID: Types.TeamID
  readonly settings: Types.PublicitySettings
}) => ({payload, type: setPublicity as typeof setPublicity})
export const createSetTeamInviteError = (payload: {readonly error: string}) => ({
  payload,
  type: setTeamInviteError as typeof setTeamInviteError,
})
export const createSetTeamJoinError = (payload: {readonly error: string}) => ({
  payload,
  type: setTeamJoinError as typeof setTeamJoinError,
})
export const createSetTeamJoinSuccess = (payload: {
  readonly open: boolean
  readonly success: boolean
  readonly teamname: string
}) => ({payload, type: setTeamJoinSuccess as typeof setTeamJoinSuccess})
export const createSetTeamProfileAddList = (payload: {
  readonly teamlist: Array<Types.TeamProfileAddList>
}) => ({payload, type: setTeamProfileAddList as typeof setTeamProfileAddList})
export const createSetTeamRetentionPolicy = (payload: {
  readonly teamID: Types.TeamID
  readonly retentionPolicy: RetentionPolicy
}) => ({payload, type: setTeamRetentionPolicy as typeof setTeamRetentionPolicy})
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
export type ClearNavBadgesPayload = ReturnType<typeof createClearNavBadges>
export type CreateChannelPayload = ReturnType<typeof createCreateChannel>
export type DeleteChannelConfirmedPayload = ReturnType<typeof createDeleteChannelConfirmed>
export type DeleteMultiChannelsConfirmedPayload = ReturnType<typeof createDeleteMultiChannelsConfirmed>
export type DeleteTeamPayload = ReturnType<typeof createDeleteTeam>
export type GetMembersPayload = ReturnType<typeof createGetMembers>
export type GetTeamProfileAddListPayload = ReturnType<typeof createGetTeamProfileAddList>
export type GetTeamRetentionPolicyPayload = ReturnType<typeof createGetTeamRetentionPolicy>
export type IgnoreRequestPayload = ReturnType<typeof createIgnoreRequest>
export type InviteToTeamByPhonePayload = ReturnType<typeof createInviteToTeamByPhone>
export type JoinTeamPayload = ReturnType<typeof createJoinTeam>
export type LeaveTeamPayload = ReturnType<typeof createLeaveTeam>
export type LeftTeamPayload = ReturnType<typeof createLeftTeam>
export type LoadTeamTreePayload = ReturnType<typeof createLoadTeamTree>
export type ManageChatChannelsPayload = ReturnType<typeof createManageChatChannels>
export type OpenInviteLinkPayload = ReturnType<typeof createOpenInviteLink>
export type ReAddToTeamPayload = ReturnType<typeof createReAddToTeam>
export type RemoveMemberPayload = ReturnType<typeof createRemoveMember>
export type RemoveParticipantPayload = ReturnType<typeof createRemoveParticipant>
export type RemovePendingInvitePayload = ReturnType<typeof createRemovePendingInvite>
export type RenameTeamPayload = ReturnType<typeof createRenameTeam>
export type RequestInviteLinkDetailsPayload = ReturnType<typeof createRequestInviteLinkDetails>
export type RespondToInviteLinkPayload = ReturnType<typeof createRespondToInviteLink>
export type SaveChannelMembershipPayload = ReturnType<typeof createSaveChannelMembership>
export type SetMemberActivityDetailsPayload = ReturnType<typeof createSetMemberActivityDetails>
export type SetMembersPayload = ReturnType<typeof createSetMembers>
export type SetPublicityPayload = ReturnType<typeof createSetPublicity>
export type SetTeamInviteErrorPayload = ReturnType<typeof createSetTeamInviteError>
export type SetTeamJoinErrorPayload = ReturnType<typeof createSetTeamJoinError>
export type SetTeamJoinSuccessPayload = ReturnType<typeof createSetTeamJoinSuccess>
export type SetTeamProfileAddListPayload = ReturnType<typeof createSetTeamProfileAddList>
export type SetTeamRetentionPolicyPayload = ReturnType<typeof createSetTeamRetentionPolicy>
export type SetTeamVersionPayload = ReturnType<typeof createSetTeamVersion>
export type SetUpdatedChannelNamePayload = ReturnType<typeof createSetUpdatedChannelName>
export type SetUpdatedTopicPayload = ReturnType<typeof createSetUpdatedTopic>
export type ShowTeamByNamePayload = ReturnType<typeof createShowTeamByName>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>
export type UpdateChannelNamePayload = ReturnType<typeof createUpdateChannelName>
export type UpdateInviteLinkDetailsPayload = ReturnType<typeof createUpdateInviteLinkDetails>
export type UpdateTopicPayload = ReturnType<typeof createUpdateTopic>
export type UploadTeamAvatarPayload = ReturnType<typeof createUploadTeamAvatar>

// All Actions
// prettier-ignore
export type Actions =
  | AddParticipantPayload
  | ClearAddUserToTeamsResultsPayload
  | ClearNavBadgesPayload
  | CreateChannelPayload
  | DeleteChannelConfirmedPayload
  | DeleteMultiChannelsConfirmedPayload
  | DeleteTeamPayload
  | GetMembersPayload
  | GetTeamProfileAddListPayload
  | GetTeamRetentionPolicyPayload
  | IgnoreRequestPayload
  | InviteToTeamByPhonePayload
  | JoinTeamPayload
  | LeaveTeamPayload
  | LeftTeamPayload
  | LoadTeamTreePayload
  | ManageChatChannelsPayload
  | OpenInviteLinkPayload
  | ReAddToTeamPayload
  | RemoveMemberPayload
  | RemoveParticipantPayload
  | RemovePendingInvitePayload
  | RenameTeamPayload
  | RequestInviteLinkDetailsPayload
  | RespondToInviteLinkPayload
  | SaveChannelMembershipPayload
  | SetMemberActivityDetailsPayload
  | SetMembersPayload
  | SetPublicityPayload
  | SetTeamInviteErrorPayload
  | SetTeamJoinErrorPayload
  | SetTeamJoinSuccessPayload
  | SetTeamProfileAddListPayload
  | SetTeamRetentionPolicyPayload
  | SetTeamVersionPayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | ShowTeamByNamePayload
  | TeamSeenPayload
  | UpdateChannelNamePayload
  | UpdateInviteLinkDetailsPayload
  | UpdateTopicPayload
  | UploadTeamAvatarPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
