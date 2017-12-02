// @flow
import ShowcasedTeamInfo from './index'
import {getDetails, getTeams} from '../../actions/teams/creators'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  /// XXX is the selected user already in this team?
  description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', routeProps.get('teamname'), 'description'], ''),
  memberCount: state.entities.getIn(['teams', 'teammembercounts', routeProps.get('teamname')], 0),  
  teamname: routeProps.get('teamname'),  
})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => ({
  _loadTeam: teamname => dispatch(getDetails(teamname)),
  _loadTeams: () => dispatch(getTeams()),  
  onHidden: () => dispatch(navigateUp()),  
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      // Member count comes from loading teams in general
      this.props._loadTeams()
      this.props._loadTeam(this.props.teamname)
    },
  })
)(ShowcasedTeamInfo)