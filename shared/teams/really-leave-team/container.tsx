import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {branch, renderComponent} from 'recompose'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {isLastOwner, leaveTeamWaitingKey} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'

type OwnProps = Container.RouteProps<
  {
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => {
  const name = Container.getRouteProps(ownProps, 'teamname')
  const _lastOwner = isLastOwner(state, name)
  return {
    _lastOwner,
    _leaving: anyWaiting(state, leaveTeamWaitingKey(name)),
    name,
    title: 'Confirmation',
  }
}

const mapDispatchToProps = (dispatch, ownProps) => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onLeave: () => {
    dispatch(
      TeamsGen.createLeaveTeam({context: 'teams', teamname: Container.getRouteProps(ownProps, 'teamname')})
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _lastOwner: stateProps._lastOwner,
  _leaving: stateProps._leaving,
  name: stateProps.name,
  onBack: stateProps._leaving ? () => {} : dispatchProps.onBack,
  onLeave: dispatchProps.onLeave,
  title: stateProps.title,
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.safeSubmit(['onLeave'], ['_leaving']),
  branch((props: any) => props._lastOwner, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam as any)
