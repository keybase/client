// @flow
import * as TeamsGen from '../../actions/teams-gen'
import {connect, type TypedState} from '../../util/container'
import {compose, branch, lifecycle, renderComponent} from 'recompose'
import ReallyLeaveTeam, {Spinner} from '.'
import LastOwnerDialog from './last-owner'
import {navigateTo} from '../../actions/route-tree'
import {chatTab} from '../../constants/tabs'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const name = routeProps.get('teamname')
  const canPerform = state.entities.getIn(['teams', 'teamNameToCanPerform', name], null)
  const _canLeaveTeam = (canPerform && canPerform.leaveTeam) || false
  return {
    _canLeaveTeam,
    loaded: !!canPerform,
    name,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _loadOperations: teamname => dispatch(TeamsGen.createGetTeamOperations({teamname})),
  onClose: () => dispatch(navigateUp()),
  onLeave: () => {
    dispatch(TeamsGen.createLeaveTeam({teamname: routeProps.get('teamname')}))
    dispatch(navigateTo([chatTab]))
    dispatch(TeamsGen.createGetTeams())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      !this.props.loaded && this.props._loadOperations(this.props.name)
    },
  }),
  branch(props => !props.loaded, renderComponent(Spinner)),
  branch(props => !props._canLeaveTeam, renderComponent(LastOwnerDialog))
)(ReallyLeaveTeam)
