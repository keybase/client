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
  console.warn('showcased teamname is', teamname)
  return {
    description: 'foo', //state.entities.getIn(['teams', 'teamNameToPublicitySettings', teamname, 'description'], ''),
    teamJoinError: state.chat.teamJoinError,
    teamJoinSuccess: state.chat.teamJoinSuccess,
    memberCount: 2,//state.entities.getIn(['teams', 'teammembercounts', teamname], 0),
    openTeam: true,//state.entities.getIn(['teams', 'teamNameToTeamSettings', teamname, 'open'], false),
    teamname,
    youAreInTeam: false,//!!state.entities.getIn(['teams', 'teamnames', teamname]),
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
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      // Member count comes from loading teams in general
      this.props._loadTeams()
      console.warn('teamname is', this.props.teamname)
      this.props.youAreInTeam && this.props._loadTeam(this.props.teamname)
    },
  })
)(ShowcasedTeamInfo)
