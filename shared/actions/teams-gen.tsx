// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as ChatTypes from '../constants/types/chat2'
import * as Types from '../constants/types/teams'
import {RetentionPolicy} from '../constants/types/retention-policy'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const addMembersWizardPushMembers = 'teams:addMembersWizardPushMembers'
export const addMembersWizardRemoveMember = 'teams:addMembersWizardRemoveMember'
export const addMembersWizardSetDefaultChannels = 'teams:addMembersWizardSetDefaultChannels'
export const addParticipant = 'teams:addParticipant'
export const addTeamWithChosenChannels = 'teams:addTeamWithChosenChannels'
export const addToTeam = 'teams:addToTeam'
export const addUserToTeams = 'teams:addUserToTeams'
export const addedToTeam = 'teams:addedToTeam'
export const cancelAddMembersWizard = 'teams:cancelAddMembersWizard'
export const channelSetMemberSelected = 'teams:channelSetMemberSelected'
export const checkRequestedAccess = 'teams:checkRequestedAccess'
export const clearAddUserToTeamsResults = 'teams:clearAddUserToTeamsResults'
export const clearNavBadges = 'teams:clearNavBadges'
export const createChannel = 'teams:createChannel'
export const createChannels = 'teams:createChannels'
export const createNewTeam = 'teams:createNewTeam'
export const createNewTeamFromConversation = 'teams:createNewTeamFromConversation'
export const deleteChannelConfirmed = 'teams:deleteChannelConfirmed'
export const deleteMultiChannelsConfirmed = 'teams:deleteMultiChannelsConfirmed'
export const deleteTeam = 'teams:deleteTeam'
export const editMembership = 'teams:editMembership'
export const editTeamDescription = 'teams:editTeamDescription'
export const finishNewTeamWizard = 'teams:finishNewTeamWizard'
export const finishedAddMembersWizard = 'teams:finishedAddMembersWizard'
export const finishedNewTeamWizard = 'teams:finishedNewTeamWizard'
export const getActivityForTeams = 'teams:getActivityForTeams'
export const getMembers = 'teams:getMembers'
export const getTeamProfileAddList = 'teams:getTeamProfileAddList'
export const getTeamRetentionPolicy = 'teams:getTeamRetentionPolicy'
export const getTeams = 'teams:getTeams'
export const ignoreRequest = 'teams:ignoreRequest'
export const inviteToTeamByEmail = 'teams:inviteToTeamByEmail'
export const inviteToTeamByPhone = 'teams:inviteToTeamByPhone'
export const joinTeam = 'teams:joinTeam'
export const launchNewTeamWizardOrModal = 'teams:launchNewTeamWizardOrModal'
export const leaveTeam = 'teams:leaveTeam'
export const leftTeam = 'teams:leftTeam'
export const loadTeam = 'teams:loadTeam'
export const loadTeamChannelList = 'teams:loadTeamChannelList'
export const loadTeamTree = 'teams:loadTeamTree'
export const loadWelcomeMessage = 'teams:loadWelcomeMessage'
export const loadedWelcomeMessage = 'teams:loadedWelcomeMessage'
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
export const saveTeamRetentionPolicy = 'teams:saveTeamRetentionPolicy'
export const setActivityLevels = 'teams:setActivityLevels'
export const setAddMembersWizardIndividualRole = 'teams:setAddMembersWizardIndividualRole'
export const setAddMembersWizardRole = 'teams:setAddMembersWizardRole'
export const setAddUserToTeamsResults = 'teams:setAddUserToTeamsResults'
export const setChannelCreationError = 'teams:setChannelCreationError'
export const setChannelSelected = 'teams:setChannelSelected'
export const setCreatingChannels = 'teams:setCreatingChannels'
export const setEditDescriptionError = 'teams:setEditDescriptionError'
export const setEditMemberError = 'teams:setEditMemberError'
export const setEmailInviteError = 'teams:setEmailInviteError'
export const setJustFinishedAddMembersWizard = 'teams:setJustFinishedAddMembersWizard'
export const setMemberActivityDetails = 'teams:setMemberActivityDetails'
export const setMemberPublicity = 'teams:setMemberPublicity'
export const setMembers = 'teams:setMembers'
export const setNewTeamInfo = 'teams:setNewTeamInfo'
export const setNewTeamRequests = 'teams:setNewTeamRequests'
export const setPublicity = 'teams:setPublicity'
export const setSubteamFilter = 'teams:setSubteamFilter'
export const setTeamAccessRequestsPending = 'teams:setTeamAccessRequestsPending'
export const setTeamCreationError = 'teams:setTeamCreationError'
export const setTeamInfo = 'teams:setTeamInfo'
export const setTeamInviteError = 'teams:setTeamInviteError'
export const setTeamJoinError = 'teams:setTeamJoinError'
export const setTeamJoinSuccess = 'teams:setTeamJoinSuccess'
export const setTeamListFilterSort = 'teams:setTeamListFilterSort'
export const setTeamLoadingInvites = 'teams:setTeamLoadingInvites'
export const setTeamProfileAddList = 'teams:setTeamProfileAddList'
export const setTeamRetentionPolicy = 'teams:setTeamRetentionPolicy'
export const setTeamRoleMap = 'teams:setTeamRoleMap'
export const setTeamRoleMapLatestKnownVersion = 'teams:setTeamRoleMapLatestKnownVersion'
export const setTeamSawChatBanner = 'teams:setTeamSawChatBanner'
export const setTeamSawSubteamsBanner = 'teams:setTeamSawSubteamsBanner'
export const setTeamVersion = 'teams:setTeamVersion'
export const setTeamWizardAvatar = 'teams:setTeamWizardAvatar'
export const setTeamWizardChannels = 'teams:setTeamWizardChannels'
export const setTeamWizardError = 'teams:setTeamWizardError'
export const setTeamWizardNameDescription = 'teams:setTeamWizardNameDescription'
export const setTeamWizardSubteamMembers = 'teams:setTeamWizardSubteamMembers'
export const setTeamWizardSubteams = 'teams:setTeamWizardSubteams'
export const setTeamWizardTeamSize = 'teams:setTeamWizardTeamSize'
export const setTeamWizardTeamType = 'teams:setTeamWizardTeamType'
export const setTeamsWithChosenChannels = 'teams:setTeamsWithChosenChannels'
export const setUpdatedChannelName = 'teams:setUpdatedChannelName'
export const setUpdatedTopic = 'teams:setUpdatedTopic'
export const setWelcomeMessage = 'teams:setWelcomeMessage'
export const setWelcomeMessageError = 'teams:setWelcomeMessageError'
export const settingsError = 'teams:settingsError'
export const showTeamByName = 'teams:showTeamByName'
export const startAddMembersWizard = 'teams:startAddMembersWizard'
export const startNewTeamWizard = 'teams:startNewTeamWizard'
export const teamChannelListLoaded = 'teams:teamChannelListLoaded'
export const teamCreated = 'teams:teamCreated'
export const teamLoaded = 'teams:teamLoaded'
export const teamSeen = 'teams:teamSeen'
export const teamSetMemberSelected = 'teams:teamSetMemberSelected'
export const toggleInvitesCollapsed = 'teams:toggleInvitesCollapsed'
export const unsubscribeTeamDetails = 'teams:unsubscribeTeamDetails'
export const unsubscribeTeamList = 'teams:unsubscribeTeamList'
export const updateChannelName = 'teams:updateChannelName'
export const updateInviteLinkDetails = 'teams:updateInviteLinkDetails'
export const updateTopic = 'teams:updateTopic'
export const uploadTeamAvatar = 'teams:uploadTeamAvatar'

