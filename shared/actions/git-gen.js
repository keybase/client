// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
type _CreateTeamRepoPayload = $ReadOnly<{|name: string, teamname: string, notifyTeam: boolean|}>
type _DeletePersonalRepoPayload = $ReadOnly<{|name: string|}>
type _DeleteTeamRepoPayload = $ReadOnly<{|name: string, teamname: string, notifyTeam: boolean|}>
type _LoadGitPayload = void
type _LoadedPayload = $ReadOnly<{|repos: {'[key: string]': Types.GitInfo}, errors: Array<Error>|}>
type _NavToGitPayload = $ReadOnly<{|switchTab: boolean, routeState: ?{expandedSet: I.Set<string>}|}>
type _NavigateToTeamRepoPayload = $ReadOnly<{|repoID: string, teamname: string|}>
type _RepoCreatedPayload = void
type _RepoDeletedPayload = void
type _SetErrorPayload = $ReadOnly<{|error: ?Error|}>
type _SetTeamRepoSettingsPayload = $ReadOnly<{|chatDisabled: boolean, channelName: ?string, teamname: string, repoID: string|}>

// Action Creators
export const createBadgeAppForGit = (payload: _BadgeAppForGitPayload) => ({payload, type: badgeAppForGit})
export const createCreatePersonalRepo = (payload: _CreatePersonalRepoPayload) => ({payload, type: createPersonalRepo})
export const createCreateTeamRepo = (payload: _CreateTeamRepoPayload) => ({payload, type: createTeamRepo})
export const createDeletePersonalRepo = (payload: _DeletePersonalRepoPayload) => ({payload, type: deletePersonalRepo})
export const createDeleteTeamRepo = (payload: _DeleteTeamRepoPayload) => ({payload, type: deleteTeamRepo})
export const createLoadGit = (payload: _LoadGitPayload) => ({payload, type: loadGit})
export const createLoaded = (payload: _LoadedPayload) => ({payload, type: loaded})
export const createNavToGit = (payload: _NavToGitPayload) => ({payload, type: navToGit})
export const createNavigateToTeamRepo = (payload: _NavigateToTeamRepoPayload) => ({payload, type: navigateToTeamRepo})
export const createRepoCreated = (payload: _RepoCreatedPayload) => ({payload, type: repoCreated})
export const createRepoDeleted = (payload: _RepoDeletedPayload) => ({payload, type: repoDeleted})
export const createSetError = (payload: _SetErrorPayload) => ({payload, type: setError})
export const createSetTeamRepoSettings = (payload: _SetTeamRepoSettingsPayload) => ({payload, type: setTeamRepoSettings})

// Action Payloads
export type BadgeAppForGitPayload = {|+payload: _BadgeAppForGitPayload, +type: 'git:badgeAppForGit'|}
export type CreatePersonalRepoPayload = {|+payload: _CreatePersonalRepoPayload, +type: 'git:createPersonalRepo'|}
export type CreateTeamRepoPayload = {|+payload: _CreateTeamRepoPayload, +type: 'git:createTeamRepo'|}
export type DeletePersonalRepoPayload = {|+payload: _DeletePersonalRepoPayload, +type: 'git:deletePersonalRepo'|}
export type DeleteTeamRepoPayload = {|+payload: _DeleteTeamRepoPayload, +type: 'git:deleteTeamRepo'|}
export type LoadGitPayload = {|+payload: _LoadGitPayload, +type: 'git:loadGit'|}
export type LoadedPayload = {|+payload: _LoadedPayload, +type: 'git:loaded'|}
export type NavToGitPayload = {|+payload: _NavToGitPayload, +type: 'git:navToGit'|}
export type NavigateToTeamRepoPayload = {|+payload: _NavigateToTeamRepoPayload, +type: 'git:navigateToTeamRepo'|}
export type RepoCreatedPayload = {|+payload: _RepoCreatedPayload, +type: 'git:repoCreated'|}
export type RepoDeletedPayload = {|+payload: _RepoDeletedPayload, +type: 'git:repoDeleted'|}
export type SetErrorPayload = {|+payload: _SetErrorPayload, +type: 'git:setError'|}
export type SetTeamRepoSettingsPayload = {|+payload: _SetTeamRepoSettingsPayload, +type: 'git:setTeamRepoSettings'|}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForGitPayload
  | CreatePersonalRepoPayload
  | CreateTeamRepoPayload
  | DeletePersonalRepoPayload
  | DeleteTeamRepoPayload
  | LoadGitPayload
  | LoadedPayload
  | NavToGitPayload
  | NavigateToTeamRepoPayload
  | RepoCreatedPayload
  | RepoDeletedPayload
  | SetErrorPayload
  | SetTeamRepoSettingsPayload
  | {type: 'common:resetStore', payload: null}
