// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RPCTypesGregor from '../constants/types/rpc-gregor-gen'
import * as Types from '../constants/types/git'

// Constants
export const resetStore = 'common:resetStore' // not a part of git but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'git:'
export const badgeAppForGit = 'git:badgeAppForGit'
export const createPersonalRepo = 'git:createPersonalRepo'
export const createTeamRepo = 'git:createTeamRepo'
export const deletePersonalRepo = 'git:deletePersonalRepo'
export const deleteTeamRepo = 'git:deleteTeamRepo'
export const loadGit = 'git:loadGit'
export const loadGitRepo = 'git:loadGitRepo'
export const loaded = 'git:loaded'
export const navToGit = 'git:navToGit'
export const navigateToTeamRepo = 'git:navigateToTeamRepo'
export const repoCreated = 'git:repoCreated'
export const repoDeleted = 'git:repoDeleted'
export const setError = 'git:setError'
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
type _LoadGitPayload = void
type _LoadGitRepoPayload = $ReadOnly<{|
  username: ?string,
  teamname: ?string,
|}>
type _LoadedPayload = $ReadOnly<{|
  repos: {'[key: string]': Types.GitInfo},
  errors: Array<Error>,
|}>
type _NavToGitPayload = $ReadOnly<{|
  switchTab: boolean,
  routeState: ?{expandedSet: I.Set<string>},
|}>
type _NavigateToTeamRepoPayload = $ReadOnly<{|
  repoID: string,
  teamname: string,
|}>
type _RepoCreatedPayload = void
type _RepoDeletedPayload = void
type _SetErrorPayload = $ReadOnly<{|error: ?Error|}>
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
export const createLoadGit = (payload: _LoadGitPayload) => ({error: false, payload, type: loadGit})
export const createLoadGitRepo = (payload: _LoadGitRepoPayload) => ({error: false, payload, type: loadGitRepo})
export const createLoaded = (payload: _LoadedPayload) => ({error: false, payload, type: loaded})
export const createNavToGit = (payload: _NavToGitPayload) => ({error: false, payload, type: navToGit})
export const createNavigateToTeamRepo = (payload: _NavigateToTeamRepoPayload) => ({error: false, payload, type: navigateToTeamRepo})
export const createRepoCreated = (payload: _RepoCreatedPayload) => ({error: false, payload, type: repoCreated})
export const createRepoDeleted = (payload: _RepoDeletedPayload) => ({error: false, payload, type: repoDeleted})
export const createSetError = (payload: _SetErrorPayload) => ({error: false, payload, type: setError})
export const createSetTeamRepoSettings = (payload: _SetTeamRepoSettingsPayload) => ({error: false, payload, type: setTeamRepoSettings})

// Action Payloads
export type BadgeAppForGitPayload = $Call<typeof createBadgeAppForGit, _BadgeAppForGitPayload>
export type CreatePersonalRepoPayload = $Call<typeof createCreatePersonalRepo, _CreatePersonalRepoPayload>
export type CreateTeamRepoPayload = $Call<typeof createCreateTeamRepo, _CreateTeamRepoPayload>
export type DeletePersonalRepoPayload = $Call<typeof createDeletePersonalRepo, _DeletePersonalRepoPayload>
export type DeleteTeamRepoPayload = $Call<typeof createDeleteTeamRepo, _DeleteTeamRepoPayload>
export type LoadGitPayload = $Call<typeof createLoadGit, _LoadGitPayload>
export type LoadGitRepoPayload = $Call<typeof createLoadGitRepo, _LoadGitRepoPayload>
export type LoadedPayload = $Call<typeof createLoaded, _LoadedPayload>
export type NavToGitPayload = $Call<typeof createNavToGit, _NavToGitPayload>
export type NavigateToTeamRepoPayload = $Call<typeof createNavigateToTeamRepo, _NavigateToTeamRepoPayload>
export type RepoCreatedPayload = $Call<typeof createRepoCreated, _RepoCreatedPayload>
export type RepoDeletedPayload = $Call<typeof createRepoDeleted, _RepoDeletedPayload>
export type SetErrorPayload = $Call<typeof createSetError, _SetErrorPayload>
export type SetTeamRepoSettingsPayload = $Call<typeof createSetTeamRepoSettings, _SetTeamRepoSettingsPayload>

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForGitPayload
  | CreatePersonalRepoPayload
  | CreateTeamRepoPayload
  | DeletePersonalRepoPayload
  | DeleteTeamRepoPayload
  | LoadGitPayload
  | LoadGitRepoPayload
  | LoadedPayload
  | NavToGitPayload
  | NavigateToTeamRepoPayload
  | RepoCreatedPayload
  | RepoDeletedPayload
  | SetErrorPayload
  | SetTeamRepoSettingsPayload
  | {type: 'common:resetStore', payload: void}
