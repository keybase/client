// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type {ConversationIDKey} from '../constants/types/chat2'
import type * as Types from '../constants/types/teams'
import type {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const addMembersWizardAddMembers = 'teams:addMembersWizardAddMembers'
export const addMembersWizardPushMembers = 'teams:addMembersWizardPushMembers'
export const addMembersWizardRemoveMember = 'teams:addMembersWizardRemoveMember'
export const addMembersWizardSetDefaultChannels = 'teams:addMembersWizardSetDefaultChannels'
export const addParticipant = 'teams:addParticipant'
export const cancelAddMembersWizard = 'teams:cancelAddMembersWizard'
export const checkRequestedAccess = 'teams:checkRequestedAccess'
export const clearAddUserToTeamsResults = 'teams:clearAddUserToTeamsResults'
export const clearNavBadges = 'teams:clearNavBadges'
export const createChannel = 'teams:createChannel'
export const createNewTeamFromConversation = 'teams:createNewTeamFromConversation'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteMultiChannelsConfirmed = 'teams:deleteMultiChannelsConfirmed'
export const deleteTeam = 'teams:deleteTeam'
export const finishNewTeamWizard = 'teams:finishNewTeamWizard'
export const finishedAddMembersWizard = 'teams:finishedAddMembersWizard'
export const finishedNewTeamWizard = 'teams:finishedNewTeamWizard'
export const getMembers = 'teams:getMembers'
export const getTeamProfileAddList = 'teams:getTeamProfileAddList'
export const getTeamRetentionPolicy = 'teams:getTeamRetentionPolicy'
export const ignoreRequest = 'teams:ignoreRequest'
export const inviteToTeamByPhone = 'teams:inviteToTeamByPhone'
export const joinTeam = 'teams:joinTeam'
export const launchNewTeamWizardOrModal = 'teams:launchNewTeamWizardOrModal'
export const leaveTeam = 'teams:leaveTeam'
export const leftTeam = 'teams:leftTeam'
export const loadTeam = 'teams:loadTeam'
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
export const setAddMembersWizardIndividualRole = 'teams:setAddMembersWizardIndividualRole'
export const setAddMembersWizardRole = 'teams:setAddMembersWizardRole'
export const setChannelSelected = 'teams:setChannelSelected'
export const setJustFinishedAddMembersWizard = 'teams:setJustFinishedAddMembersWizard'
export const setMemberActivityDetails = 'teams:setMemberActivityDetails'
export const setMembers = 'teams:setMembers'
export const setPublicity = 'teams:setPublicity'
export const setSubteamFilter = 'teams:setSubteamFilter'
export const setTeamAccessRequestsPending = 'teams:setTeamAccessRequestsPending'
export const setTeamInviteError = 'teams:setTeamInviteError'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamListFilterSort = 'teams:setTeamListFilterSort'
export const setTeamProfileAddList = 'teams:setTeamProfileAddList'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamRoleMap = 'teams:setTeamRoleMap'
export const setTeamRoleMapLatestKnownVersion = 'teams:setTeamRoleMapLatestKnownVersion'
export const setTeamVersion = 'teams:setTeamVersion'
export const setTeamWizardAvatar = 'teams:setTeamWizardAvatar'
export const setTeamWizardChannels = 'teams:setTeamWizardChannels'
export const setTeamWizardError = 'teams:setTeamWizardError'
export const setTeamWizardNameDescription = 'teams:setTeamWizardNameDescription'
export const setTeamWizardSubteamMembers = 'teams:setTeamWizardSubteamMembers'
export const setTeamWizardSubteams = 'teams:setTeamWizardSubteams'
export const setTeamWizardTeamSize = 'teams:setTeamWizardTeamSize'
export const setTeamWizardTeamType = 'teams:setTeamWizardTeamType'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const showTeamByName = 'teams:showTeamByName'
export const startAddMembersWizard = 'teams:startAddMembersWizard'
export const startNewTeamWizard = 'teams:startNewTeamWizard'
export const teamLoaded = 'teams:teamLoaded'
export const teamSeen = 'teams:teamSeen'
export const teamSetMemberSelected = 'teams:teamSetMemberSelected'
export const unsubscribeTeamDetails = 'teams:unsubscribeTeamDetails'
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
 * Change the set of default channels we're adding these users to.
 */
export const createAddMembersWizardSetDefaultChannels = (
  payload: {readonly toAdd?: Array<Types.ChannelNameID>; readonly toRemove?: Types.ChannelNameID} = {}
) => ({payload, type: addMembersWizardSetDefaultChannels as typeof addMembersWizardSetDefaultChannels})
/**
 * Clear new team wizard state and nav to team.
 */
export const createFinishedNewTeamWizard = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: finishedNewTeamWizard as typeof finishedNewTeamWizard,
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
 * Load team details if we are stale.
 *
 * `_subscribe` is for use by teams/subscriber only.
 */
export const createLoadTeam = (payload: {readonly _subscribe?: boolean; readonly teamID: Types.TeamID}) => ({
  payload,
  type: loadTeam as typeof loadTeam,
})
/**
 * Nav away from add members wizard and clear related state.
 */
export const createCancelAddMembersWizard = (payload?: undefined) => ({
  payload,
  type: cancelAddMembersWizard as typeof cancelAddMembersWizard,
})
/**
 * Nav away from add members wizard and clear related state.
 */
export const createFinishedAddMembersWizard = (payload?: undefined) => ({
  payload,
  type: finishedAddMembersWizard as typeof finishedAddMembersWizard,
})
/**
 * Remove a pending member from the add members wizard.
 */
export const createAddMembersWizardRemoveMember = (payload: {readonly assertion: string}) => ({
  payload,
  type: addMembersWizardRemoveMember as typeof addMembersWizardRemoveMember,
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
 * Set filtering and sort order for main team list. Leaves existing for undefinted params.
 */
export const createSetTeamListFilterSort = (
  payload: {readonly filter?: string; readonly sortOrder?: Types.TeamListSort} = {}
) => ({payload, type: setTeamListFilterSort as typeof setTeamListFilterSort})
/**
 * Set filtering for the subteams tab.
 */
export const createSetSubteamFilter = (payload: {
  readonly filter: string
  readonly parentTeam?: Types.TeamID
}) => ({payload, type: setSubteamFilter as typeof setSubteamFilter})
/**
 * Set the role for a pending member in the add member wizard.
 */
export const createSetAddMembersWizardIndividualRole = (payload: {
  readonly assertion: string
  readonly role: Types.AddingMemberTeamRoleType
}) => ({payload, type: setAddMembersWizardIndividualRole as typeof setAddMembersWizardIndividualRole})
/**
 * Set the role for the add members wizard.
 */
export const createSetAddMembersWizardRole = (payload: {
  readonly role: Types.AddingMemberTeamRoleType | 'setIndividually'
}) => ({payload, type: setAddMembersWizardRole as typeof setAddMembersWizardRole})
/**
 * Sets whether a channel is selected on the team page
 */
export const createSetChannelSelected = (payload: {
  readonly teamID: Types.TeamID
  readonly channel: string
  readonly selected: boolean
  readonly clearAll?: boolean
}) => ({payload, type: setChannelSelected as typeof setChannelSelected})
/**
 * Sets whether a member is selected on the team page
 */
export const createTeamSetMemberSelected = (payload: {
  readonly teamID: Types.TeamID
  readonly username: string
  readonly selected: boolean
  readonly clearAll?: boolean
}) => ({payload, type: teamSetMemberSelected as typeof teamSetMemberSelected})
/**
 * Setup store and navigate to start of add members wizard.
 */
export const createStartAddMembersWizard = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: startAddMembersWizard as typeof startAddMembersWizard,
})
/**
 * Should be called when user is trying to add new assertions to the wizard
 */
export const createAddMembersWizardPushMembers = (payload: {
  readonly members: Array<Types.AddingMember>
}) => ({payload, type: addMembersWizardPushMembers as typeof addMembersWizardPushMembers})
/**
 * Stop listening for team details for this team
 */
export const createUnsubscribeTeamDetails = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: unsubscribeTeamDetails as typeof unsubscribeTeamDetails,
})
/**
 * Takes a member list and appends it to wizard state, using assertionsInTeam as a filter. When filtering, it also maintains membersAlreadyInTeam list.
 */
