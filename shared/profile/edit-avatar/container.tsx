import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type * as ImagePicker from 'expo-image-picker'
import EditAvatar from '.'

type OwnProps = {
  image?: ImagePicker.ImagePickerAsset
  sendChatNotification?: boolean
  showBack?: boolean
  teamID?: string
  createdTeam?: boolean
  wizard?: boolean
}

const Container = (ownProps: OwnProps) => {
  const teamID = ownProps.teamID
  const createdTeam = ownProps.createdTeam ?? false
  const image = ownProps.image
  const sperror = C.Waiting.useAnyErrors(C.Profile.uploadAvatarWaitingKey)
  const sendChatNotification = ownProps.sendChatNotification ?? false
  const submitting = C.Waiting.useAnyWaiting(C.Profile.uploadAvatarWaitingKey)
  const teamname = C.useTeamsState(s => (teamID ? C.Teams.getTeamNameFromID(s, teamID) : undefined) ?? '')

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    dispatchClearWaiting(C.Profile.uploadAvatarWaitingKey)
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    dispatchClearWaiting(C.Profile.uploadAvatarWaitingKey)
    clearModals()
  }
  const uploadTeamAvatar = C.useTeamsState(s => s.dispatch.uploadTeamAvatar)
  const onSaveTeamAvatar = (
    _filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: T.RPCGen.ImageCropRect
  ) => {
    const filename = Kb.Styles.unnormalizePath(_filename)
    uploadTeamAvatar(teamname, filename, sendChatNotification, crop)
  }

  const uploadAvatar = C.useProfileState(s => s.dispatch.uploadAvatar)

  const onSaveUserAvatar = (_filename: string, crop?: T.RPCGen.ImageCropRect) => {
    const filename = Kb.Styles.unnormalizePath(_filename)
    uploadAvatar(filename, crop)
  }
  const setTeamWizardAvatar = C.useTeamsState(s => s.dispatch.setTeamWizardAvatar)
  const onSaveWizardAvatar = (_filename: string, crop?: T.Teams.AvatarCrop) => {
    const filename = Kb.Styles.unnormalizePath(_filename)
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
        : C.isNetworkErr(sperror.code)
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
    waitingKey: C.Profile.uploadAvatarWaitingKey,
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

export default Container
