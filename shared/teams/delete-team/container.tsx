import * as React from 'react'
import * as RouterConstants from '../../constants/router2'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import ReallyDeleteTeam from '.'

type OwnProps = {teamID: Types.TeamID}

const DeleteTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID ?? Types.noTeamID
  const {teamname} = Constants.useState(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Constants.useState(s => s.teamDetails.get(teamID))
  const deleteWaiting = Container.useAnyWaiting(Constants.deleteTeamWaitingKey(teamID))
  const teamMetas = Constants.useState(s => s.teamMeta)
  const subteamNames = teamDetails?.subteams.size
    ? [...teamDetails.subteams]
        .map(subteamID => teamMetas.get(subteamID)?.teamname ?? '')
        .filter(name => !!name)
    : undefined

  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const _onBack = navigateUp
  const onBack = deleteWaiting ? () => {} : _onBack
  const deleteTeam = Constants.useState(s => s.dispatch.deleteTeam)
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
