import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Constants from '../../../../../constants/teams'
import {TeamInviteRow} from '.'
import {connect} from '../../../../../util/container'
import {_InviteInfo, TeamID} from '../../../../../constants/types/teams'

type OwnProps = {
  id: string
  teamID: TeamID
}

export default connect(
  (state, {teamID}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    return {
      _invites: teamDetails.invites,
      teamname: teamDetails.teamname,
    }
  },
  dispatch => ({
    _onCancelInvite: ({email, teamname, username, inviteID}) => {
      dispatch(TeamsGen.createRemoveMemberOrPendingInvite({email, inviteID, teamname, username}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const user: _InviteInfo | undefined =
      [...(stateProps._invites || [])].find(invite => invite.id === ownProps.id) || Constants.emptyInviteInfo
    if (!user) {
      // loading
      return {label: '', onCancelInvite: () => {}, role: 'reader'}
    }
    let onCancelInvite
    if (user.email) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          email: user.email,
          inviteID: '',
          teamname: stateProps.teamname,
          username: '',
        })
    } else if (user.username) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          email: '',
          inviteID: '',
          teamname: stateProps.teamname,
          username: user.username,
        })
    } else if (user.name || user.phone) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          email: '',
          inviteID: ownProps.id,
          teamname: stateProps.teamname,
          username: '',
        })
    }

    return {
      label: user.email || user.username || user.name || user.phone,
      onCancelInvite,
      role: user.role,
    }
  }
)(TeamInviteRow)
