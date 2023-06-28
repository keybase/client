import EditAvatar from '.'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/profile'
import * as TeamsConstants from '../../constants/teams'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/teams'
import type * as ImagePicker from 'expo-image-picker'

type OwnProps = {
  image?: ImagePicker.ImageInfo
  sendChatNotification?: boolean
  showBack?: boolean
  teamID?: string
  createdTeam?: boolean
  wizard?: boolean
}

export default (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const createdTeam = ownProps.createdTeam ?? false
  const image = ownProps.image
  const sperror = Container.useAnyErrors(Constants.uploadAvatarWaitingKey)
  const sendChatNotification = ownProps.sendChatNotification ?? false
  const submitting = Container.useAnyWaiting(Constants.uploadAvatarWaitingKey)
  const teamname =
    Container.useSelector(state => (teamID ? TeamsConstants.getTeamNameFromID(state, teamID) : undefined)) ??
    ''

  const dispatchClearWaiting = Container.useDispatchClearWaiting()
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatchClearWaiting(Constants.uploadAvatarWaitingKey)
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClose = () => {
    dispatchClearWaiting(Constants.uploadAvatarWaitingKey)
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSaveTeamAvatar = (
    _filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: RPCTypes.ImageCropRect
  ) => {
    const filename = Styles.unnormalizePath(_filename)
    dispatch(
      TeamsGen.createUploadTeamAvatar({
        crop,
        filename,
        sendChatNotification,
        teamname,
      })
    )
  }

  const uploadAvatar = Constants.useState(s => s.dispatch.uploadAvatar)

  const onSaveUserAvatar = (_filename: string, crop?: RPCTypes.ImageCropRect) => {
    const filename = Styles.unnormalizePath(_filename)
    uploadAvatar(filename, crop)
  }
  const onSaveWizardAvatar = (_filename: string, crop?: Types.AvatarCrop) => {
    const filename = Styles.unnormalizePath(_filename)
    dispatch(TeamsGen.createSetTeamWizardAvatar({crop, filename}))
  }
  const onSkip = () => {
    dispatch(TeamsGen.createSetTeamWizardAvatar({}))
  }

  let error = ''
  if (sperror) {
    error =
      sperror.code === RPCTypes.StatusCode.scgeneric
        ? sperror.desc
        : Container.isNetworkErr(sperror.code)
        ? 'Connection lost. Please check your network and try again.'
        : 'This image format is not supported.'
  }
  const wizard = ownProps.wizard ?? false
  const bothProps = {
    error,
    image,
    onBack,
    onClose,
    sendChatNotification,
    submitting,
    waitingKey: Constants.uploadAvatarWaitingKey,
  }
  const props = teamID
    ? {
        ...bothProps,
        createdTeam,
        onSave: (
          filename: string,
          crop?: RPCTypes.ImageCropRect,
          scaledWidth?: number,
          offsetLeft?: number,
          offsetTop?: number
        ) => {
          if (wizard) {
            onSaveWizardAvatar(filename, crop ? {crop, offsetLeft, offsetTop, scaledWidth} : undefined)
          } else {
            onSaveTeamAvatar(filename, teamname, sendChatNotification, crop)
          }
        },
        onSkip,
        showBack: ownProps.showBack ?? false,
        teamID,
        teamname,
        type: 'team' as const,
        wizard,
      }
    : {
        ...bothProps,
        onSave: onSaveUserAvatar,
        type: 'profile' as const,
      }
  return <EditAvatar {...props} />
}
