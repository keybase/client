// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/git'

// Constants
export const resetStore = 'common:resetStore' // not a part of git but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'git:'
export const badgeAppForGit = 'git:badgeAppForGit'
export const clearBadges = 'git:clearBadges'
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
type _BadgeAppForGitPayload = {readonly ids: Set<string>}
type _ClearBadgesPayload = void
type _CreatePersonalRepoPayload = {readonly name: string}
type _CreateTeamRepoPayload = {readonly name: string; readonly teamname: string; readonly notifyTeam: boolean}
type _DeletePersonalRepoPayload = {readonly name: string}
type _DeleteTeamRepoPayload = {readonly name: string; readonly teamname: string; readonly notifyTeam: boolean}
type _LoadGitPayload = void
type _LoadedPayload = {readonly repos: Map<string, Types.GitInfo>}
type _NavToGitPayload = {readonly switchTab: boolean; readonly routeState: {expandedSet: Set<string>} | null}
type _NavigateToTeamRepoPayload = {readonly repoID: string; readonly teamname: string}
type _RepoCreatedPayload = void
type _RepoDeletedPayload = void
type _SetErrorPayload = {readonly error?: Error}
type _SetTeamRepoSettingsPayload = {
  readonly chatDisabled: boolean
  readonly channelName?: string
  readonly teamname: string
  readonly repoID: string
}

// Action Creators
/**
 * clears badges in the rows
 */
export const createClearBadges = (payload: _ClearBadgesPayload): ClearBadgesPayload => ({
  payload,
  type: clearBadges,
})
export const createBadgeAppForGit = (payload: _BadgeAppForGitPayload): BadgeAppForGitPayload => ({
  payload,
  type: badgeAppForGit,
})
export const createCreatePersonalRepo = (payload: _CreatePersonalRepoPayload): CreatePersonalRepoPayload => ({
  payload,
  type: createPersonalRepo,
})
export const createCreateTeamRepo = (payload: _CreateTeamRepoPayload): CreateTeamRepoPayload => ({
  payload,
  type: createTeamRepo,
})
export const createDeletePersonalRepo = (payload: _DeletePersonalRepoPayload): DeletePersonalRepoPayload => ({
  payload,
  type: deletePersonalRepo,
})
export const createDeleteTeamRepo = (payload: _DeleteTeamRepoPayload): DeleteTeamRepoPayload => ({
  payload,
  type: deleteTeamRepo,
})
export const createLoadGit = (payload: _LoadGitPayload): LoadGitPayload => ({payload, type: loadGit})
export const createLoaded = (payload: _LoadedPayload): LoadedPayload => ({payload, type: loaded})
export const createNavToGit = (payload: _NavToGitPayload): NavToGitPayload => ({payload, type: navToGit})
export const createNavigateToTeamRepo = (payload: _NavigateToTeamRepoPayload): NavigateToTeamRepoPayload => ({
  payload,
  type: navigateToTeamRepo,
})
export const createRepoCreated = (payload: _RepoCreatedPayload): RepoCreatedPayload => ({
  payload,
  type: repoCreated,
})
export const createRepoDeleted = (payload: _RepoDeletedPayload): RepoDeletedPayload => ({
  payload,
  type: repoDeleted,
})
export const createSetError = (payload: _SetErrorPayload = Object.freeze({})): SetErrorPayload => ({
  payload,
  type: setError,
})
export const createSetTeamRepoSettings = (
  payload: _SetTeamRepoSettingsPayload
): SetTeamRepoSettingsPayload => ({payload, type: setTeamRepoSettings})

// Action Payloads
export type BadgeAppForGitPayload = {
  readonly payload: _BadgeAppForGitPayload
  readonly type: typeof badgeAppForGit
}
export type ClearBadgesPayload = {readonly payload: _ClearBadgesPayload; readonly type: typeof clearBadges}
export type CreatePersonalRepoPayload = {
  readonly payload: _CreatePersonalRepoPayload
  readonly type: typeof createPersonalRepo
}
export type CreateTeamRepoPayload = {
  readonly payload: _CreateTeamRepoPayload
  readonly type: typeof createTeamRepo
}
export type DeletePersonalRepoPayload = {
  readonly payload: _DeletePersonalRepoPayload
  readonly type: typeof deletePersonalRepo
}
export type DeleteTeamRepoPayload = {
  readonly payload: _DeleteTeamRepoPayload
  readonly type: typeof deleteTeamRepo
}
export type LoadGitPayload = {readonly payload: _LoadGitPayload; readonly type: typeof loadGit}
export type LoadedPayload = {readonly payload: _LoadedPayload; readonly type: typeof loaded}
export type NavToGitPayload = {readonly payload: _NavToGitPayload; readonly type: typeof navToGit}
export type NavigateToTeamRepoPayload = {
  readonly payload: _NavigateToTeamRepoPayload
  readonly type: typeof navigateToTeamRepo
}
export type RepoCreatedPayload = {readonly payload: _RepoCreatedPayload; readonly type: typeof repoCreated}
export type RepoDeletedPayload = {readonly payload: _RepoDeletedPayload; readonly type: typeof repoDeleted}
export type SetErrorPayload = {readonly payload: _SetErrorPayload; readonly type: typeof setError}
export type SetTeamRepoSettingsPayload = {
  readonly payload: _SetTeamRepoSettingsPayload
  readonly type: typeof setTeamRepoSettings
}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForGitPayload
  | ClearBadgesPayload
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
  | {type: 'common:resetStore', payload: {}}
