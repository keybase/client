// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/git'

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
export const navigateToTeamRepo = 'git:navigateToTeamRepo'
export const repoCreated = 'git:repoCreated'
export const repoDeleted = 'git:repoDeleted'
export const setError = 'git:setError'
export const setTeamRepoSettings = 'git:setTeamRepoSettings'

// Action Creators
/**
 * clears badges in the rows
 */
export const createClearBadges = (payload?: undefined) => ({payload, type: clearBadges as typeof clearBadges})
export const createBadgeAppForGit = (payload: {readonly ids: Set<string>}) => ({
  payload,
  type: badgeAppForGit as typeof badgeAppForGit,
})
export const createCreatePersonalRepo = (payload: {readonly name: string}) => ({
  payload,
  type: createPersonalRepo as typeof createPersonalRepo,
})
export const createCreateTeamRepo = (payload: {
  readonly name: string
  readonly teamname: string
  readonly notifyTeam: boolean
}) => ({payload, type: createTeamRepo as typeof createTeamRepo})
export const createDeletePersonalRepo = (payload: {readonly name: string}) => ({
  payload,
  type: deletePersonalRepo as typeof deletePersonalRepo,
})
export const createDeleteTeamRepo = (payload: {
  readonly name: string
  readonly teamname: string
  readonly notifyTeam: boolean
}) => ({payload, type: deleteTeamRepo as typeof deleteTeamRepo})
export const createLoadGit = (payload?: undefined) => ({payload, type: loadGit as typeof loadGit})
export const createLoaded = (payload: {readonly repos: Map<string, Types.GitInfo>}) => ({
  payload,
  type: loaded as typeof loaded,
})
export const createNavigateToTeamRepo = (payload: {readonly repoID: string; readonly teamname: string}) => ({
  payload,
  type: navigateToTeamRepo as typeof navigateToTeamRepo,
})
export const createRepoCreated = (payload?: undefined) => ({payload, type: repoCreated as typeof repoCreated})
export const createRepoDeleted = (payload?: undefined) => ({payload, type: repoDeleted as typeof repoDeleted})
export const createSetError = (payload: {readonly error?: Error} = {}) => ({
  payload,
  type: setError as typeof setError,
})
export const createSetTeamRepoSettings = (payload: {
  readonly chatDisabled: boolean
  readonly channelName?: string
  readonly teamname: string
  readonly repoID: string
}) => ({payload, type: setTeamRepoSettings as typeof setTeamRepoSettings})

// Action Payloads
export type BadgeAppForGitPayload = ReturnType<typeof createBadgeAppForGit>
export type ClearBadgesPayload = ReturnType<typeof createClearBadges>
export type CreatePersonalRepoPayload = ReturnType<typeof createCreatePersonalRepo>
export type CreateTeamRepoPayload = ReturnType<typeof createCreateTeamRepo>
export type DeletePersonalRepoPayload = ReturnType<typeof createDeletePersonalRepo>
export type DeleteTeamRepoPayload = ReturnType<typeof createDeleteTeamRepo>
export type LoadGitPayload = ReturnType<typeof createLoadGit>
export type LoadedPayload = ReturnType<typeof createLoaded>
export type NavigateToTeamRepoPayload = ReturnType<typeof createNavigateToTeamRepo>
export type RepoCreatedPayload = ReturnType<typeof createRepoCreated>
export type RepoDeletedPayload = ReturnType<typeof createRepoDeleted>
export type SetErrorPayload = ReturnType<typeof createSetError>
export type SetTeamRepoSettingsPayload = ReturnType<typeof createSetTeamRepoSettings>

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
  | NavigateToTeamRepoPayload
  | RepoCreatedPayload
  | RepoDeletedPayload
  | SetErrorPayload
  | SetTeamRepoSettingsPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
