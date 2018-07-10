// @flow
import EditAvatar, {type Props} from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as TeamsGen from '../../actions/teams-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import type {RouteProps} from '../../route-tree/render-route'
import type {Response} from 'react-native-image-picker'

const mapStateToProps = (
  state: TypedState,
  {routeProps}: RouteProps<{image: Response, sendChatNotification: boolean, teamname: string}, {}>
) => ({
  image: routeProps.get('image'),
  sendChatNotification: routeProps.get('sendChatNotification'),
  teamname: routeProps.get('teamname'),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: Props) => ({
  onClose: () => dispatch(navigateUp()),
  onSaveTeamAvatar: (
    filename: string,
    teamname: string,
    sendChatNotification: boolean,
    crop: RPCTypes.ImageCropRect
  ) => dispatch(TeamsGen.createUploadTeamAvatar({crop, filename, sendChatNotification, teamname})),
  onSaveUserAvatar: (filename: string, crop: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({crop, filename})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: Props) => ({
  onClose: dispatchProps.onClose,
  onSave: (filename: string, crop: RPCTypes.ImageCropRect, teamname: string, sendChatNotification: boolean) =>
    stateProps.teamname
      ? dispatchProps.onSaveTeamAvatar(filename, teamname, sendChatNotification, crop)
      : dispatchProps.onSaveUserAvatar(filename, crop),
  sendChatNotification: stateProps.sendChatNotification,
  teamname: stateProps.teamname,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(EditAvatar)
