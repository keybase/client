import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Container from '../../util/container'
import {Service} from '../../constants/types/search'
import {privateFolderWithUsers} from '../../constants/config'
import NonUserProfile from '.'

type OwnProps = Container.RouteProps<{
  username: string
  avatar: string | null
  fullname: string
  fullUsername: string
  profileUrl: string
  serviceName: Service
}>

const mapStateToProps = (state: Container.TypedState, {routeProps}: OwnProps) => {
  const {avatar, fullname, fullUsername, profileUrl, serviceName, username} = routeProps.toObject()
  const myUsername = state.config.username
  const title = routeProps.get('username')
  return {avatar, fullUsername, fullname, myUsername, profileUrl, serviceName, title, username}
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch, {navigateUp}: OwnProps) => ({
  _onOpenPrivateFolder: (myUsername, username) => {
    if (myUsername && username) {
      dispatch(
        FsConstants.makeActionForOpenPathInFilesTab(
          FsTypes.stringToPath(privateFolderWithUsers([username, myUsername]))
        )
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

export default Container.connect(
  mapStateToProps,
  mapDispatchToProps,

  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    onOpenPrivateFolder: () =>
      dispatchProps._onOpenPrivateFolder(stateProps.myUsername, stateProps.fullUsername),
    onStartChat: () => dispatchProps._onStartChat(stateProps.fullUsername),
  })
)(NonUserProfile)
