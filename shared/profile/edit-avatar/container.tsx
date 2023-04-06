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

type OwnProps = Container.RouteProps<'profileEditAvatar'>

const cancelledImage = {canceled: true as const}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const {params} = ownProps.route
    const teamID = params?.teamID
    return {
      createdTeam: params?.createdTeam ?? false,
      error: anyErrors(state, Constants.uploadAvatarWaitingKey),
      image: params?.image ?? cancelledImage,
      sendChatNotification: params?.sendChatNotification ?? false,
      submitting: anyWaiting(state, Constants.uploadAvatarWaitingKey),
      teamID,
      teamname: teamID ? TeamsConstants.getTeamNameFromID(state, teamID) : undefined,
    }
  },
  dispatch => ({
    onBack: () => {
      dispatch(WaitingGen.createClearWaiting({key: Constants.uploadAvatarWaitingKey}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onClose: () => {
      dispatch(WaitingGen.createClearWaiting({key: Constants.uploadAvatarWaitingKey}))
      dispatch(RouteTreeGen.createClearModals())
    },
    onSaveTeamAvatar: (
      filename: string,
      teamname: string,
      sendChatNotification: boolean,
      crop?: RPCTypes.ImageCropRect
    ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
    onSaveUserAvatar: (filename: string, crop?: RPCTypes.ImageCropRect) =>
      dispatch(ProfileGen.createUploadAvatar({crop, filename})),
    onSaveWizardAvatar: (filename: string, crop?: Types.AvatarCrop) =>
      dispatch(TeamsGen.createSetTeamWizardAvatar({crop, filename})),
    onSkip: () => {
      dispatch(TeamsGen.createSetTeamWizardAvatar({}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {params} = ownProps.route
    let error = ''
    if (stateProps.error) {
      error =
        stateProps.error.code === RPCTypes.StatusCode.scgeneric
          ? stateProps.error.desc
          : Container.isNetworkErr(stateProps.error.code)
          ? 'Connection lost. Please check your network and try again.'
          : 'This image format is not supported.'
    }
    const wizard = params?.wizard ?? false
    const bothProps = {
      error,
      image: stateProps.image?.canceled ? undefined : stateProps.image,
      onBack: dispatchProps.onBack,
      onClose: dispatchProps.onClose,
      sendChatNotification: stateProps.sendChatNotification,
      submitting: stateProps.submitting,
      waitingKey: Constants.uploadAvatarWaitingKey,
    }
    return stateProps.teamID
      ? {
          ...bothProps,
          createdTeam: stateProps.createdTeam,
          onSave: (
            filename: string,
            crop?: RPCTypes.ImageCropRect,
            scaledWidth?: number,
            offsetLeft?: number,
            offsetTop?: number
          ) => {
            if (wizard) {
              dispatchProps.onSaveWizardAvatar(
                filename,
                crop ? {crop, offsetLeft, offsetTop, scaledWidth} : undefined
              )
            } else {
              dispatchProps.onSaveTeamAvatar(
                filename,
                stateProps.teamname!,
                stateProps.sendChatNotification,
                crop
              )
            }
          },
          onSkip: dispatchProps.onSkip,
          showBack: params?.showBack ?? false,
          teamID: stateProps.teamID,
          teamname: stateProps.teamname!,
          type: 'team' as const,
          wizard,
        }
      : {
          ...bothProps,
          onSave: dispatchProps.onSaveUserAvatar,
          type: 'profile' as const,
        }
  }
)(EditAvatar as any)
