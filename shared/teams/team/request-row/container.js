// @flow
import * as React from 'react'
import {amIFollowing} from '../../../constants/selectors'
import {connect} from 'react-redux'
import {TeamRequestRow} from '.'
import {ignoreRequest} from '../../../actions/teams/creators'
import {navigateAppend} from '../../../actions/route-tree'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {createGetProfile} from '../../../actions/tracker-gen'
import {createStartConversation} from '../../../actions/chat-gen'
import {isMobile} from '../../../constants/platform'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  username: string,
  teamname: string,
}

type StateProps = {
  you: ?string,
  following: boolean,
}

const mapStateToProps = (state: TypedState, {username}: OwnProps): StateProps => ({
  following: amIFollowing(state, username),
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
    isMobile
      ? dispatch(createShowUserProfile({username}))
      : dispatch(createGetProfile({username, ignoreCache: true, forceDisplay: true}))
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
    username && myUsername && dispatch(createStartConversation({users: [username, myUsername]}))
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

const ConnectedRequestRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRequestRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedRequestRow {...props} />
}
