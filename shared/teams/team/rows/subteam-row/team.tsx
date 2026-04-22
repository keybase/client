import * as C from '@/constants'
import type * as T from '@/constants/types'
import TeamRow from '@/teams/main/team-row'
import * as Teams from '@/stores/teams'

type Props = {
  teamID: T.Teams.TeamID
}

const SubteamTeamRow = ({teamID}: Props) => {
  const item = Teams.useTeamsState(
    C.useShallow(s => {
      const teamMeta = Teams.getTeamMeta(s, teamID)
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
