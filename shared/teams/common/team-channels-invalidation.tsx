import type * as T from '@/constants/types'

type Invalidator = (teamID: T.Teams.TeamID) => void

// Creating or deleting a channel fires no teamChangedByID, so the team channel
// cache has to be dropped by hand. This indirection exists so the chat-side
// create-channel screen can trigger it without importing anything from teams:
// teams/common sits in a require cycle (channel-hooks -> @/constants ->
// constants/router -> router-v2/routes -> chat/routes -> teams/common), and a
// chat -> teams import there has broken team rendering on iOS before. Keep this
// module a leaf: type-only imports.
const invalidators = new Set<Invalidator>()

export const registerTeamChannelsInvalidator = (invalidator: Invalidator) => {
  invalidators.add(invalidator)
  return () => {
    invalidators.delete(invalidator)
  }
}

export const invalidateTeamChannels = (teamID: T.Teams.TeamID) => {
  invalidators.forEach(invalidator => invalidator(teamID))
}
