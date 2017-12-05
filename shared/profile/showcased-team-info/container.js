// @flow
import ShowcasedTeamInfo from './index'
import {
  getDetails,
  getTeams,
  joinTeam,
  setTeamJoinError,
  setTeamJoinSuccess,
} from '../../actions/teams/creators'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, ownProps) => {
  console.warn('ownProps are', ownProps, state)
  const teamname = ownProps.teamname || ownProps.routeProps.get('teamname')
  const description = ownProps.description !== null ? ownProps.description : ownProps.routeProps.get('description')
  const memberCount = ownProps.memberCount || ownProps.routeProps.get('memberCount')
  const openTeam = ownProps.openTeam !== null ? ownProps.openTeam : ownProps.routeProps.get('openTeam')
  const youAreInTeam = false //state.entities ? !!state.entities.getIn(['teams', 'teamnames', teamname]) : false
  console.warn('showcased teamname is', teamname, state.chat.teamJoinError)
  return {
    description,
    teamJoinError: state.chat.teamJoinError,
    teamJoinSuccess: state.chat.teamJoinSuccess,
    memberCount,
    openTeam,
    teamname,
    youAreInTeam,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, ownProps) => {
  const teamname = ownProps.teamname || ownProps.routeProps.get('teamname')
  return {
    _loadTeam: (teamname: string) => dispatch(getDetails(teamname)),
    _loadTeams: () => dispatch(getTeams()),
    _onSetTeamJoinError: (error: string) => dispatch(setTeamJoinError(error)),
    _onSetTeamJoinSuccess: (success: boolean) => dispatch(setTeamJoinSuccess(success)),
    onHidden: () => dispatch(ownProps.navigateUp()),
    onJoinTeam: () => dispatch(joinTeam(teamname)),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      console.warn('mounting component for', this.props.teamname)
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      this.props._loadTeams()
    },
  })
)(ShowcasedTeamInfo)
