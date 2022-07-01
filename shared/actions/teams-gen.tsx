// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import type * as ChatTypes from '../constants/types/chat2'
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
 * Don't eagerly reload team list anymore.
 */
export const createUnsubscribeTeamList = (payload?: undefined) => ({
  payload,
  type: unsubscribeTeamList as typeof unsubscribeTeamList,
})
/**
 * Edit the role of one or more members in a team
 */
export const createEditMembership = (payload: {
  readonly teamID: Types.TeamID
  readonly usernames: Array<string>
  readonly role: Types.TeamRoleType
}) => ({payload, type: editMembership as typeof editMembership})
/**
 * Fetch activity levels.
 */
export const createGetActivityForTeams = (payload?: undefined) => ({
  payload,
  type: getActivityForTeams as typeof getActivityForTeams,
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
 * Load info for rendering the channel list on the team page.
 */
export const createLoadTeamChannelList = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: loadTeamChannelList as typeof loadTeamChannelList,
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
 * Load team list if we are stale.
 *
 * `_subscribe` is for use by teams/subscriber only.
 */
export const createGetTeams = (
  payload: {readonly _subscribe?: boolean; readonly forceReload?: boolean} = {}
) => ({payload, type: getTeams as typeof getTeams})
/**
 * Load welcome message for new team members
 */
export const createLoadWelcomeMessage = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: loadWelcomeMessage as typeof loadWelcomeMessage,
})
/**
 * Loaded channel list for team.
 */
export const createTeamChannelListLoaded = (payload: {
  readonly teamID: Types.TeamID
  readonly channels: Map<ChatTypes.ConversationIDKey, Types.TeamChannelInfo>
}) => ({payload, type: teamChannelListLoaded as typeof teamChannelListLoaded})
/**
 * Loaded welcome message for new team members
 */
export const createLoadedWelcomeMessage = (payload: {
  readonly teamID: Types.TeamID
  readonly message: RPCChatTypes.WelcomeMessageDisplay
}) => ({payload, type: loadedWelcomeMessage as typeof loadedWelcomeMessage})
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
 * Set map of activity levels for all teams and channels.
 */
export const createSetActivityLevels = (payload: {readonly levels: Types.ActivityLevels}) => ({
  payload,
  type: setActivityLevels as typeof setActivityLevels,
})
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
 * Set welcome message for new team members
 */
export const createSetWelcomeMessage = (payload: {
  readonly teamID: Types.TeamID
  readonly message: RPCChatTypes.WelcomeMessage
}) => ({payload, type: setWelcomeMessage as typeof setWelcomeMessage})
/**
 * Set which requests we haven't seen yet for a team.
 */
export const createSetNewTeamRequests = (payload: {
  readonly newTeamRequests: Map<Types.TeamID, Set<string>>
}) => ({payload, type: setNewTeamRequests as typeof setNewTeamRequests})
/**
 * Sets the retention policy for a team. The store will be updated automatically.
 */
export const createSaveTeamRetentionPolicy = (payload: {
  readonly teamID: Types.TeamID
  readonly policy: RetentionPolicy
}) => ({payload, type: saveTeamRetentionPolicy as typeof saveTeamRetentionPolicy})
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
export const createChannelSetMemberSelected = (payload: {
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly username: string
  readonly selected: boolean
  readonly clearAll?: boolean
}) => ({payload, type: channelSetMemberSelected as typeof channelSetMemberSelected})
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
 * Toggle whether invites are collapsed in the member list for this team
 */
