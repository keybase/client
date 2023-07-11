// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const loadTeamTree = 'teams:loadTeamTree'
export const manageChatChannels = 'teams:manageChatChannels'
export const setMemberActivityDetails = 'teams:setMemberActivityDetails'
export const showTeamByName = 'teams:showTeamByName'
export const teamSeen = 'teams:teamSeen'

// Action Creators
/**
 * Tries to show a team with this name whether the user is in the team or not.
 * For teams we are not in:
 * - with teamsRedesign on go to external team page
 * - with teamsRedesign off noop
 */
export const createShowTeamByName = (payload: {
  readonly teamname: string
  readonly initialTab?: Types.TabKey
  readonly join?: boolean
  readonly addMembers?: boolean
}) => ({payload, type: showTeamByName as typeof showTeamByName})
/**
 * User has viewed this team. Clear related badges.
 */
export const createTeamSeen = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: teamSeen as typeof teamSeen,
})
export const createLoadTeamTree = (payload: {readonly teamID: Types.TeamID; readonly username: string}) => ({
  payload,
  type: loadTeamTree as typeof loadTeamTree,
})
export const createManageChatChannels = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: manageChatChannels as typeof manageChatChannels,
})
export const createSetMemberActivityDetails = (payload: {
  readonly activityMap: Map<Types.TeamID, number>
  readonly username: string
}) => ({payload, type: setMemberActivityDetails as typeof setMemberActivityDetails})

// Action Payloads
export type LoadTeamTreePayload = ReturnType<typeof createLoadTeamTree>
export type ManageChatChannelsPayload = ReturnType<typeof createManageChatChannels>
export type SetMemberActivityDetailsPayload = ReturnType<typeof createSetMemberActivityDetails>
export type ShowTeamByNamePayload = ReturnType<typeof createShowTeamByName>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>

// All Actions
// prettier-ignore
export type Actions =
  | LoadTeamTreePayload
  | ManageChatChannelsPayload
  | SetMemberActivityDetailsPayload
  | ShowTeamByNamePayload
  | TeamSeenPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
