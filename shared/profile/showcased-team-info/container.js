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

const mapStateToProps = (state: TypedState, {routeProps}) => {
  console.warn('routeProps', routeProps)
  const team = routeProps.get('team')
  const description = team.description
  const memberCount = team.numMembers
  const openTeam = team.openTeam
  const teamname = team.fqName
  const publicAdmins = ['cjb', 'max', 'chris', 'oconnor663', 'mlsteele', 'mikem', 'ayoubd']
  const youAreInTeam = false //state.entities ? !!state.entities.getIn(['teams', 'teamnames', teamname]) : false
  console.warn('showcased teamname is', teamname, state.chat.teamJoinError)
  return {
    description,
    teamJoinError: state.chat.teamJoinError,
    teamJoinSuccess: state.chat.teamJoinSuccess,
    memberCount,
    openTeam,
    publicAdmins,
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
