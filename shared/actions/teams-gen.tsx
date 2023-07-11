// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/teams'

// Constants
export const resetStore = 'common:resetStore' // not a part of teams but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'teams:'
export const manageChatChannels = 'teams:manageChatChannels'
export const teamSeen = 'teams:teamSeen'

// Action Creators
/**
 * User has viewed this team. Clear related badges.
 */
export const createTeamSeen = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: teamSeen as typeof teamSeen,
})
export const createManageChatChannels = (payload: {readonly teamID: Types.TeamID}) => ({
  payload,
  type: manageChatChannels as typeof manageChatChannels,
})

// Action Payloads
export type ManageChatChannelsPayload = ReturnType<typeof createManageChatChannels>
export type TeamSeenPayload = ReturnType<typeof createTeamSeen>

// All Actions
// prettier-ignore
export type Actions =
  | ManageChatChannelsPayload
  | TeamSeenPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