export const createToggleInvitesCollapsed = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: toggleInvitesCollapsed as typeof toggleInvitesCollapsed,
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
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}) => ({payload, type: addParticipant as typeof addParticipant})
export const createAddTeamWithChosenChannels = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: addTeamWithChosenChannels as typeof addTeamWithChosenChannels,
})
export const createAddToTeam = (payload: {
  readonly teamID: Types.TeamID
  readonly users: Array<{assertion: string; role: Types.TeamRoleType}>
  readonly sendChatNotification: boolean
  readonly fromTeamBuilder?: boolean
}) => ({payload, type: addToTeam as typeof addToTeam})
export const createAddUserToTeams = (payload: {
  readonly role: Types.TeamRoleType
  readonly teams: Array<string>
  readonly user: string
}) => ({payload, type: addUserToTeams as typeof addUserToTeams})
export const createAddedToTeam = (
  payload: {readonly error?: string; readonly fromTeamBuilder?: boolean} = {}
) => ({payload, type: addedToTeam as typeof addedToTeam})
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
  readonly description: string | null
  readonly navToChatOnSuccess: boolean
}) => ({payload, type: createChannel as typeof createChannel})
export const createCreateChannels = (payload: {
  readonly teamID: Types.TeamID
  readonly channelnames: Array<string>
}) => ({payload, type: createChannels as typeof createChannels})
export const createCreateNewTeam = (payload: {
  readonly fromChat?: boolean
  readonly joinSubteam: boolean
  readonly teamname: string
  readonly thenAddMembers?: {
    users: Array<{assertion: string; role: Types.TeamRoleType}>
    sendChatNotification: boolean
    fromTeamBuilder?: boolean
  }
}) => ({payload, type: createNewTeam as typeof createNewTeam})
export const createCreateNewTeamFromConversation = (payload: {
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly teamname: string
}) => ({payload, type: createNewTeamFromConversation as typeof createNewTeamFromConversation})
export const createDeleteChannelConfirmed = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
}) => ({payload, type: deleteChannelConfirmed as typeof deleteChannelConfirmed})
export const createDeleteMultiChannelsConfirmed = (payload: {
  readonly teamID: Types.TeamID
  readonly channels: Array<ChatTypes.ConversationIDKey>
}) => ({payload, type: deleteMultiChannelsConfirmed as typeof deleteMultiChannelsConfirmed})
export const createDeleteTeam = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: deleteTeam as typeof deleteTeam,
})
export const createEditTeamDescription = (payload: {
  readonly teamID: Types.TeamID
  readonly description: string
}) => ({payload, type: editTeamDescription as typeof editTeamDescription})
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
export const createInviteToTeamByEmail = (payload: {
  readonly invitees: string
  readonly role: Types.TeamRoleType
  readonly teamID: Types.TeamID
  readonly teamname: string
  readonly loadingKey?: string
}) => ({payload, type: inviteToTeamByEmail as typeof inviteToTeamByEmail})
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
  readonly conversationIDKey: ChatTypes.ConversationIDKey
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
export const createSetAddUserToTeamsResults = (payload: {
  readonly error: boolean
  readonly results: string
}) => ({payload, type: setAddUserToTeamsResults as typeof setAddUserToTeamsResults})
export const createSetChannelCreationError = (payload: {readonly error: string}) => ({
  payload,
  type: setChannelCreationError as typeof setChannelCreationError,
})
export const createSetCreatingChannels = (payload: {readonly creatingChannels: boolean}) => ({
  payload,
  type: setCreatingChannels as typeof setCreatingChannels,
})
export const createSetEditDescriptionError = (payload: {readonly error: string}) => ({
  payload,
  type: setEditDescriptionError as typeof setEditDescriptionError,
})
export const createSetEditMemberError = (payload: {
  readonly error: string
  readonly teamID: Types.TeamID
  readonly username: string
}) => ({payload, type: setEditMemberError as typeof setEditMemberError})
export const createSetEmailInviteError = (payload: {
  readonly message: string
  readonly malformed: Array<string>
}) => ({payload, type: setEmailInviteError as typeof setEmailInviteError})
export const createSetJustFinishedAddMembersWizard = (payload: {readonly justFinished: boolean}) => ({
  payload,
  type: setJustFinishedAddMembersWizard as typeof setJustFinishedAddMembersWizard,
})
export const createSetMemberActivityDetails = (payload: {
  readonly activityMap: Map<Types.TeamID, number>
  readonly username: string
}) => ({payload, type: setMemberActivityDetails as typeof setMemberActivityDetails})
export const createSetMemberPublicity = (payload: {
  readonly teamID: Types.TeamID
  readonly showcase: boolean
}) => ({payload, type: setMemberPublicity as typeof setMemberPublicity})
export const createSetMembers = (payload: {
  readonly teamID: Types.TeamID
  readonly members: Map<string, Types.MemberInfo>
}) => ({payload, type: setMembers as typeof setMembers})
export const createSetNewTeamInfo = (payload: {
  readonly deletedTeams: Array<RPCTypes.DeletedTeamInfo>
  readonly newTeams: Set<Types.TeamID>
  readonly teamIDToResetUsers: Map<Types.TeamID, Set<string>>
}) => ({payload, type: setNewTeamInfo as typeof setNewTeamInfo})
export const createSetPublicity = (payload: {
  readonly teamID: Types.TeamID
  readonly settings: Types.PublicitySettings
}) => ({payload, type: setPublicity as typeof setPublicity})
export const createSetTeamAccessRequestsPending = (payload: {
  readonly accessRequestsPending: Set<Types.Teamname>
}) => ({payload, type: setTeamAccessRequestsPending as typeof setTeamAccessRequestsPending})
export const createSetTeamCreationError = (payload: {readonly error: string}) => ({
  payload,
  type: setTeamCreationError as typeof setTeamCreationError,
})
export const createSetTeamInfo = (payload: {
  readonly teamnames: Set<Types.Teamname>
  readonly teamNameToID: Map<Types.Teamname, string>
  readonly teamMeta: Map<Types.TeamID, Types.TeamMeta>
}) => ({payload, type: setTeamInfo as typeof setTeamInfo})
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
export const createSetTeamLoadingInvites = (payload: {
  readonly teamname: string
  readonly loadingKey: string
  readonly isLoading: boolean
}) => ({payload, type: setTeamLoadingInvites as typeof setTeamLoadingInvites})
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
export const createSetTeamSawChatBanner = (payload?: undefined) => ({
  payload,
  type: setTeamSawChatBanner as typeof setTeamSawChatBanner,
})
export const createSetTeamSawSubteamsBanner = (payload?: undefined) => ({
  payload,
  type: setTeamSawSubteamsBanner as typeof setTeamSawSubteamsBanner,
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
export const createSetTeamsWithChosenChannels = (payload: {
  readonly teamsWithChosenChannels: Set<Types.TeamID>
}) => ({payload, type: setTeamsWithChosenChannels as typeof setTeamsWithChosenChannels})
export const createSetUpdatedChannelName = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newChannelName: string
}) => ({payload, type: setUpdatedChannelName as typeof setUpdatedChannelName})
export const createSetUpdatedTopic = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newTopic: string
}) => ({payload, type: setUpdatedTopic as typeof setUpdatedTopic})
export const createSetWelcomeMessageError = (payload: {readonly error: string}) => ({
  payload,
  type: setWelcomeMessageError as typeof setWelcomeMessageError,
})
export const createSettingsError = (payload: {readonly error: string}) => ({
  payload,
  type: settingsError as typeof settingsError,
})
export const createStartNewTeamWizard = (payload?: undefined) => ({
  payload,
  type: startNewTeamWizard as typeof startNewTeamWizard,
})
export const createTeamCreated = (payload: {
  readonly fromChat: boolean
  readonly teamID: Types.TeamID
  readonly teamname: string
}) => ({payload, type: teamCreated as typeof teamCreated})
export const createTeamLoaded = (payload: {
  readonly teamID: Types.TeamID
  readonly team: RPCTypes.AnnotatedTeam
}) => ({payload, type: teamLoaded as typeof teamLoaded})
export const createUpdateChannelName = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
  readonly newChannelName: string
}) => ({payload, type: updateChannelName as typeof updateChannelName})
export const createUpdateTopic = (payload: {
  readonly teamID: Types.TeamID
  readonly conversationIDKey: ChatTypes.ConversationIDKey
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
export type AddTeamWithChosenChannelsPayload = ReturnType<typeof createAddTeamWithChosenChannels>
export type AddToTeamPayload = ReturnType<typeof createAddToTeam>
export type AddUserToTeamsPayload = ReturnType<typeof createAddUserToTeams>
export type AddedToTeamPayload = ReturnType<typeof createAddedToTeam>
export type CancelAddMembersWizardPayload = ReturnType<typeof createCancelAddMembersWizard>
export type ChannelSetMemberSelectedPayload = ReturnType<typeof createChannelSetMemberSelected>
export type CheckRequestedAccessPayload = ReturnType<typeof createCheckRequestedAccess>
export type ClearAddUserToTeamsResultsPayload = ReturnType<typeof createClearAddUserToTeamsResults>
export type ClearNavBadgesPayload = ReturnType<typeof createClearNavBadges>
export type CreateChannelPayload = ReturnType<typeof createCreateChannel>
export type CreateChannelsPayload = ReturnType<typeof createCreateChannels>
export type CreateNewTeamFromConversationPayload = ReturnType<typeof createCreateNewTeamFromConversation>
export type CreateNewTeamPayload = ReturnType<typeof createCreateNewTeam>
export type DeleteChannelConfirmedPayload = ReturnType<typeof createDeleteChannelConfirmed>
export type DeleteMultiChannelsConfirmedPayload = ReturnType<typeof createDeleteMultiChannelsConfirmed>
export type DeleteTeamPayload = ReturnType<typeof createDeleteTeam>
export type EditMembershipPayload = ReturnType<typeof createEditMembership>
export type EditTeamDescriptionPayload = ReturnType<typeof createEditTeamDescription>
export type FinishNewTeamWizardPayload = ReturnType<typeof createFinishNewTeamWizard>
export type FinishedAddMembersWizardPayload = ReturnType<typeof createFinishedAddMembersWizard>
export type FinishedNewTeamWizardPayload = ReturnType<typeof createFinishedNewTeamWizard>
export type GetActivityForTeamsPayload = ReturnType<typeof createGetActivityForTeams>
export type GetMembersPayload = ReturnType<typeof createGetMembers>
export type GetTeamProfileAddListPayload = ReturnType<typeof createGetTeamProfileAddList>
export type GetTeamRetentionPolicyPayload = ReturnType<typeof createGetTeamRetentionPolicy>
export type GetTeamsPayload = ReturnType<typeof createGetTeams>
export type IgnoreRequestPayload = ReturnType<typeof createIgnoreRequest>
export type InviteToTeamByEmailPayload = ReturnType<typeof createInviteToTeamByEmail>
export type InviteToTeamByPhonePayload = ReturnType<typeof createInviteToTeamByPhone>
export type JoinTeamPayload = ReturnType<typeof createJoinTeam>
export type LaunchNewTeamWizardOrModalPayload = ReturnType<typeof createLaunchNewTeamWizardOrModal>
export type LeaveTeamPayload = ReturnType<typeof createLeaveTeam>
export type LeftTeamPayload = ReturnType<typeof createLeftTeam>
export type LoadTeamChannelListPayload = ReturnType<typeof createLoadTeamChannelList>
export type LoadTeamPayload = ReturnType<typeof createLoadTeam>
export type LoadTeamTreePayload = ReturnType<typeof createLoadTeamTree>
export type LoadWelcomeMessagePayload = ReturnType<typeof createLoadWelcomeMessage>
export type LoadedWelcomeMessagePayload = ReturnType<typeof createLoadedWelcomeMessage>
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
export type SaveTeamRetentionPolicyPayload = ReturnType<typeof createSaveTeamRetentionPolicy>
export type SetActivityLevelsPayload = ReturnType<typeof createSetActivityLevels>
export type SetAddMembersWizardIndividualRolePayload = ReturnType<
  typeof createSetAddMembersWizardIndividualRole
>
export type SetAddMembersWizardRolePayload = ReturnType<typeof createSetAddMembersWizardRole>
export type SetAddUserToTeamsResultsPayload = ReturnType<typeof createSetAddUserToTeamsResults>
export type SetChannelCreationErrorPayload = ReturnType<typeof createSetChannelCreationError>
export type SetChannelSelectedPayload = ReturnType<typeof createSetChannelSelected>
export type SetCreatingChannelsPayload = ReturnType<typeof createSetCreatingChannels>
export type SetEditDescriptionErrorPayload = ReturnType<typeof createSetEditDescriptionError>
export type SetEditMemberErrorPayload = ReturnType<typeof createSetEditMemberError>
export type SetEmailInviteErrorPayload = ReturnType<typeof createSetEmailInviteError>
export type SetJustFinishedAddMembersWizardPayload = ReturnType<typeof createSetJustFinishedAddMembersWizard>
export type SetMemberActivityDetailsPayload = ReturnType<typeof createSetMemberActivityDetails>
export type SetMemberPublicityPayload = ReturnType<typeof createSetMemberPublicity>
export type SetMembersPayload = ReturnType<typeof createSetMembers>
export type SetNewTeamInfoPayload = ReturnType<typeof createSetNewTeamInfo>
export type SetNewTeamRequestsPayload = ReturnType<typeof createSetNewTeamRequests>
export type SetPublicityPayload = ReturnType<typeof createSetPublicity>
export type SetSubteamFilterPayload = ReturnType<typeof createSetSubteamFilter>
export type SetTeamAccessRequestsPendingPayload = ReturnType<typeof createSetTeamAccessRequestsPending>
export type SetTeamCreationErrorPayload = ReturnType<typeof createSetTeamCreationError>
export type SetTeamInfoPayload = ReturnType<typeof createSetTeamInfo>
export type SetTeamInviteErrorPayload = ReturnType<typeof createSetTeamInviteError>
export type SetTeamJoinErrorPayload = ReturnType<typeof createSetTeamJoinError>
export type SetTeamJoinSuccessPayload = ReturnType<typeof createSetTeamJoinSuccess>
export type SetTeamListFilterSortPayload = ReturnType<typeof createSetTeamListFilterSort>
export type SetTeamLoadingInvitesPayload = ReturnType<typeof createSetTeamLoadingInvites>
export type SetTeamProfileAddListPayload = ReturnType<typeof createSetTeamProfileAddList>
export type SetTeamRetentionPolicyPayload = ReturnType<typeof createSetTeamRetentionPolicy>
export type SetTeamRoleMapLatestKnownVersionPayload = ReturnType<
  typeof createSetTeamRoleMapLatestKnownVersion
>
export type SetTeamRoleMapPayload = ReturnType<typeof createSetTeamRoleMap>
export type SetTeamSawChatBannerPayload = ReturnType<typeof createSetTeamSawChatBanner>
export type SetTeamSawSubteamsBannerPayload = ReturnType<typeof createSetTeamSawSubteamsBanner>
export type SetTeamVersionPayload = ReturnType<typeof createSetTeamVersion>
export type SetTeamWizardAvatarPayload = ReturnType<typeof createSetTeamWizardAvatar>
export type SetTeamWizardChannelsPayload = ReturnType<typeof createSetTeamWizardChannels>
export type SetTeamWizardErrorPayload = ReturnType<typeof createSetTeamWizardError>
export type SetTeamWizardNameDescriptionPayload = ReturnType<typeof createSetTeamWizardNameDescription>
export type SetTeamWizardSubteamMembersPayload = ReturnType<typeof createSetTeamWizardSubteamMembers>
export type SetTeamWizardSubteamsPayload = ReturnType<typeof createSetTeamWizardSubteams>
export type SetTeamWizardTeamSizePayload = ReturnType<typeof createSetTeamWizardTeamSize>
export type SetTeamWizardTeamTypePayload = ReturnType<typeof createSetTeamWizardTeamType>
export type SetTeamsWithChosenChannelsPayload = ReturnType<typeof createSetTeamsWithChosenChannels>
export type SetUpdatedChannelNamePayload = ReturnType<typeof createSetUpdatedChannelName>
export type SetUpdatedTopicPayload = ReturnType<typeof createSetUpdatedTopic>
export type SetWelcomeMessageErrorPayload = ReturnType<typeof createSetWelcomeMessageError>
export type SetWelcomeMessagePayload = ReturnType<typeof createSetWelcomeMessage>
export type SettingsErrorPayload = ReturnType<typeof createSettingsError>
export type ShowTeamByNamePayload = ReturnType<typeof createShowTeamByName>
export type StartAddMembersWizardPayload = ReturnType<typeof createStartAddMembersWizard>
export type StartNewTeamWizardPayload = ReturnType<typeof createStartNewTeamWizard>
export type TeamChannelListLoadedPayload = ReturnType<typeof createTeamChannelListLoaded>
export type TeamCreatedPayload = ReturnType<typeof createTeamCreated>
export type TeamLoadedPayload = ReturnType<typeof createTeamLoaded>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>
export type TeamSetMemberSelectedPayload = ReturnType<typeof createTeamSetMemberSelected>
export type ToggleInvitesCollapsedPayload = ReturnType<typeof createToggleInvitesCollapsed>
export type UnsubscribeTeamDetailsPayload = ReturnType<typeof createUnsubscribeTeamDetails>
export type UnsubscribeTeamListPayload = ReturnType<typeof createUnsubscribeTeamList>
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
  | {readonly type: 'common:resetStore', readonly payload: undefined}
