import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import {privateFolderWithUsers} from '../../constants/config'
import NonUserProfile from '.'
import {ServiceId} from 'util/platforms'

export type OwnProps = Container.RouteProps<{
  username: string
  avatar: string | null
  fullname: string
  fullUsername: string
  profileUrl: string
  serviceId: ServiceId
}>

export default Container.connect(
  (state: Container.TypedState, ownProps: OwnProps) => {
    const avatar = Container.getRouteProps(ownProps, 'avatar', '')
    const fullname = Container.getRouteProps(ownProps, 'fullname', '')
    const fullUsername = Container.getRouteProps(ownProps, 'fullUsername', '')
    const profileUrl = Container.getRouteProps(ownProps, 'profileUrl', '')
    const serviceId = Container.getRouteProps(ownProps, 'serviceId', 'keybase')
    const username = Container.getRouteProps(ownProps, 'username', '')
    const myUsername = state.config.username
    const title = username
    return {avatar, fullUsername, fullname, myUsername, profileUrl, serviceId, title, username}
  },
  (dispatch: Container.TypedDispatch) => ({
    _onOpenPrivateFolder: (myUsername: string, username: string) => {
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
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    ...dispatchProps,
    onOpenPrivateFolder: () =>
      dispatchProps._onOpenPrivateFolder(stateProps.myUsername, stateProps.fullUsername),
    onStartChat: () => dispatchProps._onStartChat(stateProps.fullUsername),
  })
)(NonUserProfile)