// Payload Types
type _AddMembersWizardPushMembersPayload = {readonly members: Array<Types.AddingMember>}
type _AddMembersWizardRemoveMemberPayload = {readonly assertion: string}
type _AddMembersWizardSetDefaultChannelsPayload = {
  readonly toAdd?: Array<Types.ChannelNameID>
  readonly toRemove?: Types.ChannelNameID
}
type _AddParticipantPayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _AddTeamWithChosenChannelsPayload = {readonly teamID: Types.TeamID}
type _AddToTeamPayload = {
  readonly teamID: Types.TeamID
  readonly users: Array<{assertion: string; role: Types.TeamRoleType}>
  readonly sendChatNotification: boolean
  readonly fromTeamBuilder?: boolean
}
type _AddUserToTeamsPayload = {
  readonly role: Types.TeamRoleType
  readonly teams: Array<string>
  readonly user: string
}
type _AddedToTeamPayload = {readonly error?: string; readonly fromTeamBuilder?: boolean}
type _CancelAddMembersWizardPayload = void
type _ChannelSetMemberSelectedPayload = {
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly username: string
  readonly selected: boolean
  readonly clearAll?: boolean
}
type _CheckRequestedAccessPayload = {readonly teamname: string}
type _ClearAddUserToTeamsResultsPayload = void
type _ClearNavBadgesPayload = void
type _CreateChannelPayload = {
  readonly teamID: Types.TeamID
  readonly channelname: string
  readonly description: string | null
  readonly navToChatOnSuccess: boolean
}
type _CreateChannelsPayload = {readonly teamID: Types.TeamID; readonly channelnames: Array<string>}
type _CreateNewTeamFromConversationPayload = {
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly teamname: string
}
type _CreateNewTeamPayload = {
  readonly fromChat?: boolean
  readonly joinSubteam: boolean
  readonly teamname: string
  readonly thenAddMembers?: Omit<_AddToTeamPayload, 'teamID'>
}
type _DeleteChannelConfirmedPayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _DeleteMultiChannelsConfirmedPayload = {
  readonly teamID: Types.TeamID
  readonly channels: Array<ChatTypes.ConversationIDKey>
}
type _DeleteTeamPayload = {readonly teamID: Types.TeamID}
type _EditMembershipPayload = {
  readonly teamID: Types.TeamID
  readonly usernames: Array<string>
  readonly role: Types.TeamRoleType
}
type _EditTeamDescriptionPayload = {readonly teamID: Types.TeamID; readonly description: string}
type _FinishNewTeamWizardPayload = void
type _FinishedAddMembersWizardPayload = void
type _FinishedNewTeamWizardPayload = {readonly teamID: Types.TeamID}
type _GetActivityForTeamsPayload = void
type _GetMembersPayload = {readonly teamID: Types.TeamID}
type _GetTeamProfileAddListPayload = {readonly username: string}
type _GetTeamRetentionPolicyPayload = {readonly teamID: Types.TeamID}
type _GetTeamsPayload = {readonly _subscribe?: boolean; readonly forceReload?: boolean}
type _IgnoreRequestPayload = {
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly username: string
}
type _InviteToTeamByEmailPayload = {
  readonly invitees: string
  readonly role: Types.TeamRoleType
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly loadingKey?: string
}
type _InviteToTeamByPhonePayload = {
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly role: Types.TeamRoleType
  readonly phoneNumber: string
  readonly fullName: string
  readonly loadingKey?: string
}
type _JoinTeamPayload = {readonly teamname: string; readonly deeplink?: boolean}
type _LaunchNewTeamWizardOrModalPayload = {readonly subteamOf?: Types.TeamID}
type _LeaveTeamPayload = {
  readonly teamname: string
  readonly permanent: boolean
  readonly context: 'teams' | 'chat'
}
type _LeftTeamPayload = {readonly teamname: string; readonly context: 'teams' | 'chat'}
type _LoadTeamChannelListPayload = {readonly teamID: Types.TeamID}
type _LoadTeamPayload = {readonly _subscribe?: boolean; readonly teamID: Types.TeamID}
type _LoadTeamTreePayload = {readonly teamID: Types.TeamID; readonly username: string}
type _LoadWelcomeMessagePayload = {readonly teamID: Types.TeamID}
type _LoadedWelcomeMessagePayload = {
  readonly teamID: Types.TeamID
  readonly message: RPCChatTypes.WelcomeMessageDisplay
}
type _ManageChatChannelsPayload = {readonly teamID: Types.TeamID}
type _OpenInviteLinkPayload = {readonly inviteID: string; readonly inviteKey: string}
type _ReAddToTeamPayload = {readonly teamID: Types.TeamID; readonly username: string}
type _RemoveMemberPayload = {readonly teamID: Types.TeamID; readonly username: string}
type _RemoveParticipantPayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}
type _RemovePendingInvitePayload = {readonly teamID: Types.TeamID; readonly inviteID: string}
type _RenameTeamPayload = {readonly oldName: string; readonly newName: string}
type _RequestInviteLinkDetailsPayload = void
type _RespondToInviteLinkPayload = {readonly accept: boolean}
type _SaveChannelMembershipPayload = {
  readonly teamID: Types.TeamID
  readonly oldChannelState: Types.ChannelMembershipState
  readonly newChannelState: Types.ChannelMembershipState
}
type _SaveTeamRetentionPolicyPayload = {readonly teamID: Types.TeamID; readonly policy: RetentionPolicy}
type _SetActivityLevelsPayload = {readonly levels: Types.ActivityLevels}
type _SetAddMembersWizardIndividualRolePayload = {
  readonly assertion: string
  readonly role: Types.AddingMemberTeamRoleType
}
type _SetAddMembersWizardRolePayload = {readonly role: Types.AddingMemberTeamRoleType | 'setIndividually'}
type _SetAddUserToTeamsResultsPayload = {readonly error: boolean; readonly results: string}
type _SetChannelCreationErrorPayload = {readonly error: string}
type _SetChannelSelectedPayload = {
  readonly teamID: Types.TeamID
  readonly channel: string
  readonly selected: boolean
  readonly clearAll?: boolean
}
type _SetCreatingChannelsPayload = {readonly creatingChannels: boolean}
type _SetEditDescriptionErrorPayload = {readonly error: string}
type _SetEditMemberErrorPayload = {
  readonly error: string
  readonly teamID: Types.TeamID
  readonly username: string
}
type _SetEmailInviteErrorPayload = {readonly message: string; readonly malformed: Array<string>}
type _SetJustFinishedAddMembersWizardPayload = {readonly justFinished: boolean}
type _SetMemberActivityDetailsPayload = {
  readonly activityMap: Map<Types.TeamID, number>
  readonly username: string
}
type _SetMemberPublicityPayload = {readonly teamID: Types.TeamID; readonly showcase: boolean}
type _SetMembersPayload = {readonly teamID: Types.TeamID; readonly members: Map<string, Types.MemberInfo>}
type _SetNewTeamInfoPayload = {
  readonly deletedTeams: Array<RPCTypes.DeletedTeamInfo>
  readonly newTeams: Set<Types.TeamID>
  readonly teamIDToResetUsers: Map<Types.TeamID, Set<string>>
}
type _SetNewTeamRequestsPayload = {readonly newTeamRequests: Map<Types.TeamID, Set<string>>}
type _SetPublicityPayload = {readonly teamID: Types.TeamID; readonly settings: Types.PublicitySettings}
type _SetSubteamFilterPayload = {readonly filter: string; readonly parentTeam?: Types.TeamID}
type _SetTeamAccessRequestsPendingPayload = {readonly accessRequestsPending: Set<Types.Teamname>}
type _SetTeamCreationErrorPayload = {readonly error: string}
type _SetTeamInfoPayload = {
  readonly teamnames: Set<Types.Teamname>
  readonly teamNameToID: Map<Types.Teamname, string>
  readonly teamMeta: Map<Types.TeamID, Types.TeamMeta>
}
type _SetTeamInviteErrorPayload = {readonly error: string}
type _SetTeamJoinErrorPayload = {readonly error: string}
type _SetTeamJoinSuccessPayload = {
  readonly open: boolean
  readonly success: boolean
  readonly teamname: string
}
type _SetTeamListFilterSortPayload = {readonly filter?: string; readonly sortOrder?: Types.TeamListSort}
type _SetTeamLoadingInvitesPayload = {
  readonly teamname: string
  readonly loadingKey: string
  readonly isLoading: boolean
}
type _SetTeamProfileAddListPayload = {readonly teamlist: Array<Types.TeamProfileAddList>}
type _SetTeamRetentionPolicyPayload = {
  readonly teamID: Types.TeamID
  readonly retentionPolicy: RetentionPolicy
}
type _SetTeamRoleMapLatestKnownVersionPayload = {readonly version: number}
type _SetTeamRoleMapPayload = {readonly map: Types.TeamRoleMap}
type _SetTeamSawChatBannerPayload = void
type _SetTeamSawSubteamsBannerPayload = void
type _SetTeamVersionPayload = {readonly teamID: Types.TeamID; readonly version: Types.TeamVersion}
type _SetTeamWizardAvatarPayload = {readonly crop?: Types.AvatarCrop; readonly filename?: string}
type _SetTeamWizardChannelsPayload = {readonly channels: Array<string>}
type _SetTeamWizardErrorPayload = {readonly error: string}
type _SetTeamWizardNameDescriptionPayload = {
  readonly teamname: string
  readonly description: string
  readonly openTeam: boolean
  readonly openTeamJoinRole: Types.TeamRoleType
  readonly showcase: boolean
  readonly addYourself: boolean
}
type _SetTeamWizardSubteamMembersPayload = {readonly members: Array<string>}
type _SetTeamWizardSubteamsPayload = {readonly subteams: Array<string>}
type _SetTeamWizardTeamSizePayload = {readonly isBig: boolean}
type _SetTeamWizardTeamTypePayload = {readonly teamType: Types.TeamWizardTeamType}
type _SetTeamsWithChosenChannelsPayload = {readonly teamsWithChosenChannels: Set<Types.TeamID>}
type _SetUpdatedChannelNamePayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newChannelName: string
}
type _SetUpdatedTopicPayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newTopic: string
}
type _SetWelcomeMessageErrorPayload = {readonly error: string}
type _SetWelcomeMessagePayload = {
  readonly teamID: Types.TeamID
  readonly message: RPCChatTypes.WelcomeMessage
}
type _SettingsErrorPayload = {readonly error: string}
type _ShowTeamByNamePayload = {
  readonly teamname: string
  readonly initialTab?: Types.TabKey
  readonly join?: boolean
  readonly addMembers?: boolean
}
type _StartAddMembersWizardPayload = {readonly teamID: Types.TeamID}
type _StartNewTeamWizardPayload = void
type _TeamChannelListLoadedPayload = {
  readonly teamID: Types.TeamID
  readonly channels: Map<ChatTypes.ConversationIDKey, Types.TeamChannelInfo>
}
type _TeamCreatedPayload = {
  readonly fromChat: boolean
  readonly teamID: Types.TeamID
  readonly teamname: string
}
type _TeamLoadedPayload = {readonly teamID: Types.TeamID; readonly team: RPCTypes.AnnotatedTeam}
type _TeamSeenPayload = {readonly teamID: Types.TeamID}
type _TeamSetMemberSelectedPayload = {
  readonly teamID: Types.TeamID
  readonly username: string
  readonly selected: boolean
  readonly clearAll?: boolean
}
type _ToggleInvitesCollapsedPayload = {readonly teamID: Types.TeamID}
type _UnsubscribeTeamDetailsPayload = {readonly teamID: Types.TeamID}
type _UnsubscribeTeamListPayload = void
type _UpdateChannelNamePayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newChannelName: string
}
type _UpdateInviteLinkDetailsPayload = {readonly details: RPCTypes.InviteLinkDetails}
type _UpdateTopicPayload = {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newTopic: string
}
type _UploadTeamAvatarPayload = {
  readonly crop?: RPCTypes.ImageCropRect
  readonly filename: string
  readonly sendChatNotification: boolean
  readonly teamname: string
}

