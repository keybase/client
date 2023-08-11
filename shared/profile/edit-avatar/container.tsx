import EditAvatar from '.'
import * as C from '../../constants'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/profile'
import * as TeamsConstants from '../../constants/teams'
import * as Container from '../../util/container'
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
  const teamname = TeamsConstants.useState(
    s => (teamID ? TeamsConstants.getTeamNameFromID(s, teamID) : undefined) ?? ''
  )

  const dispatchClearWaiting = Container.useDispatchClearWaiting()
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    dispatchClearWaiting(Constants.uploadAvatarWaitingKey)
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    dispatchClearWaiting(Constants.uploadAvatarWaitingKey)
    clearModals()
  }
  const uploadTeamAvatar = TeamsConstants.useState(s => s.dispatch.uploadTeamAvatar)
  const onSaveTeamAvatar = (
    _filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: RPCTypes.ImageCropRect
  ) => {
    const filename = Styles.unnormalizePath(_filename)
    uploadTeamAvatar(teamname, filename, sendChatNotification, crop)
  }

  const uploadAvatar = Constants.useState(s => s.dispatch.uploadAvatar)

  const onSaveUserAvatar = (_filename: string, crop?: RPCTypes.ImageCropRect) => {
    const filename = Styles.unnormalizePath(_filename)
    uploadAvatar(filename, crop)
  }
  const setTeamWizardAvatar = TeamsConstants.useState(s => s.dispatch.setTeamWizardAvatar)
  const onSaveWizardAvatar = (_filename: string, crop?: Types.AvatarCrop) => {
    const filename = Styles.unnormalizePath(_filename)
    setTeamWizardAvatar(crop, filename)
  }
  const onSkip = () => {
    setTeamWizardAvatar()
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
