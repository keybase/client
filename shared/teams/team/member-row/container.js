// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import * as Constants from '../../../constants/teams'
import * as I from 'immutable'
import {TeamMemberRow} from '.'
import {showUserProfile} from '../../../actions/profile'
import {getProfile} from '../../../actions/tracker'
import {isMobile} from '../../../constants/platform'

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
  _members: I.Set<Constants.MemberInfo>,
}

const mapStateToProps = (state: TypedState, {teamname, username}: OwnProps): StateProps => ({
  following: getFollowing(state, username),
  you: state.config.username,
  _members: state.entities.getIn(['teams', 'teamNameToMembers', teamname]),
})

type DispatchProps = {
  onOpenProfile: (u: string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onOpenProfile: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
})

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

export const ConnectedMemberRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamMemberRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedMemberRow key={props.username} {...props} />
}