// Action Creators
/**
 * Add pending members to the add members wizard and show the confirm screen.
 */
export const createAddMembersWizardPushMembers = (
  payload: _AddMembersWizardPushMembersPayload
): AddMembersWizardPushMembersPayload => ({payload, type: addMembersWizardPushMembers})
/**
 * Called by the modal if the key is missing
 */
export const createRequestInviteLinkDetails = (
  payload: _RequestInviteLinkDetailsPayload
): RequestInviteLinkDetailsPayload => ({payload, type: requestInviteLinkDetails})
/**
 * Called either by the join team UI or invite links when the modal appears
 */
export const createJoinTeam = (payload: _JoinTeamPayload): JoinTeamPayload => ({payload, type: joinTeam})
/**
 * Change the set of default channels we're adding these users to.
 */
export const createAddMembersWizardSetDefaultChannels = (
  payload: _AddMembersWizardSetDefaultChannelsPayload = Object.freeze({})
): AddMembersWizardSetDefaultChannelsPayload => ({payload, type: addMembersWizardSetDefaultChannels})
/**
 * Clear new team wizard state and nav to team.
 */
export const createFinishedNewTeamWizard = (
  payload: _FinishedNewTeamWizardPayload
): FinishedNewTeamWizardPayload => ({payload, type: finishedNewTeamWizard})
/**
 * Completes the invite link decision flow, processed by joinTeam
 */
export const createRespondToInviteLink = (
  payload: _RespondToInviteLinkPayload
): RespondToInviteLinkPayload => ({payload, type: respondToInviteLink})
/**
 * Don't eagerly reload team list anymore.
 */
export const createUnsubscribeTeamList = (
  payload: _UnsubscribeTeamListPayload
): UnsubscribeTeamListPayload => ({payload, type: unsubscribeTeamList})
/**
 * Edit the role of one or more members in a team
 */
export const createEditMembership = (payload: _EditMembershipPayload): EditMembershipPayload => ({
  payload,
  type: editMembership,
})
/**
 * Fetch activity levels.
 */
export const createGetActivityForTeams = (
  payload: _GetActivityForTeamsPayload
): GetActivityForTeamsPayload => ({payload, type: getActivityForTeams})
/**
 * First stage of the invite link process, opens the modal
 */
export const createOpenInviteLink = (payload: _OpenInviteLinkPayload): OpenInviteLinkPayload => ({
  payload,
  type: openInviteLink,
})
/**
 * Gets the team retention policy and stores in `state.entities.teams.teamIDToRetentionPolicy`.
 */
export const createGetTeamRetentionPolicy = (
  payload: _GetTeamRetentionPolicyPayload
): GetTeamRetentionPolicyPayload => ({payload, type: getTeamRetentionPolicy})
/**
 * Load info for rendering the channel list on the team page.
 */
export const createLoadTeamChannelList = (
  payload: _LoadTeamChannelListPayload
): LoadTeamChannelListPayload => ({payload, type: loadTeamChannelList})
/**
 * Load team details if we are stale.
 *
 * `_subscribe` is for use by teams/subscriber only.
 */
export const createLoadTeam = (payload: _LoadTeamPayload): LoadTeamPayload => ({payload, type: loadTeam})
/**
 * Load team list if we are stale.
 *
 * `_subscribe` is for use by teams/subscriber only.
 */
export const createGetTeams = (payload: _GetTeamsPayload = Object.freeze({})): GetTeamsPayload => ({
  payload,
  type: getTeams,
})
/**
 * Load welcome message for new team members
 */
export const createLoadWelcomeMessage = (payload: _LoadWelcomeMessagePayload): LoadWelcomeMessagePayload => ({
  payload,
  type: loadWelcomeMessage,
})
/**
 * Loaded channel list for team.
 */
export const createTeamChannelListLoaded = (
  payload: _TeamChannelListLoadedPayload
): TeamChannelListLoadedPayload => ({payload, type: teamChannelListLoaded})
/**
 * Loaded welcome message for new team members
 */
export const createLoadedWelcomeMessage = (
  payload: _LoadedWelcomeMessagePayload
): LoadedWelcomeMessagePayload => ({payload, type: loadedWelcomeMessage})
/**
 * Nav away from add members wizard and clear related state.
 */
export const createCancelAddMembersWizard = (
  payload: _CancelAddMembersWizardPayload
): CancelAddMembersWizardPayload => ({payload, type: cancelAddMembersWizard})
/**
 * Nav away from add members wizard and clear related state.
 */
