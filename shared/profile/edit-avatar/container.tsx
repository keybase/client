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
  wizard: boolean
}>

const cancelledImage = {cancelled: true as const}

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    createdTeam: Container.getRouteProps(ownProps, 'createdTeam', false),
    error: anyErrors(state, Constants.uploadAvatarWaitingKey),
    image: Container.getRouteProps(ownProps, 'image', cancelledImage),
    sendChatNotification: Container.getRouteProps(ownProps, 'sendChatNotification', false),
    submitting: anyWaiting(state, Constants.uploadAvatarWaitingKey),
    teamname: Container.getRouteProps(ownProps, 'teamname', ''),
  }),
  dispatch => ({
    onClose: () => {
      dispatch(WaitingGen.createClearWaiting({key: Constants.uploadAvatarWaitingKey}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onSaveTeamAvatar: (
      filename: string,
      teamname: string,
      sendChatNotification: boolean,
      crop?: RPCTypes.ImageCropRect
    ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
    onSaveUserAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) =>
      dispatch(ProfileGen.createUploadAvatar({crop, filename})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    let error = ''
    if (stateProps.error) {
      error =
        stateProps.error.code === RPCTypes.StatusCode.scgeneric
          ? stateProps.error.desc
          : Container.isNetworkErr(stateProps.error.code)
          ? 'Connection lost. Please check your network and try again.'
          : 'This image format is not supported.'
    }
    return {
      createdTeam: stateProps.createdTeam,
      error,
      image: stateProps.image,
      onClose: dispatchProps.onClose,
      onSave: (filename: string, crop?: RPCTypes.ImageCropRect) =>
        stateProps.teamname
          ? dispatchProps.onSaveTeamAvatar(
              filename,
              stateProps.teamname,
              stateProps.sendChatNotification,
              crop
            )
          : dispatchProps.onSaveUserAvatar(filename, crop),
      sendChatNotification: stateProps.sendChatNotification,
      submitting: stateProps.submitting,
      teamname: stateProps.teamname,
      waitingKey: Constants.uploadAvatarWaitingKey,
      wizard: Container.getRouteProps(ownProps, 'wizard', false),
    }
  }
)(EditAvatar)
