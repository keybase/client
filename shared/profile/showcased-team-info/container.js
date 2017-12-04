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
  const teamname = routeProps.get('teamname')
  return {
    description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], ''),
    teamJoinError: state.chat.teamJoinError,
    teamJoinSuccess: state.chat.teamJoinSuccess,
    memberCount: state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    openTeam: state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname, 'open'], false),
    teamname,
    youAreInTeam: !!state.entities.getIn(['teams', 'teamnames', teamname]),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _loadTeam: (teamname: string) => dispatch(getDetails(teamname)),
  _loadTeams: () => dispatch(getTeams()),
  _onSetTeamJoinError: (error: string) => dispatch(setTeamJoinError(error)),
  _onSetTeamJoinSuccess: (success: boolean) => dispatch(setTeamJoinSuccess(success)),
  onHidden: () => dispatch(navigateUp()),
  onJoinTeam: () => dispatch(joinTeam(routeProps.get('teamname'))),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      // Member count comes from loading teams in general
      this.props._loadTeams()
      console.warn('teamname is', this.props.teamname)
      this.props.youAreInTeam && this.props._loadTeam(this.props.teamname)
    },
  })
)(ShowcasedTeamInfo)
