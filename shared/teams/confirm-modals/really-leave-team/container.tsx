import * as C from '../../../constants'
import * as React from 'react'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {useTeamDetailsSubscribeMountOnly} from '../../subscriber'

type OwnProps = {teamID: Types.TeamID}

const ReallyLeaveTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID ?? Types.noTeamID
  const {teamname} = C.useTeamsState(s => Constants.getTeamMeta(s, teamID))
  const {settings, members} = C.useTeamsState(s => s.teamDetails.get(teamID) ?? Constants.emptyTeamDetails)
  const open = settings.open
  const lastOwner = C.useTeamsState(s => Constants.isLastOwner(s, teamID))
  const stillLoadingTeam = !members
  const leaving = Container.useAnyWaiting(Constants.leaveTeamWaitingKey(teamname))
  const error = Container.useAnyErrors(Constants.leaveTeamWaitingKey(teamname))
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDeleteTeam = React.useCallback(() => {
    navigateUp()
    navigateAppend({props: {teamID}, selected: 'teamDeleteTeam'})
  }, [navigateUp, navigateAppend, teamID])
  const leaveTeam = C.useTeamsState(s => s.dispatch.leaveTeam)
  const _onLeave = React.useCallback(
    (permanent: boolean) => {
      leaveTeam(teamname, permanent, 'teams')
    },
    [leaveTeam, teamname]
  )
  const _onBack = navigateUp
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
