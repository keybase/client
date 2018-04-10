// @flow
import * as TeamsGen from '../../actions/teams-gen'
import {connect, type TypedState} from '../../util/container'
import {Set} from 'immutable'
import {compose, branch, renderComponent} from 'recompose'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {navigateTo} from '../../actions/route-tree'
import {teamsTab} from '../../constants/tabs'
import {isSubteam} from '../../constants/teams'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const members = state.teams.getIn(['teamNameToMembers', name], Set())
  const _lastOwner = members.size <= 1 && !isSubteam(name)
  return {
    _lastOwner,
    name,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  onClose: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(TeamsGen.createLeaveTeam({teamname: routeProps.get('teamname')}))
    dispatch(navigateTo([teamsTab]))
    dispatch(TeamsGen.createGetTeams())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  branch(props => props._lastOwner, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam)