export const createFinishedAddMembersWizard = (
  payload: _FinishedAddMembersWizardPayload
): FinishedAddMembersWizardPayload => ({payload, type: finishedAddMembersWizard})
/**
 * Remove a pending member from the add members wizard.
 */
export const createAddMembersWizardRemoveMember = (
  payload: _AddMembersWizardRemoveMemberPayload
): AddMembersWizardRemoveMemberPayload => ({payload, type: addMembersWizardRemoveMember})
/**
 * Rename a subteam
 */
export const createRenameTeam = (payload: _RenameTeamPayload): RenameTeamPayload => ({
  payload,
  type: renameTeam,
})
/**
 * Saves the details from the API in the store, prompting the user to make a decision
 */
export const createUpdateInviteLinkDetails = (
  payload: _UpdateInviteLinkDetailsPayload
): UpdateInviteLinkDetailsPayload => ({payload, type: updateInviteLinkDetails})
/**
 * Set filtering and sort order for main team list. Leaves existing for undefinted params.
 */
export const createSetTeamListFilterSort = (
  payload: _SetTeamListFilterSortPayload = Object.freeze({})
): SetTeamListFilterSortPayload => ({payload, type: setTeamListFilterSort})
/**
 * Set filtering for the subteams tab.
 */
export const createSetSubteamFilter = (payload: _SetSubteamFilterPayload): SetSubteamFilterPayload => ({
  payload,
  type: setSubteamFilter,
})
/**
 * Set map of activity levels for all teams and channels.
 */
export const createSetActivityLevels = (payload: _SetActivityLevelsPayload): SetActivityLevelsPayload => ({
  payload,
  type: setActivityLevels,
})
/**
 * Set the role for a pending member in the add member wizard.
 */
export const createSetAddMembersWizardIndividualRole = (
  payload: _SetAddMembersWizardIndividualRolePayload
): SetAddMembersWizardIndividualRolePayload => ({payload, type: setAddMembersWizardIndividualRole})
/**
 * Set the role for the add members wizard.
 */
export const createSetAddMembersWizardRole = (
  payload: _SetAddMembersWizardRolePayload
): SetAddMembersWizardRolePayload => ({payload, type: setAddMembersWizardRole})
/**
 * Set welcome message for new team members
 */
export const createSetWelcomeMessage = (payload: _SetWelcomeMessagePayload): SetWelcomeMessagePayload => ({
  payload,
  type: setWelcomeMessage,
})
/**
 * Set which requests we haven't seen yet for a team.
 */
export const createSetNewTeamRequests = (payload: _SetNewTeamRequestsPayload): SetNewTeamRequestsPayload => ({
  payload,
  type: setNewTeamRequests,
})
/**
 * Sets the retention policy for a team. The store will be updated automatically.
 */
export const createSaveTeamRetentionPolicy = (
  payload: _SaveTeamRetentionPolicyPayload
): SaveTeamRetentionPolicyPayload => ({payload, type: saveTeamRetentionPolicy})
/**
 * Sets whether a channel is selected on the team page
 */
export const createSetChannelSelected = (payload: _SetChannelSelectedPayload): SetChannelSelectedPayload => ({
  payload,
  type: setChannelSelected,
})
/**
 * Sets whether a member is selected on the team page
 */
export const createChannelSetMemberSelected = (
  payload: _ChannelSetMemberSelectedPayload
): ChannelSetMemberSelectedPayload => ({payload, type: channelSetMemberSelected})
/**
 * Sets whether a member is selected on the team page
 */
export const createTeamSetMemberSelected = (
  payload: _TeamSetMemberSelectedPayload
): TeamSetMemberSelectedPayload => ({payload, type: teamSetMemberSelected})
/**
 * Setup store and navigate to start of add members wizard.
 */
export const createStartAddMembersWizard = (
  payload: _StartAddMembersWizardPayload
): StartAddMembersWizardPayload => ({payload, type: startAddMembersWizard})
/**
 * Stop listening for team details for this team
 */
export const createUnsubscribeTeamDetails = (
  payload: _UnsubscribeTeamDetailsPayload
): UnsubscribeTeamDetailsPayload => ({payload, type: unsubscribeTeamDetails})
/**
 * Toggle whether invites are collapsed in the member list for this team
 */
export const createToggleInvitesCollapsed = (
  payload: _ToggleInvitesCollapsedPayload
): ToggleInvitesCollapsedPayload => ({payload, type: toggleInvitesCollapsed})
/**
 * Tries to show a team with this name whether the user is in the team or not.
 * For teams we are not in:
 * - with teamsRedesign on go to external team page
 * - with teamsRedesign off noop
 */
export const createShowTeamByName = (payload: _ShowTeamByNamePayload): ShowTeamByNamePayload => ({
  payload,
  type: showTeamByName,
})
/**
 * User has viewed this team. Clear related badges.
 */
export const createTeamSeen = (payload: _TeamSeenPayload): TeamSeenPayload => ({payload, type: teamSeen})
/**
 * We successfully left a team
 */
