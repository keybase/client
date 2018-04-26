// @flow
import * as KBFSGen from '../../actions/kbfs-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import {connect, type TypedState} from '../../util/container'
import {privateFolderWithUsers} from '../../constants/config'
import NonUserProfile from '.'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const {avatar, fullname, fullUsername, profileUrl, serviceName, username} = routeProps.toObject()
  const myUsername = state.config.username
  const title = routeProps.get('username')
  return {avatar, fullname, fullUsername, myUsername, profileUrl, serviceName, title, username}
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onBack: () => dispatch(navigateUp()),
  onOpenPrivateFolder: (myUsername, username) => {
    if (myUsername && username) {
      dispatch(KBFSGen.createOpen({path: privateFolderWithUsers([username, myUsername])}))
    }
  },
  onStartChat: (username: string) => {
    if (username) {
      dispatch(Chat2Gen.createStartConversation({participants: [username]}))
    }
  },
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  onOpenPrivateFolder: () =>
    dispatchProps.onOpenPrivateFolder(stateProps.myUsername, stateProps.fullUsername),
  onStartChat: () => dispatchProps.onStartChat(stateProps.fullUsername),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(NonUserProfile)
