import * as C from '@/constants'
import type * as T from '@/constants/types'
import TeamRow from '@/teams/main/team-row'
import {useActivityLevels} from '@/teams/common'
import {useNotifState} from '@/stores/notifications'
import * as Teams from '@/stores/teams'
import {useTeamsListMap} from '@/teams/use-teams-list'

type Props = {
  teamID: T.Teams.TeamID
  teamMeta?: T.Teams.TeamMeta
}

const SubteamTeamRow = ({teamID, teamMeta: providedTeamMeta}: Props) => {
  const teamMetaByID = useTeamsListMap()
  const teamMeta = providedTeamMeta ?? teamMetaByID.get(teamID) ?? Teams.makeTeamMeta({id: teamID})
  const {teams: activityByTeam} = useActivityLevels()
  const {newTeamRequests} = Teams.useTeamsState(
    C.useShallow(s => ({
      newTeamRequests: s.newTeamRequests,
    }))
  )
  const {isNew, teamIDToResetUsers} = useNotifState(
    C.useShallow(s => ({
      isNew: s.newTeams.has(teamID),
      teamIDToResetUsers: s.teamIDToResetUsers,
    }))
  )
  const item = {
    activityLevel: activityByTeam.get(teamID) || 'none',
    badgeCount: Teams.getTeamRowBadgeCount(newTeamRequests, teamIDToResetUsers, teamID),
    id: teamID,
    isNew,
    teamMeta,
  }

  return <TeamRow {...item} />
}

export default SubteamTeamRow