export const createLeftTeam = (payload: _LeftTeamPayload): LeftTeamPayload => ({payload, type: leftTeam})
export const createAddParticipant = (payload: _AddParticipantPayload): AddParticipantPayload => ({
  payload,
  type: addParticipant,
})
export const createAddTeamWithChosenChannels = (
  payload: _AddTeamWithChosenChannelsPayload
): AddTeamWithChosenChannelsPayload => ({payload, type: addTeamWithChosenChannels})
export const createAddToTeam = (payload: _AddToTeamPayload): AddToTeamPayload => ({payload, type: addToTeam})
export const createAddUserToTeams = (payload: _AddUserToTeamsPayload): AddUserToTeamsPayload => ({
  payload,
  type: addUserToTeams,
})
export const createAddedToTeam = (payload: _AddedToTeamPayload = Object.freeze({})): AddedToTeamPayload => ({
  payload,
  type: addedToTeam,
})
export const createCheckRequestedAccess = (
  payload: _CheckRequestedAccessPayload
): CheckRequestedAccessPayload => ({payload, type: checkRequestedAccess})
export const createClearAddUserToTeamsResults = (
  payload: _ClearAddUserToTeamsResultsPayload
): ClearAddUserToTeamsResultsPayload => ({payload, type: clearAddUserToTeamsResults})
export const createClearNavBadges = (payload: _ClearNavBadgesPayload): ClearNavBadgesPayload => ({
  payload,
  type: clearNavBadges,
})
export const createCreateChannel = (payload: _CreateChannelPayload): CreateChannelPayload => ({
  payload,
  type: createChannel,
})
export const createCreateChannels = (payload: _CreateChannelsPayload): CreateChannelsPayload => ({
  payload,
  type: createChannels,
})
export const createCreateNewTeam = (payload: _CreateNewTeamPayload): CreateNewTeamPayload => ({
  payload,
  type: createNewTeam,
})
export const createCreateNewTeamFromConversation = (
  payload: _CreateNewTeamFromConversationPayload
): CreateNewTeamFromConversationPayload => ({payload, type: createNewTeamFromConversation})
export const createDeleteChannelConfirmed = (
  payload: _DeleteChannelConfirmedPayload
): DeleteChannelConfirmedPayload => ({payload, type: deleteChannelConfirmed})
export const createDeleteMultiChannelsConfirmed = (
  payload: _DeleteMultiChannelsConfirmedPayload
): DeleteMultiChannelsConfirmedPayload => ({payload, type: deleteMultiChannelsConfirmed})
export const createDeleteTeam = (payload: _DeleteTeamPayload): DeleteTeamPayload => ({
  payload,
  type: deleteTeam,
})
export const createEditTeamDescription = (
  payload: _EditTeamDescriptionPayload
): EditTeamDescriptionPayload => ({payload, type: editTeamDescription})
export const createFinishNewTeamWizard = (
  payload: _FinishNewTeamWizardPayload
): FinishNewTeamWizardPayload => ({payload, type: finishNewTeamWizard})
export const createGetMembers = (payload: _GetMembersPayload): GetMembersPayload => ({
  payload,
  type: getMembers,
})
export const createGetTeamProfileAddList = (
  payload: _GetTeamProfileAddListPayload
): GetTeamProfileAddListPayload => ({payload, type: getTeamProfileAddList})
export const createIgnoreRequest = (payload: _IgnoreRequestPayload): IgnoreRequestPayload => ({
  payload,
  type: ignoreRequest,
})
export const createInviteToTeamByEmail = (
  payload: _InviteToTeamByEmailPayload
): InviteToTeamByEmailPayload => ({payload, type: inviteToTeamByEmail})
export const createInviteToTeamByPhone = (
  payload: _InviteToTeamByPhonePayload
): InviteToTeamByPhonePayload => ({payload, type: inviteToTeamByPhone})
export const createLaunchNewTeamWizardOrModal = (
  payload: _LaunchNewTeamWizardOrModalPayload = Object.freeze({})
): LaunchNewTeamWizardOrModalPayload => ({payload, type: launchNewTeamWizardOrModal})
export const createLeaveTeam = (payload: _LeaveTeamPayload): LeaveTeamPayload => ({payload, type: leaveTeam})
export const createLoadTeamTree = (payload: _LoadTeamTreePayload): LoadTeamTreePayload => ({
  payload,
  type: loadTeamTree,
})
export const createManageChatChannels = (payload: _ManageChatChannelsPayload): ManageChatChannelsPayload => ({
  payload,
  type: manageChatChannels,
})
export const createReAddToTeam = (payload: _ReAddToTeamPayload): ReAddToTeamPayload => ({
  payload,
  type: reAddToTeam,
})
export const createRemoveMember = (payload: _RemoveMemberPayload): RemoveMemberPayload => ({
  payload,
  type: removeMember,
})
export const createRemoveParticipant = (payload: _RemoveParticipantPayload): RemoveParticipantPayload => ({
  payload,
  type: removeParticipant,
})
export const createRemovePendingInvite = (
  payload: _RemovePendingInvitePayload
): RemovePendingInvitePayload => ({payload, type: removePendingInvite})
export const createSaveChannelMembership = (
  payload: _SaveChannelMembershipPayload
): SaveChannelMembershipPayload => ({payload, type: saveChannelMembership})
export const createSetAddUserToTeamsResults = (
  payload: _SetAddUserToTeamsResultsPayload
): SetAddUserToTeamsResultsPayload => ({payload, type: setAddUserToTeamsResults})
export const createSetChannelCreationError = (
  payload: _SetChannelCreationErrorPayload
): SetChannelCreationErrorPayload => ({payload, type: setChannelCreationError})
export const createSetCreatingChannels = (
  payload: _SetCreatingChannelsPayload
): SetCreatingChannelsPayload => ({payload, type: setCreatingChannels})
export const createSetEditDescriptionError = (
  payload: _SetEditDescriptionErrorPayload
): SetEditDescriptionErrorPayload => ({payload, type: setEditDescriptionError})
export const createSetEditMemberError = (payload: _SetEditMemberErrorPayload): SetEditMemberErrorPayload => ({
  payload,
  type: setEditMemberError,
})
export const createSetEmailInviteError = (
  payload: _SetEmailInviteErrorPayload
): SetEmailInviteErrorPayload => ({payload, type: setEmailInviteError})
export const createSetJustFinishedAddMembersWizard = (
  payload: _SetJustFinishedAddMembersWizardPayload
): SetJustFinishedAddMembersWizardPayload => ({payload, type: setJustFinishedAddMembersWizard})
export const createSetMemberActivityDetails = (
  payload: _SetMemberActivityDetailsPayload
): SetMemberActivityDetailsPayload => ({payload, type: setMemberActivityDetails})
export const createSetMemberPublicity = (payload: _SetMemberPublicityPayload): SetMemberPublicityPayload => ({
  payload,
  type: setMemberPublicity,
})
export const createSetMembers = (payload: _SetMembersPayload): SetMembersPayload => ({
  payload,
  type: setMembers,
})
export const createSetNewTeamInfo = (payload: _SetNewTeamInfoPayload): SetNewTeamInfoPayload => ({
  payload,
  type: setNewTeamInfo,
})
export const createSetPublicity = (payload: _SetPublicityPayload): SetPublicityPayload => ({
  payload,
  type: setPublicity,
})
export const createSetTeamAccessRequestsPending = (
  payload: _SetTeamAccessRequestsPendingPayload
): SetTeamAccessRequestsPendingPayload => ({payload, type: setTeamAccessRequestsPending})
export const createSetTeamCreationError = (
  payload: _SetTeamCreationErrorPayload
): SetTeamCreationErrorPayload => ({payload, type: setTeamCreationError})
export const createSetTeamInfo = (payload: _SetTeamInfoPayload): SetTeamInfoPayload => ({
  payload,
  type: setTeamInfo,
})
export const createSetTeamInviteError = (payload: _SetTeamInviteErrorPayload): SetTeamInviteErrorPayload => ({
  payload,
  type: setTeamInviteError,
})
export const createSetTeamJoinError = (payload: _SetTeamJoinErrorPayload): SetTeamJoinErrorPayload => ({
  payload,
  type: setTeamJoinError,
})
export const createSetTeamJoinSuccess = (payload: _SetTeamJoinSuccessPayload): SetTeamJoinSuccessPayload => ({
  payload,
  type: setTeamJoinSuccess,
})
export const createSetTeamLoadingInvites = (
  payload: _SetTeamLoadingInvitesPayload
): SetTeamLoadingInvitesPayload => ({payload, type: setTeamLoadingInvites})
export const createSetTeamProfileAddList = (
  payload: _SetTeamProfileAddListPayload
): SetTeamProfileAddListPayload => ({payload, type: setTeamProfileAddList})
export const createSetTeamRetentionPolicy = (
  payload: _SetTeamRetentionPolicyPayload
): SetTeamRetentionPolicyPayload => ({payload, type: setTeamRetentionPolicy})
export const createSetTeamRoleMap = (payload: _SetTeamRoleMapPayload): SetTeamRoleMapPayload => ({
  payload,
  type: setTeamRoleMap,
})
export const createSetTeamRoleMapLatestKnownVersion = (
  payload: _SetTeamRoleMapLatestKnownVersionPayload
): SetTeamRoleMapLatestKnownVersionPayload => ({payload, type: setTeamRoleMapLatestKnownVersion})
export const createSetTeamSawChatBanner = (
  payload: _SetTeamSawChatBannerPayload
): SetTeamSawChatBannerPayload => ({payload, type: setTeamSawChatBanner})
export const createSetTeamSawSubteamsBanner = (
  payload: _SetTeamSawSubteamsBannerPayload
): SetTeamSawSubteamsBannerPayload => ({payload, type: setTeamSawSubteamsBanner})
export const createSetTeamVersion = (payload: _SetTeamVersionPayload): SetTeamVersionPayload => ({
  payload,
  type: setTeamVersion,
})
export const createSetTeamWizardAvatar = (
  payload: _SetTeamWizardAvatarPayload = Object.freeze({})
): SetTeamWizardAvatarPayload => ({payload, type: setTeamWizardAvatar})
export const createSetTeamWizardChannels = (
  payload: _SetTeamWizardChannelsPayload
): SetTeamWizardChannelsPayload => ({payload, type: setTeamWizardChannels})
export const createSetTeamWizardError = (payload: _SetTeamWizardErrorPayload): SetTeamWizardErrorPayload => ({
  payload,
  type: setTeamWizardError,
})
export const createSetTeamWizardNameDescription = (
  payload: _SetTeamWizardNameDescriptionPayload
): SetTeamWizardNameDescriptionPayload => ({payload, type: setTeamWizardNameDescription})
export const createSetTeamWizardSubteamMembers = (
  payload: _SetTeamWizardSubteamMembersPayload
): SetTeamWizardSubteamMembersPayload => ({payload, type: setTeamWizardSubteamMembers})
export const createSetTeamWizardSubteams = (
  payload: _SetTeamWizardSubteamsPayload
): SetTeamWizardSubteamsPayload => ({payload, type: setTeamWizardSubteams})
export const createSetTeamWizardTeamSize = (
  payload: _SetTeamWizardTeamSizePayload
): SetTeamWizardTeamSizePayload => ({payload, type: setTeamWizardTeamSize})
export const createSetTeamWizardTeamType = (
  payload: _SetTeamWizardTeamTypePayload
): SetTeamWizardTeamTypePayload => ({payload, type: setTeamWizardTeamType})
export const createSetTeamsWithChosenChannels = (
  payload: _SetTeamsWithChosenChannelsPayload
): SetTeamsWithChosenChannelsPayload => ({payload, type: setTeamsWithChosenChannels})
export const createSetUpdatedChannelName = (
  payload: _SetUpdatedChannelNamePayload
): SetUpdatedChannelNamePayload => ({payload, type: setUpdatedChannelName})
export const createSetUpdatedTopic = (payload: _SetUpdatedTopicPayload): SetUpdatedTopicPayload => ({
  payload,
  type: setUpdatedTopic,
})
export const createSetWelcomeMessageError = (
  payload: _SetWelcomeMessageErrorPayload
): SetWelcomeMessageErrorPayload => ({payload, type: setWelcomeMessageError})
export const createSettingsError = (payload: _SettingsErrorPayload): SettingsErrorPayload => ({
  payload,
  type: settingsError,
})
export const createStartNewTeamWizard = (payload: _StartNewTeamWizardPayload): StartNewTeamWizardPayload => ({
  payload,
  type: startNewTeamWizard,
})
export const createTeamCreated = (payload: _TeamCreatedPayload): TeamCreatedPayload => ({
  payload,
  type: teamCreated,
})
export const createTeamLoaded = (payload: _TeamLoadedPayload): TeamLoadedPayload => ({
  payload,
  type: teamLoaded,
})
export const createUpdateChannelName = (payload: _UpdateChannelNamePayload): UpdateChannelNamePayload => ({
  payload,
  type: updateChannelName,
})
export const createUpdateTopic = (payload: _UpdateTopicPayload): UpdateTopicPayload => ({
  payload,
  type: updateTopic,
})
export const createUploadTeamAvatar = (payload: _UploadTeamAvatarPayload): UploadTeamAvatarPayload => ({
  payload,
  type: uploadTeamAvatar,
})

