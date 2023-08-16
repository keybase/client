import * as C from '../../constants'
import EditAvatar from '.'
import * as TeamsConstants from '../../constants/teams'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as T from '../../constants/types'
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
  const sperror = Container.useAnyErrors(C.uploadAvatarWaitingKey)
  const sendChatNotification = ownProps.sendChatNotification ?? false
  const submitting = Container.useAnyWaiting(C.uploadAvatarWaitingKey)
  const teamname = C.useTeamsState(
    s => (teamID ? TeamsConstants.getTeamNameFromID(s, teamID) : undefined) ?? ''
  )

  const dispatchClearWaiting = Container.useDispatchClearWaiting()
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    dispatchClearWaiting(C.uploadAvatarWaitingKey)
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    dispatchClearWaiting(C.uploadAvatarWaitingKey)
    clearModals()
  }
  const uploadTeamAvatar = C.useTeamsState(s => s.dispatch.uploadTeamAvatar)
  const onSaveTeamAvatar = (
    _filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: T.RPCGen.ImageCropRect
  ) => {
    const filename = Styles.unnormalizePath(_filename)
    uploadTeamAvatar(teamname, filename, sendChatNotification, crop)
  }

  const uploadAvatar = C.useProfileState(s => s.dispatch.uploadAvatar)

  const onSaveUserAvatar = (_filename: string, crop?: T.RPCGen.ImageCropRect) => {
    const filename = Styles.unnormalizePath(_filename)
    uploadAvatar(filename, crop)
  }
  const setTeamWizardAvatar = C.useTeamsState(s => s.dispatch.setTeamWizardAvatar)
  const onSaveWizardAvatar = (_filename: string, crop?: T.Teams.AvatarCrop) => {
    const filename = Styles.unnormalizePath(_filename)
    setTeamWizardAvatar(crop, filename)
  }
  const onSkip = () => {
    setTeamWizardAvatar()
  }

  let error = ''
  if (sperror) {
    error =
      sperror.code === T.RPCGen.StatusCode.scgeneric
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
    waitingKey: C.uploadAvatarWaitingKey,
  }
  const props = teamID
    ? {
        ...bothProps,
        createdTeam,
        onSave: (
          filename: string,
          crop?: T.RPCGen.ImageCropRect,
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
