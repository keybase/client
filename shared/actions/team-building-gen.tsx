// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/team-building'
import type {TeamRoleType, TeamID} from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of team-building but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'team-building:'
export const addUsersToTeamSoFar = 'team-building:addUsersToTeamSoFar'
export const cancelTeamBuilding = 'team-building:cancelTeamBuilding'
export const changeSendNotification = 'team-building:changeSendNotification'
export const fetchUserRecs = 'team-building:fetchUserRecs'
export const fetchedUserRecs = 'team-building:fetchedUserRecs'
export const finishTeamBuilding = 'team-building:finishTeamBuilding'
export const finishedTeamBuilding = 'team-building:finishedTeamBuilding'
export const labelsSeen = 'team-building:labelsSeen'
export const removeUsersFromTeamSoFar = 'team-building:removeUsersFromTeamSoFar'
export const search = 'team-building:search'
export const searchResultsLoaded = 'team-building:searchResultsLoaded'
export const selectRole = 'team-building:selectRole'
export const setError = 'team-building:setError'
export const tbResetStore = 'team-building:tbResetStore'

// Action Creators
/**
 * If we want to keep the modal open until an RPC finishes, use this before dispatching finishedTeamBuilding.
 */
export const createFinishTeamBuilding = (payload: {
  readonly namespace: Types.AllowedNamespace
  readonly teamID?: TeamID
}) => ({payload, type: finishTeamBuilding as typeof finishTeamBuilding})
/**
 * our own reset store so we don't have conflicts with parent reducers
 */
export const createTbResetStore = (payload: {readonly namespace: Types.AllowedNamespace}) => ({
  payload,
  type: tbResetStore as typeof tbResetStore,
})
export const createAddUsersToTeamSoFar = (payload: {
  readonly namespace: Types.AllowedNamespace
  readonly users: Array<Types.User>
}) => ({payload, type: addUsersToTeamSoFar as typeof addUsersToTeamSoFar})
export const createCancelTeamBuilding = (payload: {readonly namespace: Types.AllowedNamespace}) => ({
  payload,
  type: cancelTeamBuilding as typeof cancelTeamBuilding,
})
export const createChangeSendNotification = (payload: {
  readonly namespace: 'teams'
  readonly sendNotification: boolean
}) => ({payload, type: changeSendNotification as typeof changeSendNotification})
export const createFetchUserRecs = (payload: {
  readonly includeContacts: boolean
  readonly namespace: Types.AllowedNamespace
}) => ({payload, type: fetchUserRecs as typeof fetchUserRecs})
export const createFetchedUserRecs = (payload: {
  readonly namespace: Types.AllowedNamespace
  readonly users: Array<Types.User>
}) => ({payload, type: fetchedUserRecs as typeof fetchedUserRecs})
export const createFinishedTeamBuilding = (payload: {readonly namespace: Types.AllowedNamespace}) => ({
  payload,
  type: finishedTeamBuilding as typeof finishedTeamBuilding,
})
export const createLabelsSeen = (payload: {readonly namespace: Types.AllowedNamespace}) => ({
  payload,
  type: labelsSeen as typeof labelsSeen,
})
export const createRemoveUsersFromTeamSoFar = (payload: {
  readonly namespace: Types.AllowedNamespace
  readonly users: Array<Types.UserID>
}) => ({payload, type: removeUsersFromTeamSoFar as typeof removeUsersFromTeamSoFar})
export const createSearch = (payload: {
  readonly includeContacts: boolean
  readonly namespace: Types.AllowedNamespace
  readonly query: string
  readonly service: Types.ServiceIdWithContact
  readonly limit?: number
}) => ({payload, type: search as typeof search})
export const createSearchResultsLoaded = (payload: {
  readonly namespace: Types.AllowedNamespace
  readonly users: Array<Types.User>
  readonly query: string
  readonly service: Types.ServiceIdWithContact
}) => ({payload, type: searchResultsLoaded as typeof searchResultsLoaded})
export const createSelectRole = (payload: {readonly namespace: 'teams'; readonly role: TeamRoleType}) => ({
  payload,
  type: selectRole as typeof selectRole,
})
export const createSetError = (payload: {
  readonly namespace: Types.AllowedNamespace
  readonly error: string
}) => ({payload, type: setError as typeof setError})

// Action Payloads
export type AddUsersToTeamSoFarPayload = ReturnType<typeof createAddUsersToTeamSoFar>
export type CancelTeamBuildingPayload = ReturnType<typeof createCancelTeamBuilding>
export type ChangeSendNotificationPayload = ReturnType<typeof createChangeSendNotification>
export type FetchUserRecsPayload = ReturnType<typeof createFetchUserRecs>
export type FetchedUserRecsPayload = ReturnType<typeof createFetchedUserRecs>
export type FinishTeamBuildingPayload = ReturnType<typeof createFinishTeamBuilding>
export type FinishedTeamBuildingPayload = ReturnType<typeof createFinishedTeamBuilding>
export type LabelsSeenPayload = ReturnType<typeof createLabelsSeen>
export type RemoveUsersFromTeamSoFarPayload = ReturnType<typeof createRemoveUsersFromTeamSoFar>
export type SearchPayload = ReturnType<typeof createSearch>
export type SearchResultsLoadedPayload = ReturnType<typeof createSearchResultsLoaded>
export type SelectRolePayload = ReturnType<typeof createSelectRole>
export type SetErrorPayload = ReturnType<typeof createSetError>
export type TbResetStorePayload = ReturnType<typeof createTbResetStore>

// All Actions
// prettier-ignore
export type Actions =
  | AddUsersToTeamSoFarPayload
  | CancelTeamBuildingPayload
  | ChangeSendNotificationPayload
  | FetchUserRecsPayload
  | FetchedUserRecsPayload
  | FinishTeamBuildingPayload
  | FinishedTeamBuildingPayload
  | LabelsSeenPayload
  | RemoveUsersFromTeamSoFarPayload
  | SearchPayload
  | SearchResultsLoadedPayload
  | SelectRolePayload
  | SetErrorPayload
  | TbResetStorePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
