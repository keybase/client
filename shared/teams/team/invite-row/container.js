// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
import {TeamInviteRow} from '.'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  email: string,
  teamname: string,
  username: string,
}

const getFollowing = (state, username: string) => {
  const followingMap = Constants.getFollowingMap(state)
  return !!followingMap[username]
}

type StateProps = {
  following: boolean,
  you: ?string,
  _invites: I.Set<Constants.InviteInfo>,
  _members: I.Set<Constants.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {teamname, username}: OwnProps): StateProps => ({
  _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname], I.Set()),
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname], I.Set()),
  following: getFollowing(state, username),
  you: state.config.username,
})

type DispatchProps = {
  onCancelInvite: () => void,
}

const mapDispatchToProps = (dispatch: Dispatch, {email, teamname, username}: OwnProps): DispatchProps => ({
  onCancelInvite: () =>
    dispatch(navigateAppend([{props: {email, teamname, username}, selected: 'reallyRemoveMember'}])),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  const user =
    stateProps._invites &&
    stateProps._invites.find(
      invite => invite.username === ownProps.username || invite.email === ownProps.email
    )
  const role = user.get('role')
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    role,
  }
}

export const ConnectedInviteRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamInviteRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedInviteRow key={props.email || props.username} {...props} />
}
