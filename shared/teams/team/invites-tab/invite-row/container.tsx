import * as TeamsGen from '../../../../actions/teams-gen'
import {getTeamInvites, getTeamMembers} from '../../../../constants/teams'
import {TeamInviteRow} from '.'
import {connect} from '../../../../util/container'

type OwnProps = {
  id: string
  teamname: string
}

const mapStateToProps = (state, {teamname}: OwnProps) => {
  return {
    _invites: getTeamInvites(state, teamname),
    _members: getTeamMembers(state, teamname),
  }
}

const mapDispatchToProps = dispatch => ({
  _onCancelInvite: ({email, teamname, username, inviteID}) => {
    dispatch(TeamsGen.createRemoveMemberOrPendingInvite({email, inviteID, teamname, username}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const user = stateProps._invites.find(invite => invite.id === ownProps.id) || {}

  let onCancelInvite
  if (user.email) {
    onCancelInvite = () =>
      dispatchProps._onCancelInvite({
        email: user.email,
        inviteID: '',
        teamname: ownProps.teamname,
        username: '',
      })
  } else if (user.username) {
    onCancelInvite = () =>
      dispatchProps._onCancelInvite({
        email: '',
        inviteID: '',
        teamname: ownProps.teamname,
        username: user.username,
      })
  } else if (user.name) {
    onCancelInvite = () =>
      dispatchProps._onCancelInvite({
        email: '',
        inviteID: ownProps.id,
        teamname: ownProps.teamname,
        username: '',
      })
  }

  return {
    label: user.email || user.username || user.name,
    onCancelInvite,
    role: user.role,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TeamInviteRow)
