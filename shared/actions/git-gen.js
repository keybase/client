// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
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

// Action Creators
export const createBadgeAppForGit = (payload: $ReadOnly<{ids: Array<string>}>) => ({error: false, payload, type: badgeAppForGit})
export const createCreatePersonalRepo = (payload: $ReadOnly<{name: string}>) => ({error: false, payload, type: createPersonalRepo})
export const createCreateTeamRepo = (
  payload: $ReadOnly<{
    name: string,
    teamname: string,
    notifyTeam: boolean,
  }>
) => ({error: false, payload, type: createTeamRepo})
export const createDeletePersonalRepo = (payload: $ReadOnly<{name: string}>) => ({error: false, payload, type: deletePersonalRepo})
export const createDeleteTeamRepo = (
  payload: $ReadOnly<{
    name: string,
    teamname: string,
    notifyTeam: boolean,
  }>
) => ({error: false, payload, type: deleteTeamRepo})
export const createHandleIncomingGregor = (payload: $ReadOnly<{messages: Array<RPCTypesGregor.OutOfBandMessage>}>) => ({error: false, payload, type: handleIncomingGregor})
export const createLoadGit = () => ({error: false, payload: undefined, type: loadGit})
export const createLoadGitRepo = (
  payload: $ReadOnly<{
    username: ?string,
    teamname: ?string,
  }>
) => ({error: false, payload, type: loadGitRepo})
export const createNavigateToTeamRepo = (
  payload: $ReadOnly<{
    repoID: string,
    teamname: string,
  }>
) => ({error: false, payload, type: navigateToTeamRepo})
export const createSetError = (payload: $ReadOnly<{error: ?Error}>) => ({error: false, payload, type: setError})
export const createSetLoading = (payload: $ReadOnly<{loading: boolean}>) => ({error: false, payload, type: setLoading})
export const createSetTeamRepoSettings = (
  payload: $ReadOnly<{
    chatDisabled: boolean,
    channelName: ?string,
    teamname: string,
    repoID: string,
  }>
) => ({error: false, payload, type: setTeamRepoSettings})

// Action Payloads
export type BadgeAppForGitPayload = More.ReturnType<typeof createBadgeAppForGit>
export type CreatePersonalRepoPayload = More.ReturnType<typeof createCreatePersonalRepo>
export type CreateTeamRepoPayload = More.ReturnType<typeof createCreateTeamRepo>
export type DeletePersonalRepoPayload = More.ReturnType<typeof createDeletePersonalRepo>
export type DeleteTeamRepoPayload = More.ReturnType<typeof createDeleteTeamRepo>
export type HandleIncomingGregorPayload = More.ReturnType<typeof createHandleIncomingGregor>
export type LoadGitPayload = More.ReturnType<typeof createLoadGit>
export type LoadGitRepoPayload = More.ReturnType<typeof createLoadGitRepo>
export type NavigateToTeamRepoPayload = More.ReturnType<typeof createNavigateToTeamRepo>
export type SetErrorPayload = More.ReturnType<typeof createSetError>
export type SetLoadingPayload = More.ReturnType<typeof createSetLoading>
export type SetTeamRepoSettingsPayload = More.ReturnType<typeof createSetTeamRepoSettings>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createBadgeAppForGit>
  | More.ReturnType<typeof createCreatePersonalRepo>
  | More.ReturnType<typeof createCreateTeamRepo>
  | More.ReturnType<typeof createDeletePersonalRepo>
  | More.ReturnType<typeof createDeleteTeamRepo>
  | More.ReturnType<typeof createHandleIncomingGregor>
  | More.ReturnType<typeof createLoadGit>
  | More.ReturnType<typeof createLoadGitRepo>
  | More.ReturnType<typeof createNavigateToTeamRepo>
  | More.ReturnType<typeof createSetError>
  | More.ReturnType<typeof createSetLoading>
  | More.ReturnType<typeof createSetTeamRepoSettings>
  | {type: 'common:resetStore', payload: void}
