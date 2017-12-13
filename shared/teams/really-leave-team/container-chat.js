// @flow
import * as TeamsGen from '../../actions/teams-gen'
import {connect, type TypedState} from '../../util/container'
import {Set} from 'immutable'
import {compose, branch, lifecycle, renderComponent} from 'recompose'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'
import {isSubteam} from '../../constants/teams'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const members = state.entities.getIn(['teams', 'teamNameToMembers', name], Set())
  const _lastOwner = members.size <= 1 && !isSubteam(name)
  return {
    _lastOwner,
    name,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _loadTeam: teamname => dispatch(TeamsGen.createGetDetails({teamname})),
  onClose: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(TeamsGen.createLeaveTeam({teamname: routeProps.get('teamname')}))
    dispatch(navigateTo([chatTab]))
    dispatch(TeamsGen.createGetTeams())
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