export const createAddMembersWizardAddMembers = (payload: {
  readonly members: Array<Types.AddingMember>
  readonly assertionsInTeam: Array<string>
}) => ({payload, type: addMembersWizardAddMembers as typeof addMembersWizardAddMembers})
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
export const createCheckRequestedAccess = (payload: {readonly teamname: string}) => ({
  payload,
  type: checkRequestedAccess as typeof checkRequestedAccess,
})
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
export const createCreateNewTeamFromConversation = (payload: {
  readonly conversationIDKey: ConversationIDKey
  readonly teamname: string
}) => ({payload, type: createNewTeamFromConversation as typeof createNewTeamFromConversation})
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
export const createFinishNewTeamWizard = (payload?: undefined) => ({
  payload,
  type: finishNewTeamWizard as typeof finishNewTeamWizard,
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
export const createLaunchNewTeamWizardOrModal = (payload: {readonly subteamOf?: Types.TeamID} = {}) => ({
  payload,
  type: launchNewTeamWizardOrModal as typeof launchNewTeamWizardOrModal,
})
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
export const createSetJustFinishedAddMembersWizard = (payload: {readonly justFinished: boolean}) => ({
  payload,
  type: setJustFinishedAddMembersWizard as typeof setJustFinishedAddMembersWizard,
})
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
export const createSetTeamAccessRequestsPending = (payload: {
  readonly accessRequestsPending: Set<Types.Teamname>
}) => ({payload, type: setTeamAccessRequestsPending as typeof setTeamAccessRequestsPending})
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
export const createSetTeamRoleMap = (payload: {readonly map: Types.TeamRoleMap}) => ({
  payload,
  type: setTeamRoleMap as typeof setTeamRoleMap,
})
export const createSetTeamRoleMapLatestKnownVersion = (payload: {readonly version: number}) => ({
  payload,
  type: setTeamRoleMapLatestKnownVersion as typeof setTeamRoleMapLatestKnownVersion,
})
export const createSetTeamVersion = (payload: {
  readonly teamID: Types.TeamID
  readonly version: Types.TeamVersion
}) => ({payload, type: setTeamVersion as typeof setTeamVersion})
export const createSetTeamWizardAvatar = (
  payload: {readonly crop?: Types.AvatarCrop; readonly filename?: string} = {}
) => ({payload, type: setTeamWizardAvatar as typeof setTeamWizardAvatar})
export const createSetTeamWizardChannels = (payload: {readonly channels: Array<string>}) => ({
  payload,
  type: setTeamWizardChannels as typeof setTeamWizardChannels,
})
export const createSetTeamWizardError = (payload: {readonly error: string}) => ({
  payload,
  type: setTeamWizardError as typeof setTeamWizardError,
})
export const createSetTeamWizardNameDescription = (payload: {
  readonly teamname: string
  readonly description: string
  readonly openTeam: boolean
  readonly openTeamJoinRole: Types.TeamRoleType
  readonly profileShowcase: boolean
  readonly addYourself: boolean
}) => ({payload, type: setTeamWizardNameDescription as typeof setTeamWizardNameDescription})
export const createSetTeamWizardSubteamMembers = (payload: {readonly members: Array<string>}) => ({
  payload,
  type: setTeamWizardSubteamMembers as typeof setTeamWizardSubteamMembers,
})
export const createSetTeamWizardSubteams = (payload: {readonly subteams: Array<string>}) => ({
  payload,
  type: setTeamWizardSubteams as typeof setTeamWizardSubteams,
})
export const createSetTeamWizardTeamSize = (payload: {readonly isBig: boolean}) => ({
  payload,
  type: setTeamWizardTeamSize as typeof setTeamWizardTeamSize,
})
export const createSetTeamWizardTeamType = (payload: {readonly teamType: Types.TeamWizardTeamType}) => ({
  payload,
  type: setTeamWizardTeamType as typeof setTeamWizardTeamType,
})
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
export const createStartNewTeamWizard = (payload?: undefined) => ({
  payload,
  type: startNewTeamWizard as typeof startNewTeamWizard,
})
export const createTeamLoaded = (payload: {
  readonly teamID: Types.TeamID
  readonly team: RPCTypes.AnnotatedTeam
}) => ({payload, type: teamLoaded as typeof teamLoaded})
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
export type AddMembersWizardAddMembersPayload = ReturnType<typeof createAddMembersWizardAddMembers>
export type AddMembersWizardPushMembersPayload = ReturnType<typeof createAddMembersWizardPushMembers>
export type AddMembersWizardRemoveMemberPayload = ReturnType<typeof createAddMembersWizardRemoveMember>
export type AddMembersWizardSetDefaultChannelsPayload = ReturnType<
  typeof createAddMembersWizardSetDefaultChannels
>
export type AddParticipantPayload = ReturnType<typeof createAddParticipant>
export type CancelAddMembersWizardPayload = ReturnType<typeof createCancelAddMembersWizard>
export type CheckRequestedAccessPayload = ReturnType<typeof createCheckRequestedAccess>
export type ClearAddUserToTeamsResultsPayload = ReturnType<typeof createClearAddUserToTeamsResults>
export type ClearNavBadgesPayload = ReturnType<typeof createClearNavBadges>
export type CreateChannelPayload = ReturnType<typeof createCreateChannel>
export type CreateNewTeamFromConversationPayload = ReturnType<typeof createCreateNewTeamFromConversation>
export type DeleteChannelConfirmedPayload = ReturnType<typeof createDeleteChannelConfirmed>
export type DeleteMultiChannelsConfirmedPayload = ReturnType<typeof createDeleteMultiChannelsConfirmed>
export type DeleteTeamPayload = ReturnType<typeof createDeleteTeam>
export type FinishNewTeamWizardPayload = ReturnType<typeof createFinishNewTeamWizard>
export type FinishedAddMembersWizardPayload = ReturnType<typeof createFinishedAddMembersWizard>
export type FinishedNewTeamWizardPayload = ReturnType<typeof createFinishedNewTeamWizard>
export type GetMembersPayload = ReturnType<typeof createGetMembers>
export type GetTeamProfileAddListPayload = ReturnType<typeof createGetTeamProfileAddList>
export type GetTeamRetentionPolicyPayload = ReturnType<typeof createGetTeamRetentionPolicy>
export type IgnoreRequestPayload = ReturnType<typeof createIgnoreRequest>
export type InviteToTeamByPhonePayload = ReturnType<typeof createInviteToTeamByPhone>
export type JoinTeamPayload = ReturnType<typeof createJoinTeam>
export type LaunchNewTeamWizardOrModalPayload = ReturnType<typeof createLaunchNewTeamWizardOrModal>
export type LeaveTeamPayload = ReturnType<typeof createLeaveTeam>
export type LeftTeamPayload = ReturnType<typeof createLeftTeam>
export type LoadTeamPayload = ReturnType<typeof createLoadTeam>
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
export type SetAddMembersWizardIndividualRolePayload = ReturnType<
  typeof createSetAddMembersWizardIndividualRole
>
export type SetAddMembersWizardRolePayload = ReturnType<typeof createSetAddMembersWizardRole>
export type SetChannelSelectedPayload = ReturnType<typeof createSetChannelSelected>
export type SetJustFinishedAddMembersWizardPayload = ReturnType<typeof createSetJustFinishedAddMembersWizard>
export type SetMemberActivityDetailsPayload = ReturnType<typeof createSetMemberActivityDetails>
export type SetMembersPayload = ReturnType<typeof createSetMembers>
export type SetPublicityPayload = ReturnType<typeof createSetPublicity>
export type SetSubteamFilterPayload = ReturnType<typeof createSetSubteamFilter>
export type SetTeamAccessRequestsPendingPayload = ReturnType<typeof createSetTeamAccessRequestsPending>
export type SetTeamInviteErrorPayload = ReturnType<typeof createSetTeamInviteError>
export type SetTeamJoinErrorPayload = ReturnType<typeof createSetTeamJoinError>
export type SetTeamJoinSuccessPayload = ReturnType<typeof createSetTeamJoinSuccess>
export type SetTeamListFilterSortPayload = ReturnType<typeof createSetTeamListFilterSort>
export type SetTeamProfileAddListPayload = ReturnType<typeof createSetTeamProfileAddList>
export type SetTeamRetentionPolicyPayload = ReturnType<typeof createSetTeamRetentionPolicy>
export type SetTeamRoleMapLatestKnownVersionPayload = ReturnType<
  typeof createSetTeamRoleMapLatestKnownVersion
>
export type SetTeamRoleMapPayload = ReturnType<typeof createSetTeamRoleMap>
export type SetTeamVersionPayload = ReturnType<typeof createSetTeamVersion>
export type SetTeamWizardAvatarPayload = ReturnType<typeof createSetTeamWizardAvatar>
export type SetTeamWizardChannelsPayload = ReturnType<typeof createSetTeamWizardChannels>
export type SetTeamWizardErrorPayload = ReturnType<typeof createSetTeamWizardError>
export type SetTeamWizardNameDescriptionPayload = ReturnType<typeof createSetTeamWizardNameDescription>
export type SetTeamWizardSubteamMembersPayload = ReturnType<typeof createSetTeamWizardSubteamMembers>
export type SetTeamWizardSubteamsPayload = ReturnType<typeof createSetTeamWizardSubteams>
export type SetTeamWizardTeamSizePayload = ReturnType<typeof createSetTeamWizardTeamSize>
export type SetTeamWizardTeamTypePayload = ReturnType<typeof createSetTeamWizardTeamType>
export type SetUpdatedChannelNamePayload = ReturnType<typeof createSetUpdatedChannelName>
export type SetUpdatedTopicPayload = ReturnType<typeof createSetUpdatedTopic>
export type ShowTeamByNamePayload = ReturnType<typeof createShowTeamByName>
export type StartAddMembersWizardPayload = ReturnType<typeof createStartAddMembersWizard>
export type StartNewTeamWizardPayload = ReturnType<typeof createStartNewTeamWizard>
export type TeamLoadedPayload = ReturnType<typeof createTeamLoaded>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>
export type TeamSetMemberSelectedPayload = ReturnType<typeof createTeamSetMemberSelected>
export type UnsubscribeTeamDetailsPayload = ReturnType<typeof createUnsubscribeTeamDetails>
export type UpdateChannelNamePayload = ReturnType<typeof createUpdateChannelName>
export type UpdateInviteLinkDetailsPayload = ReturnType<typeof createUpdateInviteLinkDetails>
export type UpdateTopicPayload = ReturnType<typeof createUpdateTopic>
export type UploadTeamAvatarPayload = ReturnType<typeof createUploadTeamAvatar>

// All Actions
// prettier-ignore
export type Actions =
  | AddMembersWizardAddMembersPayload
  | AddMembersWizardPushMembersPayload
  | AddMembersWizardRemoveMemberPayload
  | AddMembersWizardSetDefaultChannelsPayload
  | AddParticipantPayload
  | CancelAddMembersWizardPayload
  | CheckRequestedAccessPayload
  | ClearAddUserToTeamsResultsPayload
  | ClearNavBadgesPayload
  | CreateChannelPayload
  | CreateNewTeamFromConversationPayload
  | DeleteChannelConfirmedPayload
  | DeleteMultiChannelsConfirmedPayload
  | DeleteTeamPayload
  | FinishNewTeamWizardPayload
  | FinishedAddMembersWizardPayload
  | FinishedNewTeamWizardPayload
  | GetMembersPayload
  | GetTeamProfileAddListPayload
  | GetTeamRetentionPolicyPayload
  | IgnoreRequestPayload
  | InviteToTeamByPhonePayload
  | JoinTeamPayload
  | LaunchNewTeamWizardOrModalPayload
  | LeaveTeamPayload
  | LeftTeamPayload
  | LoadTeamPayload
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
  | SetAddMembersWizardIndividualRolePayload
  | SetAddMembersWizardRolePayload
  | SetChannelSelectedPayload
  | SetJustFinishedAddMembersWizardPayload
  | SetMemberActivityDetailsPayload
  | SetMembersPayload
  | SetPublicityPayload
  | SetSubteamFilterPayload
  | SetTeamAccessRequestsPendingPayload
  | SetTeamInviteErrorPayload
  | SetTeamJoinErrorPayload
  | SetTeamJoinSuccessPayload
  | SetTeamListFilterSortPayload
  | SetTeamProfileAddListPayload
  | SetTeamRetentionPolicyPayload
  | SetTeamRoleMapLatestKnownVersionPayload
  | SetTeamRoleMapPayload
  | SetTeamVersionPayload
  | SetTeamWizardAvatarPayload
  | SetTeamWizardChannelsPayload
  | SetTeamWizardErrorPayload
  | SetTeamWizardNameDescriptionPayload
  | SetTeamWizardSubteamMembersPayload
  | SetTeamWizardSubteamsPayload
  | SetTeamWizardTeamSizePayload
  | SetTeamWizardTeamTypePayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | ShowTeamByNamePayload
  | StartAddMembersWizardPayload
  | StartNewTeamWizardPayload
  | TeamLoadedPayload
  | TeamSeenPayload
  | TeamSetMemberSelectedPayload
  | UnsubscribeTeamDetailsPayload
  | UpdateChannelNamePayload
  | UpdateInviteLinkDetailsPayload
  | UpdateTopicPayload
  | UploadTeamAvatarPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
