import EditAvatar from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/profile'
import * as TeamsConstants from '../../constants/teams'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type * as Types from '../../constants/types/teams'
import {anyErrors, anyWaiting} from '../../constants/waiting'
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
  const sperror = Container.useSelector(state => anyErrors(state, Constants.uploadAvatarWaitingKey))
  const sendChatNotification = ownProps.sendChatNotification ?? false
  const submitting = Container.useSelector(state => anyWaiting(state, Constants.uploadAvatarWaitingKey))
  const teamname =
    Container.useSelector(state => (teamID ? TeamsConstants.getTeamNameFromID(state, teamID) : undefined)) ??
    ''

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(WaitingGen.createClearWaiting({key: Constants.uploadAvatarWaitingKey}))
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onClose = () => {
    dispatch(WaitingGen.createClearWaiting({key: Constants.uploadAvatarWaitingKey}))
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSaveTeamAvatar = (
    filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop?: RPCTypes.ImageCropRect
  ) => {
    dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname}))
  }
  const onSaveUserAvatar = (filename: string, crop?: RPCTypes.ImageCropRect) => {
    dispatch(ProfileGen.createUploadAvatar({crop, filename}))
  }
  const onSaveWizardAvatar = (filename: string, crop?: Types.AvatarCrop) => {
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
