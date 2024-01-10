import * as C from '@/constants'
import * as React from 'react'
import * as Container from '@/util/container'
import type * as T from '@/constants/types'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {useTeamDetailsSubscribeMountOnly} from '@/teams/subscriber'

type OwnProps = {teamID: T.Teams.TeamID}

const ReallyLeaveTeamContainer = (op: OwnProps) => {
  const teamID = op.teamID
  const {teamname} = C.useTeamsState(s => C.Teams.getTeamMeta(s, teamID))
  const {settings, members} = C.useTeamsState(s => s.teamDetails.get(teamID) ?? C.Teams.emptyTeamDetails)
  const open = settings.open
  const lastOwner = C.useTeamsState(s => C.Teams.isLastOwner(s, teamID))
  const stillLoadingTeam = !members
  const leaving = C.Waiting.useAnyWaiting(C.Teams.leaveTeamWaitingKey(teamname))
  const error = C.Waiting.useAnyErrors(C.Teams.leaveTeamWaitingKey(teamname))
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
