// @flow
import ShowcasedTeamInfo from './index'
import {getDetails} from '../../actions/teams/creators'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => ({
  description: state.entities.getIn(['teams', 'teamNameToPublicitySettings', routeProps.get('teamname'), 'description'], ''),
  memberCount: state.entities.getIn(['teams', 'teammembercounts', routeProps.get('teamname')], 0),  
  teamname: routeProps.get('teamname'),  
})

const mapDispatchToProps = (dispatch: Dispatch, {routeProps}) => ({
  _loadTeam: teamname => dispatch(getDetails(teamname)),  
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeam(this.props.teamname)
    },
  })
)(ShowcasedTeamInfo)