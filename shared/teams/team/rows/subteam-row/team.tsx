import * as C from '@/constants'
import type * as T from '@/constants/types'
import TeamRow from '@/teams/main/team-row'
import * as Teams from '@/stores/teams'
import {useTeamsListMap} from '@/teams/use-teams-list'

type Props = {
  teamID: T.Teams.TeamID
  teamMeta?: T.Teams.TeamMeta
}

const SubteamTeamRow = ({teamID, teamMeta: providedTeamMeta}: Props) => {
  const teamMetaByID = useTeamsListMap()
  const teamMeta = providedTeamMeta ?? teamMetaByID.get(teamID) ?? Teams.makeTeamMeta({id: teamID})
  const item = Teams.useTeamsState(
    C.useShallow(s => {
      return {
        activityLevel: s.activityLevels.teams.get(teamID) || 'none',
        badgeCount: Teams.getTeamRowBadgeCount(s.newTeamRequests, s.teamIDToResetUsers, teamID),
        id: teamID,
        isNew: s.newTeams.has(teamID),
        teamMeta,
      }
    })
  )

  return <TeamRow {...item} />
}

export default SubteamTeamRow