// Action Payloads
export type AddMembersWizardPushMembersPayload = {
  readonly payload: _AddMembersWizardPushMembersPayload
  readonly type: typeof addMembersWizardPushMembers
}
export type AddMembersWizardRemoveMemberPayload = {
  readonly payload: _AddMembersWizardRemoveMemberPayload
  readonly type: typeof addMembersWizardRemoveMember
}
export type AddMembersWizardSetDefaultChannelsPayload = {
  readonly payload: _AddMembersWizardSetDefaultChannelsPayload
  readonly type: typeof addMembersWizardSetDefaultChannels
}
export type AddParticipantPayload = {
  readonly payload: _AddParticipantPayload
  readonly type: typeof addParticipant
}
export type AddTeamWithChosenChannelsPayload = {
  readonly payload: _AddTeamWithChosenChannelsPayload
  readonly type: typeof addTeamWithChosenChannels
}
export type AddToTeamPayload = {readonly payload: _AddToTeamPayload; readonly type: typeof addToTeam}
export type AddUserToTeamsPayload = {
  readonly payload: _AddUserToTeamsPayload
  readonly type: typeof addUserToTeams
}
export type AddedToTeamPayload = {readonly payload: _AddedToTeamPayload; readonly type: typeof addedToTeam}
export type CancelAddMembersWizardPayload = {
  readonly payload: _CancelAddMembersWizardPayload
  readonly type: typeof cancelAddMembersWizard
}
export type ChannelSetMemberSelectedPayload = {
  readonly payload: _ChannelSetMemberSelectedPayload
  readonly type: typeof channelSetMemberSelected
}
export type CheckRequestedAccessPayload = {
  readonly payload: _CheckRequestedAccessPayload
  readonly type: typeof checkRequestedAccess
}
export type ClearAddUserToTeamsResultsPayload = {
  readonly payload: _ClearAddUserToTeamsResultsPayload
  readonly type: typeof clearAddUserToTeamsResults
}
export type ClearNavBadgesPayload = {
  readonly payload: _ClearNavBadgesPayload
  readonly type: typeof clearNavBadges
}
export type CreateChannelPayload = {
  readonly payload: _CreateChannelPayload
  readonly type: typeof createChannel
}
export type CreateChannelsPayload = {
  readonly payload: _CreateChannelsPayload
  readonly type: typeof createChannels
}
export type CreateNewTeamFromConversationPayload = {
  readonly payload: _CreateNewTeamFromConversationPayload
  readonly type: typeof createNewTeamFromConversation
}
export type CreateNewTeamPayload = {
  readonly payload: _CreateNewTeamPayload
  readonly type: typeof createNewTeam
}
export type DeleteChannelConfirmedPayload = {
  readonly payload: _DeleteChannelConfirmedPayload
  readonly type: typeof deleteChannelConfirmed
}
export type DeleteMultiChannelsConfirmedPayload = {
  readonly payload: _DeleteMultiChannelsConfirmedPayload
  readonly type: typeof deleteMultiChannelsConfirmed
}
export type DeleteTeamPayload = {readonly payload: _DeleteTeamPayload; readonly type: typeof deleteTeam}
export type EditMembershipPayload = {
  readonly payload: _EditMembershipPayload
  readonly type: typeof editMembership
}
export type EditTeamDescriptionPayload = {
  readonly payload: _EditTeamDescriptionPayload
  readonly type: typeof editTeamDescription
}
export type FinishNewTeamWizardPayload = {
  readonly payload: _FinishNewTeamWizardPayload
  readonly type: typeof finishNewTeamWizard
}
export type FinishedAddMembersWizardPayload = {
  readonly payload: _FinishedAddMembersWizardPayload
  readonly type: typeof finishedAddMembersWizard
}
export type FinishedNewTeamWizardPayload = {
  readonly payload: _FinishedNewTeamWizardPayload
  readonly type: typeof finishedNewTeamWizard
}
export type GetActivityForTeamsPayload = {
  readonly payload: _GetActivityForTeamsPayload
  readonly type: typeof getActivityForTeams
}
export type GetMembersPayload = {readonly payload: _GetMembersPayload; readonly type: typeof getMembers}
export type GetTeamProfileAddListPayload = {
  readonly payload: _GetTeamProfileAddListPayload
  readonly type: typeof getTeamProfileAddList
}
export type GetTeamRetentionPolicyPayload = {
  readonly payload: _GetTeamRetentionPolicyPayload
  readonly type: typeof getTeamRetentionPolicy
}
export type GetTeamsPayload = {readonly payload: _GetTeamsPayload; readonly type: typeof getTeams}
export type IgnoreRequestPayload = {
  readonly payload: _IgnoreRequestPayload
  readonly type: typeof ignoreRequest
}
export type InviteToTeamByEmailPayload = {
  readonly payload: _InviteToTeamByEmailPayload
  readonly type: typeof inviteToTeamByEmail
}
export type InviteToTeamByPhonePayload = {
  readonly payload: _InviteToTeamByPhonePayload
  readonly type: typeof inviteToTeamByPhone
}
export type JoinTeamPayload = {readonly payload: _JoinTeamPayload; readonly type: typeof joinTeam}
export type LaunchNewTeamWizardOrModalPayload = {
  readonly payload: _LaunchNewTeamWizardOrModalPayload
  readonly type: typeof launchNewTeamWizardOrModal
}
export type LeaveTeamPayload = {readonly payload: _LeaveTeamPayload; readonly type: typeof leaveTeam}
export type LeftTeamPayload = {readonly payload: _LeftTeamPayload; readonly type: typeof leftTeam}
export type LoadTeamChannelListPayload = {
  readonly payload: _LoadTeamChannelListPayload
  readonly type: typeof loadTeamChannelList
}
export type LoadTeamPayload = {readonly payload: _LoadTeamPayload; readonly type: typeof loadTeam}
export type LoadTeamTreePayload = {readonly payload: _LoadTeamTreePayload; readonly type: typeof loadTeamTree}
export type LoadWelcomeMessagePayload = {
  readonly payload: _LoadWelcomeMessagePayload
  readonly type: typeof loadWelcomeMessage
}
export type LoadedWelcomeMessagePayload = {
  readonly payload: _LoadedWelcomeMessagePayload
  readonly type: typeof loadedWelcomeMessage
}
export type ManageChatChannelsPayload = {
  readonly payload: _ManageChatChannelsPayload
  readonly type: typeof manageChatChannels
}
export type OpenInviteLinkPayload = {
  readonly payload: _OpenInviteLinkPayload
  readonly type: typeof openInviteLink
}
export type ReAddToTeamPayload = {readonly payload: _ReAddToTeamPayload; readonly type: typeof reAddToTeam}
export type RemoveMemberPayload = {readonly payload: _RemoveMemberPayload; readonly type: typeof removeMember}
export type RemoveParticipantPayload = {
  readonly payload: _RemoveParticipantPayload
  readonly type: typeof removeParticipant
}
export type RemovePendingInvitePayload = {
  readonly payload: _RemovePendingInvitePayload
  readonly type: typeof removePendingInvite
}
export type RenameTeamPayload = {readonly payload: _RenameTeamPayload; readonly type: typeof renameTeam}
export type RequestInviteLinkDetailsPayload = {
  readonly payload: _RequestInviteLinkDetailsPayload
  readonly type: typeof requestInviteLinkDetails
}
export type RespondToInviteLinkPayload = {
  readonly payload: _RespondToInviteLinkPayload
  readonly type: typeof respondToInviteLink
}
export type SaveChannelMembershipPayload = {
  readonly payload: _SaveChannelMembershipPayload
  readonly type: typeof saveChannelMembership
}
export type SaveTeamRetentionPolicyPayload = {
  readonly payload: _SaveTeamRetentionPolicyPayload
  readonly type: typeof saveTeamRetentionPolicy
}
export type SetActivityLevelsPayload = {
  readonly payload: _SetActivityLevelsPayload
  readonly type: typeof setActivityLevels
}
export type SetAddMembersWizardIndividualRolePayload = {
  readonly payload: _SetAddMembersWizardIndividualRolePayload
  readonly type: typeof setAddMembersWizardIndividualRole
}
export type SetAddMembersWizardRolePayload = {
  readonly payload: _SetAddMembersWizardRolePayload
  readonly type: typeof setAddMembersWizardRole
}
export type SetAddUserToTeamsResultsPayload = {
  readonly payload: _SetAddUserToTeamsResultsPayload
  readonly type: typeof setAddUserToTeamsResults
}
export type SetChannelCreationErrorPayload = {
  readonly payload: _SetChannelCreationErrorPayload
  readonly type: typeof setChannelCreationError
}
export type SetChannelSelectedPayload = {
  readonly payload: _SetChannelSelectedPayload
  readonly type: typeof setChannelSelected
}
export type SetCreatingChannelsPayload = {
  readonly payload: _SetCreatingChannelsPayload
  readonly type: typeof setCreatingChannels
}
export type SetEditDescriptionErrorPayload = {
  readonly payload: _SetEditDescriptionErrorPayload
  readonly type: typeof setEditDescriptionError
}
export type SetEditMemberErrorPayload = {
  readonly payload: _SetEditMemberErrorPayload
  readonly type: typeof setEditMemberError
}
export type SetEmailInviteErrorPayload = {
  readonly payload: _SetEmailInviteErrorPayload
  readonly type: typeof setEmailInviteError
}
export type SetJustFinishedAddMembersWizardPayload = {
  readonly payload: _SetJustFinishedAddMembersWizardPayload
  readonly type: typeof setJustFinishedAddMembersWizard
}
export type SetMemberActivityDetailsPayload = {
  readonly payload: _SetMemberActivityDetailsPayload
  readonly type: typeof setMemberActivityDetails
}
export type SetMemberPublicityPayload = {
  readonly payload: _SetMemberPublicityPayload
  readonly type: typeof setMemberPublicity
}
export type SetMembersPayload = {readonly payload: _SetMembersPayload; readonly type: typeof setMembers}
export type SetNewTeamInfoPayload = {
  readonly payload: _SetNewTeamInfoPayload
  readonly type: typeof setNewTeamInfo
}
export type SetNewTeamRequestsPayload = {
  readonly payload: _SetNewTeamRequestsPayload
  readonly type: typeof setNewTeamRequests
}
export type SetPublicityPayload = {readonly payload: _SetPublicityPayload; readonly type: typeof setPublicity}
export type SetSubteamFilterPayload = {
  readonly payload: _SetSubteamFilterPayload
  readonly type: typeof setSubteamFilter
}
export type SetTeamAccessRequestsPendingPayload = {
  readonly payload: _SetTeamAccessRequestsPendingPayload
  readonly type: typeof setTeamAccessRequestsPending
}
export type SetTeamCreationErrorPayload = {
  readonly payload: _SetTeamCreationErrorPayload
  readonly type: typeof setTeamCreationError
}
export type SetTeamInfoPayload = {readonly payload: _SetTeamInfoPayload; readonly type: typeof setTeamInfo}
export type SetTeamInviteErrorPayload = {
  readonly payload: _SetTeamInviteErrorPayload
  readonly type: typeof setTeamInviteError
}
export type SetTeamJoinErrorPayload = {
  readonly payload: _SetTeamJoinErrorPayload
  readonly type: typeof setTeamJoinError
}
export type SetTeamJoinSuccessPayload = {
  readonly payload: _SetTeamJoinSuccessPayload
  readonly type: typeof setTeamJoinSuccess
}
export type SetTeamListFilterSortPayload = {
  readonly payload: _SetTeamListFilterSortPayload
  readonly type: typeof setTeamListFilterSort
}
export type SetTeamLoadingInvitesPayload = {
  readonly payload: _SetTeamLoadingInvitesPayload
  readonly type: typeof setTeamLoadingInvites
}
export type SetTeamProfileAddListPayload = {
  readonly payload: _SetTeamProfileAddListPayload
  readonly type: typeof setTeamProfileAddList
}
export type SetTeamRetentionPolicyPayload = {
  readonly payload: _SetTeamRetentionPolicyPayload
  readonly type: typeof setTeamRetentionPolicy
}
export type SetTeamRoleMapLatestKnownVersionPayload = {
  readonly payload: _SetTeamRoleMapLatestKnownVersionPayload
  readonly type: typeof setTeamRoleMapLatestKnownVersion
}
export type SetTeamRoleMapPayload = {
  readonly payload: _SetTeamRoleMapPayload
  readonly type: typeof setTeamRoleMap
}
export type SetTeamSawChatBannerPayload = {
  readonly payload: _SetTeamSawChatBannerPayload
  readonly type: typeof setTeamSawChatBanner
}
export type SetTeamSawSubteamsBannerPayload = {
  readonly payload: _SetTeamSawSubteamsBannerPayload
  readonly type: typeof setTeamSawSubteamsBanner
}
export type SetTeamVersionPayload = {
  readonly payload: _SetTeamVersionPayload
  readonly type: typeof setTeamVersion
}
export type SetTeamWizardAvatarPayload = {
  readonly payload: _SetTeamWizardAvatarPayload
  readonly type: typeof setTeamWizardAvatar
}
export type SetTeamWizardChannelsPayload = {
  readonly payload: _SetTeamWizardChannelsPayload
  readonly type: typeof setTeamWizardChannels
}
export type SetTeamWizardErrorPayload = {
  readonly payload: _SetTeamWizardErrorPayload
  readonly type: typeof setTeamWizardError
}
export type SetTeamWizardNameDescriptionPayload = {
  readonly payload: _SetTeamWizardNameDescriptionPayload
  readonly type: typeof setTeamWizardNameDescription
}
export type SetTeamWizardSubteamMembersPayload = {
  readonly payload: _SetTeamWizardSubteamMembersPayload
  readonly type: typeof setTeamWizardSubteamMembers
}
export type SetTeamWizardSubteamsPayload = {
  readonly payload: _SetTeamWizardSubteamsPayload
  readonly type: typeof setTeamWizardSubteams
}
export type SetTeamWizardTeamSizePayload = {
  readonly payload: _SetTeamWizardTeamSizePayload
  readonly type: typeof setTeamWizardTeamSize
}
export type SetTeamWizardTeamTypePayload = {
  readonly payload: _SetTeamWizardTeamTypePayload
  readonly type: typeof setTeamWizardTeamType
}
export type SetTeamsWithChosenChannelsPayload = {
  readonly payload: _SetTeamsWithChosenChannelsPayload
  readonly type: typeof setTeamsWithChosenChannels
}
export type SetUpdatedChannelNamePayload = {
  readonly payload: _SetUpdatedChannelNamePayload
  readonly type: typeof setUpdatedChannelName
}
export type SetUpdatedTopicPayload = {
  readonly payload: _SetUpdatedTopicPayload
  readonly type: typeof setUpdatedTopic
}
export type SetWelcomeMessageErrorPayload = {
  readonly payload: _SetWelcomeMessageErrorPayload
  readonly type: typeof setWelcomeMessageError
}
export type SetWelcomeMessagePayload = {
  readonly payload: _SetWelcomeMessagePayload
  readonly type: typeof setWelcomeMessage
}
export type SettingsErrorPayload = {
  readonly payload: _SettingsErrorPayload
  readonly type: typeof settingsError
}
export type ShowTeamByNamePayload = {
  readonly payload: _ShowTeamByNamePayload
  readonly type: typeof showTeamByName
}
export type StartAddMembersWizardPayload = {
  readonly payload: _StartAddMembersWizardPayload
  readonly type: typeof startAddMembersWizard
}
export type StartNewTeamWizardPayload = {
  readonly payload: _StartNewTeamWizardPayload
  readonly type: typeof startNewTeamWizard
}
export type TeamChannelListLoadedPayload = {
  readonly payload: _TeamChannelListLoadedPayload
  readonly type: typeof teamChannelListLoaded
}
export type TeamCreatedPayload = {readonly payload: _TeamCreatedPayload; readonly type: typeof teamCreated}
export type TeamLoadedPayload = {readonly payload: _TeamLoadedPayload; readonly type: typeof teamLoaded}
export type TeamSeenPayload = {readonly payload: _TeamSeenPayload; readonly type: typeof teamSeen}
export type TeamSetMemberSelectedPayload = {
  readonly payload: _TeamSetMemberSelectedPayload
  readonly type: typeof teamSetMemberSelected
}
export type ToggleInvitesCollapsedPayload = {
  readonly payload: _ToggleInvitesCollapsedPayload
  readonly type: typeof toggleInvitesCollapsed
}
export type UnsubscribeTeamDetailsPayload = {
  readonly payload: _UnsubscribeTeamDetailsPayload
  readonly type: typeof unsubscribeTeamDetails
}
export type UnsubscribeTeamListPayload = {
  readonly payload: _UnsubscribeTeamListPayload
  readonly type: typeof unsubscribeTeamList
}
export type UpdateChannelNamePayload = {
  readonly payload: _UpdateChannelNamePayload
  readonly type: typeof updateChannelName
}
export type UpdateInviteLinkDetailsPayload = {
  readonly payload: _UpdateInviteLinkDetailsPayload
  readonly type: typeof updateInviteLinkDetails
}
export type UpdateTopicPayload = {readonly payload: _UpdateTopicPayload; readonly type: typeof updateTopic}
export type UploadTeamAvatarPayload = {
  readonly payload: _UploadTeamAvatarPayload
  readonly type: typeof uploadTeamAvatar
}

