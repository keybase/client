import * as React from 'react'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import ReallyLeaveTeam, {Props} from '.'
import LastOwnerDialog from './last-owner'
import * as Constants from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{teamname: string}>

const RenderLastOwner = (p: Props & {_leaving: boolean; lastOwner: boolean}) => {
  const {lastOwner, _leaving, ...rest} = p
  return lastOwner ? <LastOwnerDialog {...rest} /> : <ReallyLeaveTeam {...rest} />
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const name = Container.getRouteProps(ownProps, 'teamname', '')
    const lastOwner = Constants.isLastOwner(state, name)
    return {
      _leaving: anyWaiting(state, Constants.leaveTeamWaitingKey(name)),
      lastOwner,
      name,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onLeave: () => {
      dispatch(
        TeamsGen.createLeaveTeam({
          context: 'teams',
          teamname: Container.getRouteProps(ownProps, 'teamname', ''),
        })
      )
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    _leaving: stateProps._leaving,
    lastOwner: stateProps.lastOwner,
    name: stateProps.name,
    onBack: stateProps._leaving ? () => {} : dispatchProps.onBack,
    onLeave: dispatchProps.onLeave,
  })
)(Container.safeSubmit(['onLeave'], ['_leaving'])(RenderLastOwner))
