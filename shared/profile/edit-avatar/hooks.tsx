import * as React from 'react'
import * as C from '@/constants'
import {useProfileState} from '@/constants/profile'
import * as Teams from '@/constants/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Props} from '.'
import type {ImageInfo} from '@/util/expo-image-picker.native'

type TeamProps = {
  createdTeam?: boolean
  showBack?: boolean
  teamID: T.Teams.TeamID
  teamname: string
  type: 'team'
  wizard: boolean
  onSkip: () => void
}
type ProfileProps = {
  createdTeam?: false
  onSkip?: undefined
  teamname?: string
  teamID?: T.Teams.TeamID
  type: 'profile'
  showBack?: false
  wizard?: false
}

type Ret = {
  error: string
  image?: ImageInfo
  onBack: () => void
  onClose: () => void
  onSave: (
    filename: string,
    crop?: T.RPCGen.ImageCropRect,
    scaledWidth?: number,
    offsetLeft?: number,
    offsetTop?: number
  ) => void
  sendChatNotification?: boolean
  submitting: boolean
  waitingKey: string
} & (TeamProps | ProfileProps)

export default (ownProps: Props): Ret => {
  const teamID = ownProps.teamID
  const createdTeam = ownProps.createdTeam ?? false
  const image = ownProps.image
  const sperror = C.Waiting.useAnyErrors(C.waitingKeyProfileUploadAvatar)
  const sendChatNotification = ownProps.sendChatNotification ?? false
  const submitting = C.Waiting.useAnyWaiting(C.waitingKeyProfileUploadAvatar)
  const teamname = Teams.useTeamsState(s => (teamID ? Teams.getTeamNameFromID(s, teamID) : undefined) ?? '')

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  React.useEffect(() => {
    dispatchClearWaiting(C.waitingKeyProfileUploadAvatar)
  }, [dispatchClearWaiting])
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    dispatchClearWaiting(C.waitingKeyProfileUploadAvatar)
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    dispatchClearWaiting(C.waitingKeyProfileUploadAvatar)
    clearModals()
  }
  const uploadTeamAvatar = Teams.useTeamsState(s => s.dispatch.uploadTeamAvatar)
  const onSaveTeamAvatar = (
    _filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: T.RPCGen.ImageCropRect
  ) => {
    const filename = Kb.Styles.unnormalizePath(_filename)
    uploadTeamAvatar(teamname, filename, sendChatNotification, crop)
  }

  const uploadAvatar = useProfileState(s => s.dispatch.uploadAvatar)

  const onSaveUserAvatar = (_filename: string, crop?: T.RPCGen.ImageCropRect) => {
    const filename = Kb.Styles.unnormalizePath(_filename)
    uploadAvatar(filename, crop)
  }
  const setTeamWizardAvatar = Teams.useTeamsState(s => s.dispatch.setTeamWizardAvatar)
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
    waitingKey: C.waitingKeyProfileUploadAvatar,
  }
  return teamID
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
}
