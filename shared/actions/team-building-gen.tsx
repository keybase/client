// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/team-building'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of team-building but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'team-building:'
export const addUsersToTeamSoFar = 'team-building:addUsersToTeamSoFar'
export const cancelTeamBuilding = 'team-building:cancelTeamBuilding'
export const fetchUserRecs = 'team-building:fetchUserRecs'
export const fetchedUserRecs = 'team-building:fetchedUserRecs'
export const finishedTeamBuilding = 'team-building:finishedTeamBuilding'
export const removeUsersFromTeamSoFar = 'team-building:removeUsersFromTeamSoFar'
export const search = 'team-building:search'
export const searchResultsLoaded = 'team-building:searchResultsLoaded'

// Payload Types
type _AddUsersToTeamSoFarPayload = {readonly users: Array<Types.User>}
type _CancelTeamBuildingPayload = void
type _FetchUserRecsPayload = void
type _FetchedUserRecsPayload = {readonly users: Array<Types.User>}
type _FinishedTeamBuildingPayload = void
type _RemoveUsersFromTeamSoFarPayload = {readonly users: Array<Types.UserID>}
type _SearchPayload = {
  readonly query: string
  readonly service: Types.ServiceIdWithContact
  readonly limit?: number
}
type _SearchResultsLoadedPayload = {
  readonly users: Array<Types.User>
  readonly query: string
  readonly service: Types.ServiceIdWithContact
}

// Action Creators
export const createAddUsersToTeamSoFar = (
  payload: _AddUsersToTeamSoFarPayload
): AddUsersToTeamSoFarPayload => ({payload, type: addUsersToTeamSoFar})
export const createCancelTeamBuilding = (payload: _CancelTeamBuildingPayload): CancelTeamBuildingPayload => ({
  payload,
  type: cancelTeamBuilding,
})
export const createFetchUserRecs = (payload: _FetchUserRecsPayload): FetchUserRecsPayload => ({
  payload,
  type: fetchUserRecs,
})
export const createFetchedUserRecs = (payload: _FetchedUserRecsPayload): FetchedUserRecsPayload => ({
  payload,
  type: fetchedUserRecs,
})
export const createFinishedTeamBuilding = (
  payload: _FinishedTeamBuildingPayload
): FinishedTeamBuildingPayload => ({payload, type: finishedTeamBuilding})
export const createRemoveUsersFromTeamSoFar = (
  payload: _RemoveUsersFromTeamSoFarPayload
): RemoveUsersFromTeamSoFarPayload => ({payload, type: removeUsersFromTeamSoFar})
export const createSearch = (payload: _SearchPayload): SearchPayload => ({payload, type: search})
export const createSearchResultsLoaded = (
  payload: _SearchResultsLoadedPayload
): SearchResultsLoadedPayload => ({payload, type: searchResultsLoaded})

// Action Payloads
export type AddUsersToTeamSoFarPayload = {
  readonly payload: _AddUsersToTeamSoFarPayload
  readonly type: 'team-building:addUsersToTeamSoFar'
}
export type CancelTeamBuildingPayload = {
  readonly payload: _CancelTeamBuildingPayload
  readonly type: 'team-building:cancelTeamBuilding'
}
export type FetchUserRecsPayload = {
  readonly payload: _FetchUserRecsPayload
  readonly type: 'team-building:fetchUserRecs'
}
export type FetchedUserRecsPayload = {
  readonly payload: _FetchedUserRecsPayload
  readonly type: 'team-building:fetchedUserRecs'
}
export type FinishedTeamBuildingPayload = {
  readonly payload: _FinishedTeamBuildingPayload
  readonly type: 'team-building:finishedTeamBuilding'
}
export type RemoveUsersFromTeamSoFarPayload = {
  readonly payload: _RemoveUsersFromTeamSoFarPayload
  readonly type: 'team-building:removeUsersFromTeamSoFar'
}
export type SearchPayload = {readonly payload: _SearchPayload; readonly type: 'team-building:search'}
export type SearchResultsLoadedPayload = {
  readonly payload: _SearchResultsLoadedPayload
  readonly type: 'team-building:searchResultsLoaded'
}

// All Actions
// prettier-ignore
export type Actions =
  | AddUsersToTeamSoFarPayload
  | CancelTeamBuildingPayload
  | FetchUserRecsPayload
  | FetchedUserRecsPayload
  | FinishedTeamBuildingPayload
  | RemoveUsersFromTeamSoFarPayload
  | SearchPayload
  | SearchResultsLoadedPayload
  | {type: 'common:resetStore', payload: null}
