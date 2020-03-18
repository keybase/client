import * as React from 'react'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import ReallyLeaveTeam, {Props} from '.'
import LastOwnerDialog from './last-owner'
import {anyWaiting} from '../../../constants/waiting'
import {useTeamDetailsSubscribeMountOnly} from '../../subscriber'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>
type ExtraProps = {_leaving: boolean; lastOwner: boolean; stillLoadingTeam: boolean; teamID: Types.TeamID}

const RenderLastOwner = (p: Props & ExtraProps) => {
  const {lastOwner, _leaving, stillLoadingTeam, teamID, ...rest} = p
  useTeamDetailsSubscribeMountOnly(teamID)
  return lastOwner ? (
    <LastOwnerDialog
      onBack={rest.onBack}
      onDeleteTeam={rest.onDeleteTeam}
      name={rest.name}
      stillLoadingTeam={stillLoadingTeam}
    />
  ) : (
    <ReallyLeaveTeam {...rest} />
  )
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    const {teamname} = Constants.getTeamMeta(state, teamID)
    const {settings, members} = Constants.getTeamDetails(state, teamID)
    const lastOwner = Constants.isLastOwner(state, teamID)
    const stillLoadingTeam = !members
    return {
      _leaving: anyWaiting(state, Constants.leaveTeamWaitingKey(teamname)),
      error: Container.anyErrors(state, Constants.leaveTeamWaitingKey(teamname)),
      lastOwner,
      name: teamname,
      open: settings?.open,
      stillLoadingTeam,
      teamID,
    }
  },
  dispatch => ({
    _onDeleteTeam: (teamID: Types.TeamID) => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {teamID}, selected: 'teamDeleteTeam'}],
        })
      )
    },
    _onLeave: (teamname: string, permanent: boolean) => {
      dispatch(
        TeamsGen.createLeaveTeam({
          context: 'teams',
          permanent,
          teamname,
        })
      )
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    _leaving: stateProps._leaving,
    error: stateProps.error?.message ?? '',
    lastOwner: stateProps.lastOwner,
    name: stateProps.name,
    onBack: stateProps._leaving ? () => {} : dispatchProps.onBack,
    onDeleteTeam: () => dispatchProps._onDeleteTeam(stateProps.teamID),
    onLeave: (permanent: boolean) => dispatchProps._onLeave(stateProps.name, permanent),
    open: stateProps.open,
    stillLoadingTeam: stateProps.stillLoadingTeam,
    teamID: stateProps.teamID,
  })
)(Container.safeSubmit(['onLeave'], ['_leaving'])(RenderLastOwner))
