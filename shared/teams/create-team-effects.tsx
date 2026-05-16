import type * as T from '@/constants/types'
import {invalidateLoadedTeams} from '@/teams/use-teams-list'

export const onTeamCreated = (_teamID: T.Teams.TeamID) => {
  invalidateLoadedTeams()
}
