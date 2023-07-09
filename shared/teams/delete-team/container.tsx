import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import ReallyDeleteTeam from '.'

type OwnProps = {teamID: Types.TeamID}

const DeleteTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID ?? Types.noTeamID
  const {teamname} = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const teamDetails = Constants.useState(s => s.teamDetails.get(teamID))
  const deleteWaiting = Container.useAnyWaiting(Constants.deleteTeamWaitingKey(teamID))
  const teamMetas = Constants.useState(s => s.teamMeta)
  const subteamNames = teamDetails?.subteams.size
    ? [...teamDetails.subteams]
        .map(subteamID => teamMetas.get(subteamID)?.teamname ?? '')
        .filter(name => !!name)
    : undefined

  const dispatch = Container.useDispatch()
  const _onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onBack = deleteWaiting ? () => {} : _onBack
  const _onDelete = React.useCallback(
    () => () => dispatch(TeamsGen.createDeleteTeam({teamID})),
    [dispatch, teamID]
  )
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
