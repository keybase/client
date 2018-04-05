// @flow
import * as TeamsGen from '../../../../actions/teams-gen'
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import {amIFollowing} from '../../../../constants/selectors'
import {TeamInviteRow} from '.'
import {connect, type TypedState} from '../../../../util/container'

type OwnProps = {
  email?: string,
  id: string,
  name?: string,
  teamname: string,
  username: string,
}

type StateProps = {
  following: boolean,
  you: ?string,
  _invites: I.Set<Types.InviteInfo>,
  _members: I.Set<Types.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {teamname, username}: OwnProps): StateProps => ({
  _invites: state.teams.getIn(['teamNameToInvites', teamname], I.Set()),
  _members: state.teams.getIn(['teamNameToMembers', teamname], I.Set()),
  following: amIFollowing(state, username || ''),
  you: state.config.username,
})

type DispatchProps = {
  onCancelInvite: () => void,
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {email, name, id, teamname, username}: OwnProps
): DispatchProps => ({
  onCancelInvite: () => {
    if (email) {
      dispatch(TeamsGen.createRemoveMemberOrPendingInvite({email, teamname, username: '', inviteID: ''}))
    } else if (username) {
      dispatch(TeamsGen.createRemoveMemberOrPendingInvite({email: '', teamname, username, inviteID: ''}))
    } else if (name) {
      dispatch(TeamsGen.createRemoveMemberOrPendingInvite({email: '', teamname, username: '', inviteID: id}))
    }
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  const user =
    stateProps._invites &&
    stateProps._invites.find(
      invite => invite.username === ownProps.username || invite.email === ownProps.email
    )
  const role = user.get('role')
  return {
    ...dispatchProps,
    ...stateProps,
    label: ownProps.email || ownProps.username || ownProps.name,
    role,
  }
}

const ConnectedInviteRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamInviteRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedInviteRow {...props} />
}
