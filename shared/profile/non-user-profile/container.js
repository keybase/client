// @flow
import * as FsGen from '../../actions/fs-gen'
import * as FsTypes from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import {connect, type RouteProps} from '../../util/container'
import type {Service} from '../../constants/types/search'
import {privateFolderWithUsers} from '../../constants/config'
import NonUserProfile from '.'

type OwnProps = RouteProps<
  {
    username: string,
    avatar: ?string,
    fullname: string,
    fullUsername: string,
    profileUrl: string,
    serviceName: Service,
  },
  {}
>

const mapStateToProps = (state, {routeProps}) => {
  const {avatar, fullname, fullUsername, profileUrl, serviceName, username} = routeProps.toObject()
  const myUsername = state.config.username
  const title = routeProps.get('username')
  return {avatar, fullUsername, fullname, myUsername, profileUrl, serviceName, title, username}
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  _onOpenPrivateFolder: (myUsername, username) => {
    if (myUsername && username) {
      dispatch(
        FsGen.createOpenPathInFilesTab({
          path: FsTypes.stringToPath(privateFolderWithUsers([username, myUsername])),
        })
      )
    }
  },
  _onStartChat: (username: string) => {
    if (username) {
      dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'profile'}))
    }
  },
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  onOpenPrivateFolder: () =>
    dispatchProps._onOpenPrivateFolder(stateProps.myUsername, stateProps.fullUsername),
  onStartChat: () => dispatchProps._onStartChat(stateProps.fullUsername),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(NonUserProfile)
