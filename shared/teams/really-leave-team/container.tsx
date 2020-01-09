import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import ReallyLeaveTeam, {Props} from '.'
import LastOwnerDialog from './last-owner'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>

const RenderLastOwner = (p: Props & {_leaving: boolean; lastOwner: boolean}) => {
  const {lastOwner, _leaving, ...rest} = p
  return lastOwner ? (
    <LastOwnerDialog
      onBack={rest.onBack}
      onDeleteTeam={rest.onDeleteTeam}
      onLeave={rest.onLeave}
      name={rest.name}
    />
  ) : (
    <ReallyLeaveTeam {...rest} />
  )
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    const {teamname} = Constants.getTeamDetails(state, teamID)
    const lastOwner = Constants.isLastOwner(state, teamID)
    return {
      _leaving: anyWaiting(state, Constants.leaveTeamWaitingKey(teamname)),
      error: Container.anyErrors(state, Constants.leaveTeamWaitingKey(teamname)),
      lastOwner,
      name: teamname,
      teamID,
    }
  },
  dispatch => ({
    _clearErrors: (teamname: string) =>
      dispatch(WaitingGen.createClearWaiting({key: Constants.leaveTeamWaitingKey(teamname)})),
    _onDeleteTeam: (teamID: Types.TeamID) => {
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {teamID}, selected: 'teamDeleteTeam'}],
        })
      )
    },
    _onLeave: (teamname: string) => {
      dispatch(
        TeamsGen.createLeaveTeam({
          context: 'teams',
          permanent: false,
          teamname,
        })
      )
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    _leaving: stateProps._leaving,
    clearErrors: () => dispatchProps._clearErrors(stateProps.name),
    error: stateProps.error?.message ?? '',
    lastOwner: stateProps.lastOwner,
    name: stateProps.name,
    onBack: stateProps._leaving ? () => {} : dispatchProps.onBack,
    onDeleteTeam: () => dispatchProps._onDeleteTeam(stateProps.teamID),
    onLeave: () => dispatchProps._onLeave(stateProps.name),
  })
)(Container.safeSubmit(['onLeave'], ['_leaving'])(RenderLastOwner))
