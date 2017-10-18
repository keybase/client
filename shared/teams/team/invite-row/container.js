// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
import {TeamInviteRow} from '.'
import {navigateAppend} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  username: string,
  teamname: string,
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
  _invites: state.entities.getIn(['teams', 'teamNameToInvites', teamname]),
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname]),
  following: getFollowing(state, username),
  you: state.config.username,
})

type DispatchProps = {}

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  const user =
    stateProps._members && stateProps._members.find(member => member.username === ownProps.username)
  const type = user ? user.type : null
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    type,
  }
}

export const ConnectedInviteRow = connect(mapStateToProps, null, mergeProps)(TeamInviteRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedInviteRow key={props.username} {...props} />
}
