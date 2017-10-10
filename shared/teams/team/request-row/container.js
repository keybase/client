// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import {connect} from 'react-redux'
import {TeamRequestRow} from '.'
import {ignoreRequest} from '../../../actions/teams/creators'
import {navigateAppend} from '../../../actions/route-tree'
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
  _onAccept: (string, string) => void,
  _onChat: (string, ?string) => void,
  _onIgnoreRequest: (name: string, username: string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onOpenProfile: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
  _onAccept: (name: string, username: string) =>
    dispatch(
      navigateAppend([
        {
          props: {teamname: name, username},
          selected: 'rolePicker',
        },
      ])
    ),
  _onChat: (username, myUsername) => {
    username && myUsername && dispatch(startConversation([username, myUsername]))
  },
  _onIgnoreRequest: (name: string, username: string) => dispatch(ignoreRequest(name, username)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    onChat: () => dispatchProps._onChat(ownProps.username, stateProps.you),
    onAccept: () => dispatchProps._onAccept(ownProps.teamname, ownProps.username),
    onIgnoreRequest: () => dispatchProps._onIgnoreRequest(ownProps.teamname, ownProps.username),
  }
}

export const ConnectedRequestRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRequestRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedRequestRow key={props.username} {...props} />
}
