import * as React from 'react'
import * as C from '../../constants'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as T from '../../constants/types'
import ReallyDeleteTeam from '.'

type OwnProps = {teamID: T.Teams.TeamID}

const DeleteTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID ?? T.Teams.noTeamID
  const {teamname} = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = C.useTeamsState(s => s.teamDetails.get(teamID))
  const deleteWaiting = Container.useAnyWaiting(Constants.deleteTeamWaitingKey(teamID))
  const teamMetas = C.useTeamsState(s => s.teamMeta)
  const subteamNames = teamDetails?.subteams.size
    ? [...teamDetails.subteams]
        .map(subteamID => teamMetas.get(subteamID)?.teamname ?? '')
        .filter(name => !!name)
    : undefined

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = deleteWaiting ? () => {} : _onBack
  const deleteTeam = C.useTeamsState(s => s.dispatch.deleteTeam)
  const _onDelete = React.useCallback(() => () => deleteTeam(teamID), [deleteTeam, teamID])
  const onDelete = Container.useSafeSubmit(_onDelete, !deleteWaiting)

  return (
    <ReallyDeleteTeam
      deleteWaiting={deleteWaiting}
      onBack={onBack}
      onDelete={onDelete}
      subteamNames={subteamNames}
      teamID={teamID}
      teamname={teamname}
    />
  )
}
export default DeleteTeamContainer
