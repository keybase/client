// @flow
import NonUserProfile from './non-user-profile.render'
import {connect} from 'react-redux'
import {openInKBFS} from '../actions/kbfs'
import {privateFolderWithUsers} from '../constants/config'
import {startConversation} from '../actions/chat'

import type {TypedState} from '../constants/reducer'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const {avatar, fullname, fullUsername, profileUrl, serviceName, username} = routeProps
  const myUsername = state.config.username
  const title = routeProps.username
  return {avatar, fullname, fullUsername, myUsername, profileUrl, serviceName, title, username}
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onOpenPrivateFolder: (myUsername, username) =>
    dispatch(openInKBFS(privateFolderWithUsers([username, myUsername]))),
  onStartChat: (myUsername, username) => {
    dispatch(startConversation([username, myUsername]))
  },
})

export default connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    onOpenPrivateFolder: () =>
      dispatchProps.onOpenPrivateFolder(stateProps.myUsername, stateProps.fullUsername),
    onStartChat: () => dispatchProps.onStartChat(stateProps.myUsername, stateProps.fullUsername),
  }
})(NonUserProfile)
