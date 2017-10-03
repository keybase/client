// @flow
import * as React from 'react'
import {connect} from 'react-redux'
import {TeamRequestRow} from '.'
import {showUserProfile} from '../../../actions/profile'
import {getProfile} from '../../../actions/tracker'
import {startConversation} from '../../../actions/chat'
import {isMobile} from '../../../constants/platform'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  username: string,
  teamname: string,
}

type StateProps = {
  you: ?string,
}

const mapStateToProps = (state: TypedState): StateProps => ({
  you: state.config.username,
})

type DispatchProps = {
  onOpenProfile: (u: string) => void,
  _onChat: (string, ?string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onOpenProfile: (username: string) => {
    isMobile ? dispatch(showUserProfile(username)) : dispatch(getProfile(username, true, true))
  },
  _onChat: (username, myUsername) => {
    username && myUsername && dispatch(startConversation([username, myUsername]))
  },
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    onChat: () => dispatchProps._onChat(ownProps.username, stateProps.you),
  }
}

export const ConnectedRequestRow = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRequestRow)

export default function(i: number, props: OwnProps) {
  return <ConnectedRequestRow {...props} />
}
