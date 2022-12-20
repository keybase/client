import * as React from 'react'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {anyWaiting} from '../../../constants/waiting'
import {useTeamDetailsSubscribeMountOnly} from '../../subscriber'

type OwnProps = Container.RouteProps<'teamReallyLeaveTeam'>

const ReallyLeaveTeamContainer = (op: OwnProps) => {
  const teamID = op.route.params?.teamID ?? Types.noTeamID
  const {teamname} = Container.useSelector(state => Constants.getTeamMeta(state, teamID))
  const {settings, members} = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const open = settings.open
  const lastOwner = Container.useSelector(state => Constants.isLastOwner(state, teamID))
  const stillLoadingTeam = !members
  const leaving = Container.useSelector(state => anyWaiting(state, Constants.leaveTeamWaitingKey(teamname)))
  const error = Container.useSelector(state =>
    Container.anyErrors(state, Constants.leaveTeamWaitingKey(teamname))
  )

  const dispatch = Container.useDispatch()
  const onDeleteTeam = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {teamID}, selected: 'teamDeleteTeam'}],
      })
    )
  }, [dispatch, teamID])
  const _onLeave = React.useCallback(
    (permanent: boolean) => {
      dispatch(
        TeamsGen.createLeaveTeam({
          context: 'teams',
          permanent,
          teamname,
        })
      )
    },
    [dispatch, teamname]
  )
  const _onBack = React.useCallback(() => dispatch(RouteTreeGen.createNavigateUp()), [dispatch])
  const onBack = leaving ? () => {} : _onBack
  const onLeave = Container.useSafeSubmit(_onLeave, !leaving)

  useTeamDetailsSubscribeMountOnly(teamID)
  return lastOwner ? (
    <LastOwnerDialog
      onBack={onBack}
      onDeleteTeam={onDeleteTeam}
      name={teamname}
      stillLoadingTeam={stillLoadingTeam}
    />
  ) : (
    <ReallyLeaveTeam
      error={error?.message ?? ''}
      onBack={onBack}
      onDeleteTeam={onDeleteTeam}
      onLeave={onLeave}
      open={open}
      name={teamname}
    />
  )
}
export default ReallyLeaveTeamContainer
