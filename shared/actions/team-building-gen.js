// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

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
export const finishedTeamBuilding = 'team-building:finishedTeamBuilding'
export const removeUsersFromTeamSoFar = 'team-building:removeUsersFromTeamSoFar'
export const search = 'team-building:search'
export const searchResultsLoaded = 'team-building:searchResultsLoaded'
export const userRecsLoaded = 'team-building:userRecsLoaded'

// Payload Types
type _AddUsersToTeamSoFarPayload = $ReadOnly<{|users: Array<Types.User>|}>
type _CancelTeamBuildingPayload = void
type _FetchUserRecsPayload = void
type _FinishedTeamBuildingPayload = void
type _RemoveUsersFromTeamSoFarPayload = $ReadOnly<{|users: Array<Types.UserID>|}>
type _SearchPayload = $ReadOnly<{|
  query: string,
  service: Types.ServiceIdWithContact,
  limit?: number,
|}>
type _SearchResultsLoadedPayload = $ReadOnly<{|
  users: Array<Types.User>,
  query: string,
  service: Types.ServiceIdWithContact,
|}>
type _UserRecsLoadedPayload = $ReadOnly<{|users: Array<Types.User>|}>

// Action Creators
export const createAddUsersToTeamSoFar = (payload: _AddUsersToTeamSoFarPayload) => ({payload, type: addUsersToTeamSoFar})
export const createCancelTeamBuilding = (payload: _CancelTeamBuildingPayload) => ({payload, type: cancelTeamBuilding})
export const createFetchUserRecs = (payload: _FetchUserRecsPayload) => ({payload, type: fetchUserRecs})
export const createFinishedTeamBuilding = (payload: _FinishedTeamBuildingPayload) => ({payload, type: finishedTeamBuilding})
export const createRemoveUsersFromTeamSoFar = (payload: _RemoveUsersFromTeamSoFarPayload) => ({payload, type: removeUsersFromTeamSoFar})
export const createSearch = (payload: _SearchPayload) => ({payload, type: search})
export const createSearchResultsLoaded = (payload: _SearchResultsLoadedPayload) => ({payload, type: searchResultsLoaded})
export const createUserRecsLoaded = (payload: _UserRecsLoadedPayload) => ({payload, type: userRecsLoaded})

// Action Payloads
export type AddUsersToTeamSoFarPayload = $Call<typeof createAddUsersToTeamSoFar, _AddUsersToTeamSoFarPayload>
export type CancelTeamBuildingPayload = $Call<typeof createCancelTeamBuilding, _CancelTeamBuildingPayload>
export type FetchUserRecsPayload = $Call<typeof createFetchUserRecs, _FetchUserRecsPayload>
export type FinishedTeamBuildingPayload = $Call<typeof createFinishedTeamBuilding, _FinishedTeamBuildingPayload>
export type RemoveUsersFromTeamSoFarPayload = $Call<typeof createRemoveUsersFromTeamSoFar, _RemoveUsersFromTeamSoFarPayload>
export type SearchPayload = $Call<typeof createSearch, _SearchPayload>
export type SearchResultsLoadedPayload = $Call<typeof createSearchResultsLoaded, _SearchResultsLoadedPayload>
export type UserRecsLoadedPayload = $Call<typeof createUserRecsLoaded, _UserRecsLoadedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddUsersToTeamSoFarPayload
  | CancelTeamBuildingPayload
  | FetchUserRecsPayload
  | FinishedTeamBuildingPayload
  | RemoveUsersFromTeamSoFarPayload
  | SearchPayload
  | SearchResultsLoadedPayload
  | UserRecsLoadedPayload
  | {type: 'common:resetStore', payload: void}
