// @flow
import ShowcasedTeamInfo from './index'
import * as TeamsGen from '../../actions/teams-gen'
import * as ProfileGen from '../../actions/profile-gen'
import {parsePublicAdmins} from '../../util/teams'
import {isInTeam, isAccessRequestPending} from '../../constants/teams'

import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const username = state.config.username
  const following = state.config.following.toObject()
  if (!username || !following) {
    throw new Error('Not logged in')
  }

  const team = routeProps.get('team')
  const description = team.description
  const memberCount = team.numMembers
  const openTeam = team.open
  const teamname = team.fqName
  const youAreInTeam = isInTeam(state, teamname)
  const youHaveRequestedAccess = isAccessRequestPending(state, teamname)

  // If the current user's in the list of public admins, pull them out to the
  // front.
  const {publicAdmins, publicAdminsOthers} = parsePublicAdmins(team.publicAdmins || [], username)

  return {
    description,
    following,
    teamJoinError: state.teams.teamJoinError,
    teamJoinSuccess: state.teams.teamJoinSuccess,
    memberCount,
    openTeam,
    publicAdmins,
    publicAdminsOthers,
    teamname,
    youAreInTeam,
    youHaveRequestedAccess,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp, routeProps}) => {
  const teamname = routeProps.get('team').fqName
  return {
    _checkRequestedAccess: () => dispatch(TeamsGen.createCheckRequestedAccess({teamname})),
    _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
    _onSetTeamJoinError: (error: string) => dispatch(TeamsGen.createSetTeamJoinError({error})),
    _onSetTeamJoinSuccess: (success: boolean) =>
      dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname: ''})),
    onHidden: () => dispatch(navigateUp()),
    onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
    onUserClick: username => {
      dispatch(navigateUp())
      dispatch(ProfileGen.createShowUserProfile({username}))
    },
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      this.props._loadTeams()
      this.props._checkRequestedAccess()
    },
  })
)(ShowcasedTeamInfo)