// All Actions
// prettier-ignore
export type Actions =
  | AddMembersWizardPushMembersPayload
  | AddMembersWizardRemoveMemberPayload
  | AddMembersWizardSetDefaultChannelsPayload
  | AddParticipantPayload
  | AddTeamWithChosenChannelsPayload
  | AddToTeamPayload
  | AddUserToTeamsPayload
  | AddedToTeamPayload
  | CancelAddMembersWizardPayload
  | ChannelSetMemberSelectedPayload
  | CheckRequestedAccessPayload
  | ClearAddUserToTeamsResultsPayload
  | ClearNavBadgesPayload
  | CreateChannelPayload
  | CreateChannelsPayload
  | CreateNewTeamFromConversationPayload
  | CreateNewTeamPayload
  | DeleteChannelConfirmedPayload
  | DeleteMultiChannelsConfirmedPayload
  | DeleteTeamPayload
  | EditMembershipPayload
  | EditTeamDescriptionPayload
  | FinishNewTeamWizardPayload
  | FinishedAddMembersWizardPayload
  | FinishedNewTeamWizardPayload
  | GetActivityForTeamsPayload
  | GetMembersPayload
  | GetTeamProfileAddListPayload
  | GetTeamRetentionPolicyPayload
  | GetTeamsPayload
  | IgnoreRequestPayload
  | InviteToTeamByEmailPayload
  | InviteToTeamByPhonePayload
  | JoinTeamPayload
  | LaunchNewTeamWizardOrModalPayload
  | LeaveTeamPayload
  | LeftTeamPayload
  | LoadTeamChannelListPayload
  | LoadTeamPayload
  | LoadTeamTreePayload
  | LoadWelcomeMessagePayload
  | LoadedWelcomeMessagePayload
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
  | SaveTeamRetentionPolicyPayload
  | SetActivityLevelsPayload
  | SetAddMembersWizardIndividualRolePayload
  | SetAddMembersWizardRolePayload
  | SetAddUserToTeamsResultsPayload
  | SetChannelCreationErrorPayload
  | SetChannelSelectedPayload
  | SetCreatingChannelsPayload
  | SetEditDescriptionErrorPayload
  | SetEditMemberErrorPayload
  | SetEmailInviteErrorPayload
  | SetJustFinishedAddMembersWizardPayload
  | SetMemberActivityDetailsPayload
  | SetMemberPublicityPayload
  | SetMembersPayload
  | SetNewTeamInfoPayload
  | SetNewTeamRequestsPayload
  | SetPublicityPayload
  | SetSubteamFilterPayload
  | SetTeamAccessRequestsPendingPayload
  | SetTeamCreationErrorPayload
  | SetTeamInfoPayload
  | SetTeamInviteErrorPayload
  | SetTeamJoinErrorPayload
  | SetTeamJoinSuccessPayload
  | SetTeamListFilterSortPayload
  | SetTeamLoadingInvitesPayload
  | SetTeamProfileAddListPayload
  | SetTeamRetentionPolicyPayload
  | SetTeamRoleMapLatestKnownVersionPayload
  | SetTeamRoleMapPayload
  | SetTeamSawChatBannerPayload
  | SetTeamSawSubteamsBannerPayload
  | SetTeamVersionPayload
  | SetTeamWizardAvatarPayload
  | SetTeamWizardChannelsPayload
  | SetTeamWizardErrorPayload
  | SetTeamWizardNameDescriptionPayload
  | SetTeamWizardSubteamMembersPayload
  | SetTeamWizardSubteamsPayload
  | SetTeamWizardTeamSizePayload
  | SetTeamWizardTeamTypePayload
  | SetTeamsWithChosenChannelsPayload
  | SetUpdatedChannelNamePayload
  | SetUpdatedTopicPayload
  | SetWelcomeMessageErrorPayload
  | SetWelcomeMessagePayload
  | SettingsErrorPayload
  | ShowTeamByNamePayload
  | StartAddMembersWizardPayload
  | StartNewTeamWizardPayload
  | TeamChannelListLoadedPayload
  | TeamCreatedPayload
  | TeamLoadedPayload
  | TeamSeenPayload
  | TeamSetMemberSelectedPayload
  | ToggleInvitesCollapsedPayload
  | UnsubscribeTeamDetailsPayload
  | UnsubscribeTeamListPayload
  | UpdateChannelNamePayload
  | UpdateInviteLinkDetailsPayload
  | UpdateTopicPayload
  | UploadTeamAvatarPayload
  | {type: 'common:resetStore', payload: {}}
