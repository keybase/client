import EditAvatar from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/profile'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyErrors, anyWaiting} from '../../constants/waiting'
import * as ImagePicker from 'expo-image-picker'

type OwnProps = Container.RouteProps<{
  createdTeam: boolean
  image: ImagePicker.ImagePickerResult
  sendChatNotification: boolean
  teamname: string
}>

const cancelledImage = {cancelled: true as const}
const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => ({
  createdTeam: Container.getRouteProps(ownProps, 'createdTeam', false),
  error: anyErrors(state, Constants.uploadAvatarWaitingKey),
  image: Container.getRouteProps(ownProps, 'image', cancelledImage),
  sendChatNotification: Container.getRouteProps(ownProps, 'sendChatNotification', false),
  submitting: anyWaiting(state, Constants.uploadAvatarWaitingKey),
  teamname: Container.getRouteProps(ownProps, 'teamname', ''),
})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  onClose: () => {
    dispatch(WaitingGen.createClearWaiting({key: Constants.uploadAvatarWaitingKey}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onSaveTeamAvatar: (
    filename: string,
    teamname: string,
    sendChatNotification,
    crop?: RPCTypes.ImageCropRect
  ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
  onSaveUserAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({crop, filename})),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => {
  let error = ''
  if (stateProps.error) {
    error =
      stateProps.error.code === RPCTypes.StatusCode.scgeneric
        ? stateProps.error.desc
        : isNetworkErr(stateProps.error.code)
        ? "We're having trouble connecting to the internet. Check your network and try again."
        : "We don't support this type of image, try a different one."
  }
  return {
    createdTeam: stateProps.createdTeam,
    error,
    image: stateProps.image,
    onClose: dispatchProps.onClose,
    onSave: (filename: string, crop?: RPCTypes.ImageCropRect) =>
      stateProps.teamname
        ? dispatchProps.onSaveTeamAvatar(filename, stateProps.teamname, stateProps.sendChatNotification, crop)
        : dispatchProps.onSaveUserAvatar(filename, crop),
    sendChatNotification: stateProps.sendChatNotification,
    submitting: stateProps.submitting,
    teamname: stateProps.teamname,
    waitingKey: Constants.uploadAvatarWaitingKey,
  }
}

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditAvatar)
