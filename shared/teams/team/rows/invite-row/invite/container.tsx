import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Constants from '../../../../../constants/teams'
import * as Container from '../../../../../util/container'
import {TeamInviteRow} from '.'
import {InviteInfo, TeamID} from '../../../../../constants/types/teams'

type OwnProps = {
  id: string
  teamID: TeamID
}

export default Container.connect(
  (state, {teamID}: OwnProps) => {
    const teamDetails = Constants.getTeamDetails(state, teamID)
    return {_invites: teamDetails.invites}
  },
  (dispatch, {teamID}: OwnProps) => ({
    _onCancelInvite: ({
      email,
      username,
      inviteID,
    }: {
      email?: string
      username?: string
      inviteID?: string
    }) => {
      dispatch(TeamsGen.createRemovePendingInvite({email, inviteID, teamID, username}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const user: InviteInfo | undefined =
      [...(stateProps._invites || [])].find(invite => invite.id === ownProps.id) || Constants.emptyInviteInfo
    if (!user) {
      // loading
      return {label: '', onCancelInvite: () => {}, role: 'reader'} as const
    }
    let onCancelInvite
    if (user.email) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          email: user.email,
        })
    } else if (user.username) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          username: user.username,
        })
    } else if (user.name || user.phone) {
      onCancelInvite = () =>
        dispatchProps._onCancelInvite({
          inviteID: ownProps.id,
        })
    }
    // TODO: can we just do this by invite ID always?

    return {
      label:
        (user.email && `[${user.email}]@email`) ||
        user.username ||
        user.name ||
        (user.phone && `${user.phone}@phone`),
      onCancelInvite,
      role: user.role,
    }
  }
)(TeamInviteRow)
