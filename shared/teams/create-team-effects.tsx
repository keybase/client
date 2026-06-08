import type * as T from '@/constants/types'
import {invalidateLoadedTeams} from './use-teams-list'

export const onTeamCreated = (_teamID: T.Teams.TeamID) => {
  invalidateLoadedTeams()
}
