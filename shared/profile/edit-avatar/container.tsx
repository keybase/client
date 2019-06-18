import EditAvatar from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/profile'
import {connect, getRouteProps, networkErrorCodes} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {anyErrors, anyWaiting} from '../../constants/waiting'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<
  {
    createdTeam: boolean
    image: any
    sendChatNotification: boolean
    teamname: string
  },
  {}
>

const mapStateToProps = (state, ownProps) => ({
  createdTeam: getRouteProps(ownProps, 'createdTeam'),
  error: anyErrors(state, Constants.uploadAvatarWaitingKey),
  image: getRouteProps(ownProps, 'image'),
  sendChatNotification: getRouteProps(ownProps, 'sendChatNotification') || false,
  submitting: anyWaiting(state, Constants.uploadAvatarWaitingKey),
  teamname: getRouteProps(ownProps, 'teamname'),
})

const mapDispatchToProps = dispatch => ({
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

const mergeProps = (stateProps, dispatchProps) => {
  let error = ''
  if (stateProps.error) {
    error =
      stateProps.error.code === RPCTypes.StatusCode.scgeneric
        ? stateProps.error.desc
        : networkErrorCodes.includes(stateProps.error.code)
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

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(EditAvatar)
