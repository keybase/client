import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {branch, renderComponent} from 'recompose'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {isLastOwner, leaveTeamWaitingKey} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<{teamname: string}>

export default Container.compose(
  Container.connect(
    (state, ownProps: OwnProps) => {
      const name = Container.getRouteProps(ownProps, 'teamname', '')
      const _lastOwner = isLastOwner(state, name)
      return {
        _lastOwner,
        _leaving: anyWaiting(state, leaveTeamWaitingKey(name)),
        name,
        title: 'Confirmation',
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
      _lastOwner: stateProps._lastOwner,
      _leaving: stateProps._leaving,
      name: stateProps.name,
      onBack: stateProps._leaving ? () => {} : dispatchProps.onBack,
      onLeave: dispatchProps.onLeave,
      title: stateProps.title,
    })
  ),
  Container.safeSubmit(['onLeave'], ['_leaving']),
  branch((props: any) => props._lastOwner, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam as any)
