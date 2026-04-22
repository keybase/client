import * as React from 'react'
import * as C from '@/constants'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Props} from '.'
import type {ImageInfo} from '@/util/expo-image-picker.native'
import {fixCrop} from '@/util/crop'
import {getNextRouteAfterAvatar} from '@/teams/new-team/wizard/state'
import {useLoadedTeam} from '@/teams/team/use-loaded-team'

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
  const {teamMeta} = useLoadedTeam(teamID ?? T.Teams.noTeamID, !!teamID)
  const teamname = teamMeta.teamname
  const parentTeamID = ownProps.newTeamWizard?.parentTeamID ?? T.Teams.noTeamID
  const {teamMeta: parentTeamMeta} = useLoadedTeam(parentTeamID, parentTeamID !== T.Teams.noTeamID)

  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()
  React.useEffect(() => {
    dispatchClearWaiting(C.waitingKeyProfileUploadAvatar)
  }, [dispatchClearWaiting])
  const navigateUp = C.Router2.navigateUp
  const navigateAppend = C.Router2.navigateAppend
  const onBack = () => {
    dispatchClearWaiting(C.waitingKeyProfileUploadAvatar)
    navigateUp()
  }
  const clearModals = C.Router2.clearModals
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

  const uploadAvatar = C.useRPC(T.RPCGen.userUploadUserAvatarRpcPromise)

  const onSaveUserAvatar = (_filename: string, crop?: T.RPCGen.ImageCropRect) => {
    const filename = Kb.Styles.unnormalizePath(_filename)
    uploadAvatar([{crop: fixCrop(crop), filename}, C.waitingKeyProfileUploadAvatar], () => navigateUp(), () => {})
  }
  const parentTeamMemberCount = parentTeamMeta.memberCount
  const onSaveWizardAvatar = (_filename: string, crop?: T.Teams.AvatarCrop) => {
    if (!ownProps.newTeamWizard) {
      return
    }
    const filename = Kb.Styles.unnormalizePath(_filename)
    const wizard = {
      ...ownProps.newTeamWizard,
      avatarCrop: crop,
      avatarFilename: filename,
    }
    navigateAppend(
      {
        name: 'profileEditAvatar',
        params: {...ownProps, newTeamWizard: wizard},
      },
      true
    )
    navigateAppend(getNextRouteAfterAvatar(wizard, parentTeamMemberCount))
  }
  const onSkip = () => {
    const wizard = ownProps.newTeamWizard
    if (!wizard) {
      return
    }
    navigateAppend(
      {
        name: 'profileEditAvatar',
        params: {...ownProps, newTeamWizard: wizard},
      },
      true
    )
    navigateAppend(getNextRouteAfterAvatar(wizard, parentTeamMemberCount))
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
