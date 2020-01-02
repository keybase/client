// TODO deprecate
import * as React from 'react'
import ShowcasedTeamInfo from './index'
import * as TeamsGen from '../../actions/teams-gen'
import * as ProfileGen from '../../actions/profile-gen'
import {parsePublicAdmins} from '../../util/teams'
import {isInTeam, isAccessRequestPending} from '../../constants/teams'
import {UserTeamShowcase} from '../../constants/types/rpc-gen'
import * as Container from '../../util/container'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  team: UserTeamShowcase
  visible: boolean
}

export default Container.connect(
  (state, {team}: OwnProps) => {
    const username = state.config.username
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
      memberCount,
      openTeam,
      publicAdmins,
      publicAdminsOthers,
      teamJoinError: state.teams.teamJoinError,
      teamJoinSuccess: state.teams.teamJoinSuccess,
      teamname,
      youAreInTeam,
      youHaveRequestedAccess,
    }
  },
  (dispatch, {team}: OwnProps) => {
    const teamname = team.fqName
    const open = team.open
    return {
      _checkRequestedAccess: () => dispatch(TeamsGen.createCheckRequestedAccess({teamname})),
      _loadTeams: () => dispatch(TeamsGen.createGetTeams()),
      _onSetTeamJoinError: (error: string) => dispatch(TeamsGen.createSetTeamJoinError({error})),
      _onSetTeamJoinSuccess: (success: boolean) =>
        dispatch(TeamsGen.createSetTeamJoinSuccess({open, success, teamname: ''})),
      onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
      onUserClick: (username: string) => {
        dispatch(ProfileGen.createShowUserProfile({username}))
      },
    }
  },
  (s, d, o) => {
    const {_onSetTeamJoinError, _onSetTeamJoinSuccess, _loadTeams, _checkRequestedAccess, ...restD} = d
    return {
      ...o,
      ...s,
      ...restD,
      load: () => {
        _onSetTeamJoinError('')
        _onSetTeamJoinSuccess(false)
        _loadTeams()
        _checkRequestedAccess()
      },
    }
  }
)(ShowcasedTeamInfo)
