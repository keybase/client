// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import {connect} from 'react-redux'
import {TeamRequestRow} from '.'
import {addToTeam, ignoreRequest} from '../../../actions/teams/creators'
import {showUserProfile} from '../../../actions/profile'
import {getProfile} from '../../../actions/tracker'
import {startConversation} from '../../../actions/chat'
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
  you: ?string,
  following: boolean,
}

const mapStateToProps = (state: TypedState, {username}: OwnProps): StateProps => ({
  following: getFollowing(state, username),
  you: state.config.username,
})

type DispatchProps = {
  onOpenProfile: (u: string) => void,
  _onChat: (string, ?string) => void,
  _onAcceptRequest: (
    name: string,
    username: string,
    role: 'owners' | 'admins' | 'writers' | 'readers',
    sendChatNotification: boolean
  ) => void,
  _onIgnoreRequest: (name: string, username: string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onOpenProfile: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
  _onChat: (username, myUsername) => {
    username && myUsername && dispatch(startConversation([username, myUsername]))
  },
  _onAcceptRequest: (
    name: string,
    username: string,
    role: 'owners' | 'admins' | 'writers' | 'readers',
    sendChatNotification: boolean
  ) => dispatch(addToTeam(name, '', username, role, sendChatNotification)),
  _onIgnoreRequest: (name: string, username: string) => dispatch(ignoreRequest(name, username)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    onChat: () => dispatchProps._onChat(ownProps.username, stateProps.you),
    onAcceptRequest: (role: 'owners' | 'admins' | 'writers' | 'readers', sendChatNotification: boolean) =>
      dispatchProps._onAcceptRequest(ownProps.teamname, ownProps.username, role, sendChatNotification),
    onIgnoreRequest: () => dispatchProps._onIgnoreRequest(ownProps.teamname, ownProps.username),
  }
}

export const ConnectedRequestRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRequestRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedRequestRow {...props} />
}
