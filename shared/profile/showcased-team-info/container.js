// @flow
import ShowcasedTeamInfo from './index'
import * as TeamsGen from '../../actions/teams-gen'
import * as ProfileGen from '../../actions/profile-gen'
import {publicAdminsLimit} from '../../constants/teams'
import {connect, compose, lifecycle, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const {following, username} = state.config
  if (!username || !following) {
    throw new Error('Not logged in')
  }

  const team = routeProps.get('team')
  const description = team.description
  const memberCount = team.numMembers
  const openTeam = team.open
  const teamname = team.fqName
  const youAreInTeam = !!state.entities.getIn(['teams', 'teamnames', teamname], false)
  const youHaveRequestedAccess = !!state.entities.getIn(
    ['teams', 'teamAccessRequestsPending', teamname],
    false
  )

  // If the current user's in the list of public admins, pull them out to the
  // front.
  let publicAdmins = team.publicAdmins || []
  const idx = publicAdmins.indexOf(username)
  if (idx !== -1) {
    const elem = publicAdmins.splice(idx, 1)
    publicAdmins.unshift(...elem)
  }
  // If there are more than six public admins, take the first six and mention
  // the count of the others.
  const publicAdminsOthers = publicAdmins.length > publicAdminsLimit
    ? publicAdmins.length - publicAdminsLimit
    : 0
  // Remove the public admins past the sixth.
  publicAdmins.splice(publicAdminsLimit, publicAdmins.length - publicAdminsLimit)

  return {
    description,
    following,
    teamJoinError: state.chat.teamJoinError,
    teamJoinSuccess: state.chat.teamJoinSuccess,
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
      dispatch(TeamsGen.createSetTeamJoinSuccess({success, teamname: null})),
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
    componentWillMount: function() {
      this.props._onSetTeamJoinError('')
      this.props._onSetTeamJoinSuccess(false)
      this.props._loadTeams()
      this.props._checkRequestedAccess()
    },
  })
)(ShowcasedTeamInfo)
