// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/teams/creators'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as I from 'immutable'
import {TeamInviteRow} from '.'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  email?: string,
  id: string,
  name?: string,
  teamname: string,
  username?: string,
}

const getFollowing = (state, username: string) => {
  const followingMap = Constants.getFollowingMap(state)
  return !!followingMap[username]
}

type StateProps = {
  following: boolean,
  you: ?string,
  _invites: I.Set<Types.InviteInfo>,
  _members: I.Set<Types.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {teamname, username}: OwnProps): StateProps => ({
  _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
  following: username ? getFollowing(state, username) : false,
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
      dispatch(Creators.removeMember(email, teamname, '', ''))
    } else if (username) {
      dispatch(Creators.removeMember('', teamname, username, ''))
    } else if (name) {
      dispatch(Creators.removeMember('', teamname, '', id))
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

export const ConnectedInviteRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamInviteRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedInviteRow {...props} />
}
