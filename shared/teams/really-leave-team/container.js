// @flow
import {connect, type TypedState} from '../../util/container'
import {Set} from 'immutable'
import {compose, branch, renderComponent} from 'recompose'
import * as Creators from '../../actions/teams/creators'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const members = state.entities.getIn(['teams', 'teamNameToMembers', name], Set())
  const _lastOwner = members.size <= 1
  return {
    _lastOwner,
    name,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(Creators.leaveTeam(routeProps.get('teamname')))
    dispatch(navigateTo([teamsTab]))
    dispatch(Creators.getTeams())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props._lastOwner, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam)
