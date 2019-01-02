// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/profile2'

// Constants
export const resetStore = 'common:resetStore' // not a part of profile2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'profile2:'
export const closeTracker = 'profile2:closeTracker'
export const load = 'profile2:load'
export const updateResult = 'profile2:updateResult'
export const updatedDetails = 'profile2:updatedDetails'

// Payload Types
type _CloseTrackerPayload = $ReadOnly<{|guiID: string|}>
type _LoadPayload = $ReadOnly<{|assertion: string, forceDisplay: boolean, fromDaemon: boolean, guiID: string, ignoreCache?: boolean, reason: string|}>
type _UpdateResultPayload = $ReadOnly<{|guiID: string, result: RPCTypes.Identify3ResultType|}>
type _UpdatedDetailsPayload = $ReadOnly<{|guiID: string, bio: string, followThem: boolean, followersCount: number, followingCount: number, followsYou: boolean, fullname: string, location: string, publishedTeams: Array<string>|}>

// Action Creators
export const createCloseTracker = (payload: _CloseTrackerPayload) => ({payload, type: closeTracker})
export const createLoad = (payload: _LoadPayload) => ({payload, type: load})
export const createUpdateResult = (payload: _UpdateResultPayload) => ({payload, type: updateResult})
export const createUpdatedDetails = (payload: _UpdatedDetailsPayload) => ({payload, type: updatedDetails})

// Action Payloads
export type CloseTrackerPayload = {|+payload: _CloseTrackerPayload, +type: 'profile2:closeTracker'|}
export type LoadPayload = {|+payload: _LoadPayload, +type: 'profile2:load'|}
export type UpdateResultPayload = {|+payload: _UpdateResultPayload, +type: 'profile2:updateResult'|}
export type UpdatedDetailsPayload = {|+payload: _UpdatedDetailsPayload, +type: 'profile2:updatedDetails'|}

// All Actions
// prettier-ignore
export type Actions =
  | CloseTrackerPayload
  | LoadPayload
  | UpdateResultPayload
  | UpdatedDetailsPayload
  | {type: 'common:resetStore', payload: null}
