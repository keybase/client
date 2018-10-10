// @flow
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import {branch, renderComponent} from 'recompose'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {getTeamMemberCount, isSubteam, leaveTeamWaitingKey} from '../../constants/teams'
import {anyWaiting} from '../../constants/waiting'

const mapStateToProps = (state: Container.TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const memberCount = getTeamMemberCount(state, name)
  const _lastOwner = memberCount <= 1 && !isSubteam(name)
  return {
    _lastOwner,
    _leaving: anyWaiting(state, leaveTeamWaitingKey(name)),
    name,
    title: 'Confirmation',
  }
}

const mapDispatchToProps = (dispatch, {navigateUp, routeProps}) => ({
  onBack: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(TeamsGen.createLeaveTeam({context: 'teams', teamname: routeProps.get('teamname')}))
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
  Container.connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  Container.safeSubmit(['onLeave'], ['_leaving']),
  branch(props => props._lastOwner, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam)
