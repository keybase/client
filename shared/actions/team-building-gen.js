// @flow
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
type _AddUsersToTeamSoFarPayload = $ReadOnly<{|users: Array<Types.User>|}>
type _CancelTeamBuildingPayload = void
type _FetchUserRecsPayload = void
type _FetchedUserRecsPayload = $ReadOnly<{|users: Array<Types.User>|}>
type _FinishedTeamBuildingPayload = void
type _RemoveUsersFromTeamSoFarPayload = $ReadOnly<{|users: Array<Types.UserID>|}>
type _SearchPayload = $ReadOnly<{|query: string, service: Types.ServiceIdWithContact, limit?: number|}>
type _SearchResultsLoadedPayload = $ReadOnly<{|users: Array<Types.User>, query: string, service: Types.ServiceIdWithContact|}>

// Action Creators
export const createAddUsersToTeamSoFar = (payload: _AddUsersToTeamSoFarPayload) => ({payload, type: addUsersToTeamSoFar})
export const createCancelTeamBuilding = (payload: _CancelTeamBuildingPayload) => ({payload, type: cancelTeamBuilding})
export const createFetchUserRecs = (payload: _FetchUserRecsPayload) => ({payload, type: fetchUserRecs})
export const createFetchedUserRecs = (payload: _FetchedUserRecsPayload) => ({payload, type: fetchedUserRecs})
export const createFinishedTeamBuilding = (payload: _FinishedTeamBuildingPayload) => ({payload, type: finishedTeamBuilding})
export const createRemoveUsersFromTeamSoFar = (payload: _RemoveUsersFromTeamSoFarPayload) => ({payload, type: removeUsersFromTeamSoFar})
export const createSearch = (payload: _SearchPayload) => ({payload, type: search})
export const createSearchResultsLoaded = (payload: _SearchResultsLoadedPayload) => ({payload, type: searchResultsLoaded})

// Action Payloads
export type AddUsersToTeamSoFarPayload = {|+payload: _AddUsersToTeamSoFarPayload, +type: 'team-building:addUsersToTeamSoFar'|}
export type CancelTeamBuildingPayload = {|+payload: _CancelTeamBuildingPayload, +type: 'team-building:cancelTeamBuilding'|}
export type FetchUserRecsPayload = {|+payload: _FetchUserRecsPayload, +type: 'team-building:fetchUserRecs'|}
export type FetchedUserRecsPayload = {|+payload: _FetchedUserRecsPayload, +type: 'team-building:fetchedUserRecs'|}
export type FinishedTeamBuildingPayload = {|+payload: _FinishedTeamBuildingPayload, +type: 'team-building:finishedTeamBuilding'|}
export type RemoveUsersFromTeamSoFarPayload = {|+payload: _RemoveUsersFromTeamSoFarPayload, +type: 'team-building:removeUsersFromTeamSoFar'|}
export type SearchPayload = {|+payload: _SearchPayload, +type: 'team-building:search'|}
export type SearchResultsLoadedPayload = {|+payload: _SearchResultsLoadedPayload, +type: 'team-building:searchResultsLoaded'|}

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
