// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCTypesGregor from '../constants/types/rpc-gregor-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of git but is handled by every reducer
export const badgeAppForGit = 'git:badgeAppForGit'
export const createPersonalRepo = 'git:createPersonalRepo'
export const createTeamRepo = 'git:createTeamRepo'
export const deletePersonalRepo = 'git:deletePersonalRepo'
export const deleteTeamRepo = 'git:deleteTeamRepo'
export const handleIncomingGregor = 'git:handleIncomingGregor'
export const loadGit = 'git:loadGit'
export const loadGitRepo = 'git:loadGitRepo'
export const navigateToTeamRepo = 'git:navigateToTeamRepo'
export const setError = 'git:setError'
export const setLoading = 'git:setLoading'
export const setTeamRepoSettings = 'git:setTeamRepoSettings'

// Payload Types
type _BadgeAppForGitPayload = $ReadOnly<{|ids: Array<string>|}>
type _CreatePersonalRepoPayload = $ReadOnly<{|name: string|}>
type _CreateTeamRepoPayload = $ReadOnly<{|
  name: string,
  teamname: string,
  notifyTeam: boolean,
|}>
type _DeletePersonalRepoPayload = $ReadOnly<{|name: string|}>
type _DeleteTeamRepoPayload = $ReadOnly<{|
  name: string,
  teamname: string,
  notifyTeam: boolean,
|}>
type _HandleIncomingGregorPayload = $ReadOnly<{|messages: Array<RPCTypesGregor.OutOfBandMessage>|}>
type _LoadGitPayload = void
type _LoadGitRepoPayload = $ReadOnly<{|
  username: ?string,
  teamname: ?string,
|}>
type _NavigateToTeamRepoPayload = $ReadOnly<{|
  repoID: string,
  teamname: string,
|}>
type _SetErrorPayload = $ReadOnly<{|error: ?Error|}>
type _SetLoadingPayload = $ReadOnly<{|loading: boolean|}>
type _SetTeamRepoSettingsPayload = $ReadOnly<{|
  chatDisabled: boolean,
  channelName: ?string,
  teamname: string,
  repoID: string,
|}>

// Action Creators
export const createBadgeAppForGit = (payload: _BadgeAppForGitPayload) => ({error: false, payload, type: badgeAppForGit})
export const createCreatePersonalRepo = (payload: _CreatePersonalRepoPayload) => ({error: false, payload, type: createPersonalRepo})
export const createCreateTeamRepo = (payload: _CreateTeamRepoPayload) => ({error: false, payload, type: createTeamRepo})
export const createDeletePersonalRepo = (payload: _DeletePersonalRepoPayload) => ({error: false, payload, type: deletePersonalRepo})
export const createDeleteTeamRepo = (payload: _DeleteTeamRepoPayload) => ({error: false, payload, type: deleteTeamRepo})
export const createHandleIncomingGregor = (payload: _HandleIncomingGregorPayload) => ({error: false, payload, type: handleIncomingGregor})
export const createLoadGit = (payload: _LoadGitPayload) => ({error: false, payload, type: loadGit})
export const createLoadGitRepo = (payload: _LoadGitRepoPayload) => ({error: false, payload, type: loadGitRepo})
export const createNavigateToTeamRepo = (payload: _NavigateToTeamRepoPayload) => ({error: false, payload, type: navigateToTeamRepo})
export const createSetError = (payload: _SetErrorPayload) => ({error: false, payload, type: setError})
export const createSetLoading = (payload: _SetLoadingPayload) => ({error: false, payload, type: setLoading})
export const createSetTeamRepoSettings = (payload: _SetTeamRepoSettingsPayload) => ({error: false, payload, type: setTeamRepoSettings})

// Action Payloads
export type BadgeAppForGitPayload = $Call<typeof createBadgeAppForGit, _BadgeAppForGitPayload>
export type CreatePersonalRepoPayload = $Call<typeof createCreatePersonalRepo, _CreatePersonalRepoPayload>
export type CreateTeamRepoPayload = $Call<typeof createCreateTeamRepo, _CreateTeamRepoPayload>
export type DeletePersonalRepoPayload = $Call<typeof createDeletePersonalRepo, _DeletePersonalRepoPayload>
export type DeleteTeamRepoPayload = $Call<typeof createDeleteTeamRepo, _DeleteTeamRepoPayload>
export type HandleIncomingGregorPayload = $Call<typeof createHandleIncomingGregor, _HandleIncomingGregorPayload>
export type LoadGitPayload = $Call<typeof createLoadGit, _LoadGitPayload>
export type LoadGitRepoPayload = $Call<typeof createLoadGitRepo, _LoadGitRepoPayload>
export type NavigateToTeamRepoPayload = $Call<typeof createNavigateToTeamRepo, _NavigateToTeamRepoPayload>
export type SetErrorPayload = $Call<typeof createSetError, _SetErrorPayload>
export type SetLoadingPayload = $Call<typeof createSetLoading, _SetLoadingPayload>
export type SetTeamRepoSettingsPayload = $Call<typeof createSetTeamRepoSettings, _SetTeamRepoSettingsPayload>

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForGitPayload
  | CreatePersonalRepoPayload
  | CreateTeamRepoPayload
  | DeletePersonalRepoPayload
  | DeleteTeamRepoPayload
  | HandleIncomingGregorPayload
  | LoadGitPayload
  | LoadGitRepoPayload
  | NavigateToTeamRepoPayload
  | SetErrorPayload
  | SetLoadingPayload
  | SetTeamRepoSettingsPayload
  | {type: 'common:resetStore', payload: void}
