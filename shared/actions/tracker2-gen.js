// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/tracker2'

// Constants
export const resetStore = 'common:resetStore' // not a part of tracker2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'tracker2:'
export const changeFollow = 'tracker2:changeFollow'
export const closeTracker = 'tracker2:closeTracker'
export const getProofSuggestions = 'tracker2:getProofSuggestions'
export const ignore = 'tracker2:ignore'
export const load = 'tracker2:load'
export const proofSuggestionsUpdated = 'tracker2:proofSuggestionsUpdated'
export const updateAssertion = 'tracker2:updateAssertion'
export const updateFollowers = 'tracker2:updateFollowers'
export const updateResult = 'tracker2:updateResult'
export const updatedDetails = 'tracker2:updatedDetails'

// Payload Types
type _ChangeFollowPayload = $ReadOnly<{|guiID: string, follow: boolean|}>
type _CloseTrackerPayload = $ReadOnly<{|guiID: string|}>
type _GetProofSuggestionsPayload = void
type _IgnorePayload = $ReadOnly<{|guiID: string|}>
type _LoadPayload = $ReadOnly<{|assertion: string, forceDisplay?: boolean, fromDaemon?: boolean, guiID: string, ignoreCache?: boolean, reason: string, inTracker: boolean|}>
type _ProofSuggestionsUpdatedPayload = $ReadOnly<{|suggestions: $ReadOnlyArray<Types.Assertion>|}>
type _UpdateAssertionPayload = $ReadOnly<{|guiID: string, type: string, value: string, sigID: string, siteURL: string, siteIcon: string, proofURL: string, state: Types.AssertionState, metas: Array<Types._AssertionMeta>, color: Types.AssertionColor|}>
type _UpdateFollowersPayload = $ReadOnly<{|username: string, following: Array<{following: boolean, followsYou: boolean, fullname: string, username: string}>, followers: Array<{following: boolean, followsYou: boolean, fullname: string, username: string}>|}>
type _UpdateResultPayload = $ReadOnly<{|guiID: string, result: Types.DetailsState, reason: ?string|}>
type _UpdatedDetailsPayload = $ReadOnly<{|guiID: string, bio: string, followThem: boolean, followersCount: number, followingCount: number, followsYou: boolean, fullname: string, location: string, username: string, teamShowcase: Array<Types._TeamShowcase>|}>

// Action Creators
export const createChangeFollow = (payload: _ChangeFollowPayload) => ({payload, type: changeFollow})
export const createCloseTracker = (payload: _CloseTrackerPayload) => ({payload, type: closeTracker})
export const createGetProofSuggestions = (payload: _GetProofSuggestionsPayload) => ({payload, type: getProofSuggestions})
export const createIgnore = (payload: _IgnorePayload) => ({payload, type: ignore})
export const createLoad = (payload: _LoadPayload) => ({payload, type: load})
export const createProofSuggestionsUpdated = (payload: _ProofSuggestionsUpdatedPayload) => ({payload, type: proofSuggestionsUpdated})
export const createUpdateAssertion = (payload: _UpdateAssertionPayload) => ({payload, type: updateAssertion})
export const createUpdateFollowers = (payload: _UpdateFollowersPayload) => ({payload, type: updateFollowers})
export const createUpdateResult = (payload: _UpdateResultPayload) => ({payload, type: updateResult})
export const createUpdatedDetails = (payload: _UpdatedDetailsPayload) => ({payload, type: updatedDetails})

// Action Payloads
export type ChangeFollowPayload = {|+payload: _ChangeFollowPayload, +type: 'tracker2:changeFollow'|}
export type CloseTrackerPayload = {|+payload: _CloseTrackerPayload, +type: 'tracker2:closeTracker'|}
export type GetProofSuggestionsPayload = {|+payload: _GetProofSuggestionsPayload, +type: 'tracker2:getProofSuggestions'|}
export type IgnorePayload = {|+payload: _IgnorePayload, +type: 'tracker2:ignore'|}
export type LoadPayload = {|+payload: _LoadPayload, +type: 'tracker2:load'|}
export type ProofSuggestionsUpdatedPayload = {|+payload: _ProofSuggestionsUpdatedPayload, +type: 'tracker2:proofSuggestionsUpdated'|}
export type UpdateAssertionPayload = {|+payload: _UpdateAssertionPayload, +type: 'tracker2:updateAssertion'|}
export type UpdateFollowersPayload = {|+payload: _UpdateFollowersPayload, +type: 'tracker2:updateFollowers'|}
export type UpdateResultPayload = {|+payload: _UpdateResultPayload, +type: 'tracker2:updateResult'|}
export type UpdatedDetailsPayload = {|+payload: _UpdatedDetailsPayload, +type: 'tracker2:updatedDetails'|}

// All Actions
// prettier-ignore
export type Actions =
  | ChangeFollowPayload
  | CloseTrackerPayload
  | GetProofSuggestionsPayload
  | IgnorePayload
  | LoadPayload
  | ProofSuggestionsUpdatedPayload
  | UpdateAssertionPayload
  | UpdateFollowersPayload
  | UpdateResultPayload
  | UpdatedDetailsPayload
  | {type: 'common:resetStore', payload: null}
