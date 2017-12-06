// @flow
import ShowcasedTeamInfo from './index'
import {
  checkRequestedAccess,
  getDetails,
  getTeams,
  joinTeam,
  setTeamJoinError,
  setTeamJoinSuccess,
} from '../../actions/teams/creators'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const team = routeProps.get('team')
  const description = team.description
  const memberCount = team.numMembers
  const openTeam = team.open
  const teamname = team.fqName
  const publicAdmins = team.publicAdmins || []
  const youAreInTeam = !!state.entities.getIn(['teams', 'teamnames', teamname], false)
  const youHaveRequestedAccess = !!state.entities.getIn(['teams', 'teamAccessRequestsPending', teamname], false)
  return {
    description,
    teamJoinError: state.chat.teamJoinError,
    teamJoinSuccess: state.chat.teamJoinSuccess,
    memberCount,
    openTeam,
    publicAdmins,
    teamname,
    youAreInTeam,
    youHaveRequestedAccess,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => {
  const teamname = routeProps.get('team').fqName
  return {
    _checkRequestedAccess: (teamname: string) => dispatch(checkRequestedAccess(teamname)),
    _loadTeam: (teamname: string) => dispatch(getDetails(teamname)),
    _loadTeams: () => dispatch(getTeams()),
    _onSetTeamJoinError: (error: string) => dispatch(setTeamJoinError(error)),
    _onSetTeamJoinSuccess: (success: boolean) => dispatch(setTeamJoinSuccess(success)),
    onHidden: () => dispatch(navigateUp()),
    onJoinTeam: () => dispatch(joinTeam(teamname)),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentWillMount: function() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      this.props._loadTeams()
      this.props._checkRequestedAccess()
    },
  })
)(ShowcasedTeamInfo)
