// @flow
import {connect, type TypedState} from '../../util/container'
import {Set} from 'immutable'
import {compose, branch, lifecycle, renderComponent} from 'recompose'
import * as Creators from '../../actions/teams/creators'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'

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
  _loadTeam: teamname => dispatch(Creators.getDetails(teamname)),
  onClose: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(Creators.leaveTeam(routeProps.get('teamname')))
    dispatch(navigateTo([chatTab]))
    dispatch(Creators.getTeams())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props._lastOwner, renderComponent(LastOwnerDialog)),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.name)
    },
  })
)(ReallyLeaveTeam)
