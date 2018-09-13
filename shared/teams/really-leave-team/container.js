// @flow
import * as TeamsGen from '../../actions/teams-gen'
import {connect, type TypedState} from '../../util/container'
import {compose, branch, renderComponent} from 'recompose'
import ReallyLeaveTeam from '.'
import LastOwnerDialog from './last-owner'
import {getTeamMemberCount, isSubteam} from '../../constants/teams'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const memberCount = getTeamMemberCount(state, name)
  const _lastOwner = memberCount <= 1 && !isSubteam(name)
  return {
    _lastOwner,
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

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  branch(props => props._lastOwner, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam)
